-- Create ETF tables
CREATE TABLE IF NOT EXISTS etfs (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255),
    underlying_asset VARCHAR(255),
    nav FLOAT,
    is_active INTEGER DEFAULT 1,
    security_id INTEGER,
    isin VARCHAR(20),
    series VARCHAR(10),
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6)
);

CREATE INDEX IF NOT EXISTS ix_etfs_id ON etfs(id);
CREATE INDEX IF NOT EXISTS ix_etfs_symbol ON etfs(symbol);

CREATE TABLE IF NOT EXISTS etf_daily_prices (
    id SERIAL PRIMARY KEY,
    etf_id INTEGER NOT NULL,
    date TIMESTAMP(6) NOT NULL,
    open_price FLOAT NOT NULL,
    high_price FLOAT NOT NULL,
    low_price FLOAT NOT NULL,
    close_price FLOAT NOT NULL,
    volume BIGINT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (etf_id) REFERENCES etfs(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS ix_etf_daily_prices_id ON etf_daily_prices(id);
CREATE INDEX IF NOT EXISTS ix_etf_daily_prices_date ON etf_daily_prices(date);
CREATE INDEX IF NOT EXISTS ix_etf_daily_prices_etf_date ON etf_daily_prices(etf_id, date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_etf_daily_prices_etf_date ON etf_daily_prices(etf_id, date);

CREATE TABLE IF NOT EXISTS etf_performance (
    id SERIAL PRIMARY KEY,
    etf_id INTEGER UNIQUE NOT NULL,
    change_1w FLOAT,
    change_1m FLOAT,
    change_3m FLOAT,
    change_6m FLOAT,
    change_1y FLOAT,
    change_3y FLOAT,
    change_5y FLOAT,
    daily_volume BIGINT,
    avg_range_20d FLOAT,
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (etf_id) REFERENCES etfs(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_etf_perf_change_1w ON etf_performance(change_1w);
CREATE INDEX IF NOT EXISTS idx_etf_perf_change_1m ON etf_performance(change_1m);
CREATE INDEX IF NOT EXISTS idx_etf_perf_change_3m ON etf_performance(change_3m);
CREATE INDEX IF NOT EXISTS idx_etf_perf_change_6m ON etf_performance(change_6m);
CREATE INDEX IF NOT EXISTS idx_etf_perf_change_1y ON etf_performance(change_1y);
CREATE INDEX IF NOT EXISTS idx_etf_perf_change_3y ON etf_performance(change_3y);
CREATE INDEX IF NOT EXISTS idx_etf_perf_change_5y ON etf_performance(change_5y);
CREATE INDEX IF NOT EXISTS idx_etf_perf_daily_volume ON etf_performance(daily_volume);
CREATE INDEX IF NOT EXISTS idx_etf_perf_avg_range_20d ON etf_performance(avg_range_20d);
