import argparse
import os
from datetime import date, datetime, timedelta
import time
from dotenv import load_dotenv
from collections import defaultdict
from sqlalchemy import text

# Load env from web/.env if DATABASE_URL not set
if not os.getenv('DATABASE_URL'):
    from .helpers import get_project_root
    load_dotenv(get_project_root() / 'web' / '.env')

from .database import DatabaseManager
from .fetcher import fetch_stock_data, fetch_batch_data
from .utils import get_nse_symbols, load_equity_list, get_remaining_symbols, load_full_equity_list
from .helpers import get_data_path

from .constants import (
    CSV_FILENAME,
    EQUITY_LIST_FILENAME,
    FULL_EQUITY_LIST_FILENAME,
    RATE_LIMIT_DELAY_SECONDS,
    VALIDATION_RECORDS_COUNT,
)
from .helpers import validate_data_mismatch

def main():
    parser = argparse.ArgumentParser(description="NSE Stock Data Syncer (Optimized)")
    parser.add_argument('--limit', type=int, help='Limit the number of symbols to process')
    parser.add_argument('--dry-run', action='store_true', help='Perform a dry run without writing to DB')
    parser.add_argument('--symbols', type=str, help='Comma-separated list of symbols to process (overrides CSV)')
    parser.add_argument('--source', type=str, choices=['default', 'remaining'], default='default', help='Source of symbols to sync')
    args = parser.parse_args()

    print("Starting NSE Stock Data Syncer (Optimized)...")
    
    # 1. Initialize Database
    db_manager = DatabaseManager()
    
    # 2. Get Symbol Map & Sync Missing Stocks
    print("Fetching symbol mapping from database...")
    symbol_map = db_manager.get_symbol_map()
    
    if args.symbols:
        csv_symbols = [s.strip() for s in args.symbols.split(',')]
        print(f"Processing specific symbols: {csv_symbols}")
    elif args.source == 'remaining':
        print("Calculating remaining stocks (in Full List but not in Nifty Total Market)...")
        csv_path = get_data_path(CSV_FILENAME)
        full_list_path = get_data_path(FULL_EQUITY_LIST_FILENAME)
        csv_symbols = get_remaining_symbols(str(full_list_path), str(csv_path))
        print(f"Found {len(csv_symbols)} remaining symbols to sync.")
    else:
        csv_path = get_data_path(CSV_FILENAME)
        csv_symbols = get_nse_symbols(str(csv_path))
        print(f"Found {len(csv_symbols)} symbols in CSV.")
    
    if args.limit:
        csv_symbols = csv_symbols[:args.limit]
        print(f"Limiting to first {args.limit} symbols.")

    # Check for missing stocks
    missing_symbols = [s for s in csv_symbols if s not in symbol_map]
    if missing_symbols:
        print(f"Found {len(missing_symbols)} new symbols to insert.")
        equity_list_path = get_data_path(EQUITY_LIST_FILENAME)
        equity_details = load_equity_list(str(equity_list_path))
        
        # Load full list for fallback
        full_list_path = get_data_path(FULL_EQUITY_LIST_FILENAME)
        full_details = load_full_equity_list(str(full_list_path))
        
        inserted_count = 0
        for sym in missing_symbols:
            details = equity_details.get(sym) or full_details.get(sym)
            
            if details:
                sid = db_manager.insert_stock(sym, details)
                if sid: 
                    symbol_map[sym] = sid
                    inserted_count += 1
            else:
                print(f"  Warning: Symbol {sym} not found in Equity List. Skipping.")
        print(f"Inserted {inserted_count} new stocks.")
        
    # ONE-TIME FIX: Ensure all stocks in symbol_map have is_active = True
    # Since we found some might be NULL
    print("Ensuring all tracked stocks are active...")
    with db_manager.engine.connect() as conn:
        conn.execute(text("UPDATE stocks SET is_active = true WHERE is_active IS NULL"))
        conn.commit()
    
    # 3. Group by Last Synced Date
    print("Getting sync status for all stocks...")
    last_synced_dates = db_manager.get_all_last_synced_dates() # {stock_id: date}
    
    # Group: date -> list of symbols
    batches = defaultdict(list)
    
    processed_count = 0
    
    for sym in csv_symbols:
        sid = symbol_map.get(sym)
        if not sid: continue
        
        last_date = last_synced_dates.get(sid)
        
        # Ensure we have date object, not datetime, for consistent grouping/sorting
        if isinstance(last_date, datetime):
            last_date = last_date.date()
            
        batches[last_date].append(sym)
        
    # 4. Process Batches
    # Sort batches by date (None/oldest first) to prioritize catching up
    # We convert None to date.min for sorting
    sorted_dates = sorted(batches.keys(), key=lambda d: d if d else date.min)
    
    BATCH_SIZE = 100 # yfinance is efficient with ~100
    
    print(f"Processing {len(sorted_dates)} distinct sync groups...")
    
    for last_date in sorted_dates:
        symbols = batches[last_date]
        
        # Calculate start_date
        start_date = None
        if last_date:
            # Ensure we have date object, not datetime
            if isinstance(last_date, datetime):
                last_date = last_date.date()
                
            start_date = last_date + timedelta(days=1)
            # If start_date is in future (e.g. run multiple times same day), skip
            if start_date > date.today():
                continue 
        
        print(f"Group {last_date or 'New'}: Processing {len(symbols)} stocks (Start: {start_date or 'Max'})...")
        
        # Split into smaller chunks
        chunks = [symbols[i:i + BATCH_SIZE] for i in range(0, len(symbols), BATCH_SIZE)]
        
        for i, chunk in enumerate(chunks):
            print(f"  Batch {i+1}/{len(chunks)} ({len(chunk)} symbols)...")
            
            # Fetch Batch
            # 5a. Validation: Get last N records for validation
            validation_data = {}
            for sym in chunk:
                sid = symbol_map.get(sym)
                if sid:
                    validation_data[sym] = db_manager.get_last_n_records(sid, n=VALIDATION_RECORDS_COUNT)

            data_dict = fetch_batch_data(chunk, start_date=start_date)
            
            if not data_dict:
                print("    No new data found.")
                continue
            
            # 5b. Check for Mismatches (Splits/Bonuses)
            valid_data_dict = {}
            resync_list = []
            
            for sym, df_new in data_dict.items():
                last_records = validation_data.get(sym, {})
                if validate_data_mismatch(sym, df_new, last_records):
                    print(f"    ⚠️  Mismatch confirmed for {sym}. Cleaning up and re-syncing...")
                    sid = symbol_map.get(sym)
                    if sid:
                        db_manager.delete_stock_prices(sid)
                        resync_list.append(sym)
                else:
                    valid_data_dict[sym] = df_new
            
            # 5c. Handle Resyncs (Fetch full history)
            if resync_list:
                print(f"    🔄  Resyncing {len(resync_list)} stocks from scratch...")
                # Fetch full history (start_date=None)
                full_data_dict = fetch_batch_data(resync_list, start_date=None)
                for sym, df_full in full_data_dict.items():
                     if not df_full.empty:
                         valid_data_dict[sym] = df_full
                         print(f"       Resynced {sym} ({len(df_full)} records).")

            if not valid_data_dict:
                 print("    No valid data to insert after validation.")
                 continue

            print(f"    Fetched data for {len(valid_data_dict)} stocks.")
            
            # Insert Batch
            if not args.dry_run:
                db_manager.insert_batch_daily_prices(symbol_map, valid_data_dict)
                
                # Update metrics (optional, but good for consistency)
                # Doing it simply here. Can be optimized further if needed.
                for sym in data_dict.keys():
                    sid = symbol_map.get(sym)
                    if sid: db_manager.update_performance_metrics(sid)
            
            processed_count += len(data_dict)
            time.sleep(1) # Mild rate limit between batches
            
    print(f"Sync completed. Processed/Updated: {processed_count}")
    
    # 6. Update Market Caps (New Feature)
    print("Updating Market Caps for all active stocks...")
    # We can do this based on active stocks in DB
    with db_manager.Session() as session:
        active_stocks = session.execute(text("SELECT nse_symbol, id FROM stocks WHERE is_active = true")).fetchall()
        active_map = {row[0]: row[1] for row in active_stocks}
    
    all_symbols = list(active_map.keys())
    
    # Process in batches to avoid memory/rate issues if any, although fast_info is local calculation mostly? 
    # Actually fast_info might hit API lightly. safe to batch.
    BATCH_SIZE_MCAP = 500
    from .fetcher import fetch_current_market_caps
    
    updated_mcap_count = 0
    m_chunks = [all_symbols[i:i + BATCH_SIZE_MCAP] for i in range(0, len(all_symbols), BATCH_SIZE_MCAP)]
    
    for i, chunk in enumerate(m_chunks):
        print(f"  Market Cap Batch {i+1}/{len(m_chunks)} ({len(chunk)} symbols)...")
        mcaps = fetch_current_market_caps(chunk)
        
        updates = []
        for sym, mcap in mcaps.items():
             sid = active_map.get(sym)
             if sid:
                 updates.append({'id': sid, 'market_cap': mcap})
        
        if updates:
            db_manager.bulk_update_market_caps(updates)
            updated_mcap_count += len(updates)
            
    print(f"Market Cap updated for {updated_mcap_count} stocks.")

    # 7. Calculate Momentum Scores
    from .momentum import calculate_momentum
    calculate_momentum()

if __name__ == "__main__":
    main()
