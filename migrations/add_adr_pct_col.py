from sqlalchemy import text
from dotenv import load_dotenv
import os
from app.helpers import get_project_root

if not os.getenv('DATABASE_URL'):
    load_dotenv(get_project_root() / 'web' / '.env')

from app.database import DatabaseManager

def run_migration():
    print("Running migration to add adr_pct column...")
    db = DatabaseManager()
    with db.engine.connect() as conn:
        try:
             conn.execute(text("ALTER TABLE stock_performance ADD COLUMN IF NOT EXISTS adr_pct DOUBLE PRECISION"))
             conn.commit()
             print("Migration successful: Added adr_pct column.")
        except Exception as e:
             # Ignore if column exists
             if 'already exists' in str(e).lower():
                 print("Column adr_pct already exists.")
             else:
                 print(f"Migration failed: {e}")

if __name__ == "__main__":
    run_migration()
