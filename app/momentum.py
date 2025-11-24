import numpy as np
import pandas as pd
from sqlalchemy import text
from .database import DatabaseManager, StockPerformance

def calculate_momentum():
    print("Starting Momentum Score Calculation...")
    db = DatabaseManager()
    session = db.Session()
    
    try:
        # 1. Get all stocks
        stocks = session.execute(text("SELECT id, nse_symbol FROM stocks WHERE is_active = true")).fetchall()
        print(f"Found {len(stocks)} active stocks.")
        
        updates = []
        
        # 2. Calculate Volatility and MR for each stock
        for i, (stock_id, symbol) in enumerate(stocks):
            if i % 50 == 0:
                print(f"Processing {i}/{len(stocks)}...")
                
            # Fetch last 1 year of daily prices
            query = text("""
                SELECT date, close_price 
                FROM daily_prices 
                WHERE stock_id = :stock_id 
                ORDER BY date DESC 
                LIMIT 300
            """)
            prices = session.execute(query, {"stock_id": stock_id}).fetchall()
            
            if len(prices) < 252: # Need at least 1 year of data
                continue
                
            df = pd.DataFrame(prices, columns=['date', 'close'])
            df['date'] = pd.to_datetime(df['date'])
            df = df.sort_values('date') # Ascending for calculation
            df.set_index('date', inplace=True)
            
            # Calculate Daily Log Returns
            df['log_ret'] = np.log(df['close'] / df['close'].shift(1))
            
            # Annualized Volatility (Standard Deviation of log returns * sqrt(252))
            # Use last 252 days
            last_year = df.tail(252)
            volatility = last_year['log_ret'].std() * np.sqrt(252)
            
            if pd.isna(volatility) or volatility == 0:
                continue
                
            # Calculate Returns for periods
            current_price = df['close'].iloc[-1]
            
            def get_return(days_ago):
                if len(df) <= days_ago:
                    return None
                past_price = df['close'].iloc[-(days_ago + 1)] # +1 because iloc[-1] is today
                return (current_price / past_price) - 1

            ret_1m = get_return(21)
            ret_3m = get_return(63)
            ret_6m = get_return(126)
            ret_1y = get_return(252)
            
            # Calculate Momentum Ratios (Return / Volatility)
            mr_1m = ret_1m / volatility if ret_1m is not None else None
            mr_3m = ret_3m / volatility if ret_3m is not None else None
            mr_6m = ret_6m / volatility if ret_6m is not None else None
            mr_1y = ret_1y / volatility if ret_1y is not None else None
            
            updates.append({
                'stock_id': stock_id,
                'volatility': float(volatility),
                'mr_1m': float(mr_1m) if mr_1m is not None else None,
                'mr_3m': float(mr_3m) if mr_3m is not None else None,
                'mr_6m': float(mr_6m) if mr_6m is not None else None,
                'mr_1y': float(mr_1y) if mr_1y is not None else None
            })
            
        print(f"Calculated metrics for {len(updates)} stocks.")
        
        # 3. Update DB with MRs (Batch update or one-by-one)
        for up in updates:
            perf = session.query(StockPerformance).filter_by(stock_id=up['stock_id']).first()
            if not perf:
                perf = StockPerformance(stock_id=up['stock_id'])
                session.add(perf)
            
            perf.volatility = up['volatility']
            perf.mr_1m = up['mr_1m']
            perf.mr_3m = up['mr_3m']
            perf.mr_6m = up['mr_6m']
            perf.mr_1y = up['mr_1y']
        
        session.commit()
        print("Saved Momentum Ratios to DB.")
        
        # 4. Calculate Universe Statistics (Mean and StdDev)
        df_updates = pd.DataFrame(updates)
        
        stats = {}
        for period in ['1m', '3m', '6m', '1y']:
            col = f'mr_{period}'
            stats[period] = {
                'mean': df_updates[col].mean(),
                'std': df_updates[col].std()
            }
            print(f"Stats for {period}: Mean={stats[period]['mean']:.4f}, Std={stats[period]['std']:.4f}")
            
        # 5. Calculate Z-Scores and Final Score
        for up in updates:
            z_scores = []
            
            # Only use 3M, 6M, 1Y (exclude 1M)
            for period in ['3m', '6m', '1y']:
                val = up[f'mr_{period}']
                if val is not None and stats[period]['std'] > 0:
                    z = (val - stats[period]['mean']) / stats[period]['std']
                    up[f'z_{period}'] = z
                    z_scores.append(z)
                else:
                    up[f'z_{period}'] = None
            
            # Set 1M z-score to None (not used)
            up['z_1m'] = None
            
            # Weighted Average Z-Score (Equal Weights: 1/3 each for 3M, 6M, 1Y)
            if len(z_scores) == 3: # Only if all 3 periods are available
                weighted_z = sum(z_scores) / 3
                
                # Normalized Score
                if weighted_z >= 0:
                    score = 1 + weighted_z
                else:
                    score = 1 / (1 - weighted_z) # Inverse for negative
                    
                up['momentum_score'] = score
            else:
                up['momentum_score'] = None
                
                
        # 6. Update DB with Final Scores
        print("Updating Final Scores...")
        for up in updates:
            perf = session.query(StockPerformance).filter_by(stock_id=up['stock_id']).first()
            if perf:
                perf.z_1m = float(up.get('z_1m')) if up.get('z_1m') is not None else None
                perf.z_3m = float(up.get('z_3m')) if up.get('z_3m') is not None else None
                perf.z_6m = float(up.get('z_6m')) if up.get('z_6m') is not None else None
                perf.z_1y = float(up.get('z_1y')) if up.get('z_1y') is not None else None
                perf.momentum_score = float(up.get('momentum_score')) if up.get('momentum_score') is not None else None
                
        session.commit()
        print("Momentum Calculation Complete!")
        
    except Exception as e:
        session.rollback()
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()
