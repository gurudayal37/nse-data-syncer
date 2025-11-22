import argparse
import os
from datetime import date
import time
from dotenv import load_dotenv

# Load env from web/.env if DATABASE_URL not set
if not os.getenv('DATABASE_URL'):
    from .helpers import get_project_root
    load_dotenv(get_project_root() / 'web' / '.env')

from .database import DatabaseManager
from .fetcher import fetch_stock_data
from .utils import get_nse_symbols, load_equity_list
from .helpers import (
    get_data_path,
    validate_data_mismatch,
    determine_fetch_strategy
)
from .constants import (
    CSV_FILENAME,
    EQUITY_LIST_FILENAME,
    RATE_LIMIT_DELAY_SECONDS,
    VALIDATION_RECORDS_COUNT
)

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
        csv_path = get_data_path(CSV_FILENAME)
        csv_symbols = get_nse_symbols(str(csv_path))
        print(f"Found {len(csv_symbols)} symbols in CSV.")
    
    if args.limit:
        csv_symbols = csv_symbols[:args.limit]
        print(f"Limiting to first {args.limit} symbols.")

    # Load Equity List for missing stock details
    equity_list_path = get_data_path(EQUITY_LIST_FILENAME)
    equity_details = load_equity_list(str(equity_list_path))
    print(f"Loaded {len(equity_details)} equity details.")
    
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
            is_full_resync = False
            df = None
            
            if last_synced_date:
                # Fetch last N records for validation
                last_records_raw = db_manager.get_last_n_records(stock_id, n=VALIDATION_RECORDS_COUNT)
                last_records = {k.date(): v for k, v in last_records_raw.items()} if last_records_raw else {}
                
                if last_records:
                    min_validation_date = min(last_records.keys())
                    df_validation = fetch_stock_data(symbol, start_date=min_validation_date)
                    
                    if not df_validation.empty:
                        print(f"  Validation: Checking {len(df_validation)} records against DB...")
                        is_full_resync = validate_data_mismatch(symbol, df_validation, last_records)
                        
                        if is_full_resync:
                            if not args.dry_run:
                                db_manager.delete_daily_prices(stock_id)
                        else:
                            # No mismatch, only insert new data
                            df = df_validation[df_validation.index > last_synced_date]
                            if not args.dry_run:
                                db_manager.update_performance_metrics(stock_id)
            
            # Determine fetch strategy
            start_date, should_fetch = determine_fetch_strategy(last_synced_date, is_full_resync, df)
            
            if should_fetch:
                df = fetch_stock_data(symbol, start_date=start_date)

            if df is not None and not df.empty: # Check if df is not None before checking empty
                print(f"  Fetched {len(df)} records.")
                if not args.dry_run:
                    db_manager.insert_daily_prices(stock_id, df)
                    # Update performance metrics
                    print(f"  Updating performance metrics for {symbol}...")
                    db_manager.update_performance_metrics(stock_id)
            else:
                print("  No new data found.")
                
            processed_count += 1
            # Basic rate limiting
            time.sleep(RATE_LIMIT_DELAY_SECONDS)
            
        except Exception as e:
            print(f"  Error processing {symbol}: {e}")
            skipped_count += 1
            continue

    print(f"Sync completed. Processed: {processed_count}, Skipped: {skipped_count}")

if __name__ == "__main__":
    main()
