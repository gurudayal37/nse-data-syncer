import sys
import os
from dotenv import load_dotenv

# Load env from web/.env
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(base_dir, 'web', '.env'))

# Add the project root to sys.path to allow importing app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import Base, DatabaseManager, StockPerformance

def create_performance_table():
    db = DatabaseManager()
    print("Creating stock_performance table if it doesn't exist...")
    try:
        # This will create the table defined in StockPerformance if it doesn't exist
        StockPerformance.__table__.create(db.engine)
        print("Table 'stock_performance' created successfully.")
    except Exception as e:
        # If table already exists, it might throw an error or just skip depending on driver
        # SQLAlchemy's create_all usually handles existence check, but calling create() on table object directly might not.
        # Let's use create_all with check.
        print(f"Note: {e}")
        print("Attempting via create_all...")
        Base.metadata.create_all(db.engine)
        print("Done.")

if __name__ == "__main__":
    create_performance_table()
