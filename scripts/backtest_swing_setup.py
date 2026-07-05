"""
Historical validation of a swing/positional trading idea:

    Strong Stock (Minervini Trend Template) + Strong Sector (sector index
    momentum) + High RS (relative-strength percentile) + High ADR%
    (Average Daily Range)

For every stock in the universe, finds every historical date all four
conditions were true simultaneously, then measures forward returns at a
few horizons to see whether the combination has real edge - and whether
Strong-Sector + High-ADR (the two new factors) actually improve on
Stage-2 + RS alone (the two that already existed).

Universe: active stocks, market_cap >= MIN_MARKET_CAP_CR, with an
industry that maps to one of our NSE sector indices (scripts/sync_dhan_indices.py).
Unmappable stocks (no industry classification, or an industry with no
sector-index equivalent - e.g. Packaging, Sugar, Gems & Jewellery) are
excluded entirely rather than partially graded.

Entirely vectorized (pandas groupby + rolling), no per-day Python loops -
computing this naively across ~10 years x ~1000+ stocks would be
intractably slow.
"""
import sys
import os
import json
import numpy as np
import pandas as pd
from sqlalchemy import text
from datetime import datetime, timedelta
from dotenv import load_dotenv

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(base_dir, 'web', '.env'))
sys.path.append(base_dir)

from app.database import DatabaseManager

# --- Tunable parameters ---
MIN_MARKET_CAP_CR = float(os.getenv('MIN_MARKET_CAP_CR', 2000))
RS_THRESHOLD = 90            # stricter than the RS>=70 already inside Stage 2
ADR_THRESHOLD_PCT = 5.0      # Qullamaggie convention minimum ADR%
SECTOR_LOOKBACK_DAYS = 63    # ~3 months, matches the RS-rank lookback
FORWARD_HORIZONS = [10, 20, 60]  # trading days: ~2wk / ~1mo / ~3mo
BENCHMARK_SYMBOL = '^CRSLDX'  # Nifty 500, read from our own index_daily_prices
HISTORY_DAYS = 365 * 12      # ~12 years, covers all available daily_prices history
CHUNK_SIZE = 200             # stock_id chunk size for loading daily_prices

OUTPUT_JSON = os.path.join(base_dir, 'web', 'src', 'data', 'backtest_results_swing_setup.json')

# --- Sector mapping: stocks.industry -> our NSE sector index symbol ---
# Many-to-one; industries with no reasonable sector-index equivalent are
# simply omitted (those stocks are excluded from the universe entirely).
SECTOR_INDEX_MAP = {
    # Auto
    'Auto Components & Equipments': 'CNXAUTO', 'Passenger Cars & Utility Vehicles': 'CNXAUTO',
    'Tyres & Rubber Products': 'CNXAUTO', '2/3 Wheelers': 'CNXAUTO', 'Tractors': 'CNXAUTO',
    'Commercial Vehicles': 'CNXAUTO',
    # IT
    'Computers - Software & Consulting': 'CNXIT', 'IT Enabled Services': 'CNXIT',
    'Software Products': 'CNXIT', 'Computers Hardware & Equipments': 'CNXIT',
    'Business Process Outsourcing (BPO)/ Knowledge Process Outsourcing (KPO)': 'CNXIT',
    # Pharma / Healthcare
    'Pharmaceuticals': 'CNXPHARMA',
    'Hospital': 'NIFTY_HEALTHCARE', 'Healthcare Research- Analytics & Technology': 'NIFTY_HEALTHCARE',
    'Healthcare Service Provider': 'NIFTY_HEALTHCARE', 'Biotechnology': 'NIFTY_HEALTHCARE',
    'Pharmacy Retail': 'NIFTY_HEALTHCARE', 'Medical Equipment & Supplies': 'NIFTY_HEALTHCARE',
    # Metal
    'Iron & Steel Products': 'CNXMETAL', 'Iron & Steel': 'CNXMETAL', 'Industrial Minerals': 'CNXMETAL',
    'Aluminium': 'CNXMETAL', 'Copper': 'CNXMETAL', 'Diversified Metals': 'CNXMETAL',
    'Ferro & Silica Manganese': 'CNXMETAL', 'Trading - Metals': 'CNXMETAL', 'Trading - Minerals': 'CNXMETAL',
    'Sponge Iron': 'CNXMETAL', 'Zinc': 'CNXMETAL', 'Aluminium- Copper & Zinc Products': 'CNXMETAL',
    # Realty / Infra
    'Residential- Commercial Projects': 'CNXREALTY',
    'Civil Construction': 'CNXINFRA', 'Cement & Cement Products': 'CNXINFRA', 'Railway Wagons': 'CNXINFRA',
    'Dredging': 'CNXINFRA', 'Road Assets–Toll- Annuity- Hybrid-Annuity': 'CNXINFRA',
    'Other Construction Materials': 'CNXINFRA',
    # Financial Services / Banks
    'Non Banking Financial Company (NBFC)': 'FINNIFTY', 'Investment Company': 'FINNIFTY',
    'Housing Finance Company': 'FINNIFTY', 'Financial Institution': 'FINNIFTY', 'Other Bank': 'FINNIFTY',
    'Life Insurance': 'FINNIFTY', 'General Insurance': 'FINNIFTY', 'Microfinance Institutions': 'FINNIFTY',
    'Ratings': 'FINNIFTY', 'Financial Products Distributor': 'FINNIFTY', 'Insurance Distributors': 'FINNIFTY',
    'Other Financial Services': 'FINNIFTY', 'Financial Technology (Fintech)': 'FINNIFTY',
    'Private Sector Bank': 'NIFTYPVTBANK', 'Public Sector Bank': 'CNXPSUBANK',
    'Stockbroking & Allied': 'NIFTY_CAPITAL_MKT', 'Asset Management Company': 'NIFTY_CAPITAL_MKT',
    'Depositories- Clearing Houses and Other Intermediaries': 'NIFTY_CAPITAL_MKT',
    'Exchange and Data Platform': 'NIFTY_CAPITAL_MKT', 'Financial Data & Stock Exchanges': 'NIFTY_CAPITAL_MKT',
    # FMCG
    'Packaged Foods': 'CNXFMCG', 'Breweries & Distilleries': 'CNXFMCG', 'Personal Care': 'CNXFMCG',
    'Dairy Products': 'CNXFMCG', 'Edible Oil': 'CNXFMCG', 'Diversified FMCG': 'CNXFMCG',
    'Other Food Products': 'CNXFMCG', 'Household Products': 'CNXFMCG', 'Cigarettes & Tobacco Products': 'CNXFMCG',
    'Tea & Coffee': 'CNXFMCG', 'Meat Products including Poultry': 'CNXFMCG', 'Other Beverages': 'CNXFMCG',
    # Energy / Oil & Gas
    'Power Generation': 'CNXENERGY', 'Integrated Power Utilities': 'CNXENERGY', 'Coal': 'CNXENERGY',
    'Power Trading': 'CNXENERGY', 'Power Distribution': 'CNXENERGY', 'Power - Transmission': 'CNXENERGY',
    'Refineries & Marketing': 'NIFTY_OIL_AND_GAS', 'LPG/CNG/PNG/LNG Supplier': 'NIFTY_OIL_AND_GAS',
    'Lubricants': 'NIFTY_OIL_AND_GAS', 'Oil Exploration & Production': 'NIFTY_OIL_AND_GAS',
    'Petrochemicals': 'NIFTY_OIL_AND_GAS', 'Gas Transmission/Marketing': 'NIFTY_OIL_AND_GAS',
    'Trading - Gas': 'NIFTY_OIL_AND_GAS', 'Oil Storage & Transportation': 'NIFTY_OIL_AND_GAS',
    # Consumer Durables
    'Household Appliances': 'CNXCONSRDURBL', 'Gems- Jewellery And Watches': 'CNXCONSRDURBL',
    'Consumer Electronics': 'CNXCONSRDURBL', 'Ceramics': 'CNXCONSRDURBL', 'Sanitary Ware': 'CNXCONSRDURBL',
    'Furniture- Home Furnishing': 'CNXCONSRDURBL', 'Plastic Products - Consumer': 'CNXCONSRDURBL',
    'Houseware': 'CNXCONSRDURBL', 'Glass - Consumer': 'CNXCONSRDURBL',
    # Media
    'Media & Entertainment': 'CNXMEDIA', 'TV Broadcasting & Software Production': 'CNXMEDIA',
    'Printing & Publication': 'CNXMEDIA', 'Digital Entertainment': 'NIFTY_IND_DIGITAL',
    'Film Production- Distribution & Exhibition': 'CNXMEDIA', 'Print Media': 'CNXMEDIA',
    # Services / Consumption / Tourism
    'Diversified Commercial Services': 'CNXSERVICE', 'Logistics Solution Provider': 'CNXSERVICE',
    'Shipping': 'CNXSERVICE', 'Port & Port services': 'CNXSERVICE', 'Transport Related Services': 'CNXSERVICE',
    'Speciality Retail': 'CNXCONSUMPTION', 'Restaurants': 'CNXCONSUMPTION', 'Diversified Retail': 'CNXCONSUMPTION',
    'Other Consumer Services': 'CNXCONSUMPTION', 'Education': 'CNXCONSUMPTION',
    'Hotels & Resorts': 'NIFTY_IND_TOURISM', 'Tour, Travel Related Services': 'NIFTY_IND_TOURISM',
    'Amusement Parks/ Other Recreation': 'NIFTY_IND_TOURISM', 'Airline': 'NIFTY_IND_TOURISM',
    'Airport & Airport services': 'NIFTY_IND_TOURISM',
    # Digital / New-age
    'E-Retail/ E-Commerce': 'NIFTY_IND_DIGITAL', 'Internet & Catalogue Retail': 'NIFTY_IND_DIGITAL',
    'E-Learning': 'NIFTY_IND_DIGITAL',
    # Defence
    'Aerospace & Defense': 'NIFTY_IND_DEFENCE', 'Ship Building & Allied Services': 'NIFTY_IND_DEFENCE',
}

FORWARD_HORIZON_COLS = {h: f'fwd_ret_{h}' for h in FORWARD_HORIZONS}


def load_universe(session):
    min_mcap = MIN_MARKET_CAP_CR * 10_000_000
    rows = session.execute(text("""
        SELECT id, nse_symbol, industry FROM stocks
        WHERE is_active = true AND market_cap >= :min_mcap
    """), {'min_mcap': min_mcap}).fetchall()

    universe = []
    for r in rows:
        sector_symbol = SECTOR_INDEX_MAP.get(r.industry)
        if sector_symbol:
            universe.append({'stock_id': r.id, 'nse_symbol': r.nse_symbol, 'sector_symbol': sector_symbol})
    print(f"Universe: {len(rows)} stocks >= {MIN_MARKET_CAP_CR} Cr, {len(universe)} with a mapped sector "
          f"({len(rows) - len(universe)} excluded - no sector-index mapping).")
    return pd.DataFrame(universe)


def load_daily_prices(session, stock_ids, start_date):
    frames = []
    ids = list(stock_ids)
    for i in range(0, len(ids), CHUNK_SIZE):
        chunk = ids[i:i + CHUNK_SIZE]
        rows = session.execute(text("""
            SELECT stock_id, date, close_price, high_price, low_price
            FROM daily_prices
            WHERE stock_id = ANY(:ids) AND date >= :start_date
            ORDER BY stock_id, date ASC
        """), {'ids': chunk, 'start_date': start_date}).fetchall()
        if rows:
            frames.append(pd.DataFrame(rows, columns=['stock_id', 'date', 'close', 'high', 'low']))
    if not frames:
        return pd.DataFrame(columns=['stock_id', 'date', 'close', 'high', 'low'])
    df = pd.concat(frames, ignore_index=True)
    df['date'] = pd.to_datetime(df['date'])
    # daily_prices has some duplicate (stock_id, date) rows from overlapping
    # syncs (pre-existing data issue, not caused by this script) - dedupe.
    df = df.drop_duplicates(subset=['stock_id', 'date'], keep='last')
    return df


def load_index_prices(session, symbols, start_date):
    rows = session.execute(text("""
        SELECT i.symbol, p.date, p.close_price
        FROM index_daily_prices p
        JOIN indices i ON i.id = p.index_id
        WHERE i.symbol = ANY(:symbols) AND p.date >= :start_date
        ORDER BY i.symbol, p.date ASC
    """), {'symbols': list(symbols), 'start_date': start_date}).fetchall()
    df = pd.DataFrame(rows, columns=['symbol', 'date', 'close'])
    df['date'] = pd.to_datetime(df['date'])
    df = df.drop_duplicates(subset=['symbol', 'date'], keep='last')
    return df


def compute_stock_features(df):
    """Per-stock, fully vectorized rolling features. df must be one stock,
    sorted by date ascending, with columns close/high/low."""
    close, high, low = df['close'], df['high'], df['low']

    sma_50 = close.rolling(50).mean()
    sma_150 = close.rolling(150).mean()
    sma_200 = close.rolling(200).mean()
    sma_200_1m_ago = sma_200.shift(21)

    high_252 = high.rolling(252, min_periods=1).max()
    low_252 = low.rolling(252, min_periods=1).min()

    ret_63 = close / close.shift(63) - 1
    adr_pct = ((high / low - 1) * 100).rolling(20).mean()

    # Deliberately strict vs. calculate_stage2.py's live screen: here, missing
    # history (NaN) means "no signal possible", not "treat as pass" - the
    # right default for a historical backtest, where spurious early signals
    # from insufficient history would be a real correctness bug.
    is_stage2 = (
        (close > sma_150) & (close > sma_200) &
        (sma_150 > sma_200) &
        (sma_200 > sma_200_1m_ago) &
        (sma_50 > sma_150) & (sma_50 > sma_200) &
        (close > sma_50) &
        (close >= 1.30 * low_252) &
        (close >= 0.75 * high_252)
    )

    out = pd.DataFrame({
        'date': df['date'].values,
        'close': close.values,
        'is_stage2': is_stage2.values,
        'ret_63': ret_63.values,
        'adr_pct': adr_pct.values,
    })
    for h in FORWARD_HORIZONS:
        out[FORWARD_HORIZON_COLS[h]] = close.shift(-h).values / close.values - 1
    return out


def compute_rs_rank(master_df):
    """Cross-sectional RS rank: percentile rank of 63-day return, per date,
    across the whole universe - computed for all dates in one vectorized op."""
    pivot = master_df.pivot(index='date', columns='stock_id', values='ret_63')
    rs_rank = pivot.rank(axis=1, pct=True) * 100
    rs_long = rs_rank.stack(future_stack=True).rename('rs_rank').reset_index()
    return rs_long


def compute_sector_returns(index_df):
    """Each sector index's own rolling SECTOR_LOOKBACK_DAYS return, per symbol."""
    out = []
    for symbol, g in index_df.groupby('symbol'):
        g = g.sort_values('date')
        ret = g['close'] / g['close'].shift(SECTOR_LOOKBACK_DAYS) - 1
        out.append(pd.DataFrame({'sector_symbol': symbol, 'date': g['date'].values, 'sector_ret': ret.values}))
    return pd.concat(out, ignore_index=True)


def mark_trade_starts(master_df, mask):
    """True only on the first day of each contiguous streak where `mask` is
    True for a given stock - i.e. a fresh signal, not a continuation of one
    already flagged. Without this, a stock qualifying for weeks in a row
    contributes many overlapping, highly-correlated daily rows and inflates
    the apparent sample size."""
    prev_true = mask.groupby(master_df['stock_id']).shift(1).fillna(False).astype(bool)
    return mask & ~prev_true


def aggregate_horizon_stats(subset, benchmark_df):
    merged = subset.merge(benchmark_df, on='date', how='left', suffixes=('', '_bench'))
    stats = {'trade_count': int(len(subset))}
    for h in FORWARD_HORIZONS:
        col = FORWARD_HORIZON_COLS[h]
        bench_col = f'bench_{col}'
        vals = merged[col].dropna()
        bench_vals = merged.loc[vals.index, bench_col].dropna()
        if len(vals) == 0:
            stats[f'{h}d'] = None
            continue
        stats[f'{h}d'] = {
            'n': int(len(vals)),
            'win_rate': float(round((vals > 0).mean() * 100, 2)),
            'avg_return_pct': float(round(vals.mean() * 100, 2)),
            'median_return_pct': float(round(vals.median() * 100, 2)),
            'benchmark_avg_return_pct': float(round(bench_vals.mean() * 100, 2)) if len(bench_vals) else None,
        }
    return stats


def run_backtest():
    print("=== Backtesting Swing Setup: Strong Stock + Strong Sector + High RS + High ADR% ===")
    db = DatabaseManager()
    session = db.Session()
    try:
        start_date = datetime.now() - timedelta(days=HISTORY_DAYS)

        universe_df = load_universe(session)
        if universe_df.empty:
            print("Empty universe, aborting.")
            return
        sector_symbol_map = dict(zip(universe_df['stock_id'], universe_df['sector_symbol']))
        stock_symbol_map = dict(zip(universe_df['stock_id'], universe_df['nse_symbol']))

        print("Loading daily prices for universe...")
        prices_df = load_daily_prices(session, universe_df['stock_id'].tolist(), start_date)
        print(f"Loaded {len(prices_df):,} price rows for {prices_df['stock_id'].nunique()} stocks.")

        print("Computing per-stock rolling features (vectorized)...")
        feature_frames = []
        for stock_id, g in prices_df.sort_values('date').groupby('stock_id'):
            feat = compute_stock_features(g.reset_index(drop=True))
            feat['stock_id'] = stock_id
            feature_frames.append(feat)
        master_df = pd.concat(feature_frames, ignore_index=True)

        print("Computing cross-sectional RS rank...")
        rs_long = compute_rs_rank(master_df)
        master_df = master_df.merge(rs_long, on=['date', 'stock_id'], how='left')

        print("Loading sector index prices and computing sector momentum...")
        sector_symbols = sorted(set(sector_symbol_map.values()) | {BENCHMARK_SYMBOL})
        index_df = load_index_prices(session, sector_symbols, start_date)
        sector_returns = compute_sector_returns(index_df)

        master_df['sector_symbol'] = master_df['stock_id'].map(sector_symbol_map)
        master_df = master_df.merge(sector_returns, on=['date', 'sector_symbol'], how='left')

        # Benchmark forward returns (Nifty 500), joined by date only
        bench_df = index_df[index_df['symbol'] == BENCHMARK_SYMBOL].sort_values('date').reset_index(drop=True)
        for h in FORWARD_HORIZONS:
            bench_df[f'bench_{FORWARD_HORIZON_COLS[h]}'] = (
                bench_df['close'].shift(-h) / bench_df['close'] - 1
            )
        bench_cols = ['date'] + [f'bench_{FORWARD_HORIZON_COLS[h]}' for h in FORWARD_HORIZONS]
        benchmark_df = bench_df[bench_cols]

        print("Applying signal conditions...")
        master_df = master_df.sort_values(['stock_id', 'date']).reset_index(drop=True)
        strong_sector = master_df['sector_ret'] > 0
        high_rs = master_df['rs_rank'] >= RS_THRESHOLD
        high_adr = master_df['adr_pct'] >= ADR_THRESHOLD_PCT

        mask_stage2_only = master_df['is_stage2']
        mask_stage2_rs = master_df['is_stage2'] & high_rs
        mask_full_combo = master_df['is_stage2'] & high_rs & strong_sector & high_adr

        # Collapse each contiguous qualifying streak to a single trade entry
        # (the first day it qualifies) - this is what "a trade taken" means,
        # matching how every other backtest script here treats entries
        # (never re-entering a name you're already positioned in).
        trades_stage2_only = master_df[mark_trade_starts(master_df, mask_stage2_only)]
        trades_stage2_rs = master_df[mark_trade_starts(master_df, mask_stage2_rs)]
        trades_full_combo = master_df[mark_trade_starts(master_df, mask_full_combo)]

        results = {
            'stage2_only': aggregate_horizon_stats(trades_stage2_only, benchmark_df),
            'stage2_plus_rs': aggregate_horizon_stats(trades_stage2_rs, benchmark_df),
            'full_combo': aggregate_horizon_stats(trades_full_combo, benchmark_df),
        }

        # Current-year (2026) slice of the same three filters, same convention
        # as the existing backtest_*.py scripts' backtest/current split.
        current_year = datetime.now().year
        results_current_year = {
            'stage2_only': aggregate_horizon_stats(trades_stage2_only[trades_stage2_only['date'].dt.year == current_year], benchmark_df),
            'stage2_plus_rs': aggregate_horizon_stats(trades_stage2_rs[trades_stage2_rs['date'].dt.year == current_year], benchmark_df),
            'full_combo': aggregate_horizon_stats(trades_full_combo[trades_full_combo['date'].dt.year == current_year], benchmark_df),
        }

        print(f"Trade counts (all-time) - Stage2 only: {results['stage2_only']['trade_count']}, "
              f"+RS: {results['stage2_plus_rs']['trade_count']}, "
              f"Full combo: {results['full_combo']['trade_count']}")
        print(f"Trade counts ({current_year}) - Stage2 only: {results_current_year['stage2_only']['trade_count']}, "
              f"+RS: {results_current_year['stage2_plus_rs']['trade_count']}, "
              f"Full combo: {results_current_year['full_combo']['trade_count']}")

        trades_df = trades_full_combo.copy()
        trades_df['nse_symbol'] = trades_df['stock_id'].map(stock_symbol_map)
        trades_df['month'] = trades_df['date'].dt.strftime('%Y-%m')
        trades_df = trades_df.sort_values('date', ascending=False)

        trades_by_month = {}
        for _, row in trades_df.iterrows():
            trade = {
                'symbol': row['nse_symbol'],
                'date': row['date'].strftime('%Y-%m-%d'),
                'entry_price': float(round(row['close'], 2)),
                'rs_rank': float(round(row['rs_rank'], 2)),
                'adr_pct': float(round(row['adr_pct'], 2)),
                'sector_return_pct': float(round(row['sector_ret'] * 100, 2)),
            }
            for h in FORWARD_HORIZONS:
                val = row[FORWARD_HORIZON_COLS[h]]
                trade[f'fwd_return_{h}d_pct'] = float(round(val * 100, 2)) if pd.notna(val) else None
            trades_by_month.setdefault(row['month'], []).append(trade)

        output = {
            'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'config': {
                'min_market_cap_cr': MIN_MARKET_CAP_CR,
                'rs_threshold': RS_THRESHOLD,
                'adr_threshold_pct': ADR_THRESHOLD_PCT,
                'sector_lookback_days': SECTOR_LOOKBACK_DAYS,
                'forward_horizons': FORWARD_HORIZONS,
                'benchmark': BENCHMARK_SYMBOL,
            },
            'universe_size': int(len(universe_df)),
            'current_year': current_year,
            'results': results,
            'results_current_year': results_current_year,
            'trades_by_month': trades_by_month,
        }

        os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
        with open(OUTPUT_JSON, 'w') as f:
            json.dump(output, f, indent=2)
        print(f"Wrote results to {OUTPUT_JSON}")

    finally:
        session.close()


if __name__ == "__main__":
    run_backtest()
