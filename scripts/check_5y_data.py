import sys
import os
from dotenv import load_dotenv
from sqlalchemy import text

# Load env from web/.env
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(base_dir, 'web', '.env'))

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import DatabaseManager

def check_5y():
    print("Checking 5Y performance data...")
    db = DatabaseManager()
    session = db.Session()
    
    try:
        # Count total records
        total = session.execute(text("SELECT COUNT(*) FROM stock_performance")).scalar()
        
        # Count non-null 5Y records
        non_null = session.execute(text("SELECT COUNT(*) FROM stock_performance WHERE change_5y IS NOT NULL")).scalar()
        
        # Count NaN records
        nan_count = session.execute(text("SELECT COUNT(*) FROM stock_performance WHERE change_5y = 'NaN'")).scalar()
        
        print(f"Total records: {total}")
        print(f"Records with 5Y data: {non_null}")
        print(f"Records with NaN: {nan_count}")
        print(f"Percentage: {(non_null/total)*100:.2f}%")
        
        # Show top 5 5Y gainers
        print("\nTop 5 5Y Gainers:")
        top_5 = session.execute(text("SELECT stock_id, change_5y FROM stock_performance WHERE change_5y IS NOT NULL ORDER BY change_5y DESC LIMIT 5")).fetchall()
        for row in top_5:
            print(f"Stock ID: {row[0]}, Change: {row[1]}%")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    check_5y()
