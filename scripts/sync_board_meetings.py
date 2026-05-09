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
import re
import sys
import json
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
RESULT_KEYWORDS = [
    'result', 'quarterly', 'financial result',
    'annual result', 'half yearly', 'unaudited', 'audited',
]

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


def clean_db_url(url: str) -> str:
    """Remove any quoting around individual query-param values.
    Handles sslmode="require", sslmode='require', sslmode="require (no closing quote).
    """
    return re.sub(r'=(["\'])?([\w-]+)\1?(?=[&\s]|$)', r'=\2', url)


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


def is_result(row: dict) -> bool:
    # Check all string values in the row for result keywords
    text = ' '.join(str(v) for v in row.values() if isinstance(v, str)).lower()
    return any(kw in text for kw in RESULT_KEYWORDS)


def fetch_bse_meetings(from_date: date, to_date: date) -> list[dict]:
    """BSE board meetings API — no auth or session cookie needed."""
    # Try both date formats BSE might expect
    for date_fmt in ('%d%m%Y', '%d-%m-%Y'):
        params = {
            'scripcode': '',
            'fromdate': from_date.strftime(date_fmt),
            'todate': to_date.strftime(date_fmt),
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

        # Log raw response shape so we can debug if needed
        if isinstance(data, list):
            rows = data
        elif isinstance(data, dict):
            rows = data.get('Table', data.get('data', []))
        else:
            rows = []

        log.info(f'Date fmt {date_fmt}: got {len(rows)} rows')
        if rows:
            log.info(f'Sample row keys: {list(rows[0].keys())}')
            log.info(f'Sample row: {json.dumps(rows[0], default=str)}')
            return rows

    return []


def normalize(row: dict) -> dict:
    """Map BSE response fields to our schema — try common field name variants."""
    def pick(*keys):
        for k in keys:
            v = row.get(k) or row.get(k.upper()) or row.get(k.lower())
            if v:
                return str(v).strip()
        return ''

    return {
        'symbol':       pick('short_name', 'NSE_CD', 'nse_cd', 'NSECODE'),
        'company_name': pick('SCRIP_NAME', 'scrip_name', 'CompanyName', 'COMPANYNAME'),
        'meeting_date': pick('DT_TM', 'dt_tm', 'MEETING_DATE', 'MeetingDate', 'BoardDate'),
        'purpose':      pick('PURPOSE', 'purpose', 'AGENDADESC', 'AgendaDesc'),
        'sm_isin':      pick('ISIN_CODE', 'isin_code', 'ISIN'),
    }


def main():
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        log.error('DATABASE_URL not set')
        sys.exit(1)

    db_url = clean_db_url(db_url.strip())
    log.info(f'Connecting to DB (sslmode portion: {re.search(r"sslmode=[^&\\s]*", db_url)})')

    today = date.today()
    to_date = today + timedelta(days=90)
    log.info(f'Fetching BSE board meetings {fmt_bse(today)} → {fmt_bse(to_date)}')

    try:
        raw = fetch_bse_meetings(today, to_date)
    except Exception as e:
        log.error(f'Failed to fetch from BSE: {e}')
        sys.exit(1)

    log.info(f'BSE returned {len(raw)} total rows')
    result_rows = [r for r in raw if is_result(r)]
    log.info(f'{len(result_rows)} are result announcements')

    conn = psycopg2.connect(db_url)
    try:
        cur = conn.cursor()
        cur.execute(CREATE_TABLE_SQL)

        count = 0
        skipped = 0
        for row in result_rows:
            m = normalize(row)
            if not m['symbol']:
                log.warning(f'No symbol found in row: {row}')
                skipped += 1
                continue
            meeting_date = parse_date(m['meeting_date'])
            if not meeting_date:
                log.warning(f'Could not parse date "{m["meeting_date"]}" in row: {row}')
                skipped += 1
                continue
            cur.execute(UPSERT_SQL, (
                m['symbol'][:20],
                m['company_name'][:500],
                meeting_date,
                m['purpose'][:500],
                m['purpose'],
                '',
                m['sm_isin'][:20],
            ))
            count += 1

        conn.commit()
        log.info(f'Upserted {count} records into board_meetings (skipped {skipped})')
    finally:
        conn.close()


if __name__ == '__main__':
    main()
