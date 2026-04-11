"""
Setup script to initialize indices in the database and pull their maximum historical data.
"""
import os
import sys
from datetime import datetime
import yfinance as yf
import pandas as pd
from dotenv import load_dotenv

# Load environment variables
load_dotenv('web/.env')

# Ensure we can import from app
sys.path.append(os.getcwd())

from app.database import DatabaseManager

DB_URL = os.getenv('DATABASE_URL')
if not DB_URL:
    raise ValueError("DATABASE_URL environment variable is not set.")

INDEX_MAPPING = {
  "^NSEI": "Nifty 50",
  "NIFTYMIDCAP150.NS": "Nifty Midcap 150",
  "NIFTY_LARGEMID250.NS": "Nifty Largemid 250",
  "NIFTYSMLCAP250.NS": "Nifty Smallcap 250",
  "^CRSLDX": "Nifty 500"
}

def setup_indices():
    print("Setting up Indices...")
    db = DatabaseManager(db_url=DB_URL)
    
    for symbol, name in INDEX_MAPPING.items():
        print(f"Processing index: {name} ({symbol})")
        # Ensure it exists
        index_id = db.insert_index(symbol, {'name': name})
        
        if not index_id:
            print(f"  Failed to insert {symbol} into indices table.")
            continue
            
        print(f"  Fetching full history for {symbol}...")
        try:
            data = yf.download(symbol, start="2000-01-01", progress=False, auto_adjust=False)
            
            if data.empty:
                print(f"  No data found for {symbol}.")
                continue
                
            # If yf returns MultiIndex when fetching single symbol sometimes
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)
            
            data.dropna(subset=['Close'], inplace=True)
            
            if data.empty:
                print(f"  No valid close price data found for {symbol}.")
                continue
                
            # Clear existing prices if any just to ensure clean state
            db.delete_index_prices(index_id)
            
            # Insert prices
            db.insert_index_daily_prices(index_id, data)
            print(f"  Inserted {len(data)} records for {symbol}.")
            
            # Update metrics
            db.update_index_performance_metrics(index_id)
            print(f"  Updated performance metrics for {symbol}.")
            
        except Exception as e:
            print(f"  Error processing {symbol}: {e}")

    print("Finished setting up Indices.")

if __name__ == "__main__":
    setup_indices()
