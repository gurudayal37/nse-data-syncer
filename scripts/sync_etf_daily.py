"""
Daily ETF data sync script
Fetches latest OHLCV data for all ETFs and updates performance metrics
"""
import os
import sys
from datetime import datetime, timedelta
import yfinance as yf
import pandas as pd
from dotenv import load_dotenv

# Load environment variables
load_dotenv('web/.env')

# Ensure we can import from app
sys.path.append(os.getcwd())

from app.database import DatabaseManager, ETF
from app.helpers import validate_data_mismatch
from app.constants import VALIDATION_RECORDS_COUNT

# Database URL
DB_URL = os.getenv('DATABASE_URL')
if not DB_URL:
    raise ValueError("DATABASE_URL environment variable is not set.")

def sync_etf_daily():
    """Sync daily ETF data - fetch latest prices and update performance metrics"""
    print(f"Starting ETF daily sync at {datetime.now()}")
    
    db = DatabaseManager(db_url=DB_URL)
    
    # Get all active ETFs
    etf_map = db.get_etf_symbol_map()
    
    if not etf_map:
        print("No ETFs found in database")
        return
    
    print(f"Found {len(etf_map)} ETFs to sync")
    
    # Get last 5 trading days to ensure we don't miss any data
    end_date = datetime.now()
    start_date = end_date - timedelta(days=90)
    
    successful = 0
    failed = 0
    
    # Process in batches
    symbols = list(etf_map.keys())
    batch_size = 50
    
    for i in range(0, len(symbols), batch_size):
        batch = symbols[i:i+batch_size]
        batch_num = i//batch_size + 1
        total_batches = (len(symbols) + batch_size - 1) // batch_size
        
        print(f"\nProcessing batch {batch_num}/{total_batches} ({len(batch)} ETFs)...")
        
        # Add .NS suffix for NSE
        yf_symbols = [f"{s}.NS" for s in batch]
        
        try:
            data = yf.download(
                yf_symbols,
                start=start_date.strftime('%Y-%m-%d'),
                end=end_date.strftime('%Y-%m-%d'),
                group_by='ticker',
                threads=True,
                progress=False,
                auto_adjust=False
            )
            
            if data.empty:
                print(f"  No data returned for batch {batch_num}")
                failed += len(batch)
                continue
            
            # Process each ETF
            for symbol in batch:
                yf_sym = f"{symbol}.NS"
                etf_id = etf_map[symbol]
                
                try:
                    # Handle single vs multiple symbols
                    if len(batch) == 1:
                        etf_df = data.copy()
                    else:
                        if yf_sym not in data.columns:
                            print(f"  ⚠️  {symbol}: No data available")
                            failed += 1
                            continue
                        etf_df = data[yf_sym].copy()
                    
                    # Drop rows with no close price
                    etf_df.dropna(subset=['Close'], inplace=True)
                    
                    if etf_df.empty:
                        print(f"  ⚠️  {symbol}: No valid data")
                        failed += 1
                        continue
                    
                    # Validation: Check for mismatches
                    last_records = db.get_etf_last_n_records(etf_id, n=VALIDATION_RECORDS_COUNT)
                    if validate_data_mismatch(symbol, etf_df, last_records):
                        print(f"  ⚠️  Mismatch confirmed for {symbol}. Cleaning up and re-syncing...")
                        db.delete_etf_prices(etf_id)
                        
                        # Re-fetch full history for this specific ETF
                        print(f"  🔄  Resyncing {symbol} from scratch...")
                        full_data = yf.download(yf_sym, period="max", progress=False, auto_adjust=False)
                        if not full_data.empty:
                            etf_df = full_data
                            print(f"     Resynced {len(etf_df)} records.")
                        else:
                            print(f"     Failed to resync {symbol}.")
                            failed += 1
                            continue

                    # Insert daily prices (will skip duplicates based on date)
                    # Check last synced date to avoid duplicates
                    last_synced_date = db.get_etf_last_synced_date(etf_id)
                    
                    if last_synced_date:
                        # Ensure last_synced_date is timezone-naive/aware matching df
                        last_ts = pd.Timestamp(last_synced_date)
                        if etf_df.index.tz is not None and last_ts.tz is None:
                             last_ts = last_ts.tz_localize(etf_df.index.tz)
                        elif etf_df.index.tz is None and last_ts.tz is not None:
                             last_ts = last_ts.tz_convert(None)
                             
                        etf_df_to_insert = etf_df[etf_df.index > last_ts]
                    else:
                        etf_df_to_insert = etf_df

                    if not etf_df_to_insert.empty:
                        db.insert_etf_daily_prices(etf_id, etf_df_to_insert)
                        print(f"  ✓ {symbol}: {len(etf_df_to_insert)} new records synced")
                        successful += 1
                    else:
                        print(f"  - {symbol}: No new data")
                        successful += 1 # Count as success even if no new data

                    # Update performance metrics
                    db.update_etf_performance_metrics(etf_id)
                    
                except Exception as e:
                    print(f"  ✗ {symbol}: Error - {e}")
                    failed += 1
                    
        except Exception as e:
            print(f"Error in batch {batch_num}: {e}")
            failed += len(batch)
    
    print(f"\n{'='*60}")
    print(f"ETF Daily Sync Complete!")
    print(f"{'='*60}")
    print(f"Total ETFs: {len(symbols)}")
    print(f"Successful: {successful}")
    print(f"Failed: {failed}")
    print(f"Completed at: {datetime.now()}")
    print(f"{'='*60}")

if __name__ == "__main__":
    sync_etf_daily()
