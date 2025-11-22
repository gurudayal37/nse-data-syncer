import sys
import os
from dotenv import load_dotenv

# Load env from web/.env
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(base_dir, 'web', '.env'))

# Add the project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import DatabaseManager, StockPerformance

def check_performance():
    db = DatabaseManager()
    session = db.Session()
    try:
        results = session.query(StockPerformance).all()
        print(f"Found {len(results)} performance records.")
        for r in results:
            print(f"Stock ID: {r.stock_id}, 1W: {r.change_1w}, 1M: {r.change_1m}, 1Y: {r.change_1y}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    check_performance()
