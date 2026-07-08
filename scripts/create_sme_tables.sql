-- Create SME (NSE Small and Medium Enterprise board) tables
-- Deliberately separate from stocks/daily_prices - SME is a distinct
-- board with different listing/trading rules, do not mix universes.
CREATE TABLE IF NOT EXISTS sme_stocks (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255),
    isin VARCHAR(20),
    security_id INTEGER,              -- Dhan's security_id, for re-sync lookups
    series VARCHAR(5),                -- SM / ST / SZ
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6)
);

CREATE INDEX IF NOT EXISTS ix_sme_stocks_id ON sme_stocks(id);
CREATE INDEX IF NOT EXISTS ix_sme_stocks_symbol ON sme_stocks(symbol);

CREATE TABLE IF NOT EXISTS sme_daily_prices (
    id SERIAL PRIMARY KEY,
    sme_stock_id INTEGER NOT NULL,
    date TIMESTAMP(6) NOT NULL,
    open_price FLOAT,
    high_price FLOAT,
    low_price FLOAT,
    close_price FLOAT,
    volume BIGINT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sme_stock_id) REFERENCES sme_stocks(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT ix_sme_daily_prices_stock_date UNIQUE (sme_stock_id, date)
);

CREATE INDEX IF NOT EXISTS ix_sme_daily_prices_id ON sme_daily_prices(id);
CREATE INDEX IF NOT EXISTS ix_sme_daily_prices_date ON sme_daily_prices(date);
CREATE INDEX IF NOT EXISTS ix_sme_daily_prices_stock_date_idx ON sme_daily_prices(sme_stock_id, date DESC);

CREATE TABLE IF NOT EXISTS sme_performance (
    id SERIAL PRIMARY KEY,
    sme_stock_id INTEGER UNIQUE NOT NULL,
    change_1w FLOAT,
    change_1m FLOAT,
    change_3m FLOAT,
    change_6m FLOAT,
    change_1y FLOAT,
    change_3y FLOAT,
    change_5y FLOAT,
    daily_volume BIGINT,
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sme_stock_id) REFERENCES sme_stocks(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_sme_perf_change_1w ON sme_performance(change_1w);
CREATE INDEX IF NOT EXISTS idx_sme_perf_change_1m ON sme_performance(change_1m);
CREATE INDEX IF NOT EXISTS idx_sme_perf_change_3m ON sme_performance(change_3m);
CREATE INDEX IF NOT EXISTS idx_sme_perf_change_6m ON sme_performance(change_6m);
CREATE INDEX IF NOT EXISTS idx_sme_perf_change_1y ON sme_performance(change_1y);
CREATE INDEX IF NOT EXISTS idx_sme_perf_change_3y ON sme_performance(change_3y);
CREATE INDEX IF NOT EXISTS idx_sme_perf_change_5y ON sme_performance(change_5y);
CREATE INDEX IF NOT EXISTS idx_sme_perf_daily_volume ON sme_performance(daily_volume);
