-- Daily ETF opening-fade strategy picks + live intraday tracking status.
-- One row per (trade_date, etf) - "trade_date" is the upcoming session these
-- picks are FOR (computed after the prior session's close). Populated nightly
-- by scripts/compute_etf_live_strategy.py (pushed, runs in CI). The live
-- status columns are updated intraday by scripts/track_etf_live_strategy.py
-- (NOT committed - run manually against Dhan's live quote API).
CREATE TABLE IF NOT EXISTS etf_live_strategy_picks (
    id SERIAL PRIMARY KEY,
    trade_date DATE NOT NULL,
    etf_id INTEGER NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    rank INTEGER NOT NULL,

    -- basis for the pick, as of the prior session's close
    prev_close FLOAT NOT NULL,
    open_eq_high_pct FLOAT NOT NULL,   -- % of trailing days where open == day's high
    avg_fade_pct FLOAT NOT NULL,       -- avg (open-close)/open over trailing window, %
    fade_score FLOAT NOT NULL,         -- open_eq_high_pct/100 * avg_fade_pct, ranking metric
    avg_daily_volume BIGINT,

    -- the actual recommendation
    sell_price FLOAT NOT NULL,
    target_buy_price FLOAT NOT NULL,   -- cover target; assumes full reversion to prev_close
    quantity INTEGER NOT NULL,
    notional FLOAT NOT NULL,

    -- live intraday status (NULL until the manual tracker script runs)
    entry_achieved BOOLEAN DEFAULT false,
    entry_achieved_at TIMESTAMPTZ,
    entry_ltp FLOAT,
    exit_ltp FLOAT,
    exit_captured_at TIMESTAMPTZ,
    last_checked_at TIMESTAMPTZ,
    last_ltp FLOAT,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (etf_id) REFERENCES etfs(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT ux_etf_live_strategy_date_etf UNIQUE (trade_date, etf_id)
);

CREATE INDEX IF NOT EXISTS ix_etf_live_strategy_trade_date ON etf_live_strategy_picks(trade_date);
