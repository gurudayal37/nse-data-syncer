import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import Link from 'next/link'
import { PAGE_SIZE, SORTABLE_COLUMNS, PERFORMANCE_PERIODS, type SortableColumn } from '@/lib/constants'
import PercentageChange from '@/components/PercentageChange'
import Pagination from '@/components/Pagination'
import Search from '@/components/Search'

export const dynamic = 'force-dynamic'

interface USDashboardProps {
  searchParams: Promise<{ page?: string; sort?: string; order?: string; query?: string }>
}

// ── Helpers (mirrors web/src/app/stocks/page.tsx) ───────────────────────────

function daysAgo(date: Date | string | null): number | null {
  if (!date) return null
  const d = typeof date === 'string' ? new Date(date) : date
  return Math.floor((Date.now() - d.getTime()) / 86_400_000)
}

function fmtDaysAgo(days: number | null): string {
  if (days == null) return ''
  if (days === 0) return 'today'
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

function pctFromHigh(price: number | null, high: number | null): number | null {
  if (!price || !high || high === 0) return null
  return ((price - high) / high) * 100
}

interface PriceStats {
  us_stock_id: number
  high_52w: number | null
  low_52w: number | null
  high_date: Date | null
  low_date: Date | null
}

async function fetchPriceStats(usStockIds: number[]): Promise<Map<number, PriceStats>> {
  if (usStockIds.length === 0) return new Map()

  const rows = await prisma.$queryRaw<PriceStats[]>`
    WITH w52 AS (
      SELECT us_stock_id,
             MAX(high_price) AS high_52w,
             MIN(low_price)  AS low_52w
      FROM   us_daily_prices
      WHERE  date >= CURRENT_DATE - INTERVAL '365 days'
        AND  us_stock_id = ANY(${usStockIds}::int[])
      GROUP  BY us_stock_id
    ),
    high_date AS (
      SELECT DISTINCT ON (dp.us_stock_id)
             dp.us_stock_id, dp.date AS high_date
      FROM   us_daily_prices dp
      JOIN   w52 ON dp.us_stock_id = w52.us_stock_id
               AND dp.high_price = w52.high_52w
      WHERE  dp.date >= CURRENT_DATE - INTERVAL '365 days'
      ORDER  BY dp.us_stock_id, dp.date DESC
    ),
    low_date AS (
      SELECT DISTINCT ON (dp.us_stock_id)
             dp.us_stock_id, dp.date AS low_date
      FROM   us_daily_prices dp
      JOIN   w52 ON dp.us_stock_id = w52.us_stock_id
               AND dp.low_price = w52.low_52w
      WHERE  dp.date >= CURRENT_DATE - INTERVAL '365 days'
      ORDER  BY dp.us_stock_id, dp.date DESC
    )
    SELECT w.us_stock_id,
           w.high_52w, w.low_52w,
           hd.high_date, ld.low_date
    FROM   w52 w
    LEFT   JOIN high_date hd ON hd.us_stock_id = w.us_stock_id
    LEFT   JOIN low_date  ld ON ld.us_stock_id = w.us_stock_id
  `

  const map = new Map<number, PriceStats>()
  for (const row of rows) {
    map.set(Number(row.us_stock_id), {
      ...row,
      us_stock_id: Number(row.us_stock_id),
      high_52w: row.high_52w ? Number(row.high_52w) : null,
      low_52w: row.low_52w ? Number(row.low_52w) : null,
    })
  }
  return map
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function USDashboard(props: USDashboardProps) {
  const searchParams = await props.searchParams
  const page = Number(searchParams.page) || 1
  const sort = (searchParams.sort || 'change_1w') as SortableColumn
  const order = searchParams.order || 'desc'
  const query = searchParams.query || ''
  const skip = (page - 1) * PAGE_SIZE

  let usStocks: Prisma.us_stocksGetPayload<{ include: { us_daily_prices: true; us_performance: true } }>[] = []
  let totalCount = 0
  let error: string | null = null

  // Only stocks that actually have synced price data - excludes tickers the
  // sync has never successfully fetched (yfinance failures / delistings).
  const where: Prisma.us_stocksWhereInput = {
    is_active: true,
    us_daily_prices: { some: {} },
    ...(query ? {
      OR: [
        { ticker: { contains: query, mode: 'insensitive' } },
        { name:   { contains: query, mode: 'insensitive' } },
      ],
    } : {}),
  }

  const orderBy: Prisma.us_stocksOrderByWithRelationInput[] = SORTABLE_COLUMNS.includes(sort)
    ? [{ us_performance: { [sort]: { sort: order, nulls: 'last' } } }, { ticker: 'asc' }]
    : [{ ticker: 'asc' }]

  try {
    ;[totalCount, usStocks] = await Promise.all([
      prisma.us_stocks.count({ where }),
      prisma.us_stocks.findMany({
        where,
        take: PAGE_SIZE,
        skip,
        include: {
          us_daily_prices: { orderBy: { date: 'desc' }, take: 1 },
          us_performance: true,
        },
        orderBy,
      }),
    ])
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to fetch US stocks'
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

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const usStockIds = usStocks.map((s) => s.id)
  const priceStats = await fetchPriceStats(usStockIds)

  // ── Sort header helpers ──────────────────────────────────────────────────

  const SortIcon = ({ column }: { column: string }) => {
    if (sort !== column) return <span className="ml-1 text-gray-400">↕</span>
    return order === 'asc' ? <span className="ml-1 text-blue-600">↑</span> : <span className="ml-1 text-blue-600">↓</span>
  }

  const SortHeader = ({ column, label, align = 'left' }: { column: string; label: string; align?: string }) => {
    const newOrder = sort === column && order === 'desc' ? 'asc' : 'desc'
    const qp = query ? `&query=${encodeURIComponent(query)}` : ''
    return (
      <th className={`px-4 py-3 ${align === 'right' ? 'text-right' : ''}`}>
        <Link href={`/us-stocks?page=${page}&sort=${column}&order=${newOrder}${qp}`} className="inline-flex items-center hover:text-blue-600 whitespace-nowrap">
          {label}<SortIcon column={column} />
        </Link>
      </th>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="px-6 py-6">
        <header className="mb-5 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">US Stocks</h1>
            <p className="text-slate-500 text-sm mt-1">
              {totalCount === 0 ? '0' : `${skip + 1}–${Math.min(skip + PAGE_SIZE, totalCount)}`} of {totalCount} Russell 1000 stocks
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="w-72">
              <Search placeholder="Search US stocks…" />
            </div>
            <Pagination currentPage={page} totalPages={totalPages} sort={sort} order={order} basePath="/us-stocks" query={query} />
          </div>
        </header>

        <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Sector</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">52W High</th>
                  {PERFORMANCE_PERIODS.map((period) => (
                    <SortHeader key={period.key} column={period.key} label={period.label} align="right" />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usStocks.map((stock) => {
                  const latest = stock.us_daily_prices[0]
                  const perf = stock.us_performance
                  const ps = priceStats.get(stock.id)
                  const price = latest?.close_price ?? null

                  const pctFromW52H = pctFromHigh(price, ps?.high_52w ?? null)
                  const w52HighDays = fmtDaysAgo(daysAgo(ps?.high_date ?? null))

                  return (
                    <tr key={stock.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-semibold">
                        <Link href={`/us-stocks/${stock.ticker}`} className="text-blue-600 hover:underline">
                          {stock.ticker}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-500 truncate max-w-[180px]" title={stock.name || ''}>
                        {stock.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 truncate max-w-[140px]" title={stock.sector || ''}>
                        {stock.sector || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-slate-800">
                          {price != null ? `$${price.toFixed(2)}` : '—'}
                        </span>
                        {pctFromW52H != null && (
                          <span className={`block text-xs font-medium ${pctFromW52H >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {pctFromW52H >= 0 ? '+' : ''}{pctFromW52H.toFixed(1)}% from 52W H
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {ps?.high_52w != null ? (
                          <>
                            <span className="font-medium text-slate-700">${ps.high_52w.toFixed(2)}</span>
                            {w52HighDays && (
                              <span className="block text-xs text-slate-400">{w52HighDays}</span>
                            )}
                          </>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      {PERFORMANCE_PERIODS.map((period) => {
                        const value = perf?.[period.key as keyof typeof perf] as number | null | undefined
                        return (
                          <td key={period.key} className="px-4 py-3 text-right">
                            <PercentageChange value={value} />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
                {usStocks.length === 0 && (
                  <tr>
                    <td colSpan={5 + PERFORMANCE_PERIODS.length} className="px-4 py-12 text-center text-slate-400">
                      No US stocks match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex justify-between items-center">
          <p className="text-sm text-slate-400">Page {page} of {totalPages}</p>
          <Pagination currentPage={page} totalPages={totalPages} sort={sort} order={order} basePath="/us-stocks" query={query} />
        </div>
      </div>
    </div>
  )
}
