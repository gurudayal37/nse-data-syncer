import os
import sys
from sqlalchemy import text
from dotenv import load_dotenv

# Ensure we can import from app
sys.path.append(os.getcwd())

# Load env
load_dotenv('web/.env')

from app.database import DatabaseManager
DB_URL = os.getenv('DATABASE_URL')

if __name__ == "__main__":
    if not DB_URL:
        print("DATABASE_URL not set")
        sys.exit(1)
        
    print("Starting duplicate cleanup...")
    db = DatabaseManager(db_url=DB_URL)
    session = db.Session()
    
    try:
        # SQL to keep the row with Max ID and delete others for same etf_id and date
        # Postgres specific
        query = text("""
            DELETE FROM etf_daily_prices a 
            USING etf_daily_prices b
            WHERE a.id < b.id 
            AND a.etf_id = b.etf_id 
            AND a.date = b.date
        """)
        
        result = session.execute(query)
        rows_deleted = result.rowcount
        session.commit()
        print(f"Cleanup complete. Deleted {rows_deleted} duplicate rows.")
        
    except Exception as e:
        session.rollback()
        print(f"Error executing cleanup: {e}")
    finally:
        session.close()
