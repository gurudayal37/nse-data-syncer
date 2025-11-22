// Type definitions for stock-related data structures

export interface StockPerformance {
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

export interface DailyPrice {
  close_price: number
  date: Date
}

export interface Stock {
  id: number
  nse_symbol: string | null
  name: string | null
  sector: string | null
  subsector: string | null
  daily_prices: DailyPrice[]
  stock_performance: StockPerformance | null
}

export interface NewsItem {
  id: number
  title: string
  content: string | null
  url: string | null
  published_date: Date
}

