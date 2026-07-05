"""
Quick standalone test of ScreenerService._extract_sector_info() against a
handful of known stocks, without triggering the full get_stock_data()
scrape (quarterly results, balance sheet, etc. - unnecessary here).

Usage:
    python scripts/test_screener_sector.py
"""
import os
import sys
import time
from dotenv import load_dotenv

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(base_dir, 'web', '.env'))
sys.path.append(os.path.join(base_dir, 'scripts'))

from screener_service import ScreenerService

# TATACONSUM: the user's own example (FMCG > FMCG > Agri Food & other Products > Tea & Coffee)
# RELIANCE: what the OLD broken code hardcoded (Energy > Oil Gas & Consumable Fuels > Petroleum Products > Refineries & Marketing) - good regression check
# TCS: a stock already well-mapped via the BSE CSV, cross-check for drift
# BALRAMCHIN: a Sugar producer - Sugar has no NSE sector index and was in our top-15 unmapped industries list
TEST_SYMBOLS = ['TATACONSUM', 'RELIANCE', 'TCS', 'BALRAMCHIN']


def main():
    username = os.getenv('SCREENER_USERNAME')
    password = os.getenv('SCREENER_PASSWORD')
    if not username or not password:
        print("SCREENER_USERNAME / SCREENER_PASSWORD not set in web/.env")
        sys.exit(1)

    with ScreenerService(headless=True) as service:
        if not service.login(username, password):
            print("Login failed.")
            sys.exit(1)

        for symbol in TEST_SYMBOLS:
            url = f"{service.base_url}/company/{symbol}/consolidated/"
            print(f"\n{symbol} -> {url}")
            service.driver.get(url)
            time.sleep(2)

            if "company" not in service.driver.current_url.lower():
                print(f"  Could not load company page (redirected to {service.driver.current_url})")
                continue

            sector_info = service._extract_sector_info()
            print(f"  sector:     {sector_info['sector']}")
            print(f"  subsector1: {sector_info['subsector1']}")
            print(f"  subsector2: {sector_info['subsector2']}")
            print(f"  subsector3: {sector_info['subsector3']}")


if __name__ == "__main__":
    main()
