"""
Investor Presentation Keyword & Sentiment Analysis — Q4 FY26 Results Season

Steps:
  1. For every company in pead_announcements this season, fetch NSE filings
     for their result date +1 to find "Investor Presentation" attachments.
  2. Download each PDF and:
       - count theme keyword occurrences (data centre, AI, defence, ...)
       - run a positive/negative sentiment phrase scan with negation handling
       - normalize hits per 1000 words and compute a sentiment delta
  3. Save results to DB table `presentation_keyword_analysis` and a CSV.

Usage:
  python scripts/keyword_analysis.py [--season-start 2026-04-08] [--out results/keyword_analysis.csv]
  python scripts/keyword_analysis.py --symbol TCS   # single-symbol test mode
  python scripts/keyword_analysis.py --force        # re-process even if already analysed
"""

from __future__ import annotations

import argparse
import csv
import io
import os
import re
import time
from datetime import date, timedelta, datetime, timezone
from pathlib import Path

import psycopg2
import requests

import logging
logging.getLogger('pdfminer').setLevel(logging.ERROR)

try:
    import pdfplumber
except ImportError:
    raise SystemExit('Install pdfplumber: pip3 install pdfplumber')

DB_URL = os.environ.get(
    'DATABASE_URL',
    'postgresql://postgres:6XC3bmwDse3Bu6f@database-1.cziuywsuc132.ap-south-1.rds.amazonaws.com:5432/nifty_data?sslmode=require'
)

NSE_API = 'https://www.nseindia.com/api/corporate-announcements'
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
      'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')
NSE_HEADERS = {
    'User-Agent': UA,
    'Accept': 'application/json',
    'Referer': 'https://www.nseindia.com/companies-listing/corporate-filings-announcements',
}
PDF_HEADERS = {
    'User-Agent': UA,
    'Accept': 'application/pdf,*/*',
    'Referer': 'https://www.nseindia.com/',
}

# ── Theme keywords (regex, case-insensitive on lowered text) ──────────────
# \s* matches zero or more spaces so "datacentre" and "data centre" both count,
# and "orderbook" and "order book" both count.
THEME_KEYWORDS = {
    'data_centre':    [r'data\s*cent(?:re|er)s?'],          # datacentre / data centre / datacenter
    'ai':             [r'\bai\b', r'artificial\s+intelligence', r'machine\s+learning', r'generative\s+ai', r'\bgenai\b', r'\bllm\b'],
    'semiconductor':  [r'semiconductor'],
    'aerospace':      [r'aerospace'],
    'defence':        [r'defenc(?:e|es)', r'defens(?:e|es)', r'defense', r'\bdrdo\b'],
    'cloud':          [r'\bcloud\b'],
    'ev':             [r'\bev\b', r'electric\s+vehicle'],
    'renewable':      [r'renewable', r'solar', r'wind\s+energy'],
    'export':         [r'\bexport'],
    'capex':          [r'\bcapex\b', r'capital\s+expenditure'],
    'precision_engineering': [r'precision\s*engineering'],
    'best':           [r'\bbest\b'],
    'top':            [r'\btop\b'],
    'leader':         [r'\bleader[s]?\b', r'\bleading\b', r'\bleadership\b'],
    'order_book':     [r'order\s*book', r'order\s*inflow', r'\bbacklog\b'],
    'highest':        [r'\bhighest\b'],
}

# ── Sentiment phrase library ───────────────────────────────────────────────
# Each entry is a tuple of tokens (1-3 words). Tokens are lowercase, hyphens
# treated as spaces during tokenization (so "all-time" -> "all", "time").
# Bigrams/trigrams are preferred over noisy unigrams to reduce false positives.

POSITIVE_PHRASES: list[tuple[str, ...]] = [
    # Performance superlatives
    ('highest',), ('record',), ('all', 'time', 'high'), ('record', 'high'),
    ('record', 'revenue'), ('record', 'profit'), ('record', 'quarter'),
    ('record', 'order', 'book'), ('record', 'orderbook'), ('record', 'ebitda'),
    ('strongest',), ('unprecedented',), ('exceptional',), ('outstanding',),
    ('robust',), ('stellar',), ('milestone',),

    # Growth language
    ('growth',), ('accelerating',), ('surge',), ('momentum',), ('expansion',),
    ('scaling',), ('ramp', 'up'), ('double', 'digit'), ('multi', 'fold'),
    ('exponential',), ('traction',), ('uptick',),
    ('strong', 'growth'), ('healthy', 'growth'), ('growth', 'momentum'), ('strong', 'traction'),

    # Market position
    ('leader',), ('leading',), ('market', 'leader'), ('dominant',), ('pioneer',),
    ('first', 'mover'), ('flagship',), ('top', 'selling'), ('fastest', 'growing'),
    ('preferred',), ('trusted',), ('best',), ('number', 'one'), ('no', '1'),

    # Demand / order book
    ('strong', 'demand'), ('robust', 'order', 'book'), ('healthy', 'order', 'book'),
    ('robust', 'orderbook'), ('healthy', 'orderbook'), ('strong', 'orderbook'),
    ('record', 'order', 'inflow'), ('strong', 'order', 'inflow'),
    ('healthy', 'pipeline'), ('sold', 'out'), ('fully', 'booked'), ('order', 'inflow'),
    ('backlog',), ('repeat', 'orders'), ('capacity', 'utilization'),

    # Profitability / margins
    ('margin', 'expansion'), ('improved', 'margins'), ('operating', 'leverage'),
    ('healthy', 'margins'), ('profitability',), ('ebitda', 'growth'),
    ('return', 'ratios'), ('roe', 'improvement'),

    # Forward-looking / guidance
    ('confident',), ('well', 'positioned'), ('poised',), ('optimistic',),
    ('on', 'track'), ('ahead', 'of', 'guidance'), ('raised', 'guidance'),
    ('upgraded', 'outlook'), ('visibility',), ('structural', 'tailwinds'),

    # Strategic / competitive
    ('moat',), ('differentiated',), ('proprietary',), ('breakthrough',),
    ('transformational',), ('value', 'accretive'), ('synergies',),
    ('debottlenecking',), ('foray',), ('scale', 'up'),

    # Capacity / capex
    ('greenfield',), ('brownfield',), ('commissioned',), ('debt', 'reduction'),
    ('deleveraging',), ('free', 'cash', 'flow'), ('strong', 'balance', 'sheet'),
    ('capex', 'completion'),

    # Custom requested
    ('precision', 'engineering'),
]

NEGATIVE_PHRASES: list[tuple[str, ...]] = [
    ('weak',), ('weak', 'demand'), ('decline',), ('declining',), ('declined',),
    ('decrease',), ('decreased',), ('below', 'expectations'), ('challenging',),
    ('headwinds',), ('subdued',), ('muted',), ('underperformance',),
    ('delayed',), ('postponed',), ('postpone',), ('slowdown',), ('sluggish',),
    ('loss',), ('losses',), ('write', 'off'), ('impairment',), ('contraction',),
    ('degrowth',), ('de', 'growth'), ('margin', 'pressure'), ('cost', 'pressure'),
    ('working', 'capital', 'pressure'), ('increased', 'debt'), ('disappointing',),
    ('lower', 'margins'), ('missed', 'guidance'), ('downgrade',), ('downgraded',),
    ('cautious',), ('uncertain',), ('uncertainty',), ('volatile',), ('volatility',),
    ('weak', 'orderbook'), ('weak', 'order', 'book'), ('declining', 'orderbook'),
]

# Negation / downplaying tokens — if any appear within NEGATION_WINDOW tokens
# before a phrase match, the match is dropped (treated as neutral).
NEGATION_WORDS = {
    'not', 'no', 'never', 'without', 'lack', 'lacking', 'despite',
    'neither', 'nor', 'cannot', 'unable',
}
NEGATION_WINDOW = 3


def clean_db_url(url: str) -> str:
    return re.sub(r'sslmode=["\']?(\w+)["\']?', r'sslmode=\1', url.strip())


class DB:
    """Thin psycopg2 wrapper that transparently reconnects on dropped
    connections (RDS closes idle connections during long PDF-fetch gaps)."""

    def __init__(self, url: str):
        self.url = url
        self._connect()

    def _connect(self):
        self.conn = psycopg2.connect(self.url)
        self.cur = self.conn.cursor()

    def execute(self, sql: str, params=None):
        for attempt in range(2):
            try:
                self.cur.execute(sql, params)
                return
            except psycopg2.OperationalError:
                try:
                    self.conn.close()
                except Exception:
                    pass
                self._connect()
                if attempt == 1:
                    raise

    def commit(self):
        try:
            self.conn.commit()
        except psycopg2.OperationalError:
            self._connect()

    def fetchone(self):
        return self.cur.fetchone()

    def fetchall(self):
        return self.cur.fetchall()

    def close(self):
        self.cur.close()
        self.conn.close()


def fetch_nse_day(date_str: str) -> list[dict]:
    """date_str in DD-MM-YYYY."""
    try:
        resp = requests.get(
            NSE_API,
            params={'index': 'equities', 'from_date': date_str, 'to_date': date_str},
            headers=NSE_HEADERS,
            timeout=25,
        )
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, list) else []
    except Exception as e:
        print(f'    NSE fetch error {date_str}: {e}')
        return []


def find_investor_presentation(symbol: str, result_date: date, season_end: date | None = None) -> str | None:
    """
    Search NSE filings for an 'Investor Presentation' filing by this company.
    Searches result_date up to 30 days ahead (companies often file presentations
    weeks after results — e.g. STLTECH filed 20 days later).
    """
    end = min(season_end or date.today(), result_date + timedelta(days=30))
    d = result_date
    while d <= end:
        if d.weekday() != 6:  # skip Sundays only
            nse_date = d.strftime('%d-%m-%Y')
            anns = fetch_nse_day(nse_date)
            time.sleep(0.4)
            for ann in anns:
                if ann.get('symbol', '').upper() != symbol.upper():
                    continue
                url = ann.get('attchmntFile', '')
                combined = (ann.get('desc', '') + ' ' + ann.get('attchmntText', '') + ' ' + url).lower()
                # NSE filings use varied labels for investor decks: "Investor
                # Presentation", "Investor Update(s)", "Investor/Analyst Meet", etc.
                if url and (
                    'investor presentation' in combined
                    or 'investor update' in combined
                    or 'investor/analyst' in combined
                    or 'analyst meet' in combined
                    or 'investorpresentation' in combined
                    or 'investorupdate' in combined
                ):
                    return url
        d += timedelta(days=1)
    return None


def download_pdf(url: str) -> bytes | None:
    try:
        resp = requests.get(url, headers=PDF_HEADERS, timeout=60)
        if resp.status_code == 200 and resp.content:
            return resp.content
    except Exception as e:
        print(f'    PDF download error: {e}')
    return None


def extract_text(pdf_bytes: bytes) -> str:
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            pages = []
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    pages.append(t)
            return '\n'.join(pages)
    except Exception as e:
        print(f'    PDF parse error: {e}')
        return ''


def count_theme_keywords(text: str) -> dict[str, int]:
    lower = text.lower()
    counts = {}
    for key, patterns in THEME_KEYWORDS.items():
        total = 0
        for pattern in patterns:
            total += len(re.findall(pattern, lower))
        counts[key] = total
    return counts


def tokenize(text: str) -> list[str]:
    """Lowercase, split on non-alphanumerics (hyphens become word breaks too,
    so 'all-time' -> ['all', 'time'], 'first-mover' -> ['first', 'mover'])."""
    return re.findall(r'[a-z0-9]+', text.lower())


def count_phrases(words: list[str], phrases: list[tuple[str, ...]], check_negation: bool = True) -> int:
    """
    Count occurrences of any phrase (1-3 token tuples) in `words`.
    If check_negation, a match preceded within NEGATION_WINDOW tokens by a
    negation word ("not strong", "no growth") is dropped.
    """
    by_len: dict[int, set[tuple[str, ...]]] = {}
    for p in phrases:
        by_len.setdefault(len(p), set()).add(p)

    n = len(words)
    total = 0
    for i in range(n):
        for plen, pset in by_len.items():
            if i + plen > n:
                continue
            if tuple(words[i:i + plen]) in pset:
                if check_negation:
                    start = max(0, i - NEGATION_WINDOW)
                    if any(w in NEGATION_WORDS for w in words[start:i]):
                        continue
                total += 1
    return total


def analyse_sentiment(text: str) -> dict:
    words = tokenize(text)
    word_count = len(words)
    pos_hits = count_phrases(words, POSITIVE_PHRASES)
    neg_hits = count_phrases(words, NEGATIVE_PHRASES)

    pos_density = (pos_hits / word_count * 1000) if word_count else 0.0
    neg_density = (neg_hits / word_count * 1000) if word_count else 0.0

    return {
        'word_count': word_count,
        'positive_hits': pos_hits,
        'negative_hits': neg_hits,
        'positive_density': round(pos_density, 2),
        'negative_density': round(neg_density, 2),
        'sentiment_score': round(pos_density - neg_density, 2),
    }


THEME_COLUMNS = list(THEME_KEYWORDS.keys())

_THEME_COL_DEFS = ',\n    '.join(f'{c} INT DEFAULT 0' for c in THEME_COLUMNS)

CREATE_TABLE_SQL = f"""
CREATE TABLE IF NOT EXISTS presentation_keyword_analysis (
    id              SERIAL PRIMARY KEY,
    symbol          VARCHAR(20) NOT NULL,
    company_name    VARCHAR(500),
    result_date     DATE NOT NULL,
    presentation_url TEXT,
    pdf_pages       INT,
    pdf_chars       INT,
    {_THEME_COL_DEFS},
    word_count        INT DEFAULT 0,
    positive_hits     INT DEFAULT 0,
    negative_hits     INT DEFAULT 0,
    positive_density  NUMERIC(8,2) DEFAULT 0,
    negative_density  NUMERIC(8,2) DEFAULT 0,
    sentiment_score   NUMERIC(8,2) DEFAULT 0,
    has_presentation BOOLEAN DEFAULT FALSE,
    analysed_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (symbol, result_date)
);
CREATE INDEX IF NOT EXISTS ix_pka_symbol ON presentation_keyword_analysis (symbol);
"""

# ALTER statements to add new columns to a pre-existing table from the prior version.
ALTER_TABLE_SQL = [
    f'ALTER TABLE presentation_keyword_analysis ADD COLUMN IF NOT EXISTS {c} INT DEFAULT 0'
    for c in ('precision_engineering', 'best', 'top', 'leader', 'order_book', 'highest',
              'word_count', 'positive_hits', 'negative_hits')
] + [
    "ALTER TABLE presentation_keyword_analysis ADD COLUMN IF NOT EXISTS positive_density NUMERIC(8,2) DEFAULT 0",
    "ALTER TABLE presentation_keyword_analysis ADD COLUMN IF NOT EXISTS negative_density NUMERIC(8,2) DEFAULT 0",
    "ALTER TABLE presentation_keyword_analysis ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC(8,2) DEFAULT 0",
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--season-start', default='2026-04-08')
    parser.add_argument('--out', default='results/keyword_analysis.csv')
    parser.add_argument('--symbol', help='Run for a single symbol only (for testing)')
    parser.add_argument('--force', action='store_true', help='Re-process even if already analysed')
    parser.add_argument('--resume-after', help='Skip companies alphabetically <= this symbol (for resuming a --force run)')
    parser.add_argument('--missing-only', action='store_true', help='Only re-search companies currently marked has_presentation=FALSE')
    args = parser.parse_args()

    season_start = date.fromisoformat(args.season_start)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    db = DB(clean_db_url(DB_URL))
    db.execute(CREATE_TABLE_SQL)
    for stmt in ALTER_TABLE_SQL:
        db.execute(stmt)
    db.commit()

    # Get all companies that announced results this season
    # Pick earliest announcement per symbol (their actual result date)
    query = """
        SELECT DISTINCT ON (symbol)
            symbol,
            company_name,
            DATE(announced_at AT TIME ZONE 'Asia/Kolkata') AS result_date
        FROM pead_announcements
        WHERE announced_at >= %s
        ORDER BY symbol, announced_at ASC
    """
    IST_start = datetime.combine(season_start, datetime.min.time()).replace(
        tzinfo=timezone(timedelta(hours=5, minutes=30))
    )
    db.execute(query, (IST_start,))
    companies = db.fetchall()

    if args.symbol:
        companies = [(s, n, d) for s, n, d in companies if s.upper() == args.symbol.upper()]

    if args.resume_after:
        companies = [(s, n, d) for s, n, d in companies if s.upper() > args.resume_after.upper()]

    if args.missing_only:
        db.execute("SELECT symbol FROM presentation_keyword_analysis WHERE has_presentation = TRUE")
        have = {r[0].upper() for r in db.fetchall()}
        companies = [(s, n, d) for s, n, d in companies if s.upper() not in have]
        args.force = True  # overwrite the existing has_presentation=FALSE row

    print(f'Companies to analyse: {len(companies)}')
    print(f'Output CSV: {out_path}\n')

    rows = []
    insert_cols = (
        ['symbol', 'company_name', 'result_date', 'presentation_url', 'pdf_pages', 'pdf_chars']
        + THEME_COLUMNS
        + ['word_count', 'positive_hits', 'negative_hits', 'positive_density', 'negative_density', 'sentiment_score']
    )
    update_cols = [c for c in insert_cols if c not in ('symbol', 'result_date')]

    insert_sql = f"""
        INSERT INTO presentation_keyword_analysis
            ({', '.join(insert_cols)}, has_presentation)
        VALUES ({', '.join(['%s'] * len(insert_cols))}, TRUE)
        ON CONFLICT (symbol, result_date) DO UPDATE SET
            {', '.join(f'{c} = EXCLUDED.{c}' for c in update_cols)},
            has_presentation = TRUE,
            analysed_at = NOW()
    """

    for i, (symbol, company_name, result_date) in enumerate(companies, 1):
        print(f'[{i}/{len(companies)}] {symbol} ({result_date})', end=' … ', flush=True)

        if not args.force:
            db.execute(
                'SELECT id FROM presentation_keyword_analysis WHERE symbol = %s AND result_date = %s',
                (symbol, result_date)
            )
            if db.fetchone():
                print('already done, skipping')
                continue

        # Find investor presentation URL from NSE
        pres_url = find_investor_presentation(symbol, result_date)

        if not pres_url:
            print('no presentation found')
            db.execute("""
                INSERT INTO presentation_keyword_analysis
                    (symbol, company_name, result_date, has_presentation)
                VALUES (%s, %s, %s, FALSE)
                ON CONFLICT (symbol, result_date) DO NOTHING
            """, (symbol, company_name, result_date))
            db.commit()
            rows.append({
                'symbol': symbol, 'company_name': company_name,
                'result_date': result_date, 'has_presentation': False,
                'presentation_url': '', 'pdf_pages': 0, 'pdf_chars': 0,
                **{k: 0 for k in THEME_COLUMNS},
                'word_count': 0, 'positive_hits': 0, 'negative_hits': 0,
                'positive_density': 0, 'negative_density': 0, 'sentiment_score': 0,
            })
            continue

        print('found PDF', end=' … ', flush=True)

        pdf_bytes = download_pdf(pres_url)
        if not pdf_bytes:
            print('download failed')
            db.execute("""
                INSERT INTO presentation_keyword_analysis
                    (symbol, company_name, result_date, presentation_url, has_presentation)
                VALUES (%s, %s, %s, %s, TRUE)
                ON CONFLICT (symbol, result_date) DO UPDATE
                  SET presentation_url = EXCLUDED.presentation_url
            """, (symbol, company_name, result_date, pres_url))
            db.commit()
            continue

        text = extract_text(pdf_bytes)
        theme_counts = count_theme_keywords(text)
        sentiment = analyse_sentiment(text)

        try:
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                n_pages = len(pdf.pages)
        except Exception:
            n_pages = 0

        kw_display = ', '.join(f'{k}={v}' for k, v in theme_counts.items() if v > 0) or 'no theme matches'
        print(f"{n_pages}pp, {sentiment['word_count']}w → sentiment={sentiment['sentiment_score']:+.2f} "
              f"(+{sentiment['positive_hits']}/-{sentiment['negative_hits']}) | {kw_display}")

        values = [symbol, company_name, result_date, pres_url, n_pages, len(text)]
        values += [theme_counts[c] for c in THEME_COLUMNS]
        values += [sentiment['word_count'], sentiment['positive_hits'], sentiment['negative_hits'],
                   sentiment['positive_density'], sentiment['negative_density'], sentiment['sentiment_score']]

        db.execute(insert_sql, values)
        db.commit()

        row = {
            'symbol': symbol, 'company_name': company_name,
            'result_date': str(result_date), 'has_presentation': True,
            'presentation_url': pres_url, 'pdf_pages': n_pages,
            'pdf_chars': len(text), **theme_counts, **sentiment,
        }
        rows.append(row)

        time.sleep(1)  # polite delay between PDFs

    db.close()

    # Write CSV
    if rows:
        fieldnames = (
            ['symbol', 'company_name', 'result_date', 'has_presentation',
             'presentation_url', 'pdf_pages', 'pdf_chars']
            + THEME_COLUMNS
            + ['word_count', 'positive_hits', 'negative_hits', 'positive_density', 'negative_density', 'sentiment_score']
        )
        with open(out_path, 'w', newline='') as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            w.writerows(rows)
        print(f'\nCSV saved: {out_path}')

    # Summary
    conn2 = psycopg2.connect(clean_db_url(DB_URL))
    cur2 = conn2.cursor()
    cur2.execute(f"""
        SELECT
            COUNT(*) FILTER (WHERE has_presentation) AS with_presentation,
            COUNT(*) AS total,
            {', '.join(f'SUM({c}) AS {c}' for c in THEME_COLUMNS)},
            AVG(sentiment_score) FILTER (WHERE has_presentation) AS avg_sentiment
        FROM presentation_keyword_analysis
    """)
    row = cur2.fetchone()
    if row:
        print('\n=== Season Summary ===')
        print(f'Companies with investor presentation: {row[0]} / {row[1]}')
        print('Total theme mentions across all presentations:')
        for label, val in zip(THEME_COLUMNS, row[2:-1]):
            print(f'  {label:24s}: {val or 0}')
        avg_sent = row[-1]
        if avg_sent is not None:
            print(f'\nAverage sentiment score (positive - negative density per 1000 words): {avg_sent:.2f}')

    cur2.close()
    conn2.close()


if __name__ == '__main__':
    main()
