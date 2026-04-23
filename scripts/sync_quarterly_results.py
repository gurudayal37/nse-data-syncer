#!/usr/bin/env python3
"""
Scrape quarterly results for a stock from Screener.in and store in DB.

Usage:
    python sync_quarterly_results.py --symbol RELIANCE

Requires env vars (in web/.env or environment):
    DATABASE_URL        PostgreSQL connection string
    SCREENER_USERNAME   Screener.in username/email
    SCREENER_PASSWORD   Screener.in password
"""

import sys
import os
import argparse
import json
import re
import logging
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
import psycopg2
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# Load env from web/.env (works when running from repo root or scripts/)
_script_dir = os.path.dirname(os.path.abspath(__file__))
for _candidate in [
    os.path.join(_script_dir, '..', 'web', '.env'),
    os.path.join(_script_dir, '..', '.env'),
]:
    if os.path.exists(_candidate):
        load_dotenv(_candidate)
        break

BASE_URL = "https://www.screener.in"


def login_to_screener() -> requests.Session:
    username = os.environ.get('SCREENER_USERNAME')
    password = os.environ.get('SCREENER_PASSWORD')
    if not username or not password:
        raise RuntimeError(
            "SCREENER_USERNAME and SCREENER_PASSWORD must be set in web/.env"
        )

    session = requests.Session()
    session.headers.update({
        'User-Agent': (
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/120.0.0.0 Safari/537.36'
        )
    })

    resp = session.get(f"{BASE_URL}/login/", timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, 'html.parser')
    csrf_input = soup.find('input', {'name': 'csrfmiddlewaretoken'})
    if not csrf_input:
        raise RuntimeError("Could not find CSRF token on Screener.in login page")

    resp = session.post(
        f"{BASE_URL}/login/",
        data={
            'csrfmiddlewaretoken': csrf_input['value'],
            'username': username,
            'password': password,
            'next': '/',
        },
        headers={'Referer': f"{BASE_URL}/login/"},
        timeout=15,
        allow_redirects=True,
    )
    resp.raise_for_status()

    if '/login/' in resp.url:
        raise RuntimeError("Login failed — check SCREENER_USERNAME / SCREENER_PASSWORD")

    logger.info("Logged into Screener.in successfully")
    return session


def _parse_number(text: str):
    """Parse '1,234.56' or '12.5%' → float, or None."""
    if not text:
        return None
    cleaned = text.strip().replace(',', '').replace('%', '').replace('\xa0', '')
    # Handle negative in parentheses: (123) → -123
    if cleaned.startswith('(') and cleaned.endswith(')'):
        cleaned = '-' + cleaned[1:-1]
    try:
        return float(cleaned)
    except ValueError:
        return None


def _quarter_info(col_header: str):
    """
    'Jun 2024' → (quarter='Jun 2024', fy_year=2025, quarter_number=1)

    Indian fiscal year quarters:
        Q1 Apr–Jun  Q2 Jul–Sep  Q3 Oct–Dec  Q4 Jan–Mar
    FY year is the year in which March falls.
    e.g. 'Mar 2024' → FY2024 Q4; 'Jun 2024' → FY2025 Q1
    """
    MONTH_MAP = {
        'jan': (4, 0), 'feb': (4, 0), 'mar': (4, 0),   # Q4, same calendar year
        'apr': (1, 1), 'may': (1, 1), 'jun': (1, 1),   # Q1, +1 year
        'jul': (2, 1), 'aug': (2, 1), 'sep': (2, 1),   # Q2, +1 year
        'oct': (3, 1), 'nov': (3, 1), 'dec': (3, 1),   # Q3, +1 year
    }
    parts = col_header.strip().split()
    if len(parts) != 2:
        return col_header, 0, 0
    month_str, year_str = parts
    try:
        cal_year = int(year_str)
    except ValueError:
        return col_header, 0, 0
    key = month_str[:3].lower()
    if key not in MONTH_MAP:
        return col_header, 0, 0
    qnum, yr_offset = MONTH_MAP[key]
    fy_year = cal_year + yr_offset
    return col_header, fy_year, qnum


# Map Screener.in row labels to DB column names
_ROW_MAP = [
    (['sales', 'revenue', 'net sales'], 'revenue'),
    (['operating profit'], 'operating_profit'),
    (['opm %', 'opm%', 'operating profit margin'], 'opm_percent'),
    (['other income'], 'other_income'),
    (['interest'], 'interest'),
    (['depreciation'], 'depreciation'),
    (['profit before tax', 'pbt'], 'pbt'),
    (['tax %', 'tax%'], 'tax_percent'),
    (['net profit', 'profit after tax', 'pat'], 'net_profit'),
    (['eps in rs', 'eps (rs)', 'eps'], 'eps'),
    (['expenditure', 'expenses', 'total expenses'], 'expenditure'),
]


def _match_row(label: str):
    norm = label.lower().strip().replace('+', '').replace('\xa0', ' ').strip()
    for keywords, field in _ROW_MAP:
        for kw in keywords:
            if kw in norm:
                return field
    return None


def scrape_quarterly_results(session: requests.Session, symbol: str):
    """Returns list of dicts, one per quarter (newest first from Screener)."""
    url = f"{BASE_URL}/company/{symbol}/consolidated/"
    resp = session.get(url, timeout=20)
    if resp.status_code == 404:
        url = f"{BASE_URL}/company/{symbol}/"
        resp = session.get(url, timeout=20)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, 'html.parser')

    section = soup.find('section', {'id': 'quarters'})
    if not section:
        raise RuntimeError(f"No #quarters section found for {symbol}")

    table = section.find('table')
    if not table:
        raise RuntimeError(f"No table in #quarters section for {symbol}")

    # Parse column headers (quarter strings)
    thead = table.find('thead')
    if not thead:
        raise RuntimeError("No thead in quarterly results table")

    col_headers = [th.get_text(strip=True) for th in thead.find_all('th')]
    # col_headers[0] is the row-label column; the rest are quarters
    quarter_cols = col_headers[1:]
    if not quarter_cols:
        raise RuntimeError("No quarter columns found in table")

    # Parse body rows into {field: [val_q0, val_q1, ...]}
    field_values: dict[str, list] = {}
    tbody = table.find('tbody')
    if tbody:
        for tr in tbody.find_all('tr'):
            cells = tr.find_all('td')
            if not cells:
                continue
            label = cells[0].get_text(strip=True)
            field = _match_row(label)
            if field:
                vals = [
                    cells[i].get_text(strip=True) if i < len(cells) else ''
                    for i in range(1, len(quarter_cols) + 1)
                ]
                field_values[field] = vals

    # Build one record per quarter column
    results = []
    for idx, col in enumerate(quarter_cols):
        if not col:
            continue
        quarter_str, fy_year, qnum = _quarter_info(col)
        rec: dict = {
            'quarter': quarter_str,
            'year': fy_year,
            'quarter_number': qnum,
            'is_consolidated': True,
            'source': 'screener',
        }
        for field, vals in field_values.items():
            if idx < len(vals):
                rec[field] = _parse_number(vals[idx])

        # EBITDA = Operating Profit + Depreciation
        op = rec.get('operating_profit')
        dep = rec.get('depreciation')
        if op is not None:
            rec['ebitda'] = (op + dep) if dep is not None else op

        # Derived margins (if not already set by OPM% row)
        rev = rec.get('revenue')
        if rev and rev != 0:
            if 'opm_percent' not in rec or rec['opm_percent'] is None:
                if op is not None:
                    rec['opm_percent'] = round((op / rev) * 100, 2)
            np_ = rec.get('net_profit')
            if np_ is not None:
                rec['net_margin'] = round((np_ / rev) * 100, 2)
            if op is not None:
                rec['operating_margin'] = round((op / rev) * 100, 2)

        results.append(rec)

    return results


def save_to_db(symbol: str, results: list) -> int:
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        raise RuntimeError("DATABASE_URL not set")

    parsed = urlparse(db_url)
    conn = psycopg2.connect(
        host=parsed.hostname,
        port=parsed.port or 5432,
        database=parsed.path.lstrip('/'),
        user=parsed.username,
        password=parsed.password,
        sslmode='require',
    )

    cur = conn.cursor()
    cur.execute("SELECT id FROM stocks WHERE nse_symbol = %s", (symbol,))
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        raise RuntimeError(f"Stock '{symbol}' not found in database")
    stock_id = row[0]

    upserted = 0
    for rec in results:
        try:
            cur.execute(
                """
                INSERT INTO quarterly_results
                    (stock_id, quarter, year, quarter_number,
                     revenue, net_profit, ebitda, operating_profit,
                     operating_margin, net_margin, eps, is_consolidated,
                     other_income, interest, depreciation, pbt,
                     tax_percent, opm_percent, expenditure, source)
                VALUES
                    (%s,%s,%s,%s, %s,%s,%s,%s, %s,%s,%s,%s, %s,%s,%s,%s, %s,%s,%s,%s)
                ON CONFLICT (stock_id, quarter, year) DO UPDATE SET
                    revenue          = EXCLUDED.revenue,
                    net_profit       = EXCLUDED.net_profit,
                    ebitda           = EXCLUDED.ebitda,
                    operating_profit = EXCLUDED.operating_profit,
                    operating_margin = EXCLUDED.operating_margin,
                    net_margin       = EXCLUDED.net_margin,
                    eps              = EXCLUDED.eps,
                    other_income     = EXCLUDED.other_income,
                    interest         = EXCLUDED.interest,
                    depreciation     = EXCLUDED.depreciation,
                    pbt              = EXCLUDED.pbt,
                    tax_percent      = EXCLUDED.tax_percent,
                    opm_percent      = EXCLUDED.opm_percent,
                    expenditure      = EXCLUDED.expenditure,
                    source           = EXCLUDED.source
                """,
                (
                    stock_id,
                    rec.get('quarter'),
                    rec.get('year'),
                    rec.get('quarter_number'),
                    rec.get('revenue'),
                    rec.get('net_profit'),
                    rec.get('ebitda'),
                    rec.get('operating_profit'),
                    rec.get('operating_margin'),
                    rec.get('net_margin'),
                    rec.get('eps'),
                    rec.get('is_consolidated', True),
                    rec.get('other_income'),
                    rec.get('interest'),
                    rec.get('depreciation'),
                    rec.get('pbt'),
                    rec.get('tax_percent'),
                    rec.get('opm_percent'),
                    rec.get('expenditure'),
                    rec.get('source', 'screener'),
                ),
            )
            upserted += 1
        except Exception as e:
            logger.warning(f"  Skipped quarter {rec.get('quarter')}: {e}")
            conn.rollback()
            continue

    conn.commit()
    cur.close()
    conn.close()
    return upserted


def main():
    parser = argparse.ArgumentParser(description='Sync quarterly results from Screener.in')
    parser.add_argument('--symbol', required=True, help='NSE stock symbol (e.g. RELIANCE)')
    args = parser.parse_args()

    symbol = args.symbol.upper().replace('.NS', '').replace('.BO', '')

    try:
        session = login_to_screener()
        results = scrape_quarterly_results(session, symbol)
        logger.info(f"Scraped {len(results)} quarters for {symbol}")

        saved = save_to_db(symbol, results)
        logger.info(f"Saved/updated {saved} quarters in DB")

        # Emit JSON for the API route to consume
        print(json.dumps({
            'success': True,
            'symbol': symbol,
            'quarters_scraped': len(results),
            'quarters_saved': saved,
        }))

    except Exception as exc:
        logger.error(str(exc))
        print(json.dumps({'success': False, 'error': str(exc)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
