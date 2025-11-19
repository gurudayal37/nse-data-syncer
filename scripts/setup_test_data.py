import sys
import os
# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load env vars
load_dotenv()
DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print("DATABASE_URL not set")
    sys.exit(1)

engine = create_engine(DATABASE_URL)

def setup_test_data():
    with engine.connect() as conn:
        # 1. Delete 'ABB' from stocks to test insertion
        print("Deleting 'ABB' from stocks...")
        # First delete daily prices for ABB if any (need stock_id)
        result = conn.execute(text("SELECT id FROM stocks WHERE nse_symbol = 'ABB'"))
        row = result.fetchone()
        if row:
            stock_id = row[0]
            conn.execute(text("DELETE FROM daily_prices WHERE stock_id = :id"), {"id": stock_id})
            conn.execute(text("DELETE FROM quarterly_results WHERE stock_id = :id"), {"id": stock_id})
            conn.execute(text("DELETE FROM news WHERE stock_id = :id"), {"id": stock_id})
            conn.execute(text("DELETE FROM sync_tracker WHERE stock_id = :id"), {"id": stock_id})
            conn.execute(text("DELETE FROM stocks WHERE id = :id"), {"id": stock_id})
            conn.execute(text("DELETE FROM stocks WHERE id = :id"), {"id": stock_id})
            conn.execute(text("DELETE FROM stocks WHERE id = :id"), {"id": stock_id})
            print("Deleted 'ABB'.")
        else:
            print("'ABB' not found, ready for insertion test.")

        # 2. Corrupt 'RELIANCE' data to test corporate action detection
        print("Corrupting 'RELIANCE' data...")
        result = conn.execute(text("SELECT id FROM stocks WHERE nse_symbol = 'RELIANCE'"))
        row = result.fetchone()
        if row:
            stock_id = row[0]
            # Get the latest date
            res = conn.execute(text("SELECT date, close_price FROM daily_prices WHERE stock_id = :id ORDER BY date DESC LIMIT 1"), {"id": stock_id})
            last_rec = res.fetchone()
            if last_rec:
                date, close = last_rec
                new_close = float(close) * 0.5 # Simulate 50% drop (e.g. split)
                print(f"Modifying RELIANCE data for {date}: {close} -> {new_close}")
                conn.execute(text("UPDATE daily_prices SET close_price = :price WHERE stock_id = :id AND date = :date"), 
                             {"price": new_close, "id": stock_id, "date": date})
            else:
                print("No data for RELIANCE to corrupt.")
        else:
            print("RELIANCE not found.")
        
        conn.commit()
        print("Test data setup complete.")

if __name__ == "__main__":
    setup_test_data()
