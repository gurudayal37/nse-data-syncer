"""
Daily stop-loss monitor for active strategy holdings.

Priority:
  1. If web/src/data/monthly_positions.json has an entry for the current month,
     use those symbols and actual entry prices (filled in from Dhan after buying).
  2. Otherwise fall back to strategy_picks.json picks + DB open on first trading day.

Stop rule: daily close <= entry * 0.90 → exit at next morning's market open.
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

STOP_LOSS_PCT = -0.10


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

        # Current close prices
        close_rows = session.execute(
            text("SELECT stock_id, close_price FROM daily_prices WHERE stock_id IN :ids AND date = :dt"),
            {'ids': tuple(ids), 'dt': latest_date}
        ).fetchall()
        close_map = {r[0]: float(r[1]) for r in close_rows}
        id_to_sym = {v: k for k, v in sym_to_id.items()}

        strategy_alerts = []
        for rank, pos in enumerate(positions, 1):
            sym = pos['symbol']
            sid = sym_to_id.get(sym)
            entry_price = float(pos['entry_price'])
            current_close = close_map.get(sid) if sid else None
            if current_close is None:
                print(f"  Warning: no close price for {sym}")
                continue
            ret = (current_close - entry_price) / entry_price
            strategy_alerts.append({
                'rank':          rank,
                'symbol':        sym,
                'name':          pos.get('name', sym),
                'entry_date':    manual.get('entry_date', f'{current_month}-01'),
                'entry_price':   entry_price,
                'current_close': round(current_close, 2),
                'current_date':  str(latest_date),
                'return_pct':    round(ret * 100, 2),
                'stop_hit':      ret <= STOP_LOSS_PCT,
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

            close_rows = session.execute(
                text("SELECT stock_id, close_price FROM daily_prices WHERE stock_id IN :ids AND date = :dt"),
                {'ids': tuple(ids), 'dt': latest_date}
            ).fetchall()
            close_map = {r[0]: float(r[1]) for r in close_rows}

            strategy_alerts = []
            for pick in stocks:
                sym = pick['symbol']
                sid = sym_to_id.get(sym)
                if not sid:
                    continue
                entry_price = entry_map.get(sid)
                current_close = close_map.get(sid)
                if not entry_price or not current_close:
                    continue
                ret = (current_close - entry_price) / entry_price
                strategy_alerts.append({
                    'rank':          pick['rank'],
                    'symbol':        sym,
                    'name':          pick.get('name', sym),
                    'entry_date':    str(entry_date),
                    'entry_price':   round(entry_price, 2),
                    'current_close': round(current_close, 2),
                    'current_date':  str(latest_date),
                    'return_pct':    round(ret * 100, 2),
                    'stop_hit':      ret <= STOP_LOSS_PCT,
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
        'stop_loss_pct':   STOP_LOSS_PCT * 100,
        'total_stop_hits': hits,
        'alerts':          alerts,
    }

    out_path = os.path.join(base_dir, 'web', 'src', 'data', 'stop_alerts.json')
    with open(out_path, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\nWrote {out_path}  (source={source})")
    print(f"Total stop hits: {hits}")
    for key, lst in alerts.items():
        hit_syms = [a['symbol'] for a in lst if a['stop_hit']]
        print(f"  {key}: {', '.join(hit_syms) if hit_syms else 'none hit'}")


if __name__ == '__main__':
    main()
