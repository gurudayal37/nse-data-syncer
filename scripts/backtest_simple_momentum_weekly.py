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

def get_week_ends(years=8):
    """Get list of Friday dates for the last N years (default 8 years from 2017)"""
    today = datetime.now()
    dates = []
    # Start from N years ago
    start_date = today - relativedelta(years=years)
    
    # Find the first Friday
    current = start_date
    # weekday(): Monday=0, Sunday=6, so Friday=4
    days_until_friday = (4 - current.weekday()) % 7
    current = current + timedelta(days=days_until_friday)
    
    while current < today:
        dates.append(current)
        current += timedelta(weeks=1)  # Move to next Friday
        
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
                
            r6m = get_ret(126)
            r1y = get_ret(252)
            
            if None in [r6m, r1y]:
                continue
                
            # Only use 6M, 1Y (exclude 3M)
            mr_6m = r6m / volatility
            mr_1y = r1y / volatility
            
            scores.append({
                'stock_id': stock_id,
                'mr_6m': mr_6m,
                'mr_1y': mr_1y
            })
            
        except KeyError:
            continue
            
    if not scores:
        return []
        
    # Calculate Z-Scores (only for 6M, 1Y)
    df_scores = pd.DataFrame(scores)
    
    for period in ['6m', '1y']:
        col = f'mr_{period}'
        mean = df_scores[col].mean()
        std = df_scores[col].std()
        if std > 0:
            df_scores[f'z_{period}'] = (df_scores[col] - mean) / std
        else:
            df_scores[f'z_{period}'] = 0
            
    # Weighted Score (equal weights: 1/2 each)
    df_scores['weighted_z'] = (df_scores['z_6m'] + df_scores['z_1y']) / 2
    
    # Sort by weighted Z (descending)
    df_scores = df_scores.sort_values('weighted_z', ascending=False)
    
    return df_scores

def calculate_comprehensive_metrics(monthly_results, benchmark_results):
    """Calculate comprehensive backtest metrics"""
    
    # Convert to numpy arrays for calculations
    portfolio_returns = np.array([r['portfolio_return'] / 100 for r in monthly_results])
    benchmark_returns = np.array([r['benchmark_return'] / 100 for r in monthly_results])
    
    # Time Metrics
    start_date = monthly_results[0]['week']
    end_date = monthly_results[-1]['week']
    period_weeks = len(monthly_results)
    period_years = period_weeks / 52
    
    # Capital Metrics
    start_value = 100000  # Changed to 1 lakh
    cumulative_portfolio = np.cumprod(1 + portfolio_returns)
    cumulative_benchmark = np.cumprod(1 + benchmark_returns)
    end_value = start_value * cumulative_portfolio[-1]
    total_fees_paid = 0  # Will be updated later with actual fees
    open_trade_pnl = 0  # No open trades at end of backtest period
    
    # Return Metrics
    total_return = (end_value - start_value) / start_value
    benchmark_total_return = (start_value * cumulative_benchmark[-1] - start_value) / start_value
    
    # Expectancy (average return per trade/month)
    expectancy = np.mean(portfolio_returns)
    
    # Risk Metrics
    # Max Drawdown
    cumulative_values = start_value * cumulative_portfolio
    running_max = np.maximum.accumulate(cumulative_values)
    drawdowns = (cumulative_values - running_max) / running_max
    max_drawdown = np.min(drawdowns)
    
    # Max Drawdown Duration (in weeks)
    dd_duration = 0
    current_dd_duration = 0
    for dd in drawdowns:
        if dd < 0:
            current_dd_duration += 1
            dd_duration = max(dd_duration, current_dd_duration)
        else:
            current_dd_duration = 0
    
    # Sharpe Ratio (annualized, assuming risk-free rate = 0)
    excess_returns = portfolio_returns - 0  # Assuming risk-free rate = 0
    sharpe_ratio = (np.mean(excess_returns) * 52) / (np.std(excess_returns) * np.sqrt(52)) if np.std(excess_returns) > 0 else 0
    
    # Calmar Ratio (annualized return / max drawdown)
    annualized_return = (1 + total_return) ** (1 / period_years) - 1
    calmar_ratio = annualized_return / abs(max_drawdown) if max_drawdown != 0 else 0
    
    # Sortino Ratio (using downside deviation)
    downside_returns = portfolio_returns[portfolio_returns < 0]
    downside_std = np.std(downside_returns) if len(downside_returns) > 0 else 0
    sortino_ratio = (np.mean(excess_returns) * 52) / (downside_std * np.sqrt(52)) if downside_std > 0 else 0
    
    # Omega Ratio (probability weighted ratio of gains vs losses)
    threshold = 0
    gains = portfolio_returns[portfolio_returns > threshold]
    losses = portfolio_returns[portfolio_returns < threshold]
    omega_ratio = np.sum(gains - threshold) / abs(np.sum(losses - threshold)) if len(losses) > 0 and np.sum(losses - threshold) != 0 else 0
    
    # Exposure Metrics
    max_gross_exposure = 100  # Always 100% invested in this strategy
    
    # Trade Statistics
    total_trades = period_weeks  # One trade per week (rebalancing)
    total_closed_trades = period_weeks - 1  # All except current week
    total_open_trades = 1  # Current month position
    
    winning_trades = np.sum(portfolio_returns > 0)
    losing_trades = np.sum(portfolio_returns < 0)
    win_rate = (winning_trades / total_trades) * 100 if total_trades > 0 else 0
    
    best_trade = np.max(portfolio_returns) * 100
    worst_trade = np.min(portfolio_returns) * 100
    
    avg_winning_trade = np.mean(portfolio_returns[portfolio_returns > 0]) * 100 if winning_trades > 0 else 0
    avg_losing_trade = np.mean(portfolio_returns[portfolio_returns < 0]) * 100 if losing_trades > 0 else 0
    
    # Trade durations (all trades are 1 month)
    avg_winning_trade_duration = 1
    avg_losing_trade_duration = 1
    
    # Profit Factor
    gross_profit = np.sum(portfolio_returns[portfolio_returns > 0])
    gross_loss = abs(np.sum(portfolio_returns[portfolio_returns < 0]))
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0
    
    return {
        "time_metrics": {
            "start": start_date,
            "end": end_date,
            "period": f"{period_weeks} weeks ({period_years:.1f} years)"
        },
        "capital_metrics": {
            "start_value": round(start_value, 2),
            "end_value": round(end_value, 2),
            "total_fees_paid": round(total_fees_paid, 2),
            "open_trade_pnl": round(open_trade_pnl, 2)
        },
        "return_metrics": {
            "total_return": round(total_return * 100, 2),
            "benchmark_return": round(benchmark_total_return * 100, 2),
            "expectancy": round(expectancy * 100, 2)
        },
        "risk_metrics": {
            "max_drawdown": round(max_drawdown * 100, 2),
            "max_drawdown_duration": dd_duration,
            "sharpe_ratio": round(sharpe_ratio, 2),
            "calmar_ratio": round(calmar_ratio, 2),
            "omega_ratio": round(omega_ratio, 2),
            "sortino_ratio": round(sortino_ratio, 2)
        },
        "exposure_metrics": {
            "max_gross_exposure": max_gross_exposure
        },
        "trade_statistics": {
            "total_trades": total_trades,
            "total_closed_trades": total_closed_trades,
            "total_open_trades": total_open_trades,
            "win_rate": round(win_rate, 2),
            "best_trade": round(best_trade, 2),
            "worst_trade": round(worst_trade, 2),
            "avg_winning_trade": round(avg_winning_trade, 2),
            "avg_losing_trade": round(avg_losing_trade, 2),
            "avg_winning_trade_duration": avg_winning_trade_duration,
            "avg_losing_trade_duration": avg_losing_trade_duration,
            "profit_factor": round(profit_factor, 2)
        }
    }

def run_backtest():
    print("Starting **Simple** Momentum **Weekly** Backtest (6M + 1Y)...")
    db = DatabaseManager()
    
    # Ensure tables exist
    from app.database import Base
    Base.metadata.create_all(db.engine)
    
    session = db.Session()
    
    # 1. Fetch Benchmark (Nifty 50)
    print("Fetching Benchmark Data...")
    try:
        nifty = yf.download('^NSEI', start=(datetime.now() - relativedelta(years=10)).strftime('%Y-%m-%d'), progress=False)
        if nifty.empty:
            print("Warning: Could not fetch Nifty data. Benchmark returns will be 0.")
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

    # Load ALL daily prices into memory once
    print("Loading ALL price data into memory (this may take a moment)...")
    all_prices_query = text("SELECT stock_id, date, close_price FROM daily_prices ORDER BY date ASC")
    all_prices_result = session.execute(all_prices_query).fetchall()
    
    master_df = pd.DataFrame(all_prices_result, columns=['stock_id', 'date', 'close_price'])
    master_df['date'] = pd.to_datetime(master_df['date'])
    master_df.set_index('date', inplace=True)
    print(f"Loaded {len(master_df)} price records into memory.")

    # Load Stock Names
    stock_map = {}
    stocks = session.execute(text("SELECT id, nse_symbol FROM stocks")).fetchall()
    for s in stocks:
        stock_map[s.id] = s.nse_symbol
        
    # 2. Iterate Months (from 2017 to present)
    dates = get_week_ends(years=8)
    all_results = []
    
    print(f"Backtesting over {len(dates)} weeks...")

    # Pre-calculate eligible stocks based on Market Cap (Global Filter)
    min_mcap_cr = float(os.getenv('MIN_MARKET_CAP_CR', 2000))
    min_mcap = min_mcap_cr * 10000000
    
    valid_stocks_query = text(f"SELECT id FROM stocks WHERE is_active = true AND market_cap >= {min_mcap}")
    valid_stock_ids = [r[0] for r in session.execute(valid_stocks_query).fetchall()]
    print(f"Applying Global Market Cap Filter (> {min_mcap_cr} Cr). Eligible Stocks: {len(valid_stock_ids)}")
    
    # helper for processing a period
    def process_period(rebalance_date, next_rebalance_date, label_date=None, valid_stock_ids=None):
        print(f"Processing {rebalance_date.date()} -> {next_rebalance_date.date()}")
        
        start_window = rebalance_date - timedelta(days=400)
        
        try:
            df_slice = master_df.loc[start_window:rebalance_date]
        except KeyError:
            print("  No price data found for this period.")
            return None
            
        if df_slice.empty:
            print("  No price data found for this period.")
            return None
            
        df_window = df_slice.reset_index()
        df_window.set_index(['stock_id', 'date'], inplace=True)
        
        # Calculate Momentum
        top_stocks_df = calculate_momentum_for_date(session, rebalance_date, df_window, valid_stock_ids=valid_stock_ids)
        
        if top_stocks_df.empty:
            print("  No stocks found.")
            return None

        # Select Top 15 (Standard)
        top_stocks = top_stocks_df.head(15)
        selected_stock_ids = top_stocks['stock_id'].tolist()
        
        score_map = top_stocks.set_index('stock_id')['weighted_z'].to_dict()
        
        # Calculate Portfolio Return
        portfolio_returns = []
        stock_returns_detail = []
        
        try:
            df_next_slice = master_df.loc[rebalance_date + timedelta(days=1) : next_rebalance_date]
            df_next = df_next_slice[df_next_slice['stock_id'].isin(selected_stock_ids)].reset_index()
        except KeyError:
            df_next = pd.DataFrame()

        if not df_next.empty:
            for stock_id in selected_stock_ids:
                try:
                    start_price = df_window.loc[stock_id].iloc[-1]['close_price']
                except KeyError:
                    stock_returns_detail.append({
                        'symbol': stock_map.get(stock_id, 'Unknown'),
                        'return': None,
                        'score': round(score_map.get(stock_id, 0), 2)
                    })
                    continue
                    
                stock_data_next = df_next[df_next['stock_id'] == stock_id].sort_values('date')
                if stock_data_next.empty:
                    stock_returns_detail.append({
                        'symbol': stock_map.get(stock_id, 'Unknown'),
                        'return': 0.0,
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
            if not stock_returns_detail:
                for stock_id in selected_stock_ids:
                     stock_returns_detail.append({
                        'symbol': stock_map.get(stock_id, 'Unknown'),
                        'return': 0.0,
                        'score': round(score_map.get(stock_id, 0), 2)
                    })
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
            
        print(f"  Port: {port_ret:.2%}, Bench: {bench_ret:.2%}")
        
        if label_date:
            week_label = label_date
        else:
            week_label = next_rebalance_date.strftime('%Y-%m-%d')

        return {
            'week': week_label,
            'portfolio_return': round(port_ret * 100, 2),
            'benchmark_return': round(bench_ret * 100, 2),
            'holdings': stock_returns_detail
        }

    for i, rebalance_date in enumerate(dates[:-1]):
        next_rebalance_date = dates[i+1]
        week_label = next_rebalance_date.strftime('%Y-%m-%d')
        
        print(f"Processing {rebalance_date.date()} -> {next_rebalance_date.date()} ({week_label})")
        res = process_period(rebalance_date, next_rebalance_date, valid_stock_ids=valid_stock_ids)
        if res:
            all_results.append(res)
            
    # Current Month (Live)
    last_rebalance_date = dates[-1]
    today = datetime.now()
    
    if today > last_rebalance_date:
        next_friday = last_rebalance_date + timedelta(days=7)
        current_week_label = next_friday.strftime('%Y-%m-%d')
        
        # Market Cap Filter is already applied globally

        print(f"Processing Current Week (Live): {last_rebalance_date.date()} -> {today.date()}")
        res = process_period(last_rebalance_date, today, label_date=current_week_label, valid_stock_ids=valid_stock_ids)
        if res:
            all_results.append(res)

    # Sort all results by week ascending for proper calculation/splitting
    all_results.sort(key=lambda x: x['week'])

    # Split into backtest period (until Nov 2025) and current performance (Dec 2025+)
    backtest_cutoff = "2025-11-28"
    backtest_results = [r for r in all_results if r['week'] <= backtest_cutoff]
    current_results = [r for r in all_results if r['week'] > backtest_cutoff]
    
    # Calculate actual transactions specific to the BACKTEST set
    # Note: We need to carefully handle the transition. The transactions for the first week of current period
    # depend on the last week of backtest period.
    # However, for pure backtest metrics, we only care about transactions occurring WITHIN the backtest period.
    
    print("\nCalculating actual transactions (Backtest Period)...")
    total_transactions = 0
    previous_holdings = set()
    
    # We iterate only through backtest_results to calculate fees relevant to that period
    sorted_backtest = sorted(backtest_results, key=lambda x: x['week'])
    
    for result in sorted_backtest:
        # Get current month's stock symbols
        current_holdings = set([h['symbol'] for h in result['holdings']])
        
        if previous_holdings:
            # Stocks that need to be sold (in previous but not in current)
            stocks_to_sell = previous_holdings - current_holdings
            # Stocks that need to be bought (in current but not in previous)
            stocks_to_buy = current_holdings - previous_holdings
            
            # Each buy or sell is a transaction
            transactions_this_week = len(stocks_to_sell) + len(stocks_to_buy)
            total_transactions += transactions_this_week
        else:
            # First week: buy all 15 stocks
            total_transactions += len(current_holdings)
        
        previous_holdings = current_holdings
    
    # Calculate fees (assuming 0.03% brokerage per transaction, both buy and sell)
    # Fee per transaction = portfolio_value * position_size * fee_rate
    # Simplified: Assume equal allocation, so each stock = 1/15 of portfolio
    # Average portfolio value over the BACKTEST period
    start_value = 100000  # 1 lakh
    cumulative_values = []
    port_value = start_value
    for r in sorted_backtest:
        port_value = port_value * (1 + r['portfolio_return'] / 100)
        cumulative_values.append(port_value)
    
    if cumulative_values:
        avg_portfolio_value = np.mean(cumulative_values)
        fee_per_transaction = (avg_portfolio_value / 15) * 0.0003  # 0.03% fee
        total_fees_paid = total_transactions * fee_per_transaction
        
        # Calculate net return after fees for BACKTEST period
        final_value = cumulative_values[-1]
        net_value_after_fees = final_value - total_fees_paid
        net_return_after_fees = ((net_value_after_fees - start_value) / start_value) * 100
    else:
        avg_portfolio_value = 0
        total_fees_paid = 0
        net_return_after_fees = 0

    print(f"Total Transactions: {total_transactions}")
    print(f"Average Portfolio Value: ₹{avg_portfolio_value:.2f}")
    print(f"Total Fees Paid: ₹{total_fees_paid:.2f}")
    print(f"Net Return After Fees: {net_return_after_fees:.2f}%")
    
    # Calculate comprehensive metrics for backtest period
    print("\nCalculating comprehensive metrics...")
    backtest_metrics = calculate_comprehensive_metrics(backtest_results, backtest_results)
    
    # Update with actual transaction data
    backtest_metrics['trade_statistics']['total_stock_transactions'] = total_transactions
    backtest_metrics['capital_metrics']['total_fees_paid'] = round(total_fees_paid, 2)
    backtest_metrics['return_metrics']['net_return_after_fees'] = round(net_return_after_fees, 2)
    
    # Prepare final output
    output_data = {
        "backtest_metrics": backtest_metrics,
        "backtest_results": sorted(backtest_results, key=lambda x: x['week'], reverse=True),
        "current_performance": sorted(current_results, key=lambda x: x['week'], reverse=True)
    }
    
    output_path = os.path.join(base_dir, 'web', 'src', 'data', 'backtest_results_simple_weekly.json')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(output_data, f, indent=2)
        
    print(f"\nBacktest saved to {output_path}")
    print(f"Backtest period: {len(backtest_results)} weeks")
    print(f"Current performance: {len(current_results)} weeks")

if __name__ == "__main__":
    run_backtest()
