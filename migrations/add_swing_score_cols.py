from sqlalchemy import text
from dotenv import load_dotenv
import os
from app.helpers import get_project_root

if not os.getenv('DATABASE_URL'):
    load_dotenv(get_project_root() / 'web' / '.env')

from app.database import DatabaseManager

COLUMNS = ['strong_stock_score', 'sector_score', 'adr_score', 'swing_score']

def run_migration():
    print("Running migration to add swing score columns...")
    db = DatabaseManager()
    with db.engine.connect() as conn:
        for col in COLUMNS:
            try:
                conn.execute(text(f"ALTER TABLE stock_performance ADD COLUMN IF NOT EXISTS {col} DOUBLE PRECISION"))
                conn.commit()
                print(f"Migration successful: Added {col} column.")
            except Exception as e:
                if 'already exists' in str(e).lower():
                    print(f"Column {col} already exists.")
                else:
                    print(f"Migration failed for {col}: {e}")

if __name__ == "__main__":
    run_migration()
