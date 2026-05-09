#!/usr/bin/env python3
"""
Fetch BSE board meeting result dates for the next 90 days and upsert into DB.
Run daily via GitHub Actions at 6 AM IST (Mon-Fri).

Uses BSE's public API instead of NSE — NSE blocks GitHub Actions IPs.

Usage:
    python scripts/sync_board_meetings.py

Requires:
    DATABASE_URL  — PostgreSQL connection string (env var or web/.env)
"""

import os
import sys
import logging
from datetime import date, timedelta

import psycopg2
import requests
from dotenv import load_dotenv

_script_dir = os.path.dirname(os.path.abspath(__file__))
for _candidate in [
    os.path.join(_script_dir, '..', 'web', '.env'),
    os.path.join(_script_dir, '..', '.env'),
]:
    if os.path.exists(_candidate):
        load_dotenv(_candidate)
        break

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
log = logging.getLogger(__name__)

BSE_URL = 'https://api.bseindia.com/BseIndiaAPI/api/boardMeetings/w'
UA = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
    'AppleWebKit/537.36 (KHTML, like Gecko) '
    'Chrome/122.0.0.0 Safari/537.36'
)

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS board_meetings (
    id           SERIAL PRIMARY KEY,
    symbol       VARCHAR(20)   NOT NULL,
    company_name VARCHAR(500),
    meeting_date DATE          NOT NULL,
    purpose      VARCHAR(500),
    bm_desc      TEXT,
    attachment   VARCHAR(1000),
    sm_isin      VARCHAR(20),
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (symbol, meeting_date)
);
CREATE INDEX IF NOT EXISTS ix_board_meetings_date ON board_meetings (meeting_date);
"""

UPSERT_SQL = """
INSERT INTO board_meetings
    (symbol, company_name, meeting_date, purpose, bm_desc, attachment, sm_isin, updated_at)
VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
ON CONFLICT (symbol, meeting_date) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    purpose      = EXCLUDED.purpose,
    bm_desc      = EXCLUDED.bm_desc,
    updated_at   = NOW();
"""


def fmt_bse(d: date) -> str:
    """BSE date format: DDMMYYYY (no separators)."""
    return d.strftime('%d%m%Y')


def parse_date(date_str: str) -> date | None:
    """Parse DD-MM-YYYY or YYYY-MM-DD."""
    if not date_str:
        return None
    s = date_str.strip()
    parts = s.split('-')
    if len(parts) == 3 and len(parts[0]) == 2:
        try:
            return date(int(parts[2]), int(parts[1]), int(parts[0]))
        except ValueError:
            pass
    try:
        return date.fromisoformat(s[:10])
    except ValueError:
        return None


def fetch_bse_meetings(from_date: date, to_date: date) -> list[dict]:
    """
    BSE board meetings API — no auth or session cookie needed.
    type=Results filters to financial result meetings only.
    """
    params = {
        'scripcode': '',
        'fromdate': fmt_bse(from_date),
        'todate': fmt_bse(to_date),
        'type': 'Results',
    }
    headers = {
        'User-Agent': UA,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.bseindia.com/',
        'Origin': 'https://www.bseindia.com',
    }
    resp = requests.get(BSE_URL, params=params, headers=headers, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    # BSE returns either a plain list or {"Table": [...]}
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get('Table', [])
    return []


def normalize(row: dict) -> dict:
    """Map BSE response fields to our common schema."""
    return {
        'symbol':       (row.get('short_name') or '').strip(),
        'company_name': (row.get('SCRIP_NAME') or '').strip(),
        'meeting_date': row.get('DT_TM', ''),
        'purpose':      (row.get('PURPOSE') or '').strip(),
        'bm_desc':      (row.get('PURPOSE') or '').strip(),
        'sm_isin':      (row.get('ISIN_CODE') or '').strip(),
    }


def main():
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        log.error('DATABASE_URL not set')
        sys.exit(1)

    today = date.today()
    to_date = today + timedelta(days=90)
    log.info(f'Fetching BSE board meetings {fmt_bse(today)} → {fmt_bse(to_date)}')

    try:
        raw = fetch_bse_meetings(today, to_date)
    except Exception as e:
        log.error(f'Failed to fetch from BSE: {e}')
        sys.exit(1)

    log.info(f'BSE returned {len(raw)} result meetings')

    conn = psycopg2.connect(db_url)
    try:
        cur = conn.cursor()
        cur.execute(CREATE_TABLE_SQL)

        count = 0
        skipped = 0
        for row in raw:
            m = normalize(row)
            if not m['symbol']:
                skipped += 1
                continue
            meeting_date = parse_date(m['meeting_date'])
            if not meeting_date:
                skipped += 1
                continue
            cur.execute(UPSERT_SQL, (
                m['symbol'][:20],
                m['company_name'][:500],
                meeting_date,
                m['purpose'][:500],
                m['bm_desc'],
                '',           # BSE API doesn't return attachment URL
                m['sm_isin'][:20],
            ))
            count += 1

        conn.commit()
        log.info(f'Upserted {count} records into board_meetings (skipped {skipped})')
    finally:
        conn.close()


if __name__ == '__main__':
    main()
