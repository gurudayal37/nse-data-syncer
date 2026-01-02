import pandas as pd
import sqlite3
import os
from datetime import datetime
import csv

# Configuration
DB_PATH = 'data/stocks.db'
CSV_PATH = 'data/ind_niftytotalmarket_list.csv'
OUTPUT_FILE = 'top_25_performers_2025.csv'
START_DATE = '2025-01-01'

def get_db_connection():
    return sqlite3.connect(DB_PATH)

def get_trading_months():
    # Generate list of month ends for 2025 that have passed or are current
    # For now, we'll just determine month ends dynamically based on data availability
    return list(range(1, 13))

def get_month_name(month_num):
    return datetime(2025, month_num, 1).strftime('%b %Y')

def main():
    print("Connecting to database...")
    conn = get_db_connection()
    
    # 1. Load Stock List and Sectors
    print("Loading stock list...")
    try:
        stocks_df = pd.read_csv(CSV_PATH)
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return

    # Map Symbol to Sector and Name
    symbol_info = {}
    for _, row in stocks_df.iterrows():
        symbol_info[row['Symbol']] = {
            'Name': row['Company Name'],
            'Sector': row['Industry']
        }

    # 2. Get Stock IDs from DB
    print("Fetching stock IDs...")
    query_stocks = "SELECT id, nse_symbol FROM stocks"
    db_stocks = pd.read_sql_query(query_stocks, conn)
    symbol_to_id = dict(zip(db_stocks['nse_symbol'], db_stocks['id']))

    # 3. Process Each Stock
    results = []
    
    print("Processing stocks data...")
    # Filter stocks that are in our target list
    target_symbols = [s for s in symbol_info.keys() if s in symbol_to_id]
    
    for symbol in target_symbols:
        stock_id = symbol_to_id[symbol]
        
        # Fetch prices for 2025
        query_prices = f"""
            SELECT date, close_price 
            FROM daily_prices 
            WHERE stock_id = {stock_id} AND date >= '{START_DATE}'
            ORDER BY date ASC
        """
        prices_df = pd.read_sql_query(query_prices, conn)
        
        if prices_df.empty:
            continue
            
        prices_df['date'] = pd.to_datetime(prices_df['date'])
        
        # Base Price (First available price in 2025)
        base_price = prices_df.iloc[0]['close_price']
        
        # Calculate monthly cumulative returns
        stock_data = {
            'Stock Name': symbol_info[symbol]['Name'],
            'Sector': symbol_info[symbol]['Sector'],
            'Symbol': symbol
        }
        
        latest_return = -9999.0
        
        # Group by month
        prices_df['month'] = prices_df['date'].dt.month
        monthly_groups = prices_df.groupby('month')
        
        for month in range(1, 13):
            month_name = get_month_name(month)
            col_name = month_name
            
            if month in monthly_groups.groups:
                # Get the last price of the month
                last_price = monthly_groups.get_group(month).iloc[-1]['close_price']
                cum_return = ((last_price - base_price) / base_price) * 100
                stock_data[col_name] = round(cum_return, 2)
                latest_return = cum_return
            else:
                # If month data not available yet, leave empty or handle as needed
                # For future months, we just leave blank
                stock_data[col_name] = None
        
        stock_data['latest_return'] = latest_return
        results.append(stock_data)

    # 4. Sort and Filter
    print("Ranking stocks...")
    # Sort by latest return descending
    results.sort(key=lambda x: x['latest_return'], reverse=True)
    
    top_25 = results[:25]
    
    # 5. Output to CSV
    print(f"Writing results to {OUTPUT_FILE}...")
    
    # Prepare columns
    months_cols = [get_month_name(m) for m in range(1, 13)]
    fieldnames = ['Stock Name', 'Sector', 'Symbol'] + months_cols
    
    # Check which months actually have data to avoid empty columns if desired, 
    # but requirement says "Jan 2025... Dec 2025", so we keep them all.
    
    with open(OUTPUT_FILE, 'w', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        for row in top_25:
            writer.writerow(row)
            
    print("Done!")

if __name__ == "__main__":
    main()
