"""
PEAD Poller — Lambda function
Runs every minute via EventBridge. Detects new quarterly result
announcements on NSE and triggers downstream processing via SQS.
"""

from __future__ import annotations

import json
import os
import re
import boto3
import psycopg2
import requests
from datetime import datetime, timedelta, timezone

NSE_API = 'https://www.nseindia.com/api/corporate-announcements'
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
      'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')

RESULT_KEYWORDS = [
    'financial result', 'quarterly result', 'unaudited result',
    'audited result', 'half yearly result', 'annual result',
]

EXCLUDE_CATEGORIES = [
    'copy of newspaper publication',
    'clarification - financial results',
    'reply to clarification',
    'analysts/institutional investor meet',
    'corporate insolvency',
    'general updates',
]

IST = timezone(timedelta(hours=5, minutes=30))

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS pead_announcements (
    id             SERIAL PRIMARY KEY,
    seq_id         VARCHAR(50) UNIQUE NOT NULL,
    symbol         VARCHAR(20) NOT NULL,
    company_name   VARCHAR(500),
    announced_at   TIMESTAMPTZ NOT NULL,
    detected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    latency_sec    INT,
    subject        TEXT,
    attachment_url VARCHAR(1000),
    has_xbrl       BOOLEAN DEFAULT FALSE,
    phase1_sent    BOOLEAN DEFAULT FALSE,
    phase2_sent    BOOLEAN DEFAULT FALSE,
    claude_signal  VARCHAR(10),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_pead_seq     ON pead_announcements (seq_id);
CREATE INDEX IF NOT EXISTS ix_pead_symbol  ON pead_announcements (symbol);
CREATE INDEX IF NOT EXISTS ix_pead_ann_at  ON pead_announcements (announced_at DESC);
"""


def clean_db_url(url: str) -> str:
    return re.sub(r'sslmode=["\']?(\w+)["\']?', r'sslmode=\1', url.strip())


def is_result(ann: dict) -> bool:
    cat = ann.get('desc', '').lower()
    if any(excl in cat for excl in EXCLUDE_CATEGORIES):
        return False
    if 'outcome of board meeting' in cat:
        return True
    text = (ann.get('desc', '') + ' ' + ann.get('attchmntText', '')).lower()
    return any(kw in text for kw in RESULT_KEYWORDS)


def parse_nse_dt(s: str) -> datetime | None:
    """Parse '10-May-2026 14:32:07' → aware datetime in IST."""
    if not s:
        return None
    for fmt in ('%d-%b-%Y %H:%M:%S', '%d-%m-%Y %H:%M:%S'):
        try:
            return datetime.strptime(s.strip(), fmt).replace(tzinfo=IST)
        except ValueError:
            pass
    return None


def fetch_nse_announcements(today: str) -> list[dict]:
    resp = requests.get(
        NSE_API,
        params={'index': 'equities', 'from_date': today, 'to_date': today},
        headers={
            'User-Agent': UA,
            'Accept': 'application/json',
            'Referer': 'https://www.nseindia.com/companies-listing/corporate-filings-announcements',
        },
        timeout=20,
    )
    resp.raise_for_status()
    data = resp.json()
    return data if isinstance(data, list) else []


def send_telegram(token: str, chat_id: str, text: str) -> None:
    requests.post(
        f'https://api.telegram.org/bot{token}/sendMessage',
        json={'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML', 'disable_web_page_preview': True},
        timeout=10,
    )


def phase1_message(ann: dict, announced_at: datetime, latency_sec: int) -> str:
    pdf = ann.get('attchmntFile', '')
    return (
        f'🔔 <b>NEW RESULT DETECTED</b>\n\n'
        f'<b>{ann["symbol"]}</b> — {ann.get("sm_name", "")}\n'
        f'📅 Announced: {announced_at.strftime("%d-%b-%Y %H:%M:%S")} IST\n'
        f'⚡️ Detected in ~{latency_sec} sec\n'
        f'<a href="{pdf}">📎 View Filing</a>\n\n'
        f'⏳ Full QoQ/YoY analysis + PEAD signal in ~15 min...'
    )


def lambda_handler(event, context):
    db_url = clean_db_url(os.environ['DATABASE_URL'])
    tg_token = os.environ['TELEGRAM_BOT_TOKEN']
    tg_chat = os.environ['TELEGRAM_CHAT_ID']
    sqs_url = os.environ['SQS_QUEUE_URL']

    now_ist = datetime.now(IST)

    # Skip outside 8 AM – 9 PM IST on weekdays
    if now_ist.weekday() >= 5 or not (8 <= now_ist.hour < 21):
        return {'message': 'Outside polling window'}

    today = now_ist.strftime('%d-%m-%Y')

    try:
        announcements = fetch_nse_announcements(today)
    except Exception as e:
        print(f'NSE fetch error: {e}')
        return {'error': str(e)}

    result_anns = [a for a in announcements if is_result(a)]
    print(f'Announcements today: {len(announcements)}, results: {len(result_anns)}')

    # Filter to companies scheduled in today's earnings calendar
    conn_check = psycopg2.connect(db_url)
    try:
        cur_check = conn_check.cursor()
        cur_check.execute(
            'SELECT UPPER(symbol) FROM board_meetings WHERE meeting_date = %s',
            (now_ist.date(),)
        )
        calendar_symbols = {row[0] for row in cur_check.fetchall()}
    finally:
        conn_check.close()

    result_anns = [a for a in result_anns if a.get('symbol', '').upper() in calendar_symbols]
    print(f'After calendar filter: {len(result_anns)}')

    if not result_anns:
        return {'processed': 0}

    conn = psycopg2.connect(db_url)
    sqs = boto3.client('sqs', region_name=os.environ.get('AWS_REGION', 'ap-south-1'))

    try:
        cur = conn.cursor()
        cur.execute(CREATE_TABLE_SQL)

        processed = 0
        for ann in result_anns:
            seq_id = str(ann.get('seq_id', ''))
            if not seq_id:
                continue

            # Skip already-seen announcements
            cur.execute('SELECT 1 FROM pead_announcements WHERE seq_id = %s', (seq_id,))
            if cur.fetchone():
                continue

            announced_at = parse_nse_dt(ann.get('an_dt', ''))
            if not announced_at:
                continue

            now_utc = datetime.now(timezone.utc)
            latency_sec = int((now_utc - announced_at.astimezone(timezone.utc)).total_seconds())
            latency_sec = max(0, latency_sec)

            # Store in DB
            cur.execute("""
                INSERT INTO pead_announcements
                    (seq_id, symbol, company_name, announced_at, latency_sec,
                     subject, attachment_url, has_xbrl, phase1_sent)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, TRUE)
                ON CONFLICT (seq_id) DO NOTHING
            """, (
                seq_id,
                ann.get('symbol', ''),
                ann.get('sm_name', ''),
                announced_at,
                latency_sec,
                ann.get('desc', ''),
                ann.get('attchmntFile', ''),
                bool(ann.get('hasXbrl')),
            ))

            # Phase 1 Telegram
            send_telegram(tg_token, tg_chat, phase1_message(ann, announced_at, latency_sec))

            # Put on SQS with 15-min delay for processor
            sqs.send_message(
                QueueUrl=sqs_url,
                MessageBody=json.dumps({
                    'seq_id': seq_id,
                    'symbol': ann.get('symbol', ''),
                    'company_name': ann.get('sm_name', ''),
                    'announced_at': announced_at.isoformat(),
                    'attachment_url': ann.get('attchmntFile', ''),
                }),
                DelaySeconds=900,  # 15 minutes
            )

            print(f'Processed new result: {ann.get("symbol")} seq={seq_id}')
            processed += 1

        conn.commit()
        return {'processed': processed}

    finally:
        conn.close()
