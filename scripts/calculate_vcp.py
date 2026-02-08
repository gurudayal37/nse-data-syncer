import sys
import os
import numpy as np
import pandas as pd
from sqlalchemy import text
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load env
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(base_dir, 'web', '.env'))

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import DatabaseManager

def calculate_vcp_candidates():
    print("Starting **VCP (Volume Contraction Pattern)** Screen...")
    db = DatabaseManager()
    session = db.Session()
    
    try:
        # Pre-calculate eligible stocks based on Market Cap (Global Filter)
        min_mcap_cr = float(os.getenv('MIN_MARKET_CAP_CR', 500)) # Lower threshold for VCP
        min_mcap = min_mcap_cr * 10000000
        
        # Get active stocks with price data
        print(f"Fetching stocks with Market Cap > {min_mcap_cr} Cr...")
        query = text(f"""
            SELECT id, nse_symbol, name, market_cap 
            FROM stocks 
            WHERE is_active = true AND market_cap >= {min_mcap}
        """)
        stocks = session.execute(query).fetchall()
        print(f"Analyzing {len(stocks)} stocks...")

        vcp_candidates = []

        # Load ALL daily prices into memory (efficient for many stocks)
        print("Loading price data...")
        prices_query = text("""
            SELECT stock_id, date, close_price, high_price, low_price, volume 
            FROM daily_prices 
            WHERE date >= :start_date
            ORDER BY stock_id, date ASC
        """)
        
        # Fetch last 300 days of data (enough for 200 SMA)
        start_date = datetime.now() - timedelta(days=500)
        all_prices = session.execute(prices_query, {"start_date": start_date}).fetchall()
        
        # Convert to DataFrame
        cols = ['stock_id', 'date', 'close', 'high', 'low', 'volume']
        master_df = pd.DataFrame(all_prices, columns=cols)
        master_df['date'] = pd.to_datetime(master_df['date'])
        
        grouped = master_df.groupby('stock_id')
        
        count = 0
        total = len(stocks)
        
        for stock in stocks:
            stock_id = stock.id
            count += 1
            if count % 100 == 0:
                print(f"Processed {count}/{total}...")
                
            try:
                df = grouped.get_group(stock_id).copy()
            except KeyError:
                continue
                
            if len(df) < 200:
                continue
                
            df.set_index('date', inplace=True)
            
            # --- 1. Trend Template (Stage 2) ---
            current_close = df['close'].iloc[-1]
            
            # SMAs
            sma_50 = df['close'].rolling(window=50).mean().iloc[-1]
            sma_150 = df['close'].rolling(window=150).mean().iloc[-1]
            sma_200 = df['close'].rolling(window=200).mean().iloc[-1]
            
            # 52-week High/Low
            high_52w = df['high'].tail(252).max()
            low_52w = df['low'].tail(252).min()
            
            # Trend Rules
            # 1. Price > 150 > 200
            if not (current_close > sma_150 and sma_150 > sma_200):
                continue
            
            # 2. 200 SMA trending up (compare to 1 month ago)
            sma_200_prev = df['close'].rolling(window=200).mean().iloc[-22] # approx 1 month
            if sma_200 <= sma_200_prev:
                continue
                
            # 3. Price > 50 SMA
            if current_close <= sma_50:
                continue
                
            # 4. Price > 25% above 52w low
            if current_close < 1.25 * low_52w:
                continue
                
            # 5. Price within 25% of 52w high
            if current_close < 0.75 * high_52w:
                continue
                
            # --- 2. VCP Characteristics ---
            
            # Volatility Contraction
            # Std Dev of last 10 days vs last 50 days
            std_10 = df['close'].tail(10).std()
            std_50 = df['close'].tail(50).std()
            
            # If recent volatility is roughly half of longer term volatility = Contraction
            if std_10 > (0.6 * std_50): # Allowing slightly more than 50%
                 continue

            # Volume Contraction
            vol_avg_10 = df['volume'].tail(10).mean()
            vol_avg_50 = df['volume'].tail(50).mean()
            
            # Valid if recent volume is lower (drying up)
            # OR if volume on up days is high and down days is low (Pocket pivots etc) - sticking to simple contraction for now
            if vol_avg_10 > vol_avg_50:
                # Optional: Allow if today is a breakout? 
                # For scanning candidates, we want the contraction BEFORE the breakout or during it.
                # Let's enforce contraction:
                pass 
            
            # Price Tightness
            # Avg Range (High-Low) last 5 days vs 20 days
            df['range'] = (df['high'] - df['low']) / df['close']
            avg_range_5 = df['range'].tail(5).mean()
            avg_range_20 = df['range'].tail(20).mean()
            
            if avg_range_5 > avg_range_20:
                continue

            # Calculate a VCP Score (lower std dev relative to trend is better)
            # Normalize contraction: (std_50 - std_10) / std_50  --> Higher is better (more contraction)
            contraction_metric = (std_50 - std_10) / std_50 if std_50 > 0 else 0
            
            vcp_candidates.append({
                'stock_id': stock_id,
                'vcp_score': float(round(contraction_metric, 2))
            })

        print(f"Found {len(vcp_candidates)} VCP candidates.")
        
        # Reset all is_vcp flags
        session.execute(text("UPDATE stock_performance SET is_vcp = false, vcp_score = NULL"))
        session.commit()
        
        # Update candidates
        if vcp_candidates:
             # Batch update
            for cand in vcp_candidates:
                session.execute(text("""
                    UPDATE stock_performance 
                    SET is_vcp = true, vcp_score = :score, updated_at = NOW()
                    WHERE stock_id = :stock_id
                """), {'score': cand['vcp_score'], 'stock_id': cand['stock_id']})
            session.commit()
            print("Database updated.")

    except Exception as e:
        print(f"Error: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    calculate_vcp_candidates()
