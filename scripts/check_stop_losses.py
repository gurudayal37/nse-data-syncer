"""
Daily stop-loss monitor for active strategy holdings.

Uses strategy_picks.json for current month's stocks and DB open price on the
first trading day of the month as entry price — same as the backtest.

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


def main():
    today = date.today()
    current_month = today.strftime('%Y-%m')

    picks_path = os.path.join(base_dir, 'web', 'src', 'data', 'strategy_picks.json')
    if not os.path.exists(picks_path):
        print("strategy_picks.json not found.")
        return

    with open(picks_path) as f:
        picks_data = json.load(f)

    db = DatabaseManager()
    session = db.Session()

    latest_date = session.execute(text("SELECT MAX(date) FROM daily_prices")).scalar()
    print(f"Latest price date: {latest_date}")

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

    alerts = {}

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

        # Entry prices = open on first trading day of month (same as backtest)
        entry_rows = session.execute(
            text("SELECT stock_id, open_price FROM daily_prices WHERE stock_id IN :ids AND date = :dt"),
            {'ids': tuple(ids), 'dt': entry_date}
        ).fetchall()
        entry_map = {r[0]: float(r[1]) for r in entry_rows}

        # Latest OHLC for stop checks
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

    session.close()

    hits = sum(sum(1 for a in v if a['stop_hit']) for v in alerts.values())
    next_trading_day = next_weekday(pd.Timestamp(latest_date).date()).isoformat()

    output = {
        'generated_at':    datetime.now().isoformat(timespec='seconds'),
        'current_month':   current_month,
        'entry_date':      str(entry_date),
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

    print(f"\nWrote {out_path}")
    print(f"Total stop hits: {hits}")
    for key, lst in alerts.items():
        for a in lst:
            if a['stop_hit']:
                print(f"  {key}: {a['symbol']} → {a['stop_type']} ({a['return_pct']:.1f}%)")


if __name__ == '__main__':
    main()
