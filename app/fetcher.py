import yfinance as yf
import pandas as pd
from datetime import timedelta

def fetch_stock_data(symbol, start_date=None):
    """
    Fetches daily OHLCV data from Yahoo Finance.
    
    Args:
        symbol (str): The NSE symbol (without suffix).
        start_date (date): The start date for fetching data. If None, fetches max available history.
    
    Returns:
        pd.DataFrame: DataFrame with Date index and OHLCV columns.
    """
    # Add .NS suffix for NSE
    yf_symbol = f"{symbol}.NS"
    
    try:
        ticker = yf.Ticker(yf_symbol)
        
        if start_date:
            # yfinance start is inclusive, but we want data AFTER the last synced date.
            # So if we have a last synced date, we should ask for start = last_synced + 1 day.
            # However, the caller will handle the logic of "next day". 
            # Here we strictly respect the passed start_date.
            df = ticker.history(start=start_date, auto_adjust=False)
        else:
            df = ticker.history(period="max", auto_adjust=False)
            
        if df.empty:
            return pd.DataFrame()
            
        # Clean up data
        # Keep only OHLCV
        df = df[['Open', 'High', 'Low', 'Close', 'Volume']]
        
        # Ensure index is datetime date
        df.index = df.index.date
        df.index.name = 'Date'
        
        return df
        
    except Exception as e:
        print(f"Error fetching data for {yf_symbol}: {e}")
        return pd.DataFrame()
