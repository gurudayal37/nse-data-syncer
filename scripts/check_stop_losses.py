"""
Daily stop-loss monitor for active strategy holdings.

Priority:
  1. If web/src/data/monthly_positions.json has an entry for the current month,
     use those symbols and actual entry prices (filled in from Dhan after buying).
  2. Otherwise fall back to strategy_picks.json picks + DB open on first trading day.

Stop rules (checked in order each day):
  1. GTT gap-down:  today's open  <= entry * 0.85 → exited at open that day
  2. GTT intraday:  today's low   <= entry * 0.85 → exited at ~entry * 0.85
  3. Close stop:    today's close <= entry * 0.90 → exit at next morning's open
"""

import json
import os
import sys
from datetime import date, datetime, timedelta
import pandas as pd
from sqlalchemy import text
from dotenv import load_dotenv

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(base_dir, 'web', '.env'))
sys.path.append(base_dir)
from app.database import DatabaseManager

CLOSE_STOP_PCT = -0.10
GTT_STOP_PCT   = -0.15


def next_weekday(d: date) -> date:
    candidate = d + timedelta(days=1)
    while candidate.weekday() >= 5:
        candidate += timedelta(days=1)
    return candidate


def load_manual_positions(current_month: str):
    """Return list of {symbol, name, entry_price} for current_month, or None."""
    path = os.path.join(base_dir, 'web', 'src', 'data', 'monthly_positions.json')
    if not os.path.exists(path):
        return None
    with open(path) as f:
        data = json.load(f)
    month_data = data.get(current_month)
    if not month_data:
        return None
    return month_data


def main():
    today = date.today()
    current_month = today.strftime('%Y-%m')

    # --- Try manual positions first ---
    manual = load_manual_positions(current_month)

    db = DatabaseManager()
    session = db.Session()

    # Most recent trading day with data
    latest_date = session.execute(text("SELECT MAX(date) FROM daily_prices")).scalar()
    print(f"Latest price date: {latest_date}")

    alerts = {}

    if manual:
        print(f"Using manual positions for {current_month} ({len(manual['positions'])} stocks)")
        positions = manual['positions']
        symbols = [p['symbol'] for p in positions]

        # Get stock IDs
        id_rows = session.execute(
            text("SELECT id, nse_symbol FROM stocks WHERE nse_symbol IN :syms"),
            {'syms': tuple(symbols)}
        ).fetchall()
        sym_to_id = {r[1]: r[0] for r in id_rows}
        ids = [sym_to_id[s] for s in symbols if s in sym_to_id]

        # Current OHLC prices for latest date
        price_rows = session.execute(
            text("SELECT stock_id, open_price, low_price, close_price FROM daily_prices WHERE stock_id IN :ids AND date = :dt"),
            {'ids': tuple(ids), 'dt': latest_date}
        ).fetchall()
        price_map = {r[0]: {'open': float(r[1]) if r[1] else None,
                             'low':  float(r[2]) if r[2] else None,
                             'close': float(r[3]) if r[3] else None}
                     for r in price_rows}
        id_to_sym = {v: k for k, v in sym_to_id.items()}

        strategy_alerts = []
        for rank, pos in enumerate(positions, 1):
            sym = pos['symbol']
            sid = sym_to_id.get(sym)
            entry_price = float(pos['entry_price'])
            prices = price_map.get(sid) if sid else None
            if prices is None or prices['close'] is None:
                print(f"  Warning: no price data for {sym}")
                continue

            open_p  = prices['open']
            low_p   = prices['low']
            close_p = prices['close']

            gtt_price   = entry_price * (1 + GTT_STOP_PCT)
            close_trigger = entry_price * (1 + CLOSE_STOP_PCT)

            stop_hit  = False
            stop_type = None

            if open_p is not None and open_p <= gtt_price:
                stop_hit  = True
                stop_type = 'gtt_gap_down'
                ret = (open_p - entry_price) / entry_price
            elif low_p is not None and low_p <= gtt_price:
                stop_hit  = True
                stop_type = 'gtt_intraday'
                ret = GTT_STOP_PCT
            elif close_p <= close_trigger:
                stop_hit  = True
                stop_type = 'close_stop'
                ret = (close_p - entry_price) / entry_price
            else:
                ret = (close_p - entry_price) / entry_price

            strategy_alerts.append({
                'rank':          rank,
                'symbol':        sym,
                'name':          pos.get('name', sym),
                'entry_date':    manual.get('entry_date', f'{current_month}-01'),
                'entry_price':   entry_price,
                'current_close': round(close_p, 2),
                'current_date':  str(latest_date),
                'return_pct':    round(ret * 100, 2),
                'stop_hit':      stop_hit,
                'stop_type':     stop_type,
            })

        strategy_alerts.sort(key=lambda x: x['return_pct'])
        alerts['momentum'] = strategy_alerts
        source = 'manual'

    else:
        # Fall back to strategy_picks.json + DB open prices
        print(f"No manual positions for {current_month} — using strategy_picks.json")
        picks_path = os.path.join(base_dir, 'web', 'src', 'data', 'strategy_picks.json')
        if not os.path.exists(picks_path):
            print("strategy_picks.json not found.")
            session.close()
            return

        with open(picks_path) as f:
            picks_data = json.load(f)

        month_start = today.replace(day=1)
        entry_date = session.execute(
            text("SELECT MIN(date) FROM daily_prices WHERE date >= :ms"),
            {'ms': month_start.isoformat()}
        ).scalar()

        if not entry_date:
            print("No price data for current month.")
            session.close()
            return

        print(f"Entry date (first trading day): {entry_date}")

        for strategy_key, strategy in picks_data['picks'].items():
            stocks = strategy['stocks']
            symbols = [s['symbol'] for s in stocks]
            if not symbols:
                continue

            id_rows = session.execute(
                text("SELECT id, nse_symbol FROM stocks WHERE nse_symbol IN :syms AND is_active = true"),
                {'syms': tuple(symbols)}
            ).fetchall()
            sym_to_id = {r[1]: r[0] for r in id_rows}
            ids = list(sym_to_id.values())
            if not ids:
                continue

            entry_rows = session.execute(
                text("SELECT stock_id, open_price FROM daily_prices WHERE stock_id IN :ids AND date = :dt"),
                {'ids': tuple(ids), 'dt': entry_date}
            ).fetchall()
            entry_map = {r[0]: float(r[1]) for r in entry_rows}

            price_rows = session.execute(
                text("SELECT stock_id, open_price, low_price, close_price FROM daily_prices WHERE stock_id IN :ids AND date = :dt"),
                {'ids': tuple(ids), 'dt': latest_date}
            ).fetchall()
            price_map = {r[0]: {'open': float(r[1]) if r[1] else None,
                                 'low':  float(r[2]) if r[2] else None,
                                 'close': float(r[3]) if r[3] else None}
                         for r in price_rows}

            strategy_alerts = []
            for pick in stocks:
                sym = pick['symbol']
                sid = sym_to_id.get(sym)
                if not sid:
                    continue
                entry_price = entry_map.get(sid)
                prices = price_map.get(sid)
                if not entry_price or not prices or prices['close'] is None:
                    continue

                open_p  = prices['open']
                low_p   = prices['low']
                close_p = prices['close']

                gtt_price     = entry_price * (1 + GTT_STOP_PCT)
                close_trigger = entry_price * (1 + CLOSE_STOP_PCT)

                stop_hit  = False
                stop_type = None

                if open_p is not None and open_p <= gtt_price:
                    stop_hit  = True
                    stop_type = 'gtt_gap_down'
                    ret = (open_p - entry_price) / entry_price
                elif low_p is not None and low_p <= gtt_price:
                    stop_hit  = True
                    stop_type = 'gtt_intraday'
                    ret = GTT_STOP_PCT
                elif close_p <= close_trigger:
                    stop_hit  = True
                    stop_type = 'close_stop'
                    ret = (close_p - entry_price) / entry_price
                else:
                    ret = (close_p - entry_price) / entry_price

                strategy_alerts.append({
                    'rank':          pick['rank'],
                    'symbol':        sym,
                    'name':          pick.get('name', sym),
                    'entry_date':    str(entry_date),
                    'entry_price':   round(entry_price, 2),
                    'current_close': round(close_p, 2),
                    'current_date':  str(latest_date),
                    'return_pct':    round(ret * 100, 2),
                    'stop_hit':      stop_hit,
                    'stop_type':     stop_type,
                })

            strategy_alerts.sort(key=lambda x: x['return_pct'])
            alerts[strategy_key] = strategy_alerts

        source = 'picks_json'

    session.close()

    hits = sum(sum(1 for a in v if a['stop_hit']) for v in alerts.values())
    next_trading_day = next_weekday(pd.Timestamp(latest_date).date()).isoformat()

    output = {
        'generated_at':    datetime.now().isoformat(timespec='seconds'),
        'current_month':   current_month,
        'source':          source,
        'latest_date':     str(latest_date),
        'next_trading_day': next_trading_day,
        'close_stop_pct':  CLOSE_STOP_PCT * 100,
        'gtt_stop_pct':    GTT_STOP_PCT * 100,
        'total_stop_hits': hits,
        'alerts':          alerts,
    }

    out_path = os.path.join(base_dir, 'web', 'src', 'data', 'stop_alerts.json')
    with open(out_path, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\nWrote {out_path}  (source={source})")
    print(f"Total stop hits: {hits}")
    for key, lst in alerts.items():
        for a in lst:
            if a['stop_hit']:
                print(f"  {key}: {a['symbol']} → {a['stop_type']} ({a['return_pct']:.1f}%)")


if __name__ == '__main__':
    main()
