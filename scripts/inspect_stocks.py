from database import DatabaseManager
from sqlalchemy import inspect, text

def inspect_stocks():
    db = DatabaseManager()
    inspector = inspect(db.engine)
    
    if 'stocks' in inspector.get_table_names():
        print("Columns in stocks:")
        for col in inspector.get_columns('stocks'):
            print(f"  {col['name']} ({col['type']})")
            
        # Show sample data
        with db.engine.connect() as conn:
            result = conn.execute(text("SELECT * FROM stocks LIMIT 5"))
            print("\nSample stocks:")
            for row in result:
                print(row)
    else:
        print("stocks table does not exist.")

if __name__ == "__main__":
    inspect_stocks()
