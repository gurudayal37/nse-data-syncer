import pandas as pd

def get_nse_symbols(csv_path):
    """Reads NSE symbols from the CSV file."""
    try:
        # Read CSV, assuming header is on the first line
        df = pd.read_csv(csv_path)
        
        # The user specified the third column contains symbols.
        # Based on the file view: "Company Name,Industry,Symbol,Series,ISIN Code"
        # Symbol is indeed the 3rd column (index 2).
        
        if 'Symbol' in df.columns:
            symbols = df['Symbol'].tolist()
        else:
            # Fallback to index if column name doesn't match (though it seems to match)
            symbols = df.iloc[:, 2].tolist()
            
        return [str(s).strip() for s in symbols if pd.notna(s)]
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return []
