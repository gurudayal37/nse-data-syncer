import time
import sys
import os
from dotenv import load_dotenv

# Load env from web/.env
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(base_dir, 'web', '.env'))

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import DatabaseManager, Stock

def test_speed():
    print("Testing Database Connection and Query Speed...")
    db = DatabaseManager()
    session = db.Session()
    
    try:
        # Test 1: Connection
        start = time.time()
        from sqlalchemy import text
        session.execute(text("SELECT 1"))
        print(f"Connection test: {time.time() - start:.4f}s")
        
        # Test 2: Count
        start = time.time()
        count = session.query(Stock).count()
        print(f"Count query ({count} stocks): {time.time() - start:.4f}s")
        
        # Test 3: Fetch 50 stocks (simulating pagination)
        start = time.time()
        stocks = session.query(Stock).limit(50).all()
        print(f"Fetch 50 stocks: {time.time() - start:.4f}s")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    test_speed()
