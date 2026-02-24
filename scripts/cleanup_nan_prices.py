"""
One-time cleanup script: Remove rows from daily_prices where close_price is NaN.
PostgreSQL stores NaN as a special float value that Prisma cannot convert, causing
the /stocks page to crash with: "Could not convert value NaN of the field `close_price`"

Run this once to fix the existing bad data, then the fixed database.py will prevent future NaN insertions.
"""

import os
from dotenv import load_dotenv

# Load env
if not os.getenv('DATABASE_URL'):
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from pathlib import Path
    load_dotenv(Path(__file__).parent.parent / 'web' / '.env')

from sqlalchemy import create_engine, text

DB_URL = os.getenv('DATABASE_URL')
if not DB_URL:
    raise ValueError("DATABASE_URL environment variable is not set.")

engine = create_engine(DB_URL)

with engine.connect() as conn:
    # Count affected rows first
    count_result = conn.execute(text("""
        SELECT COUNT(*) FROM daily_prices 
        WHERE close_price = 'NaN'::float
           OR open_price = 'NaN'::float
           OR high_price = 'NaN'::float
           OR low_price = 'NaN'::float
    """))
    count = count_result.scalar()
    print(f"Found {count} rows with NaN price values.")

    if count > 0:
        # Delete rows where close_price is NaN (critical field for Prisma)
        delete_result = conn.execute(text("""
            DELETE FROM daily_prices 
            WHERE close_price = 'NaN'::float
        """))
        deleted = delete_result.rowcount
        print(f"Deleted {deleted} rows with NaN close_price.")

        # For remaining rows, set NaN open/high/low to NULL (less critical)
        conn.execute(text("""
            UPDATE daily_prices
            SET 
                open_price = CASE WHEN open_price = 'NaN'::float THEN NULL ELSE open_price END,
                high_price = CASE WHEN high_price = 'NaN'::float THEN NULL ELSE high_price END,
                low_price  = CASE WHEN low_price  = 'NaN'::float THEN NULL ELSE low_price  END
            WHERE 
                open_price = 'NaN'::float
                OR high_price = 'NaN'::float
                OR low_price = 'NaN'::float
        """))
        print("Replaced remaining NaN open/high/low values with NULL.")

        conn.commit()
        print("✅ Cleanup complete. The /stocks page should now work.")
    else:
        print("✅ No NaN rows found. Database is clean.")
