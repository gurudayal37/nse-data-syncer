#!/usr/bin/env python3
"""
Fetch NSE board meeting result dates for the next 90 days and upsert into DB.
Run daily via GitHub Actions at 6 AM IST (Mon-Fri).

Usage:
    python scripts/sync_board_meetings.py

Requires:
    DATABASE_URL  — PostgreSQL connection string (env var or web/.env)
"""

import os
import sys
import time
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

NSE_BASE = 'https://www.nseindia.com'
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
    attachment   = EXCLUDED.attachment,
    sm_isin      = EXCLUDED.sm_isin,
    updated_at   = NOW();
"""


def get_nse_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
    })
    resp = session.get(NSE_BASE, timeout=20)
    resp.raise_for_status()
    time.sleep(1)
    return session


def fmt_nse(d: date) -> str:
    return d.strftime('%d-%m-%Y')


def fetch_meetings(session: requests.Session, from_date: date, to_date: date) -> list:
    url = (
        f'{NSE_BASE}/api/corporate-board-meetings'
        f'?index=equities'
        f'&from_date={fmt_nse(from_date)}'
        f'&to_date={fmt_nse(to_date)}'
    )
    resp = session.get(url, headers={
        'Accept': 'application/json, text/plain, */*',
        'Referer': f'{NSE_BASE}/companies-listing/corporate-filings-board-meetings',
        'X-Requested-With': 'XMLHttpRequest',
    }, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return data if isinstance(data, list) else []


def parse_date(date_str: str) -> date | None:
    if not date_str:
        return None
    parts = date_str.strip().split('-')
    if len(parts) == 3 and len(parts[0]) == 2:
        try:
            return date(int(parts[2]), int(parts[1]), int(parts[0]))
        except ValueError:
            pass
    try:
        return date.fromisoformat(date_str[:10])
    except ValueError:
        return None


def is_result(row: dict) -> bool:
    text = f"{row.get('purpose', '')} {row.get('bm_desc', '')}".lower()
    return any(kw in text for kw in RESULT_KEYWORDS)


def main():
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        log.error('DATABASE_URL not set')
        sys.exit(1)

    today = date.today()
    to_date = today + timedelta(days=90)
    log.info(f'Syncing board meetings {fmt_nse(today)} → {fmt_nse(to_date)}')

    try:
        session = get_nse_session()
        raw = fetch_meetings(session, today, to_date)
    except Exception as e:
        log.error(f'Failed to fetch from NSE: {e}')
        sys.exit(1)

    log.info(f'NSE returned {len(raw)} meetings total')
    meetings = [m for m in raw if is_result(m)]
    log.info(f'{len(meetings)} are result announcements')

    conn = psycopg2.connect(db_url)
    try:
        cur = conn.cursor()
        cur.execute(CREATE_TABLE_SQL)

        count = 0
        for m in meetings:
            meeting_date = parse_date(m.get('meetingDate', ''))
            if not meeting_date:
                continue
            cur.execute(UPSERT_SQL, (
                m.get('symbol', '')[:20],
                (m.get('companyName', '') or '')[:500],
                meeting_date,
                (m.get('purpose', '') or '')[:500],
                m.get('bm_desc', ''),
                (m.get('attachment', '') or '')[:1000],
                (m.get('sm_isin', '') or '')[:20],
            ))
            count += 1

        conn.commit()
        log.info(f'Upserted {count} records into board_meetings')
    finally:
        conn.close()


if __name__ == '__main__':
    main()
