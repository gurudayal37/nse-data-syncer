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
    stock_map = {s.id: s.nse_symbol for s in stocks} # update map
    
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
    
    # Load Market Cap Filter (Global)
    min_mcap_cr = float(os.getenv('MIN_MARKET_CAP_CR', 2000))
    min_mcap = min_mcap_cr * 10000000
    
    valid_stocks_query = text(f"SELECT id FROM stocks WHERE is_active = true AND market_cap >= {min_mcap}")
    valid_stock_ids = set([r[0] for r in session.execute(valid_stocks_query).fetchall()])
    print(f"Loaded {len(valid_stock_ids)} eligible stocks (> {min_mcap_cr} Cr) for Backtest & Live Signals.")
    
    # Pre-calculate simple metrics if possible, but ATH is path-dependent
    
    trades = []
    eligible_stocks = []  # Stocks with breakout signal waiting for entry
    
    print("Processing stocks...")
    
    for stock_id, symbol in stock_map.items():
        # Global Filter: Skip if not in valid list
        if stock_id not in valid_stock_ids:
            continue
            
        try:
            df = df_all[df_all['stock_id'] == stock_id].sort_index()
            if symbol == 'NETWEB':
                 print(f"DEBUG NETWEB: Data Length {len(df)}")
            if len(df) < 500: # Need some history for ATH
                if symbol == 'NETWEB':
                     print("DEBUG NETWEB: Skipped due to length < 500")
                continue
                
            # Calculate 30-Week SMA
            # Resample to Weekly (Ending Friday)
            weekly_df = df.resample('W-FRI').agg({
                'open': 'first', 
                'high': 'max', 
                'low': 'min', 
                'close': 'last'
            })
            weekly_df['sma_30_weekly'] = weekly_df['close'].rolling(window=30).mean()
            
            # Resample to Monthly for ATH Detection (as before)
            monthly = df.resample('ME').agg({
                'high': 'max',
                'close': 'last'
            })
            
            # Start logic from 2017, but need prior history for ATH
            start_backtest = pd.Timestamp('2017-01-01')
            
            monthly['prev_ath'] = monthly['high'].expanding().max().shift(1)
            
            current_ath = 0
            current_ath_date = df.index[0]
            
            monthly_records = monthly.reset_index().to_dict('records')
            
            for i, month in enumerate(monthly_records):
                if i == 0:
                    current_ath = month['high']
                    current_ath_date = month['date']
                    continue
                    
                month_date = month['date']
                
                # Update ATH if this month made a new one
                # CAREFUL: Strategy says "Monthly Close > Prev ATH".
                
                # Check Breakout Condition
                is_breakout = False
                if month_date >= start_backtest:
                    if month['close'] > current_ath:
                        # Gap Condition: current_ath must be at least 2 months old
                        # Approx 60 days
                        if (month_date - current_ath_date).days > 60:
                            is_breakout = True
                        else:
                            pass
                            
                # Logic for Trade Execution (Next Month)
                if is_breakout:
                    entry_trigger = month['high']
                    
                    next_month_start = month_date + timedelta(days=1)
                    
                    # Track eligible stocks (recent breakouts waiting for entry)
                    # Only track if breakout happened in last 2 months
                    today = pd.Timestamp(datetime.now())
                    months_since_breakout = (today.year - month_date.year) * 12 + (today.month - month_date.month)
                    
                    # We'll check later if this breakout actually resulted in a trade
                    # For now, just mark it as a potential eligible stock
                    potential_eligible = None
                    if months_since_breakout <= 2 and months_since_breakout >= 0:
                        # Get current price for reference
                        current_price = df['close'].iloc[-1] if len(df) > 0 else 0
                        
                        # Market Cap Filter: Already applied globally at loop start
                        potential_eligible = {
                            'symbol': symbol,
                            'breakout_month': month_date.strftime('%Y-%m'),
                            'breakout_date': month_date.strftime('%Y-%m-%d'),
                            'entry_trigger': round(entry_trigger, 2),
                            'previous_ath': round(current_ath, 2),
                            'ath_date': current_ath_date.strftime('%Y-%m-%d'),
                            'gap_days': (month_date - current_ath_date).days,
                            'close_price': round(month['close'], 2),
                            'current_price': round(current_price, 2),
                            'entry_month': next_month_start.strftime('%Y-%m')
                        }
                    
                    # Get daily data for next month onwards (for entry and exit)
                    future_data = df[df.index >= next_month_start]
                    
                    if future_data.empty:
                        continue
                        
                    # 1. Entry Check
                    entry_date = None
                    entry_price = 0.0
                    
                    # We look for entry in the NEXT MONTH only
                    entry_window = future_data[
                        (future_data.index.month == next_month_start.month) & 
                        (future_data.index.year == next_month_start.year)
                    ]
                    
                    if symbol == 'NETWEB' and is_breakout:
                         pass
                    
                    # LOGIC CHANGE: Prevent Overlapping Trades
                    # If we have a last_exit_date for this stock, and the potential entry window starts BEFORE that exit,
                    # we must skip this setup or carefully check dates.
                    # Simplest robust check: Don't take a new setup if the Entry Window overlaps with an active trade.
                    # Since we don't know the NEW entry date yet, we check if we are "clear" of the last trade.
                    
                    last_trade = None
                    last_trade_exit = None
                    
                    # Find the last trade for this stock in our list
                    stock_trades = [t for t in trades if t['symbol'] == symbol]
                    if stock_trades:
                        last_trade = stock_trades[-1] # List is appended chronologically
                        if last_trade['exit_date']:
                            last_trade_exit = pd.Timestamp(last_trade['exit_date'])
                        else:
                            # Last trade is OPEN. Cannot take new one.
                            continue

                    # If the last trade exited after the start of this entry window, 
                    # we might be overlapping.
                    # Actually, we just need to ensure new Entry Date > Last Exit Date.
                    

                    for date, row in entry_window.iterrows():
                        # Overlap Check
                        if last_trade_exit and date <= last_trade_exit:
                            continue
                            
                        if row['high'] > entry_trigger:
                            # TRIGGERED
                            entry_date = date
                            entry_price = max(entry_trigger, row['open'])
                            
                            # SANITY CHECK: Entry Price must be > Current ATH (Prev ATH)
                            # This filters out invalid setups caused by unadjusted splits or data glitches
                            if entry_price <= current_ath:
                                entry_date = None
                                continue
                                
                            break
                    
                    if entry_date:
                        # Trade is ON. Now scan for Weekly Exit.
                        exit_date = None
                        exit_price = 0.0
                        status = 'OPEN'
                        
                        # Get Weekly Data after Entry Date
                        trade_weekly = weekly_df[weekly_df.index > entry_date].copy()
                        
                        # Check Exit Condition: Close < 30 Week SMA
                        exit_signals = trade_weekly[
                            trade_weekly['close'] < trade_weekly['sma_30_weekly']
                        ]
                        
                        if not exit_signals.empty:
                            signal_date = exit_signals.index[0] # This is a Friday
                            
                            # Exit next trading day (Monday usually)
                            # Find first daily candle AFTER signal_date
                            next_days = df[df.index > signal_date]
                            if not next_days.empty:
                                exit_row = next_days.iloc[0]
                                exit_date = exit_row.name
                                exit_price = exit_row['open']
                                status = 'CLOSED'
                            else:
                                status = 'OPEN' 
                        
                        # Record Trade
                        pnl = 0.0
                        pnl_pct = 0.0
                        
                        current_price = df['close'].iloc[-1]
                        
                        if status == 'CLOSED':
                            pnl = exit_price - entry_price
                            pnl_pct = (pnl / entry_price) * 100
                        else:
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
                        
                        # This breakout resulted in a trade, so it's not "eligible" anymore
                        potential_eligible = None
                        
                        # Since we consumed this setup, we stop scanning this month (entry_window).
                        # break  <-- REMOVED (Was breaking stock loop)
                        pass
                        
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
                
                    # If we had a potential eligible stock and it didn't result in a trade, add it to the list
                    if potential_eligible is not None:
                        eligible_stocks.append(potential_eligible)

                # Update ATH tracking
                if month['high'] > current_ath:
                    current_ath = month['high']
                    current_ath_date = month_date
                    
        except Exception as e:
            # print(f"Error processing {symbol}: {str(e)}")
            continue

    print(f"Total Trades Found: {len(trades)}")
    print(f"Eligible Stocks (Recent Breakouts): {len(eligible_stocks)}")
    
    # Save Results
    output = {
        'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'trades': sorted(trades, key=lambda x: x['entry_date'], reverse=True),
        'eligible_stocks': sorted(eligible_stocks, key=lambda x: x['breakout_date'], reverse=True)
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
        
        # --- Advanced Metrics ---
        # 1. Equity Curve (Daily/Weekly or Trade-based?)
        # Trade-based implies "Discrete" equity curve (Balance updates only on exit).
        # We'll do a Trade-based curve sorted by Exit Date for simplicity and clarity.
        
        equity_curve = []
        cumulative_pnl = 0.0
        peak_equity = 0.0
        drawdown_abs = 0.0
        max_drawdown = 0.0
        
        # Sort closed trades by Exit Date
        sorted_closed = sorted(closed_trades, key=lambda x: x['exit_date'])
        
        for t in sorted_closed:
            cumulative_pnl += t['pnl']
            
            # Max Drawdown Calc
            if cumulative_pnl > peak_equity:
                peak_equity = cumulative_pnl
            
            # Drawdown (Peak - Current)
            dd = peak_equity - cumulative_pnl
            if dd > max_drawdown:
                max_drawdown = dd
                
            equity_curve.append({
                'date': t['exit_date'],
                'equity': round(cumulative_pnl, 2),
                'pnl': t['pnl']
            })
            
        # 2. Profit Factor
        gross_profit = sum([t['pnl'] for t in closed_trades if t['pnl'] > 0])
        gross_loss = abs(sum([t['pnl'] for t in closed_trades if t['pnl'] < 0]))
        profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else float('inf')
        
        # 3. Avg Win / Loss
        winning_trades = [t['pnl'] for t in closed_trades if t['pnl'] > 0]
        losing_trades = [t['pnl'] for t in closed_trades if t['pnl'] <= 0]
        
        avg_win = round(sum(winning_trades) / len(winning_trades), 2) if winning_trades else 0
        avg_loss = round(sum(losing_trades) / len(losing_trades), 2) if losing_trades else 0
        
        output['summary'].update({
            'profit_factor': profit_factor,
            'max_drawdown': round(max_drawdown, 2),
            'avg_win': avg_win,
            'avg_loss': avg_loss
        })
        
        output['equity_curve'] = equity_curve
    
    out_path = os.path.join(base_dir, 'web', 'src', 'data', 'backtest_results_ath.json')
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    
    with open(out_path, 'w') as f:
        json.dump(output, f, indent=2)
        
    print(f"Saved results to {out_path}")

if __name__ == "__main__":
    run_backtest()
