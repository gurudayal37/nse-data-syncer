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

def get_friday_dates(start_year=2019):
    """Get list of Fridays from start_year to present"""
    today = datetime.now()
    dates = []
    
    # Start from Jan 1st of start_year
    current = datetime(start_year, 1, 1)
    
    # Find first Friday
    while current.weekday() != 4: # 4 is Friday
        current += timedelta(days=1)
        
    while current < today:
        dates.append(current)
        current += timedelta(days=7)
        
    return dates

def calculate_momentum_for_date(session, target_date, stocks_df, valid_stock_ids=None):
    """
    Calculate momentum scores for all stocks as of target_date.
    stocks_df should contain all daily prices up to target_date.
    """
    scores = []
    
    # Filter for data up to target_date
    start_date = target_date - timedelta(days=365 + 30) # Buffer
    
    unique_stocks = stocks_df.index.get_level_values('stock_id').unique()
    
    for stock_id in unique_stocks:
        if valid_stock_ids is not None and stock_id not in valid_stock_ids:
            continue
        try:
            # Get stock data
            df = stocks_df.loc[stock_id]
            df = df[df.index <= target_date].sort_index()
            
            if len(df) < 252:
                continue
                
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
        
    # Calculate Z-Scores
    df_scores = pd.DataFrame(scores)
    
    for period in ['3m', '6m', '1y']:
        col = f'mr_{period}'
        mean = df_scores[col].mean()
        std = df_scores[col].std()
        if std > 0:
            df_scores[f'z_{period}'] = (df_scores[col] - mean) / std
        else:
            df_scores[f'z_{period}'] = 0
            
    # Weighted Score
    df_scores['weighted_z'] = (df_scores['z_3m'] + df_scores['z_6m'] + df_scores['z_1y']) / 3
    
    # Sort by weighted Z (descending)
    df_scores = df_scores.sort_values('weighted_z', ascending=False)
    
    return df_scores

def run_backtest():
    print("Starting Weekly Backtest (Since 2019)...")
    db = DatabaseManager()
    
    # Ensure tables exist
    from app.database import Base
    Base.metadata.create_all(db.engine)
    
    session = db.Session()
    
    # 1. Fetch Benchmark (Nifty 50)
    print("Fetching Benchmark Data...")
    try:
        nifty = yf.download('^NSEI', start='2018-01-01', progress=False)
        if nifty.empty:
            print("Warning: Could not fetch Nifty data.")
            nifty = pd.DataFrame(columns=['close'])
        else:
            nifty['date'] = nifty.index
            nifty = nifty[['date', 'Close']]
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
        
    # OPTIMIZATION: Load ALL daily prices into memory once
    print("Loading ALL price data into memory (this may take a moment)...")
    all_prices_query = text("SELECT stock_id, date, close_price, open_price FROM daily_prices ORDER BY date ASC")
    all_prices_result = session.execute(all_prices_query).fetchall()
    
    # Create master DataFrame
    master_df = pd.DataFrame(all_prices_result, columns=['stock_id', 'date', 'close_price', 'open_price'])
    master_df['date'] = pd.to_datetime(master_df['date'])
    # Set index for faster slicing
    master_df.set_index('date', inplace=True)
    print(f"Loaded {len(master_df)} price records into memory.")

    # Check for existing results
    output_path = os.path.join(base_dir, 'web', 'src', 'data', 'backtest_results_weekly.json')
    existing_results = []
    processed_weeks = set()
    
    if os.path.exists(output_path):
        try:
            with open(output_path, 'r') as f:
                data = json.load(f)
                if isinstance(data, list):
                    existing_results = data
                elif isinstance(data, dict):
                    existing_results = data.get('backtest_results', [])
                
                for r in existing_results:
                    processed_weeks.add(r['week'])
            print(f"Loaded existing results for {len(processed_weeks)} weeks.")
        except Exception as e:
            print(f"Could not load existing results: {e}")
            existing_results = []

    # 2. Iterate Weeks (from 2019 to present)
    dates = get_friday_dates(start_year=2019)
    new_results = []
    
    print(f"Backtesting over {len(dates)} weeks...")

    # Pre-calculate eligible stocks based on Market Cap (Global Filter)
    min_mcap_cr = float(os.getenv('MIN_MARKET_CAP_CR', 2000))
    min_mcap = min_mcap_cr * 10000000
    
    valid_stocks_query = text(f"SELECT id FROM stocks WHERE is_active = true AND market_cap >= {min_mcap}")
    valid_stock_ids = [r[0] for r in session.execute(valid_stocks_query).fetchall()]
    print(f"Applying Global Market Cap Filter (> {min_mcap_cr} Cr). Eligible Stocks: {len(valid_stock_ids)}")
    
    def process_period(rebalance_date, next_rebalance_date, label_date=None, valid_stock_ids=None):
        # Optimized: Slice from master_df in memory
        start_window = rebalance_date - timedelta(days=400)
        
        # Get data for the calculation window (up to rebalance_date)
        # Using slice on datetime index is fast
        try:
            # Slicing creates a view/copy, we need to filter by start_window too
            # loc[start:end] includes end
            df_slice = master_df.loc[start_window:rebalance_date]
        except KeyError:
            return None
            
        if df_slice.empty:
            return None
            
        # Reset index to get date back as column for set_index preparation below
        df_window = df_slice.reset_index()
        df_window.set_index(['stock_id', 'date'], inplace=True)
        
        # Calculate Momentum
        top_stocks_df = calculate_momentum_for_date(session, rebalance_date, df_window, valid_stock_ids=valid_stock_ids)
        
        if top_stocks_df.empty:
            return None
            
        # Select Top 15
        top_stocks = top_stocks_df.head(15)
        selected_stock_ids = top_stocks['stock_id'].tolist()
        score_map = top_stocks.set_index('stock_id')['weighted_z'].to_dict()
        
        # Calculate Returns for NEXT week
        portfolio_returns = []
        stock_returns_detail = []
        
        # Fetch next week prices from master_df
        # We need prices > rebalance_date AND <= next_rebalance_date
        # Limit to selected stock_ids
        try:
            # We want strictly greater than rebalance_date
            # master_df is sorted by date
            df_next_slice = master_df.loc[rebalance_date + timedelta(days=1) : next_rebalance_date]
            
            # Filter for selected stocks
            df_next = df_next_slice[df_next_slice['stock_id'].isin(selected_stock_ids)].reset_index()
            
        except KeyError:
            df_next = pd.DataFrame()

        if not df_next.empty:
            # Ensure proper index
            # df_next already has date column from reset_index
            
            for stock_id in selected_stock_ids:
                try:
                    # FIX: Buy at Next Day OPEN instead of Signal Day CLOSE
                    stock_data_next = df_next[df_next['stock_id'] == stock_id].sort_values('date')
                    if stock_data_next.empty:
                        stock_returns_detail.append({'symbol': stock_map.get(stock_id, 'Unknown'), 'return': 0.0, 'score': round(score_map.get(stock_id, 0), 2)})
                        continue

                    start_price = stock_data_next.iloc[0]['open_price']
                except (KeyError, IndexError):
                    stock_returns_detail.append({'symbol': stock_map.get(stock_id, 'Unknown'), 'return': 0.0, 'score': round(score_map.get(stock_id, 0), 2)})
                    continue
                    
                end_price = stock_data_next.iloc[-1]['close_price']
                ret = (end_price - start_price) / start_price
                portfolio_returns.append(ret)
                stock_returns_detail.append({'symbol': stock_map.get(stock_id, 'Unknown'), 'return': round(ret * 100, 2), 'score': round(score_map.get(stock_id, 0), 2)})

                
        if not portfolio_returns:
            port_ret = 0
            if not stock_returns_detail:
                for stock_id in selected_stock_ids:
                     stock_returns_detail.append({'symbol': stock_map.get(stock_id, 'Unknown'), 'return': 0.0, 'score': round(score_map.get(stock_id, 0), 2)})
        else:
            port_ret = sum(portfolio_returns) / len(portfolio_returns)
            
        # Benchmark Return
        if not nifty.empty:
            n_prev = nifty[nifty['date'] <= rebalance_date]
            n_curr = nifty[nifty['date'] <= next_rebalance_date]
            if not n_prev.empty and not n_curr.empty:
                n_start_price = n_prev.iloc[-1]['close']
                n_end_price = n_curr.iloc[-1]['close']
                bench_ret = (n_end_price - n_start_price) / n_start_price
            else:
                bench_ret = 0
        else:
            bench_ret = 0
            
        print(f"Processed {rebalance_date.date()} -> {next_rebalance_date.date()}: Port {port_ret:.2%} vs Bench {bench_ret:.2%}")
        
        week_label = label_date if label_date else next_rebalance_date.strftime('%Y-%m-%d')

        return {
            'week': week_label,
            'portfolio_return': round(port_ret * 100, 2),
            'benchmark_return': round(bench_ret * 100, 2),
            'holdings': stock_returns_detail
        }

    for i, rebalance_date in enumerate(dates[:-1]):
        next_rebalance_date = dates[i+1]
        week_label = next_rebalance_date.strftime('%Y-%m-%d')
        
        if week_label in processed_weeks:
            continue
            
        res = process_period(rebalance_date, next_rebalance_date, valid_stock_ids=valid_stock_ids)
        if res:
            new_results.append(res)
            
    # Current Week (Live)
    last_rebalance_date = dates[-1]
    today = datetime.now()
    if today > last_rebalance_date:
        current_week_label = today.strftime('%Y-%m-%d') # Or "Live"
        print(f"Processing Live Week: {last_rebalance_date.date()} -> {today.date()}")
        # Remove old live entry if exists
        # In this simplistic label logic (YYYY-MM-DD), the live week label keeps changing as today changes?
        # Ideally, we label it by the Friday effectively ending it?
        # Let's say the week label is the Friday date of that week.
        # If today is Wed, we are in the week ending next Friday.
        # next_friday = last_rebalance_date + 7 days
        next_friday = last_rebalance_date + timedelta(days=7)
        live_label = next_friday.strftime('%Y-%m-%d')
        
        # Market Cap Filter is already applied globally
        
        res = process_period(last_rebalance_date, today, label_date=live_label, valid_stock_ids=valid_stock_ids)
        if res:
             existing_results = [r for r in existing_results if r['week'] != live_label]
             new_results.append(res)

    all_results = existing_results + new_results
    all_results.sort(key=lambda x: x['week'], reverse=False) # Sort Oldest to Newest for calculations
    
    # Calculate actual transactions
    print("\nCalculating actual transactions...")
    total_transactions = 0
    previous_holdings = set()
    
    # We need to process in chronological order
    for result in all_results:
        # Get current week's stock symbols
        current_holdings = set([h['symbol'] for h in result['holdings']])
        
        if previous_holdings:
            # Stocks to sell (in prev, not in curr)
            stocks_to_sell = previous_holdings - current_holdings
            # Stocks to buy (in curr, not in prev)
            stocks_to_buy = current_holdings - previous_holdings
            
            transactions = len(stocks_to_sell) + len(stocks_to_buy)
            total_transactions += transactions
        else:
            # First week: buy all 15
            total_transactions += len(current_holdings)
            
        previous_holdings = current_holdings
        
    # Calculate Fees (0.25% per transaction)
    # Average portfolio value calculation
    start_value = 100000
    cumulative_values = []
    port_value = start_value
    for r in all_results:
        port_value = port_value * (1 + r['portfolio_return'] / 100)
        cumulative_values.append(port_value)
        
    avg_portfolio_value = np.mean(cumulative_values) if cumulative_values else 0
    # Fee: 0.25% per transaction
    fee_per_transaction = (avg_portfolio_value / 15) * 0.0025
    total_fees_paid = total_transactions * fee_per_transaction
    
    # Net Return
    final_value = cumulative_values[-1] if cumulative_values else start_value
    net_value_after_fees = final_value - total_fees_paid
    net_return_after_fees = ((net_value_after_fees - start_value) / start_value) * 100
    
    print(f"Total Transactions: {total_transactions}")
    print(f"Average Portfolio Value: ₹{avg_portfolio_value:.2f}")
    print(f"Total Fees Paid: ₹{total_fees_paid:.2f}")
    print(f"Net Return After Fees: {net_return_after_fees:.2f}%")
    
    # Construct Output
    output_data = {
        "backtest_metrics": {
            "return_metrics": {
                "net_return_after_fees": round(net_return_after_fees, 2)
            },
            "capital_metrics": {
                "total_fees_paid": round(total_fees_paid, 2),
                "total_transactions": total_transactions
            }
        },
        "backtest_results": sorted(all_results, key=lambda x: x['week'], reverse=True) # Newest first for JSON
    }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(output_data, f, indent=2)
        
    print(f"Weekly Backtest saved to {output_path}")

if __name__ == "__main__":
    run_backtest()
