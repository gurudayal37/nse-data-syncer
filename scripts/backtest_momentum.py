import sys
import os
import json
import numpy as np
import pandas as pd
import yfinance as yf
from sqlalchemy import text
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from dotenv import load_dotenv

# Load env
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(base_dir, 'web', '.env'))

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import DatabaseManager, MomentumHistory

def get_month_ends(years=8):
    """Get list of month-end dates for the last N years (default 8 years from 2017)"""
    today = datetime.now()
    dates = []
    # Start from N years ago
    start_date = today - relativedelta(years=years)
    # Align to next month start
    current = start_date.replace(day=1) + relativedelta(months=1)
    
    while current < today:
        # Get last day of previous month (rebalancing date)
        last_month_end = current - timedelta(days=1)
        dates.append(last_month_end)
        current += relativedelta(months=1)
        
    return dates

def calculate_momentum_for_date(session, target_date, stocks_df):
    """
    Calculate momentum scores for all stocks as of target_date.
    stocks_df should contain all daily prices up to target_date.
    """
    # This is a simplified version of the main momentum logic, optimized for backtesting
    # We assume stocks_df has MultiIndex (stock_id, date) or similar for fast lookup
    
    scores = []
    
    # We need to process each stock
    # To optimize, we can group by stock_id
    
    # Filter for data up to target_date (already done by caller ideally, but let's be safe)
    # And we need at least 1 year of history before target_date
    start_date = target_date - timedelta(days=365 + 30) # Buffer
    
    # This part is tricky to do purely in Pandas if we pass the HUGE dataframe.
    # Better to query DB for the specific window? No, too many queries.
    # Better to load ALL prices once and slice? Yes, if memory allows.
    
    # Let's try iterating unique stock_ids in the dataframe
    unique_stocks = stocks_df.index.get_level_values('stock_id').unique()
    
    for stock_id in unique_stocks:
        try:
            # Get stock data
            df = stocks_df.loc[stock_id]
            df = df[df.index <= target_date].sort_index()
            
            if len(df) < 252:
                continue
                
            # Calculate metrics
            # Log returns
            df['log_ret'] = np.log(df['close_price'] / df['close_price'].shift(1))
            
            # Volatility (last 252 days)
            volatility = df['log_ret'].tail(252).std() * np.sqrt(252)
            
            if pd.isna(volatility) or volatility == 0:
                continue
                
            current_price = df['close_price'].iloc[-1]
            
            def get_ret(days):
                if len(df) <= days: return None
                past_price = df['close_price'].iloc[-(days + 1)]
                return (current_price / past_price) - 1
                
            r1m = get_ret(21)
            r3m = get_ret(63)
            r6m = get_ret(126)
            r1y = get_ret(252)
            
            if None in [r1m, r3m, r6m, r1y]:
                continue
                
            # Only use 3M, 6M, 1Y (exclude 1M)
            mr_3m = r3m / volatility
            mr_6m = r6m / volatility
            mr_1y = r1y / volatility
            
            scores.append({
                'stock_id': stock_id,
                'mr_3m': mr_3m,
                'mr_6m': mr_6m,
                'mr_1y': mr_1y
            })
            
        except KeyError:
            continue
            
    if not scores:
        return []
        
    # Calculate Z-Scores (only for 3M, 6M, 1Y)
    df_scores = pd.DataFrame(scores)
    
    for period in ['3m', '6m', '1y']:
        col = f'mr_{period}'
        mean = df_scores[col].mean()
        std = df_scores[col].std()
        if std > 0:
            df_scores[f'z_{period}'] = (df_scores[col] - mean) / std
        else:
            df_scores[f'z_{period}'] = 0
            
    # Weighted Score (equal weights: 1/3 each)
    df_scores['weighted_z'] = (df_scores['z_3m'] + df_scores['z_6m'] + df_scores['z_1y']) / 3
    
    # Sort by weighted Z (descending)
    df_scores = df_scores.sort_values('weighted_z', ascending=False)
    
    return df_scores

def run_backtest():
    print("Starting Backtest...")
    db = DatabaseManager()
    
    # Ensure tables exist (specifically momentum_history)
    from app.database import Base
    Base.metadata.create_all(db.engine)
    
    session = db.Session()
    
    # 1. Fetch Benchmark (Nifty 50) - Fetch 10 years to cover full backtest period
    print("Fetching Benchmark Data...")
    try:
        nifty = yf.download('^NSEI', start=(datetime.now() - relativedelta(years=10)).strftime('%Y-%m-%d'), progress=False)
        if nifty.empty:
            print("Warning: Could not fetch Nifty data. Benchmark returns will be 0.")
            nifty = pd.DataFrame(columns=['close'])
        else:
            nifty['date'] = nifty.index
            nifty = nifty[['date', 'Close']]
            # Flatten columns if MultiIndex (yfinance update)
            if isinstance(nifty.columns, pd.MultiIndex):
                nifty.columns = nifty.columns.get_level_values(0)
            nifty.rename(columns={'Close': 'close'}, inplace=True)
    except Exception as e:
        print(f"Error fetching benchmark: {e}")
        nifty = pd.DataFrame(columns=['close'])

    # Load Stock Names
    stock_map = {}
    stocks = session.execute(text("SELECT id, nse_symbol FROM stocks")).fetchall()
    for s in stocks:
        stock_map[s.id] = s.nse_symbol
        
    # 2. Iterate Months (from 2017 to present)
    dates = get_month_ends(years=8)
    results = []
    
    print(f"Backtesting over {len(dates)} months...")
    
    for i, rebalance_date in enumerate(dates[:-1]): # Skip last one
        next_rebalance_date = dates[i+1]
        
        print(f"Processing {rebalance_date.date()} -> {next_rebalance_date.date()}")
        
        # Fetch prices for calculation window (1 year + buffer before rebalance_date)
        start_window = rebalance_date - timedelta(days=400)
        
        # Optimized Query: Fetch only necessary columns for the window
        query = text("""
            SELECT stock_id, date, close_price 
            FROM daily_prices 
            WHERE date >= :start_date AND date <= :end_date
            ORDER BY date ASC
        """)
        
        prices = session.execute(query, {
            "start_date": start_window,
            "end_date": rebalance_date
        }).fetchall()
        
        if not prices:
            print("  No price data found for this period.")
            continue
            
        df_window = pd.DataFrame(prices, columns=['stock_id', 'date', 'close_price'])
        df_window['date'] = pd.to_datetime(df_window['date'])
        df_window.set_index(['stock_id', 'date'], inplace=True)
        
        # Calculate Momentum
        top_stocks_df = calculate_momentum_for_date(session, rebalance_date, df_window)
        
        if top_stocks_df.empty:
            print("  No stocks found.")
            continue
            
        # Save History to DB
        try:
            session.execute(text("DELETE FROM momentum_history WHERE date = :date"), {"date": rebalance_date})
            
            history_records = []
            for rank, row in enumerate(top_stocks_df.itertuples(), 1):
                history_records.append(MomentumHistory(
                    stock_id=row.stock_id,
                    date=rebalance_date,
                    momentum_score=row.weighted_z,
                    rank=rank
                ))
            
            session.bulk_save_objects(history_records)
            session.commit()
        except Exception as e:
            print(f"  Error saving history: {e}")
            session.rollback()
         # Select Top 15
        top_stocks = top_stocks_df.head(15)
        selected_stock_ids = top_stocks['stock_id'].tolist()
        
        # Create map of stock_id -> score
        score_map = top_stocks.set_index('stock_id')['weighted_z'].to_dict()
        
        # Calculate Portfolio Return for the NEXT month
        # We need prices for selected stocks in the next month window
        portfolio_returns = []
        stock_returns_detail = []  # Store individual stock returns
        
        # Fetch next month prices for selected stocks only
        next_prices_query = text("""
            SELECT stock_id, date, close_price 
            FROM daily_prices 
            WHERE stock_id IN :stock_ids AND date > :start_date AND date <= :end_date
            ORDER BY date ASC
        """)
        
        next_prices = session.execute(next_prices_query, {
            "stock_ids": tuple(selected_stock_ids),
            "start_date": rebalance_date,
            "end_date": next_rebalance_date
        }).fetchall()
        
        df_next = pd.DataFrame(next_prices, columns=['stock_id', 'date', 'close_price'])
        if not df_next.empty:
            df_next['date'] = pd.to_datetime(df_next['date'])
            
            for stock_id in selected_stock_ids:
                # Start Price: Closing price at rebalance_date (from df_window)
                try:
                    start_price = df_window.loc[stock_id].iloc[-1]['close_price']
                except KeyError:
                    stock_returns_detail.append({
                        'symbol': stock_map.get(stock_id, 'Unknown'),
                        'return': None,
                        'score': round(score_map.get(stock_id, 0), 2)
                    })
                    continue
                    
                # End Price: Last available in next month
                stock_data_next = df_next[df_next['stock_id'] == stock_id].sort_values('date')
                if stock_data_next.empty:
                    stock_returns_detail.append({
                        'symbol': stock_map.get(stock_id, 'Unknown'),
                        'return': None,
                        'score': round(score_map.get(stock_id, 0), 2)
                    })
                    continue
                
                end_price = stock_data_next.iloc[-1]['close_price']
                
                ret = (end_price - start_price) / start_price
                portfolio_returns.append(ret)
                stock_returns_detail.append({
                    'symbol': stock_map.get(stock_id, 'Unknown'),
                    'return': round(ret * 100, 2),
                    'score': round(score_map.get(stock_id, 0), 2)
                })
                
        if not portfolio_returns:
            port_ret = 0
        else:
            port_ret = sum(portfolio_returns) / len(portfolio_returns)
            
        # Calculate Benchmark Return
        if not nifty.empty:
            # Start Price: Close on or before rebalance_date
            n_prev = nifty[nifty['date'] <= rebalance_date]
            # End Price: Close on or before next_rebalance_date
            n_curr = nifty[nifty['date'] <= next_rebalance_date]
            
            if not n_prev.empty and not n_curr.empty:
                n_start_price = n_prev.iloc[-1]['close']
                n_end_price = n_curr.iloc[-1]['close']
                bench_ret = (n_end_price - n_start_price) / n_start_price
            else:
                bench_ret = 0
        else:
            bench_ret = 0
            
        # Store Result
        results.append({
            'month': next_rebalance_date.strftime('%Y-%m'),
            'portfolio_return': round(port_ret * 100, 2),
            'benchmark_return': round(bench_ret * 100, 2),
            'holdings': stock_returns_detail
        })
        
        print(f"  Port: {port_ret:.2%}, Bench: {bench_ret:.2%}")
        
    # Save to JSON
    output_path = os.path.join(base_dir, 'web', 'src', 'data', 'backtest_results.json')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)
        
    print(f"Backtest saved to {output_path}")

if __name__ == "__main__":
    run_backtest()
