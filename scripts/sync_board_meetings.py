#!/usr/bin/env python3
"""
Fetch upcoming BSE board meeting result dates and upsert into DB.
Run daily via GitHub Actions at 6 AM IST (Mon-Fri).

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

BSE_HEADERS = {
    'User-Agent': UA,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.bseindia.com/',
    'Origin': 'https://www.bseindia.com',
}


def clean_db_url(url: str) -> str:
    return re.sub(r'sslmode=["\']?(\w+)["\']?', r'sslmode=\1', url.strip())


def fmt(d: date, fmt_str: str) -> str:
    return d.strftime(fmt_str)


def parse_date(s: str) -> date | None:
    if not s:
        return None
    s = s.strip()
    # DD-MM-YYYY
    parts = s.split('-')
    if len(parts) == 3 and len(parts[0]) == 2:
        try:
            return date(int(parts[2]), int(parts[1]), int(parts[0]))
        except ValueError:
            pass
    # YYYY-MM-DD or ISO
    try:
        return date.fromisoformat(s[:10])
    except ValueError:
        return None


def probe_endpoint(session: requests.Session, url: str, params: dict) -> list[dict]:
    """Try an endpoint, log its response shape, return rows or []."""
    try:
        resp = session.get(url, params=params, timeout=20)
        log.info(f'  {url} → HTTP {resp.status_code}')
        if not resp.ok:
            return []
        data = resp.json()
        if isinstance(data, list):
            rows = data
        elif isinstance(data, dict):
            # Try common wrapper keys
            rows = next(
                (data[k] for k in ('Table', 'Table1', 'data', 'Data', 'meetings', 'result')
                 if k in data and isinstance(data[k], list)),
                []
            )
            if not rows:
                log.info(f'  Dict keys: {list(data.keys())}')
        else:
            rows = []

        log.info(f'  Rows: {len(rows)}')
        if rows:
            log.info(f'  Sample keys: {list(rows[0].keys())}')
            log.info(f'  Sample row : {json.dumps(rows[0], default=str)[:300]}')
        return rows
    except Exception as e:
        log.info(f'  Error: {e}')
        return []


def is_result(row: dict) -> bool:
    text = ' '.join(str(v) for v in row.values() if isinstance(v, str)).lower()
    return any(kw in text for kw in RESULT_KEYWORDS)


def try_fetch_bse(from_date: date, to_date: date) -> list[dict]:
    session = requests.Session()
    session.headers.update(BSE_HEADERS)

    # Warm up BSE session
    try:
        session.get('https://www.bseindia.com', timeout=10)
    except Exception:
        pass

    ddmmyyyy_from = fmt(from_date, '%d%m%Y')
    ddmmyyyy_to   = fmt(to_date,   '%d%m%Y')
    dash_from     = fmt(from_date, '%d-%m-%Y')
    dash_to       = fmt(to_date,   '%d-%m-%Y')

    candidates = [
        # Upcoming board meetings calendar
        ('https://api.bseindia.com/BseIndiaAPI/api/UpcomingBoardMeeting/w',
         {'fromdate': ddmmyyyy_from, 'todate': ddmmyyyy_to}),

        ('https://api.bseindia.com/BseIndiaAPI/api/UpcomingBoardMeeting/w',
         {'fromdate': dash_from, 'todate': dash_to}),

        # Board meetings search with result filter
        ('https://api.bseindia.com/BseIndiaAPI/api/boardMeetingsSearch/w',
         {'fromdate': ddmmyyyy_from, 'todate': ddmmyyyy_to, 'scripcode': '', 'type': ''}),

        # Corporate filings / board meetings
        ('https://api.bseindia.com/BseIndiaAPI/api/Boardmeeting/w',
         {'fromdate': ddmmyyyy_from, 'todate': ddmmyyyy_to, 'scripcode': '', 'type': ''}),

        # Original endpoint but with empty type
        ('https://api.bseindia.com/BseIndiaAPI/api/boardMeetings/w',
         {'fromdate': ddmmyyyy_from, 'todate': ddmmyyyy_to, 'scripcode': '', 'type': ''}),
    ]

    for url, params in candidates:
        log.info(f'Trying: {url}  params={params}')
        rows = probe_endpoint(session, url, params)
        if len(rows) > 5:  # >5 rows means we found real data
            return rows

    log.error('No BSE endpoint returned usable data')
    return []


def normalize(row: dict) -> dict:
    def pick(*keys):
        for k in keys:
            for variant in (k, k.upper(), k.lower()):
                v = row.get(variant)
                if v:
                    return str(v).strip()
        return ''

    return {
        'symbol':       pick('short_name', 'NSE_CD', 'NSECODE', 'SYMBOL'),
        'company_name': pick('SCRIP_NAME', 'CompanyName', 'COMPANYNAME', 'company_name'),
        'meeting_date': pick('DT_TM', 'MEETING_DATE', 'MeetingDate', 'BoardDate', 'BOARD_DATE'),
        'purpose':      pick('PURPOSE', 'AGENDADESC', 'AgendaDesc', 'DETAILS', 'Sub_Ann'),
        'sm_isin':      pick('ISIN_CODE', 'ISIN', 'isin'),
    }


def main():
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        log.error('DATABASE_URL not set')
        sys.exit(1)

    db_url = clean_db_url(db_url)
    ssl_match = re.search(r'sslmode=\S+', db_url)
    log.info(f'DB sslmode: {ssl_match.group() if ssl_match else "not found"}')

    today = date.today()
    to_date = today + timedelta(days=90)
    log.info(f'Date range: {today} → {to_date}')

    raw = try_fetch_bse(today, to_date)
    log.info(f'Total rows fetched: {len(raw)}')

    result_rows = [r for r in raw if is_result(r)]
    log.info(f'Result announcements: {len(result_rows)}')

    if not result_rows:
        log.warning('Nothing to upsert — check BSE endpoint logs above')
        sys.exit(0)

    conn = psycopg2.connect(db_url)
    try:
        cur = conn.cursor()
        cur.execute(CREATE_TABLE_SQL)

        count = 0
        skipped = 0
        for row in result_rows:
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
                m['purpose'],
                '',
                m['sm_isin'][:20],
            ))
            count += 1

        conn.commit()
        log.info(f'Upserted {count} records (skipped {skipped})')
    finally:
        conn.close()


if __name__ == '__main__':
    main()
