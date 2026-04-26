import sys
import os
import pandas as pd
import numpy as np
from sqlalchemy import text
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load env from web/.env
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(base_dir, 'web', '.env'))

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import DatabaseManager


def calculate_stage2_candidates():
    """
    Identifies stocks in Stage 2 uptrend based on Mark Minervini's Trend Template.

    Criteria:
    1. Current price > 150 DMA (30-week) AND > 200 DMA (40-week)
    2. 150 DMA > 200 DMA
    3. 200 DMA is trending up for at least 1 month (~21 trading days)
    4. 50 DMA (10-week) > 150 DMA AND > 200 DMA
    5. Current price > 50 DMA
    6. Current price >= 30% above its 52-week low
    7. Current price is within 25% of its 52-week high (>= 75% of 52W high)
    8. Relative Strength rank >= 70 (computed as 63-day return percentile across all stocks)
    """
    print("Starting Stage 2 (Minervini Trend Template) Screen...")
    db = DatabaseManager()
    session = db.Session()

    try:
        # Optional market cap filter (defaults to 0 = no filter)
        min_mcap_cr = float(os.getenv('MIN_MARKET_CAP_CR', 2000))
        min_mcap = min_mcap_cr * 10_000_000

        print(f"Fetching stocks (Market Cap >= {min_mcap_cr} Cr)...")
        query = text("""
            SELECT id, nse_symbol, name
            FROM stocks
            WHERE is_active = true AND market_cap >= :min_mcap
        """)
        stocks = session.execute(query, {"min_mcap": min_mcap}).fetchall()
        print(f"Analyzing {len(stocks)} stocks...")

        # We need ~252 days for 52W calcs + 200 for SMA + 21 for trend check = ~473 days.
        # Use 520 for a safe buffer.
        start_date = datetime.now() - timedelta(days=520)

        print("Loading price data...")
        prices_query = text("""
            SELECT stock_id, date, close_price, high_price, low_price
            FROM daily_prices
            WHERE date >= :start_date
            ORDER BY stock_id, date ASC
        """)
        all_prices = session.execute(prices_query, {"start_date": start_date}).fetchall()

        if not all_prices:
            print("No price data found.")
            return

        cols = ['stock_id', 'date', 'close', 'high', 'low']
        master_df = pd.DataFrame(all_prices, columns=cols)
        master_df['date'] = pd.to_datetime(master_df['date'])

        # --- Step 1: Compute RS Rank across all stocks ---
        # RS Rank = percentile rank of 63-day (3-month) price return in the full universe
        print("Calculating Relative Strength ranks...")
        rs_ranks = {}

        latest_prices = (
            master_df.sort_values('date')
            .groupby('stock_id')
            .tail(1)
            .set_index('stock_id')['close']
        )

        # Price ~63 trading days ago
        prices_63d_ago = (
            master_df.sort_values('date')
            .groupby('stock_id')
            .apply(lambda g: g.iloc[-63]['close'] if len(g) >= 63 else None, include_groups=False)
        )

        returns_63d = {}
        for sid in latest_prices.index:
            past = prices_63d_ago.get(sid)
            curr = latest_prices.get(sid)
            if past and curr and past > 0:
                returns_63d[sid] = (curr - past) / past * 100

        if returns_63d:
            returns_series = pd.Series(returns_63d)
            # Percentile rank 0–100
            rs_rank_series = returns_series.rank(pct=True) * 100
            rs_ranks = rs_rank_series.to_dict()

        # --- Step 2: Save RS rank for ALL eligible stocks (>= 63 days of data) ---
        # Do this before the Stage 2 loop so every stock gets an RS rank regardless
        # of whether it passes the Trend Template criteria.
        print(f"Saving RS ranks for {len(rs_ranks)} eligible stocks...")
        session.execute(text("""
            UPDATE stock_performance
            SET is_stage2 = false,
                stage2_rs_rank = NULL,
                stage2_pct_from_52w_high = NULL,
                stage2_pct_above_52w_low = NULL
        """))
        for stock_id, rs_rank in rs_ranks.items():
            session.execute(text("""
                UPDATE stock_performance
                SET stage2_rs_rank = :rs_rank
                WHERE stock_id = :stock_id
            """), {'stock_id': int(stock_id), 'rs_rank': float(round(rs_rank, 2))})

        # --- Step 3: Apply Trend Template to each stock ---
        grouped = master_df.groupby('stock_id')

        stage2_candidates = []
        count = 0
        total = len(stocks)

        for stock in stocks:
            stock_id = stock.id
            count += 1
            if count % 200 == 0:
                print(f"  Processed {count}/{total}...")

            try:
                df = grouped.get_group(stock_id).copy()
            except KeyError:
                continue

            # Need at least 221 rows: 200 SMA + 21 days for trend check
            if len(df) < 221:
                continue

            df.set_index('date', inplace=True)
            df = df.sort_index()

            # --- Moving Averages ---
            sma_50  = df['close'].rolling(window=50).mean()
            sma_150 = df['close'].rolling(window=150).mean()
            sma_200 = df['close'].rolling(window=200).mean()

            current_close    = df['close'].iloc[-1]
            current_sma_50   = sma_50.iloc[-1]
            current_sma_150  = sma_150.iloc[-1]
            current_sma_200  = sma_200.iloc[-1]

            # 200 SMA from 21 trading days ago (1 calendar month proxy)
            sma_200_1m_ago = sma_200.iloc[-22]  # -1 is today, -22 is ~21 days back

            # Guard against NaN in SMAs (insufficient data for a window)
            if any(pd.isna(v) for v in [current_sma_50, current_sma_150, current_sma_200, sma_200_1m_ago]):
                continue

            # --- 52-Week High / Low (last 252 trading days) ---
            last_252 = df.tail(252)
            high_52w = last_252['high'].max()
            low_52w  = last_252['low'].min()

            # --- Criterion 1: Price > 150 DMA and > 200 DMA ---
            cond1 = (current_close > current_sma_150) and (current_close > current_sma_200)

            # --- Criterion 2: 150 DMA > 200 DMA ---
            cond2 = current_sma_150 > current_sma_200

            # --- Criterion 3: 200 DMA trending up for at least 1 month ---
            cond3 = current_sma_200 > sma_200_1m_ago

            # --- Criterion 4: 50 DMA > 150 DMA and > 200 DMA ---
            cond4 = (current_sma_50 > current_sma_150) and (current_sma_50 > current_sma_200)

            # --- Criterion 5: Price > 50 DMA ---
            cond5 = current_close > current_sma_50

            # --- Criterion 6: Price >= 30% above 52-week low ---
            cond6 = current_close >= (1.30 * low_52w)

            # --- Criterion 7: Price within 25% of 52-week high (>= 75% of high) ---
            cond7 = current_close >= (0.75 * high_52w)

            # --- Criterion 8: RS Rank >= 70 ---
            rs_rank = rs_ranks.get(stock_id, 0)
            cond8 = rs_rank >= 70

            if not (cond1 and cond2 and cond3 and cond4 and cond5 and cond6 and cond7 and cond8):
                continue

            # Compute % from 52W high (for display in UI)
            pct_from_52w_high = ((current_close - high_52w) / high_52w) * 100  # negative = below high
            pct_above_52w_low = ((current_close - low_52w) / low_52w) * 100

            stage2_candidates.append({
                'stock_id': stock_id,
                'stage2_pct_from_52w_high': float(round(pct_from_52w_high, 2)),
                'stage2_pct_above_52w_low': float(round(pct_above_52w_low, 2)),
            })

        print(f"Found {len(stage2_candidates)} Stage 2 candidates.")

        # Mark Stage 2 candidates (RS rank already written above for all stocks)
        if stage2_candidates:
            for cand in stage2_candidates:
                session.execute(text("""
                    UPDATE stock_performance
                    SET is_stage2 = true,
                        stage2_pct_from_52w_high = :pct_high,
                        stage2_pct_above_52w_low = :pct_low,
                        updated_at = NOW()
                    WHERE stock_id = :stock_id
                """), {
                    'pct_high': cand['stage2_pct_from_52w_high'],
                    'pct_low': cand['stage2_pct_above_52w_low'],
                    'stock_id': cand['stock_id'],
                })

            print("Database updated successfully.")

        session.commit()
        print("Stage 2 screen complete.")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        session.rollback()
    finally:
        session.close()


if __name__ == "__main__":
    calculate_stage2_candidates()
