import sys
import os
import json
import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load env
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(base_dir, 'web', '.env'))

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import DatabaseManager

def get_trading_dates(start_date, end_date):
    """Helper to generate expected trading dates (approx)"""
    return pd.date_range(start=start_date, end=end_date, freq='B')

def run_backtest():
    print("Starting **ATH Breakout** Strategy Backtest...")
    db = DatabaseManager()
    
    # 1. Load All Stocks
    print("Fetching stock list...")
    session = db.Session()
    try:
        query = text("SELECT id, nse_symbol, name FROM stocks WHERE is_active = true")
        stocks = session.execute(query).fetchall()
        stock_map = {s.id: s.nse_symbol for s in stocks}
    finally:
        session.close()

    print(f"Loaded {len(stocks)} stocks.")

    # 2. Load Price Data
    print("Loading daily price data...")
    
    session = db.Session()
    try:
        query = text("""
            SELECT stock_id, date, open_price, high_price, low_price, close_price 
            FROM daily_prices 
            ORDER BY stock_id, date
        """)
        result = session.execute(query)
        df_all = pd.DataFrame(result.fetchall(), columns=['stock_id', 'date', 'open', 'high', 'low', 'close'])
    finally:
        session.close()
        
    df_all['date'] = pd.to_datetime(df_all['date'])
    df_all.set_index('date', inplace=True)
    
    # Pre-calculate simple metrics if possible, but ATH is path-dependent
    
    trades = []
    
    print("Processing stocks...")
    
    for stock_id, symbol in stock_map.items():
        try:
            df = df_all[df_all['stock_id'] == stock_id].sort_index()
            if len(df) < 500: # Need some history for ATH
                continue
                
            # Calculate 30 DMA (Simple Moving Average)
            df['sma_30'] = df['close'].rolling(window=30).mean()
            
            # Resample to Monthly for ATH Detection
            # We want the HIGHEST HIGH of the month for ATH check
            # And CLOSE of the month for Breakout check
            monthly = df.resample('M').agg({
                'high': 'max',
                'close': 'last'
            })
            
            # Start logic from 2017, but need prior history for ATH
            start_backtest = pd.Timestamp('2017-01-01')
            
            # Identify ATHs
            # Expanding max of 'high' gives All-Time High up to that month
            # Shift by 1 because we check if current month close > PREVIOUS ATH
            monthly['prev_ath'] = monthly['high'].expanding().max().shift(1)
            
            # We also need the DATE of that Prev ATH to check the 2-month gap
            # This is tricky with vectorized expanding. 
            # Iterative approach might be safer for logic accuracy given the "Gap" condition.
            
            current_ath = 0
            current_ath_date = df.index[0]
            
            # Only iterate months
            monthly_records = monthly.reset_index().to_dict('records')
            
            for i, month in enumerate(monthly_records):
                if i == 0:
                    current_ath = month['high']
                    current_ath_date = month['date']
                    continue
                    
                month_date = month['date']
                
                # Update ATH if this month made a new one
                # CAREFUL: Strategy says "Monthly Close > Prev ATH".
                # If this month is the NEW ATH leader, it might also be the breakout candle.
                
                # Check Breakout Condition
                is_breakout = False
                if month_date >= start_backtest:
                    if month['close'] > current_ath:
                        # Gap Condition: current_ath must be at least 2 months old
                        # Approx 60 days
                        if (month_date - current_ath_date).days > 60:
                            is_breakout = True
                            
                # Logic for Trade Execution (Next Month)
                if is_breakout:
                    entry_trigger = month['high']
                    
                    # Scan NEXT month's daily data
                    next_month_start = month_date + timedelta(days=1)
                    # Next month end is approx
                    next_month_end = month_date + timedelta(days=32) 
                    
                    # Get daily data for next month onwards (for entry and exit)
                    future_data = df[df.index >= next_month_start]
                    
                    if future_data.empty:
                        continue
                        
                    # 1. Entry Check
                    entry_date = None
                    entry_price = 0.0
                    
                    # We only look for entry in the immediate next month? 
                    # "we buy the stock next month any time" -> Implies valid for 1 month
                    # Let's limit entry window to next month
                    entry_window = future_data[future_data.index.month == next_month_start.month]
                    
                    for date, row in entry_window.iterrows():
                        if row['high'] > entry_trigger:
                            # TRIGGERED
                            entry_date = date
                            # Buy at trigger price or Open if it gaped up
                            entry_price = max(entry_trigger, row['open'])
                            # Add some slippage? kept simple for now
                            break
                    
                    if entry_date:
                        # Trade is ON. Now scan for Exit.
                        # Exit: Weekly (Friday) Close < 30 DMA -> Exit next trading day
                        
                        trade_data = df[df.index > entry_date]
                        exit_date = None
                        exit_price = 0.0
                        status = 'OPEN'
                        
                        # Resample trade data to Weekly (Friday)
                        # We need to check daily close against 30DMA though?
                        # "if the stock on the last day of the week has given close below the 30 day moving average"
                        
                        # We iterate weekly periods
                        # Get all Fridays after entry
                        
                        # Optimised search:
                        # Filter rows where index is Friday (weekday=4) AND close < sma_30
                        exit_signals = trade_data[
                            (trade_data.index.dayofweek == 4) & 
                            (trade_data['close'] < trade_data['sma_30'])
                        ]
                        
                        if not exit_signals.empty:
                            signal_date = exit_signals.index[0]
                            
                            # Exit next trading day
                            next_days = df[df.index > signal_date]
                            if not next_days.empty:
                                exit_row = next_days.iloc[0]
                                exit_date = exit_row.name
                                exit_price = exit_row['open']
                                status = 'CLOSED'
                            else:
                                # Signal was last Friday, exit pending on Mon (Market Not Open Yet)
                                status = 'OPEN' 
                        
                        # Record Trade
                        pnl = 0.0
                        pnl_pct = 0.0
                        
                        current_price = df['close'].iloc[-1]
                        
                        if status == 'CLOSED':
                            pnl = exit_price - entry_price
                            pnl_pct = (pnl / entry_price) * 100
                        else:
                            # Unrealized PnL
                            pnl = current_price - entry_price
                            pnl_pct = (pnl / entry_price) * 100
                            
                        trades.append({
                            'symbol': symbol,
                            'entry_date': entry_date.strftime('%Y-%m-%d'),
                            'entry_price': round(entry_price, 2),
                            'exit_date': exit_date.strftime('%Y-%m-%d') if exit_date else None,
                            'exit_price': round(exit_price, 2) if exit_date else None,
                            'status': status,
                            'pnl': round(pnl, 2),
                            'pnl_pct': round(pnl_pct, 2),
                            'duration_days': (exit_date - entry_date).days if exit_date else (df.index[-1] - entry_date).days
                        })
                        
                        # IMPORTANT: Strategy says we buy. Assuming only 1 position per stock at a time?
                        # If we held a position, we wouldn't take another setup until exited?
                        # For simplicity in this logic: if we took a trade, we skip months until it's closed?
                        # The iteration above is independent. It might generate overlapping trades if breakout happens again while holding.
                        # Realistically, if you hold it, you hold it.
                        # Optimization: Skip `i` until exit_date month. 
                        
                        # Note: `i` is index of monthly_records. We need to jump ahead.
                        # But `monthly_records` logic updates ATH. 
                        # We should just block Taking New Trades for this stock if `entry_date` > existing trade `exit_date`?
                        # Let's keep it simple: Multiple pyramiding is allowed OR simple filter later.
                        # Given "All Time High" logic, it's unlikely to trigger again quickly unless it crashes and recovers.
                        # Actually, if it keeps making new ATHs, `current_ath` updates.
                        # But Setup requires `Close > Prev_ATH`. If we are in a trade, we are likely making new ATHs.
                        # But the "Prev ATH" must be 2 months OLD. 
                        # If we are rallying, the "Prev ATH" is just last month. So Gap condition < 60 days fails.
                        # So NATURALLY, this strategy filters pyramiding during strong trends!
                        pass

                # Update ATH tracking
                if month['high'] > current_ath:
                    current_ath = month['high']
                    current_ath_date = month_date
                    
        except Exception as e:
            # print(f"Error processing {symbol}: {str(e)}")
            continue

    print(f"Total Trades Found: {len(trades)}")
    
    # Save Results
    output = {
        'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'trades': sorted(trades, key=lambda x: x['entry_date'], reverse=True)
    }
    
    # Calc Summary
    closed_trades = [t for t in trades if t['status'] == 'CLOSED']
    if closed_trades:
        wins = len([t for t in closed_trades if t['pnl'] > 0])
        total_pnl = sum([t['pnl'] for t in trades]) # realized + unrealized? 1 share logic
        output['summary'] = {
            'total_trades': len(trades),
            'closed_trades': len(closed_trades),
            'active_trades': len(trades) - len(closed_trades),
            'win_rate': round(wins / len(closed_trades) * 100, 2),
            'total_pnl_abs': round(total_pnl, 2),
            'avg_pnl_per_trade': round(total_pnl / len(trades), 2)
        }
    
    out_path = os.path.join(base_dir, 'web', 'src', 'data', 'backtest_results_ath.json')
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    
    with open(out_path, 'w') as f:
        json.dump(output, f, indent=2)
        
    print(f"Saved results to {out_path}")

if __name__ == "__main__":
    run_backtest()
