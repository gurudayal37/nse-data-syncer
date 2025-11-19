import argparse
import os
from datetime import date, timedelta
import time
from database import DatabaseManager
from fetcher import fetch_stock_data
from utils import get_nse_symbols

CSV_PATH = "ind_niftytotalmarket_list.csv"

def main():
    parser = argparse.ArgumentParser(description="NSE Stock Data Syncer")
    parser.add_argument("--limit", type=int, help="Limit the number of symbols to process (for testing)")
    parser.add_argument("--dry-run", action="store_true", help="Fetch data but do not write to database")
    args = parser.parse_args()

    print("Starting NSE Stock Data Syncer...")
    
    # 1. Initialize Database
    db_manager = DatabaseManager()
    # Note: We are NOT calling create_tables() as we are using existing schema.
    
    # 2. Get Symbol Map
    print("Fetching symbol mapping from database...")
    symbol_map = db_manager.get_symbol_map()
    print(f"Found {len(symbol_map)} existing stocks in DB.")
    
    # 3. Get Symbols from CSV
    print(f"Reading symbols from {CSV_PATH}...")
    csv_symbols = get_nse_symbols(CSV_PATH)
    print(f"Found {len(csv_symbols)} symbols in CSV.")
    
    if args.limit:
        csv_symbols = csv_symbols[:args.limit]
        print(f"Limiting to first {args.limit} symbols.")

    # 4. Process Symbols
    processed_count = 0
    skipped_count = 0
    
    for i, symbol in enumerate(csv_symbols):
        print(f"[{i+1}/{len(csv_symbols)}] Processing {symbol}...")
        
        stock_id = symbol_map.get(symbol)
        if not stock_id:
            print(f"  Warning: Symbol {symbol} not found in 'stocks' table. Skipping.")
            skipped_count += 1
            continue
            
        try:
            # Check last synced date
            last_date = None
            if not args.dry_run:
                last_date = db_manager.get_last_synced_date(stock_id)
            
            start_date = None
            if last_date:
                print(f"  Last synced: {last_date}")
                start_date = last_date + timedelta(days=1)
                if start_date > date.today():
                    print("  Data up to date.")
                    continue
            else:
                print("  No existing data. Fetching full history.")

            # Fetch data
            df = fetch_stock_data(symbol, start_date=start_date)
            
            if df.empty:
                print("  No new data found.")
                continue
                
            print(f"  Fetched {len(df)} records.")
            
            # Insert data
            if not args.dry_run:
                db_manager.bulk_insert(df, stock_id)
            else:
                print("  [Dry Run] Skipping DB insert.")
                
            processed_count += 1
            
            # Basic rate limiting
            time.sleep(0.5)
            
        except Exception as e:
            print(f"  Error processing {symbol}: {e}")
            continue

    print(f"Sync completed. Processed: {processed_count}, Skipped: {skipped_count}")

if __name__ == "__main__":
    main()
