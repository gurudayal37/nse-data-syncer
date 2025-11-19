from database import DatabaseManager, DailyPrice
from sqlalchemy import func

def check_db():
    db = DatabaseManager()
    session = db.Session()
    
    try:
        # Count total records
        count = session.query(func.count(DailyPrice.id)).scalar()
        print(f"Total records in daily_prices: {count}")
        
        # Get count per stock_id
        results = session.query(DailyPrice.stock_id, func.count(DailyPrice.date)).group_by(DailyPrice.stock_id).limit(10).all()
        print("\nRecords per stock_id (first 10):")
        for stock_id, count in results:
            print(f"  Stock ID {stock_id}: {count}")
            
        # Show sample data
        print("\nSample data (first 5 rows):")
        rows = session.query(DailyPrice).limit(5).all()
        for row in rows:
            print(f"  Stock ID {row.stock_id} | {row.date} | {row.close_price}")
            
    except Exception as e:
        print(f"Error checking DB: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    check_db()
