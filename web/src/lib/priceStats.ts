// Shared 52W/ATH price-stat helpers used by /stocks and /favorites

import prisma from '@/lib/prisma'

export function daysAgo(date: Date | string | null): number | null {
  if (!date) return null
  const d = typeof date === 'string' ? new Date(date) : date
  return Math.floor((Date.now() - d.getTime()) / 86_400_000)
}

export function fmtDaysAgo(days: number | null): string {
  if (days == null) return ''
  if (days === 0) return 'today'
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

export function pctFromHigh(price: number | null, high: number | null): number | null {
  if (!price || !high || high === 0) return null
  return ((price - high) / high) * 100
}

export interface PriceStats {
  stock_id: number
  high_52w: number | null
  low_52w: number | null
  high_date: Date | null
  low_date: Date | null
  ath: number | null
  ath_date: Date | null
  latest_price: number | null
}

// Only ever called with a page-sized (<= PAGE_SIZE) id list - critical for
// performance. Also carries "latest close price" so callers that fetch their
// full matching set without the expensive include:{daily_prices:{take:1}}
// relation can defer per-row price lookups to just the visible rows too.
export async function fetchPriceStats(stockIds: number[]): Promise<Map<number, PriceStats>> {
  if (stockIds.length === 0) return new Map()

  const rows = await prisma.$queryRaw<PriceStats[]>`
    WITH w52 AS (
      SELECT stock_id,
             MAX(high_price) AS high_52w,
             MIN(low_price)  AS low_52w
      FROM   daily_prices
      WHERE  date >= CURRENT_DATE - INTERVAL '365 days'
        AND  stock_id = ANY(${stockIds}::int[])
      GROUP  BY stock_id
    ),
    high_date AS (
      SELECT DISTINCT ON (dp.stock_id)
             dp.stock_id, dp.date AS high_date
      FROM   daily_prices dp
      JOIN   w52 ON dp.stock_id = w52.stock_id
               AND dp.high_price = w52.high_52w
      WHERE  dp.date >= CURRENT_DATE - INTERVAL '365 days'
      ORDER  BY dp.stock_id, dp.date DESC
    ),
    low_date AS (
      SELECT DISTINCT ON (dp.stock_id)
             dp.stock_id, dp.date AS low_date
      FROM   daily_prices dp
      JOIN   w52 ON dp.stock_id = w52.stock_id
               AND dp.low_price = w52.low_52w
      WHERE  dp.date >= CURRENT_DATE - INTERVAL '365 days'
      ORDER  BY dp.stock_id, dp.date DESC
    ),
    ath AS (
      SELECT DISTINCT ON (stock_id)
             stock_id, close_price AS ath, date AS ath_date
      FROM   daily_prices
      WHERE  stock_id = ANY(${stockIds}::int[])
      ORDER  BY stock_id, close_price DESC, date DESC
    ),
    latest AS (
      SELECT DISTINCT ON (stock_id)
             stock_id, close_price AS latest_price
      FROM   daily_prices
      WHERE  stock_id = ANY(${stockIds}::int[])
      ORDER  BY stock_id, date DESC
    )
    SELECT w.stock_id,
           w.high_52w, w.low_52w,
           hd.high_date, ld.low_date,
           a.ath, a.ath_date,
           l.latest_price
    FROM   w52 w
    LEFT   JOIN high_date hd ON hd.stock_id = w.stock_id
    LEFT   JOIN low_date  ld ON ld.stock_id = w.stock_id
    LEFT   JOIN ath        a ON a.stock_id  = w.stock_id
    LEFT   JOIN latest     l ON l.stock_id  = w.stock_id
  `

  const map = new Map<number, PriceStats>()
  for (const row of rows) {
    map.set(Number(row.stock_id), {
      ...row,
      stock_id: Number(row.stock_id),
      high_52w: row.high_52w ? Number(row.high_52w) : null,
      low_52w:  row.low_52w  ? Number(row.low_52w)  : null,
      ath:      row.ath      ? Number(row.ath)       : null,
      latest_price: row.latest_price ? Number(row.latest_price) : null,
    })
  }
  return map
}
