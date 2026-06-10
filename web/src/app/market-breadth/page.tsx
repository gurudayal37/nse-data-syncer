import prisma from '@/lib/prisma'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface BreadthRow {
  total: bigint
  advances: bigint
  declines: bigint
  unchanged: bigint
  near_52w_high: bigint
  near_52w_low: bigint
  as_of_date: Date | null
}

async function fetchBreadth(minMarketCap: number): Promise<BreadthRow | null> {
  const rows = await prisma.$queryRaw<BreadthRow[]>`
    WITH eligible AS (
      SELECT id FROM stocks
      WHERE is_active = true AND market_cap >= ${minMarketCap}
    ),
    ranked AS (
      SELECT dp.stock_id, dp.date, dp.close_price,
             ROW_NUMBER() OVER (PARTITION BY dp.stock_id ORDER BY dp.date DESC) AS rn
      FROM daily_prices dp
      JOIN eligible e ON e.id = dp.stock_id
    ),
    pivoted AS (
      SELECT stock_id,
             MAX(CASE WHEN rn = 1 THEN close_price END) AS latest_close,
             MAX(CASE WHEN rn = 1 THEN date END)        AS latest_date,
             MAX(CASE WHEN rn = 2 THEN close_price END) AS prev_close
      FROM ranked
      WHERE rn <= 2
      GROUP BY stock_id
    ),
    w52 AS (
      SELECT dp.stock_id,
             MAX(dp.high_price) AS high_52w,
             MIN(dp.low_price)  AS low_52w
      FROM daily_prices dp
      JOIN eligible e ON e.id = dp.stock_id
      WHERE dp.date >= CURRENT_DATE - INTERVAL '365 days'
      GROUP BY dp.stock_id
    )
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE p.latest_close > p.prev_close) AS advances,
      COUNT(*) FILTER (WHERE p.latest_close < p.prev_close) AS declines,
      COUNT(*) FILTER (WHERE p.latest_close = p.prev_close) AS unchanged,
      COUNT(*) FILTER (WHERE w.high_52w > 0 AND p.latest_close >= w.high_52w * 0.9) AS near_52w_high,
      COUNT(*) FILTER (WHERE w.low_52w > 0 AND p.latest_close <= w.low_52w * 1.1) AS near_52w_low,
      MAX(p.latest_date) AS as_of_date
    FROM pivoted p
    LEFT JOIN w52 w ON w.stock_id = p.stock_id
    WHERE p.prev_close IS NOT NULL
  `

  return rows[0] ?? null
}

export default async function MarketBreadthPage() {
  const minMarketCap = Number(process.env.MIN_MARKET_CAP_CR || 2000) * 10_000_000

  let breadth: BreadthRow | null = null
  let error: string | null = null

  try {
    breadth = await fetchBreadth(minMarketCap)
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to fetch market breadth'
    if (process.env.NODE_ENV === 'development') console.error(e)
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h1 className="text-2xl font-bold text-red-900 mb-2">Database Connection Error</h1>
            <p className="text-red-700 mb-4">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  const total         = Number(breadth?.total ?? 0)
  const advances      = Number(breadth?.advances ?? 0)
  const declines      = Number(breadth?.declines ?? 0)
  const unchanged     = Number(breadth?.unchanged ?? 0)
  const near52wHigh   = Number(breadth?.near_52w_high ?? 0)
  const near52wLow    = Number(breadth?.near_52w_low ?? 0)
  const asOfDate      = breadth?.as_of_date ?? null

  const advancePct = total ? (advances / total) * 100 : 0
  const declinePct = total ? (declines / total) * 100 : 0

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="px-6 py-6">
        <header className="mb-5">
          <h1 className="text-2xl font-bold text-slate-900">Market Breadth</h1>
          <p className="text-slate-500 text-sm mt-1">
            {total} stocks
            {asOfDate && (
              <> &middot; as of {new Date(asOfDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</>
            )}
          </p>
        </header>

        {/* Advance / Decline */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">Advances</div>
            <div className="text-3xl font-bold text-emerald-600">{advances}</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">Declines</div>
            <div className="text-3xl font-bold text-red-600">{declines}</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">Unchanged</div>
            <div className="text-3xl font-bold text-slate-600">{unchanged}</div>
          </div>
        </div>

        {/* A/D bar */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
          <div className="flex justify-between text-sm text-slate-500 mb-2">
            <span>Advance / Decline Ratio</span>
            <span>{advancePct.toFixed(1)}% / {declinePct.toFixed(1)}%</span>
          </div>
          <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-100">
            <div className="bg-emerald-500" style={{ width: `${advancePct}%` }} />
            <div className="bg-red-500" style={{ width: `${declinePct}%` }} />
          </div>
        </div>

        {/* 52 Week High / Low Zones */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">Within 10% of 52W High</div>
            <div className="text-3xl font-bold text-emerald-600">{near52wHigh}</div>
            <p className="text-xs text-slate-400 mt-2">
              Stocks trading at or above 90% of their 52-week high.{' '}
              <Link href="/stocks?sort=change_1w&order=desc" className="text-blue-600 hover:underline">
                View stocks
              </Link>
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">Within 10% of 52W Low</div>
            <div className="text-3xl font-bold text-red-600">{near52wLow}</div>
            <p className="text-xs text-slate-400 mt-2">
              Stocks trading at or below 110% of their 52-week low.{' '}
              <Link href="/stocks?sort=change_1w&order=asc" className="text-blue-600 hover:underline">
                View stocks
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
