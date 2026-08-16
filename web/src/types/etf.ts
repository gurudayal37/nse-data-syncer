// Type definitions for ETF-related data structures

export interface ETFPerformance {
    change_1w: number | null
    change_1m: number | null
    change_3m: number | null
    change_6m: number | null
    change_1y: number | null
    change_3y: number | null
    change_5y: number | null
    daily_volume: bigint | null
    avg_range_20d: number | null
    updated_at: Date
}

export interface ETFDailyPrice {
    close_price: number
    date: Date
}

export interface ETF {
    id: number
    symbol: string | null
    name: string | null
    underlying_asset: string | null
    etf_daily_prices: ETFDailyPrice[]
    etf_performance: ETFPerformance | null
}
