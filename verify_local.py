from sqlalchemy import text
import os
import sys
from dotenv import load_dotenv

# 1. Setup Environment
# Calculate path to 'web/.env' assuming this script is in project root
project_root = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(project_root, 'web', '.env')

if os.path.exists(env_path):
    print(f"Loading env from: {env_path}")
    load_dotenv(env_path)
else:
    print("Warning: web/.env not found")

# Add project root to path so we can import app.database
sys.path.append(project_root)

from app.database import DatabaseManager

def verify():
    print("\n--- Market Cap Filter Verification ---")
    
    # Get Configured Threshold
    threshold_cr = float(os.getenv('MIN_MARKET_CAP_CR', 0))
    threshold_val = threshold_cr * 10000000
    
    print(f"Configured Threshold: {threshold_cr} Cr ({threshold_val:,.0f})")
    
    if threshold_cr == 0:
        print("ERROR: MIN_MARKET_CAP_CR is not set or is 0.")
        return

    db = DatabaseManager()
    
    with db.engine.connect() as conn:
        # 1. Total Active Stocks
        total = conn.execute(text("SELECT COUNT(*) FROM stocks WHERE is_active = true")).scalar()
        
        # 2. Eligible Stocks
        eligible = conn.execute(text(f"SELECT COUNT(*) FROM stocks WHERE is_active = true AND market_cap >= {threshold_val}")).scalar()
        
        # 3. Filtered Stocks
        filtered = total - eligible
        
        print(f"\nTotal Active Stocks:   {total}")
        print(f"Eligible (> {threshold_cr}Cr):   {eligible}")
        print(f"Filtered Out:          {filtered}")
        
        if filtered > 0:
            print("\n✅ SUCCESS: Filter is active and removing small-cap stocks.")
        else:
            print("\n❌ WARNING: No stocks are filtered. Check if market_cap data exists or threshold is too low.")

        # 4. Spot Check
        print("\n--- Spot Check ---")
        samples = [
            ('RELIANCE', 'Large Cap'), 
            ('SANCO', 'Small Cap'), 
            ('INFY', 'Large Cap')
        ]
        
        for sym, cat in samples:
            res = conn.execute(text(f"SELECT market_cap FROM stocks WHERE nse_symbol = '{sym}'")).fetchone()
            if res:
                mcap = res[0]
                status = "✅ PASS" if (mcap >= threshold_val) == (cat == 'Large Cap') else "❌ FAIL"
                print(f"{sym:<10} ({cat}): {mcap:,.0f}  -> {status}")
            else:
                print(f"{sym:<10}: Not Found")

if __name__ == "__main__":
    try:
        verify()
    except Exception as e:
        print(f"Error: {e}")
        print("Ensure you are running this from the project root: python3 verify_local.py")
