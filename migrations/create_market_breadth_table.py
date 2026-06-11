from sqlalchemy import text
from dotenv import load_dotenv
import os
from app.helpers import get_project_root

if not os.getenv('DATABASE_URL'):
    load_dotenv(get_project_root() / 'web' / '.env')

from app.database import DatabaseManager


def run_migration():
    print("Running migration to create market_breadth_history table...")
    db = DatabaseManager()
    with db.engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS market_breadth_history (
                date              DATE PRIMARY KEY,
                total             INT,
                advances          INT,
                declines          INT,
                unchanged         INT,
                near_52w_high     INT,
                near_52w_low      INT,
                pct_above_ema20   DOUBLE PRECISION,
                pct_above_ema50   DOUBLE PRECISION,
                pct_above_ema200  DOUBLE PRECISION,
                new_highs         INT,
                new_lows          INT,
                net_highs_lows    INT,
                created_at        TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        conn.commit()
        print("Migration successful: market_breadth_history table ready.")


if __name__ == "__main__":
    run_migration()
