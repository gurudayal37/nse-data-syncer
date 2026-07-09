"""
Daily stop-loss monitor for active strategy holdings.

Reads current picks from strategy_picks.json, finds entry prices (open on the
first trading day of the current month), compares against today's close, and
writes stop_alerts.json for the UI to display.

Stop rule: if daily close drops >= 10% from entry → exit at next morning's open.
"""

import json
import os
import sys
from datetime import date, datetime
import pandas as pd
from sqlalchemy import text
from dotenv import load_dotenv

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(base_dir, 'web', '.env'))
sys.path.append(base_dir)
from app.database import DatabaseManager

STOP_LOSS_PCT = -0.10


def _next_trading_day_label(latest_date) -> str:
    """Return a human-readable label for the next trading day after latest_date."""
    from datetime import timedelta
    d = pd.Timestamp(latest_date).date()
    # Advance past weekends; exchange holidays can't be determined here so we just say "next trading day"
    candidate = d + timedelta(days=1)
    while candidate.weekday() >= 5:  # 5=Sat, 6=Sun
        candidate += timedelta(days=1)
    return candidate.isoformat()


def main():
    picks_path = os.path.join(base_dir, 'web', 'src', 'data', 'strategy_picks.json')
    if not os.path.exists(picks_path):
        print("strategy_picks.json not found — run generate_strategy_picks.py first.")
        return

    with open(picks_path) as f:
        picks_data = json.load(f)

    db = DatabaseManager()
    session = db.Session()

    today = date.today()
    month_start = today.replace(day=1)

    # First trading day of current month
    first_day_row = session.execute(text("""
        SELECT MIN(date) FROM daily_prices
        WHERE date >= :ms
    """), {'ms': month_start.isoformat()}).scalar()

    if not first_day_row:
        print("No price data found for current month — skipping.")
        session.close()
        return

    entry_date = first_day_row

    # Most recent trading day with data
    latest_date = session.execute(text("SELECT MAX(date) FROM daily_prices")).scalar()

    print(f"Entry date : {entry_date}")
    print(f"Latest date: {latest_date}")

    alerts = {}

    for strategy_key, strategy in picks_data['picks'].items():
        stocks = strategy['stocks']
        symbols = [s['symbol'] for s in stocks]
        if not symbols:
            continue

        # Fetch stock IDs
        id_rows = session.execute(
            text("SELECT id, nse_symbol FROM stocks WHERE nse_symbol IN :syms AND is_active = true"),
            {'syms': tuple(symbols)}
        ).fetchall()
        sym_to_id = {r[1]: r[0] for r in id_rows}
        ids = list(sym_to_id.values())
        if not ids:
            continue

        # Entry prices: open on first trading day of month
        entry_rows = session.execute(
            text("SELECT stock_id, open_price FROM daily_prices WHERE stock_id IN :ids AND date = :dt"),
            {'ids': tuple(ids), 'dt': entry_date}
        ).fetchall()
        entry_map = {r[0]: r[1] for r in entry_rows}

        # Current close prices: most recent day
        close_rows = session.execute(
            text("SELECT stock_id, close_price FROM daily_prices WHERE stock_id IN :ids AND date = :dt"),
            {'ids': tuple(ids), 'dt': latest_date}
        ).fetchall()
        close_map = {r[0]: r[1] for r in close_rows}

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

            ret = (float(current_close) - float(entry_price)) / float(entry_price)
            strategy_alerts.append({
                'rank':          pick['rank'],
                'symbol':        sym,
                'name':          pick.get('name', sym),
                'entry_date':    str(entry_date),
                'entry_price':   round(float(entry_price), 2),
                'current_close': round(float(current_close), 2),
                'current_date':  str(latest_date),
                'return_pct':    round(ret * 100, 2),
                'stop_hit':      ret <= STOP_LOSS_PCT,
            })

        strategy_alerts.sort(key=lambda x: x['return_pct'])
        alerts[strategy_key] = strategy_alerts

    session.close()

    hits = sum(sum(1 for a in v if a['stop_hit']) for v in alerts.values())
    next_trading_day = _next_trading_day_label(latest_date)

    output = {
        'generated_at':    datetime.now().isoformat(timespec='seconds'),
        'current_month':   today.strftime('%Y-%m'),
        'entry_date':      str(entry_date),
        'latest_date':     str(latest_date),
        'next_trading_day': next_trading_day,
        'stop_loss_pct':   STOP_LOSS_PCT * 100,
        'total_stop_hits': hits,
        'alerts':          alerts,
    }

    out_path = os.path.join(base_dir, 'web', 'src', 'data', 'stop_alerts.json')
    with open(out_path, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\nWrote {out_path}")
    print(f"Total stop hits: {hits}")
    for key, lst in alerts.items():
        hit_syms = [a['symbol'] for a in lst if a['stop_hit']]
        print(f"  {key}: {', '.join(hit_syms) if hit_syms else 'none'}")


if __name__ == '__main__':
    main()
