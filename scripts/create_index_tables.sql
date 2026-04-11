-- Create indices table
CREATE TABLE IF NOT EXISTS indices (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255),
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE INDEX IF NOT EXISTS ix_indices_id ON indices(id);
CREATE INDEX IF NOT EXISTS ix_indices_symbol ON indices(symbol);

-- Create index_daily_prices table
CREATE TABLE IF NOT EXISTS index_daily_prices (
    id SERIAL PRIMARY KEY,
    index_id INTEGER NOT NULL,
    date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    open_price DOUBLE PRECISION,
    high_price DOUBLE PRECISION,
    low_price DOUBLE PRECISION,
    close_price DOUBLE PRECISION,
    volume BIGINT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ix_index_daily_prices_index_date UNIQUE (index_id, date)
);

CREATE INDEX IF NOT EXISTS ix_index_daily_prices_id ON index_daily_prices(id);
CREATE INDEX IF NOT EXISTS ix_index_daily_prices_date ON index_daily_prices(date);
CREATE INDEX IF NOT EXISTS ix_index_daily_prices_index_date_idx ON index_daily_prices(index_id, date DESC);

-- Create index_performance table
CREATE TABLE IF NOT EXISTS index_performance (
    id SERIAL PRIMARY KEY,
    index_id INTEGER UNIQUE NOT NULL,
    change_1w DOUBLE PRECISION,
    change_1m DOUBLE PRECISION,
    change_3m DOUBLE PRECISION,
    change_6m DOUBLE PRECISION,
    change_1y DOUBLE PRECISION,
    change_3y DOUBLE PRECISION,
    change_5y DOUBLE PRECISION,
    daily_volume BIGINT,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_index_perf_change_1w ON index_performance(change_1w);
CREATE INDEX IF NOT EXISTS idx_index_perf_change_1m ON index_performance(change_1m);
CREATE INDEX IF NOT EXISTS idx_index_perf_change_3m ON index_performance(change_3m);
CREATE INDEX IF NOT EXISTS idx_index_perf_change_6m ON index_performance(change_6m);
CREATE INDEX IF NOT EXISTS idx_index_perf_change_1y ON index_performance(change_1y);
CREATE INDEX IF NOT EXISTS idx_index_perf_change_3y ON index_performance(change_3y);
CREATE INDEX IF NOT EXISTS idx_index_perf_change_5y ON index_performance(change_5y);
CREATE INDEX IF NOT EXISTS idx_index_perf_daily_volume ON index_performance(daily_volume);
