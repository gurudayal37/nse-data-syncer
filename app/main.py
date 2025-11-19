import argparse
import os
from datetime import date, timedelta
import time
from .database import DatabaseManager
from .fetcher import fetch_stock_data
from .utils import get_nse_symbols
from . import utils

CSV_PATH = "ind_niftytotalmarket_list.csv"

def main():
    parser = argparse.ArgumentParser(description="NSE Stock Data Syncer")
    parser.add_argument('--limit', type=int, help='Limit the number of symbols to process')
    parser.add_argument('--dry-run', action='store_true', help='Perform a dry run without writing to DB')
    parser.add_argument('--symbols', type=str, help='Comma-separated list of symbols to process (overrides CSV)')
    args = parser.parse_args()

    print("Starting NSE Stock Data Syncer...")
    
    # 1. Initialize Database
    db_manager = DatabaseManager()
    # Note: We are NOT calling create_tables() as we are using existing schema.
    
    # 2. Get Symbol Map
    print("Fetching symbol mapping from database...")
    symbol_map = db_manager.get_symbol_map()
    print(f"Found {len(symbol_map)} existing stocks in DB.")
    
    # 3. Get Symbols
    if args.symbols:
        csv_symbols = [s.strip() for s in args.symbols.split(',')]
        print(f"Processing specific symbols: {csv_symbols}")
    else:
        # Path relative to app/main.py: ../data/ind_niftytotalmarket_list.csv
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        csv_path = os.path.join(base_dir, 'data', 'ind_niftytotalmarket_list.csv')
        csv_symbols = get_nse_symbols(csv_path)
        print(f"Found {len(csv_symbols)} symbols in CSV.")
    
    if args.limit:
        csv_symbols = csv_symbols[:args.limit]
        print(f"Limiting to first {args.limit} symbols.")

    # Load Equity List for missing stock details
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    equity_list_path = os.path.join(base_dir, 'data', 'Equity_List.csv')
    equity_details = utils.load_equity_list(equity_list_path)
    print(f"Loaded {len(equity_details)} equity details.")

    # Get existing symbol map
    symbol_map = db_manager.get_symbol_map()
    
    processed_count = 0
    skipped_count = 0
    
    for i, symbol in enumerate(csv_symbols): # Changed 'symbols' to 'csv_symbols'
        if args.limit and processed_count >= args.limit:
            break
            
        print(f"[{i+1}/{len(csv_symbols)}] Processing {symbol}...") # Changed 'symbols' to 'csv_symbols'
        
        stock_id = symbol_map.get(symbol)
        
        # Handle missing stock
        if not stock_id:
            if symbol in equity_details:
                print(f"  Symbol {symbol} not found in DB. Inserting from Equity List...")
                stock_id = db_manager.insert_stock(symbol, equity_details[symbol])
                if stock_id:
                    symbol_map[symbol] = stock_id  # Update map
            else:
                print(f"  Warning: Symbol {symbol} not found in 'stocks' table and Equity List. Skipping.")
                skipped_count += 1
                continue
        
        if not stock_id: # Double check if insertion failed
             skipped_count += 1
             continue

        try:
            last_synced_date = db_manager.get_last_synced_date(stock_id)
            
            # Validation and Fetch Logic
            start_date = None
            is_full_resync = False
            df = None # Initialize df to None
            
            if last_synced_date:
                # Fetch last 5 days for validation
                last_records_raw = db_manager.get_last_n_records(stock_id, n=5)
                last_records = {k.date(): v for k, v in last_records_raw.items()} if last_records_raw else {}
                if last_records:
                    min_validation_date = min(last_records.keys())
                    # Fetch data overlapping with existing data
                    df_validation = fetch_stock_data(symbol, start_date=min_validation_date) # Use a temporary df for validation
                    
                    if not df_validation.empty:
                        print(f"  Validation: Checking {len(df_validation)} records against DB...")
                        mismatch_detected = False
                        for date, row in df_validation.iterrows():
                            date_obj = date
                            if date_obj in last_records:
                                db_close = last_records[date_obj]
                                new_close = row['Close']
                                diff = abs(db_close - new_close) / db_close
                                # print(f"    Checking {date_obj}: DB={db_close}, New={new_close}, Diff={diff:.4f}")
                                # Check for > 1% difference
                                if diff > 0.01:
                                    print(f"  Mismatch detected for {symbol} on {date_obj}: DB={db_close}, New={new_close}. Triggering full resync.")
                                    mismatch_detected = True
                                    break
                        
                        if mismatch_detected:
                            if not args.dry_run:
                                db_manager.delete_daily_prices(stock_id)
                            is_full_resync = True
                            start_date = None # Fetch all
                        else:
                            # No mismatch, only insert new data
                            start_date = last_synced_date + timedelta(days=1)
                            # Filter df_validation to only new data
                            df = df_validation[df_validation.index > last_synced_date] # Assign filtered df to main df
                    else:
                         # No data fetched even for validation?
                         start_date = last_synced_date + timedelta(days=1)
                else:
                    start_date = last_synced_date + timedelta(days=1)
            
            # If we haven't fetched data yet (or need to refetch for full sync)
            if is_full_resync or (start_date and df is None): # Check if df is still None
                 df = fetch_stock_data(symbol, start_date=start_date)
            elif start_date is None and not is_full_resync and not last_synced_date:
                 # New stock, no history
                 df = fetch_stock_data(symbol)

            if df is not None and not df.empty: # Check if df is not None before checking empty
                print(f"  Fetched {len(df)} records.")
                if not args.dry_run:
                    db_manager.insert_daily_prices(stock_id, df)
            else:
                print("  No new data found.")
                
            processed_count += 1
            # Basic rate limiting
            time.sleep(0.5)
            
        except Exception as e:
            print(f"  Error processing {symbol}: {e}")
            skipped_count += 1
            continue

    print(f"Sync completed. Processed: {processed_count}, Skipped: {skipped_count}")

if __name__ == "__main__":
    main()
