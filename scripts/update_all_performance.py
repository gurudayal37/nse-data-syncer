import sys
import os
from dotenv import load_dotenv

# Load env from web/.env
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(base_dir, 'web', '.env'))

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import DatabaseManager

def update_all():
    print("Updating performance metrics for all stocks...")
    db = DatabaseManager()
    symbol_map = db.get_symbol_map()
    
    count = 0
    total = len(symbol_map)
    
    for symbol, stock_id in symbol_map.items():
        count += 1
        if count % 50 == 0:
            print(f"Processed {count}/{total} stocks...")
        db.update_performance_metrics(stock_id)
        
    print("Done.")

if __name__ == "__main__":
    update_all()
