#!/usr/bin/env python3
"""
Fetch NSE upcoming board meeting result dates and upsert into DB.
Run daily via GitHub Actions at 6 AM IST (Mon-Fri).

Usage:
    python scripts/sync_board_meetings.py

Requires:
    DATABASE_URL  — PostgreSQL connection string (env var or web/.env)
"""

from __future__ import annotations

import os
import re
import sys
import logging
from datetime import date, timedelta, datetime

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

NSE_API = 'https://www.nseindia.com/api/corporate-board-meetings'
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
    return re.sub(r'sslmode=["\']?(\w+)["\']?', r'sslmode=\1', url.strip())


def fmt_nse(d: date) -> str:
    return d.strftime('%d-%m-%Y')


def parse_date(s: str) -> date | None:
    """Parse NSE date formats: '30-May-2026' or 'DD-MM-YYYY'."""
    if not s:
        return None
    s = s.strip()
    for fmt in ('%d-%b-%Y', '%d-%m-%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def is_result(row: dict) -> bool:
    text = f"{row.get('bm_purpose', '')} {row.get('bm_desc', '')}".lower()
    return any(kw in text for kw in RESULT_KEYWORDS)


def fetch_nse_meetings(from_date: date, to_date: date, index: str = 'equities') -> list[dict]:
    """
    Call NSE board meetings API directly — no homepage session needed.
    Works locally and may work from GitHub Actions depending on IP.
    `index` is 'equities' for the main board or 'sme' for the SME board —
    NSE serves these as separate feeds.
    """
    params = {
        'index': index,
        'from_date': fmt_nse(from_date),
        'to_date': fmt_nse(to_date),
    }
    headers = {
        'User-Agent': UA,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.nseindia.com/companies-listing/corporate-filings-board-meetings',
    }
    resp = requests.get(NSE_API, params=params, headers=headers, timeout=30)
    log.info(f'NSE API ({index}) HTTP {resp.status_code}')
    resp.raise_for_status()
    data = resp.json()
    return data if isinstance(data, list) else []


def main():
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        log.error('DATABASE_URL not set')
        sys.exit(1)
    db_url = clean_db_url(db_url)

    today = date.today()
    to_date = today + timedelta(days=90)
    log.info(f'Fetching NSE board meetings {fmt_nse(today)} → {fmt_nse(to_date)}')

    raw = []
    for index in ('equities', 'sme'):
        try:
            raw.extend(fetch_nse_meetings(today, to_date, index=index))
        except Exception as e:
            log.error(f'NSE API ({index}) failed: {e}')
            if index == 'equities':
                sys.exit(1)

    log.info(f'NSE returned {len(raw)} total meetings')
    result_rows = [r for r in raw if is_result(r)]
    log.info(f'{len(result_rows)} are result announcements')

    conn = psycopg2.connect(db_url)
    try:
        cur = conn.cursor()
        cur.execute(CREATE_TABLE_SQL)

        count = 0
        skipped = 0
        for row in result_rows:
            meeting_date = parse_date(row.get('bm_date', ''))
            if not meeting_date:
                skipped += 1
                continue
            cur.execute(UPSERT_SQL, (
                (row.get('bm_symbol') or '')[:20],
                (row.get('sm_name') or '')[:500],
                meeting_date,
                (row.get('bm_purpose') or '')[:500],
                row.get('bm_desc') or '',
                (row.get('attachment') or '')[:1000],
                (row.get('sm_isin') or '')[:20],
            ))
            count += 1

        conn.commit()
        log.info(f'Upserted {count} records into board_meetings (skipped {skipped})')
    finally:
        conn.close()


if __name__ == '__main__':
    main()
