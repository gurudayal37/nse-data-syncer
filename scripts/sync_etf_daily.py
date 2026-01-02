"""
Daily ETF data sync script
Fetches latest OHLCV data for all ETFs and updates performance metrics
"""
import os
import sys
from datetime import datetime, timedelta
import yfinance as yf
from dotenv import load_dotenv

# Load environment variables
load_dotenv('web/.env')

# Ensure we can import from app
sys.path.append(os.getcwd())

from app.database import DatabaseManager, ETF

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
    start_date = end_date - timedelta(days=7)
    
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
                    
                    # Insert daily prices (will skip duplicates based on date)
                    db.insert_etf_daily_prices(etf_id, etf_df)
                    
                    # Update performance metrics
                    db.update_etf_performance_metrics(etf_id)
                    
                    print(f"  ✓ {symbol}: {len(etf_df)} records synced")
                    successful += 1
                    
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
