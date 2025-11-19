from database import DatabaseManager
from sqlalchemy import inspect, text

def inspect_db():
    db = DatabaseManager()
    inspector = inspect(db.engine)
    
    print("Tables:", inspector.get_table_names())
    
    if 'daily_prices' in inspector.get_table_names():
        print("\nColumns in daily_prices:")
        for col in inspector.get_columns('daily_prices'):
            print(f"  {col['name']} ({col['type']})")
    else:
        print("daily_prices table does not exist.")

    # Try to drop the table if it's wrong
    # with db.engine.connect() as conn:
    #     conn.execute(text("DROP TABLE daily_prices"))
    #     conn.commit()
    #     print("Dropped table daily_prices")

if __name__ == "__main__":
    inspect_db()
