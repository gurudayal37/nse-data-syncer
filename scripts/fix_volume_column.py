"""
Migration script to fix the volume column type from INTEGER to BIGINT.
This resolves the 'integer out of range' error when inserting large volume values.
"""
import os
from sqlalchemy import create_engine, text

# Get database URL from environment
DB_URL = os.getenv('DATABASE_URL')

if not DB_URL:
    raise ValueError("DATABASE_URL environment variable is not set.")

def migrate_volume_columns():
    """Alter volume columns from INTEGER to BIGINT"""
    engine = create_engine(DB_URL)
    
    with engine.connect() as conn:
        print("Starting migration to fix volume column types...")
        
        # Fix daily_prices.volume column
        print("Altering daily_prices.volume to BIGINT...")
        conn.execute(text("ALTER TABLE daily_prices ALTER COLUMN volume TYPE BIGINT"))
        conn.commit()
        print("✓ daily_prices.volume migrated to BIGINT")
        
        # Fix stock_performance.daily_volume column
        print("Altering stock_performance.daily_volume to BIGINT...")
        conn.execute(text("ALTER TABLE stock_performance ALTER COLUMN daily_volume TYPE BIGINT"))
        conn.commit()
        print("✓ stock_performance.daily_volume migrated to BIGINT")
        
        print("\n✅ Migration completed successfully!")
        print("The volume columns can now handle values up to 9,223,372,036,854,775,807")

if __name__ == "__main__":
    migrate_volume_columns()
