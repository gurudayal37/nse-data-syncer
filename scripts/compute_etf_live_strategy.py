"""Computes tomorrow's top-10 ETF opening-fade sell candidates and stores
them in etf_live_strategy_picks, for the /etf-live-strategy page to display.

Mechanism (see the SML100CASE backtest write-up): newly-listed / thinly
authorized-participant-covered ETFs often print their day's high right at
the open, then fade back toward fair value over the session. This script
ranks all eligible ETFs by how strongly and how often that's true for them
specifically, using only data already synced by sync_etf_daily.py - no new
external calls.

Per ETF, over a trailing LOOKBACK_DAYS window of daily bars:
  open_eq_high_pct = % of days where open_price == high_price
  avg_fade_pct     = mean((open - close) / open * 100)   [positive = faded down]
  fade_score       = (open_eq_high_pct / 100) * avg_fade_pct

Eligibility: at least LOOKBACK_DAYS of history (so the trailing window is
fully populated), avg_fade_pct > 0 (only names that actually tend to fade),
and avg daily traded value over the window >= MIN_DAILY_TURNOVER (so a ~1L
order isn't a large fraction of a typical day's volume).

sell_price = prev_close * (1 + avg_fade_pct/2 / 100) - half of the ETF's own
average fade, so the trigger is calibrated per ETF rather than a flat %
applied to everything.

Run as part of dhan_daily_sync.yml, right after sync_etf_daily.py, so the
picks are always computed from that day's freshly-synced closes.
"""
import sys, os
from datetime import datetime, timedelta
from types import SimpleNamespace
from dotenv import load_dotenv
from sqlalchemy import text

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(base_dir, 'web', '.env'))
sys.path.append(base_dir)
from app.database import DatabaseManager

LOOKBACK_DAYS = 60
MIN_DAILY_TURNOVER = 1_000_000  # ₹10L avg daily traded value floor
TOP_N = 10
ORDER_NOTIONAL = 100_000  # ₹1L per pick


def next_trading_day(last_date) -> "datetime.date":
    """Next weekday after last_date. Doesn't know about NSE holidays -
    if the next weekday happens to be a market holiday, these picks will
    simply sit unused; nothing breaks, just re-run once markets reopen."""
    d = last_date + timedelta(days=1)
    while d.weekday() >= 5:  # 5=Sat, 6=Sun
        d += timedelta(days=1)
    return d


def compute_candidates(session):
    rows = session.execute(text("""
        WITH ranked AS (
            SELECT
                dp.etf_id, dp.date, dp.open_price, dp.high_price, dp.close_price, dp.volume,
                ROW_NUMBER() OVER (PARTITION BY dp.etf_id ORDER BY dp.date DESC) AS rn
            FROM etf_daily_prices dp
        ),
        windowed AS (
            SELECT * FROM ranked WHERE rn <= :lookback
        )
        SELECT
            w.etf_id,
            e.symbol,
            COUNT(*) AS n,
            AVG(CASE WHEN w.open_price = w.high_price THEN 1.0 ELSE 0.0 END) * 100 AS open_eq_high_pct,
            AVG((w.open_price - w.close_price) / NULLIF(w.open_price, 0) * 100) AS avg_fade_pct,
            AVG(w.volume * w.close_price) AS avg_daily_turnover,
            AVG(w.volume) AS avg_daily_volume,
            (SELECT dp2.close_price FROM etf_daily_prices dp2
             WHERE dp2.etf_id = w.etf_id ORDER BY dp2.date DESC LIMIT 1) AS prev_close,
            (SELECT dp2.date FROM etf_daily_prices dp2
             WHERE dp2.etf_id = w.etf_id ORDER BY dp2.date DESC LIMIT 1) AS last_date
        FROM windowed w
        JOIN etfs e ON e.id = w.etf_id
        WHERE e.is_active = 1
        GROUP BY w.etf_id, e.symbol
        HAVING COUNT(*) >= :lookback
    """), {'lookback': LOOKBACK_DAYS}).fetchall()

    # psycopg2 returns numeric/AVG() results as Decimal - coerce to float upfront
    # so the rest of the script can do normal arithmetic on these rows.
    float_fields = ('open_eq_high_pct', 'avg_fade_pct', 'avg_daily_turnover', 'avg_daily_volume', 'prev_close')
    out = []
    for r in rows:
        d = dict(r._mapping)
        for f in float_fields:
            if d.get(f) is not None:
                d[f] = float(d[f])
        out.append(SimpleNamespace(**d))
    return out


def main():
    db = DatabaseManager()
    session = db.Session()
    try:
        candidates = compute_candidates(session)
        print(f"Evaluated {len(candidates)} ETFs with >= {LOOKBACK_DAYS} days of history")

        eligible = [
            r for r in candidates
            if r.avg_fade_pct is not None
            and r.avg_fade_pct > 0
            and r.avg_daily_turnover is not None
            and r.avg_daily_turnover >= MIN_DAILY_TURNOVER
        ]
        print(f"Eligible after avg_fade>0 and turnover>=₹{MIN_DAILY_TURNOVER:,.0f}: {len(eligible)}")

        eligible.sort(key=lambda r: (r.open_eq_high_pct / 100) * r.avg_fade_pct, reverse=True)
        top = eligible[:TOP_N]

        if not top:
            print("No eligible ETFs found - nothing to write.")
            return

        last_date = max(r.last_date for r in top)
        trade_date = next_trading_day(last_date)
        print(f"Picks computed as of {last_date}, for trading session {trade_date}")

        session.execute(text("DELETE FROM etf_live_strategy_picks WHERE trade_date = :d"), {'d': trade_date})

        for rank, r in enumerate(top, start=1):
            fade_score = (r.open_eq_high_pct / 100) * r.avg_fade_pct
            sell_price = r.prev_close * (1 + (r.avg_fade_pct / 2) / 100)
            quantity = max(1, round(ORDER_NOTIONAL / sell_price))
            notional = quantity * sell_price

            session.execute(text("""
                INSERT INTO etf_live_strategy_picks
                    (trade_date, etf_id, symbol, rank, prev_close, open_eq_high_pct,
                     avg_fade_pct, fade_score, avg_daily_volume, sell_price, quantity, notional)
                VALUES
                    (:trade_date, :etf_id, :symbol, :rank, :prev_close, :open_eq_high_pct,
                     :avg_fade_pct, :fade_score, :avg_daily_volume, :sell_price, :quantity, :notional)
            """), {
                'trade_date': trade_date, 'etf_id': r.etf_id, 'symbol': r.symbol, 'rank': rank,
                'prev_close': r.prev_close, 'open_eq_high_pct': r.open_eq_high_pct,
                'avg_fade_pct': r.avg_fade_pct, 'fade_score': fade_score,
                'avg_daily_volume': int(r.avg_daily_volume) if r.avg_daily_volume else None,
                'sell_price': sell_price, 'quantity': quantity, 'notional': notional,
            })
            print(f"  #{rank} {r.symbol}: prev_close={r.prev_close:.2f} sell={sell_price:.2f} "
                  f"qty={quantity} notional=₹{notional:,.0f} fade_score={fade_score:.3f} "
                  f"(open==high {r.open_eq_high_pct:.0f}%, avg fade {r.avg_fade_pct:.2f}%)")

        session.commit()
        print(f"\nStored {len(top)} picks for {trade_date}")
    finally:
        session.close()


if __name__ == '__main__':
    main()
