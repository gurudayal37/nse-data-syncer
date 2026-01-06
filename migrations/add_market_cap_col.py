from sqlalchemy import text
from dotenv import load_dotenv
import os
from app.helpers import get_project_root

if not os.getenv('DATABASE_URL'):
    load_dotenv(get_project_root() / 'web' / '.env')

from app.database import DatabaseManager

def run_migration():
    print("Running migration to add market_cap column...")
    db = DatabaseManager()
    with db.engine.connect() as conn:
        try:
             conn.execute(text("ALTER TABLE stocks ADD COLUMN IF NOT EXISTS market_cap DOUBLE PRECISION"))
             conn.commit()
             print("Migration successful: Added market_cap column.")
        except Exception as e:
             # Ignore if column exists
             if 'already exists' in str(e).lower():
                 print("Column market_cap already exists.")
             else:
                 print(f"Migration failed: {e}")

if __name__ == "__main__":
    run_migration()
