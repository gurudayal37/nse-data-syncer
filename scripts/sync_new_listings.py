"""Discover and backfill brand-new NSE mainboard equity listings from Dhan.

The regular mainboard sync (app/main.py) sources its universe from
manually-refreshed CSVs (EQUITY_LIST_*.csv / ind_niftytotalmarket_list.csv),
which can lag behind very recent IPOs by days-to-weeks until someone
downloads a fresh list. This script closes that gap: it diffs Dhan's live
instrument master against the stocks already tracked in the DB, and for
any genuinely new mainboard equity share it finds, backfills full OHLCV
history from Dhan and computes performance metrics - reusing the same
DatabaseManager methods app/main.py itself uses (insert_stock,
insert_batch_daily_prices, update_performance_metrics), so the new rows
are shaped identically to the rest of the pipeline.

Scoped deliberately to *recent* listings only (first available Dhan bar
within RECENCY_WINDOW_DAYS) so this never silently sweeps in old,
thinly-traded stocks that the curated equity-list CSVs may have
intentionally excluded from momentum/VCP/swing-score universes.

Requires DHAN_CLIENT_ID, DHAN_PIN and DHAN_TOTP_SECRET in web/.env - same
Dhan account already used by sync_dhan_indices.py / sync_sme_stocks.py.
"""
import sys, os, time
import pandas as pd
import pyotp
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv
from sqlalchemy import text

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(base_dir, 'web', '.env'))
sys.path.append(base_dir)
from app.database import DatabaseManager

DHAN_CLIENT_ID = os.getenv('DHAN_CLIENT_ID')
DHAN_PIN = os.getenv('DHAN_PIN')
DHAN_TOTP_SECRET = os.getenv('DHAN_TOTP_SECRET')
DHAN_TOKEN_URL = 'https://auth.dhan.co/app/generateAccessToken'
DHAN_HISTORICAL_URL = 'https://api.dhan.co/v2/charts/historical'
DHAN_SCRIP_MASTER_URL = 'https://images.dhan.co/api-data/api-scrip-master-detailed.csv'

HISTORY_START = '2010-01-01'
RECENCY_WINDOW_DAYS = 400  # only treat as a "new listing" if first Dhan bar is this recent


def generate_access_token() -> str:
    """Mint a fresh 24h access token via Dhan's TOTP login flow (no browser needed).

    Note: Dhan rate-limits this to once every 2 minutes per account.
    """
    totp_code = pyotp.TOTP(DHAN_TOTP_SECRET).now()
    resp = requests.post(
        DHAN_TOKEN_URL,
        params={
            "dhanClientId": DHAN_CLIENT_ID,
            "pin": DHAN_PIN,
            "totp": totp_code,
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    if 'accessToken' not in data:
        raise RuntimeError(f"Dhan token generation failed: {data.get('message', data)}")
    return data['accessToken']


def load_mainboard_universe() -> pd.DataFrame:
    """Download Dhan's instrument master and filter to NSE mainboard equity shares.
    Returns columns: security_id, symbol, name, isin."""
    df = pd.read_csv(DHAN_SCRIP_MASTER_URL, low_memory=False)
    eq = df[
        (df['EXCH_ID'] == 'NSE')
        & (df['SEGMENT'] == 'E')
        & (df['SERIES'] == 'EQ')
        & (df['INSTRUMENT_TYPE'] == 'ES')  # excludes ETFs/other instruments also tagged SERIES=EQ
    ].copy()
    eq = eq.rename(columns={
        'SECURITY_ID': 'security_id',
        'UNDERLYING_SYMBOL': 'symbol',
        'SYMBOL_NAME': 'name',
        'ISIN': 'isin',
    })[['security_id', 'symbol', 'name', 'isin']]
    eq = eq.dropna(subset=['symbol']).drop_duplicates(subset='symbol')
    return eq.reset_index(drop=True)


def fetch_dhan_history(security_id: int, from_date: str, to_date: str, access_token: str, retries: int = 3) -> pd.DataFrame:
    """Returns a DataFrame with a 'Date'-named DatetimeIndex and Open/High/Low/Close/Volume
    columns - the exact shape DatabaseManager.insert_batch_daily_prices() expects."""
    payload = {
        "securityId": str(security_id),
        "exchangeSegment": "NSE_EQ",
        "instrument": "EQUITY",
        "expiryCode": 0,
        "oi": False,
        "fromDate": from_date,
        "toDate": to_date,
    }
    headers = {
        "Content-Type": "application/json",
        "access-token": access_token,
        "client-id": DHAN_CLIENT_ID,
    }

    for attempt in range(1, retries + 1):
        resp = requests.post(DHAN_HISTORICAL_URL, json=payload, headers=headers, timeout=30)
        if resp.status_code == 429:
            time.sleep(2 * attempt)
            continue
        if resp.status_code != 200:
            print(f"    HTTP {resp.status_code}: {resp.text[:300]}")
            return pd.DataFrame()
        data = resp.json()
        if not data.get('timestamp'):
            return pd.DataFrame()

        df = pd.DataFrame({
            'Date': pd.to_datetime(data['timestamp'], unit='s', utc=True).tz_convert('Asia/Kolkata').date,
            'Open': data.get('open'),
            'High': data.get('high'),
            'Low': data.get('low'),
            'Close': data.get('close'),
            'Volume': data.get('volume'),
        })
        df['Date'] = pd.to_datetime(df['Date'])
        df = df.drop_duplicates(subset='Date', keep='last').set_index('Date').sort_index()
        return df

    print("    Giving up after repeated rate-limit errors")
    return pd.DataFrame()


def find_new_symbols(universe: pd.DataFrame, db: DatabaseManager) -> pd.DataFrame:
    """Diff Dhan's mainboard universe against tracked stocks by ISIN, falling back to symbol."""
    session = db.Session()
    try:
        rows = session.execute(text("SELECT isin, nse_symbol FROM stocks")).fetchall()
    finally:
        session.close()
    known_isins = {r[0] for r in rows if r[0]}
    known_symbols = {r[1] for r in rows if r[1]}

    missing = universe[
        (~universe['isin'].isin(known_isins)) & (~universe['symbol'].isin(known_symbols))
    ]
    return missing.reset_index(drop=True)


def main():
    if not DHAN_CLIENT_ID or not DHAN_PIN or not DHAN_TOTP_SECRET:
        print("DHAN_CLIENT_ID / DHAN_PIN / DHAN_TOTP_SECRET not set in web/.env")
        sys.exit(1)

    print("=== Discovering new NSE mainboard listings from Dhan ===")
    universe = load_mainboard_universe()
    print(f"Dhan mainboard universe: {len(universe)} equity shares")

    db = DatabaseManager()
    missing = find_new_symbols(universe, db)
    print(f"Found {len(missing)} symbol(s) untracked in our stocks table")

    if missing.empty:
        print("Nothing new to sync.")
        return

    access_token = generate_access_token()
    print("Generated fresh Dhan access token via TOTP")

    to_date = datetime.now().strftime('%Y-%m-%d')
    recency_cutoff = datetime.now() - timedelta(days=RECENCY_WINDOW_DAYS)

    added = 0
    for row in missing.itertuples(index=False):
        df = fetch_dhan_history(int(row.security_id), HISTORY_START, to_date, access_token)
        time.sleep(0.5)  # be gentle with Dhan's rate limits

        if df.empty:
            continue

        first_date = df.index.min()
        if first_date < recency_cutoff:
            # Untracked, but not a recent listing - out of scope for this script
            continue

        stock_id = db.insert_stock(row.symbol, {'name': row.name, 'isin': row.isin})
        if not stock_id:
            continue

        db.insert_batch_daily_prices({row.symbol: stock_id}, {row.symbol: df})
        db.update_performance_metrics(stock_id)
        added += 1
        print(f"  + {row.symbol} ({row.name}) - listed {first_date.date()}, {len(df)} rows")

    print(f"\nDone. Added {added} newly-listed mainboard stock(s).")


if __name__ == '__main__':
    main()
