// Type definitions for Index-related data structures

export interface IndexPerformance {
    change_1w: number | null
    change_1m: number | null
    change_3m: number | null
    change_6m: number | null
    change_1y: number | null
    change_3y: number | null
    change_5y: number | null
    daily_volume: bigint | null
    updated_at: Date
}

export interface IndexDailyPrice {
    close_price: number | null
    date: Date
}

export interface MarketIndex {
    id: number
    symbol: string | null
    name: string | null
    index_daily_prices: IndexDailyPrice[]
    index_performance: IndexPerformance | null
}
