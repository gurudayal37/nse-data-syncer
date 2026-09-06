from sqlalchemy import text
from dotenv import load_dotenv
import os
from app.helpers import get_project_root

if not os.getenv('DATABASE_URL'):
    load_dotenv(get_project_root() / 'web' / '.env')

from app.database import DatabaseManager


def run_migration():
    print("Running migration to create favorite_stocks table...")
    db = DatabaseManager()
    with db.engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS favorite_stocks (
                id         SERIAL PRIMARY KEY,
                stock_id   INT NOT NULL UNIQUE REFERENCES stocks(id),
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        conn.commit()
        print("Migration successful: favorite_stocks table ready.")


if __name__ == "__main__":
    run_migration()
