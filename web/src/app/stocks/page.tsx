import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import Link from 'next/link'
import { PAGE_SIZE, SORTABLE_COLUMNS, PERFORMANCE_PERIODS, type SortableColumn } from '@/lib/constants'
import PercentageChange from '@/components/PercentageChange'
import Pagination from '@/components/Pagination'
import Search from '@/components/Search'
import StocksFilters from '@/components/StocksFilters'
import type { Stock } from '@/types/stock'
import { daysAgo, fmtDaysAgo, pctFromHigh, fetchPriceStats, type PriceStats } from '@/lib/priceStats'

export const dynamic = 'force-dynamic'

interface DashboardProps {
  searchParams: Promise<{ page?: string; sort?: string; order?: string; query?: string; cap?: string; board?: string }>
}

type Board = 'mainboard' | 'sme'

interface UnifiedStockRow {
  id: number
  board: Board
  symbol: string
  name: string | null
  price: number | null
  marketCapCr: number | null
  change_1w: number | null
  change_1m: number | null
  change_3m: number | null
  change_6m: number | null
  change_1y: number | null
  change_3y: number | null
  change_5y: number | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

interface SMEPriceStats {
  sme_stock_id: number
  high_52w: number | null
  high_date: Date | null
  latest_price: number | null
}

async function fetchSMEPriceStats(smeStockIds: number[]): Promise<Map<number, SMEPriceStats>> {
  if (smeStockIds.length === 0) return new Map()

  const rows = await prisma.$queryRaw<SMEPriceStats[]>`
    WITH w52 AS (
      SELECT sme_stock_id, MAX(high_price) AS high_52w
      FROM   sme_daily_prices
      WHERE  date >= CURRENT_DATE - INTERVAL '365 days'
        AND  sme_stock_id = ANY(${smeStockIds}::int[])
      GROUP  BY sme_stock_id
    ),
    high_date AS (
      SELECT DISTINCT ON (dp.sme_stock_id)
             dp.sme_stock_id, dp.date AS high_date
      FROM   sme_daily_prices dp
      JOIN   w52 ON dp.sme_stock_id = w52.sme_stock_id
               AND dp.high_price = w52.high_52w
      WHERE  dp.date >= CURRENT_DATE - INTERVAL '365 days'
      ORDER  BY dp.sme_stock_id, dp.date DESC
    ),
    latest AS (
      SELECT DISTINCT ON (sme_stock_id)
             sme_stock_id, close_price AS latest_price
      FROM   sme_daily_prices
      WHERE  sme_stock_id = ANY(${smeStockIds}::int[])
      ORDER  BY sme_stock_id, date DESC
    )
    SELECT w.sme_stock_id, w.high_52w, hd.high_date, l.latest_price
    FROM   w52 w
    LEFT   JOIN high_date hd ON hd.sme_stock_id = w.sme_stock_id
    LEFT   JOIN latest     l ON l.sme_stock_id  = w.sme_stock_id
  `

  const map = new Map<number, SMEPriceStats>()
  for (const row of rows) {
    map.set(Number(row.sme_stock_id), {
      ...row,
      sme_stock_id: Number(row.sme_stock_id),
      high_52w: row.high_52w ? Number(row.high_52w) : null,
      latest_price: row.latest_price ? Number(row.latest_price) : null,
    })
  }
  return map
}

const SORT_GETTERS: Record<string, (r: UnifiedStockRow) => number | null> = {
  change_1w: (r) => r.change_1w,
  change_1m: (r) => r.change_1m,
  change_3m: (r) => r.change_3m,
  change_6m: (r) => r.change_6m,
  change_1y: (r) => r.change_1y,
  change_3y: (r) => r.change_3y,
  change_5y: (r) => r.change_5y,
}

function stockToRow(s: Stock): UnifiedStockRow {
  const perf = s.stock_performance
  return {
    id: s.id,
    board: 'mainboard',
    symbol: s.nse_symbol ?? '',
    name: s.name,
    price: s.daily_prices[0]?.close_price ?? null,
    marketCapCr: s.market_cap != null ? Number(s.market_cap) / 10_000_000 : null,
    change_1w: perf?.change_1w ?? null,
    change_1m: perf?.change_1m ?? null,
    change_3m: perf?.change_3m ?? null,
    change_6m: perf?.change_6m ?? null,
    change_1y: perf?.change_1y ?? null,
    change_3y: perf?.change_3y ?? null,
    change_5y: perf?.change_5y ?? null,
  }
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function Dashboard(props: DashboardProps) {
  const searchParams = await props.searchParams
  const page  = Number(searchParams.page)  || 1
  const sort  = (searchParams.sort || 'change_1w') as SortableColumn
  const order = searchParams.order || 'desc'
  const query = searchParams.query || ''
  const skip  = (page - 1) * PAGE_SIZE

  const minMarketCapCr = Number(process.env.MIN_MARKET_CAP_CR || 2000)
  const minMarketCap = minMarketCapCr * 10_000_000
  const capOn = (searchParams.cap ?? 'on') !== 'off'
  const boardAll = (searchParams.board ?? 'mainboard') === 'all'

  let rows: UnifiedStockRow[] = []
  let totalCount = 0
  let error: string | null = null
  let priceStats = new Map<number, PriceStats>()
  let smePriceStats = new Map<number, SMEPriceStats>()

  const stocksWhere: Prisma.stocksWhereInput = {
    is_active: true,
    ...(capOn ? { market_cap: { gte: minMarketCap } } : {}),
    ...(query ? {
      OR: [
        { nse_symbol: { contains: query, mode: 'insensitive' } },
        { name:       { contains: query, mode: 'insensitive' } },
      ],
    } : {}),
  }

  try {
    if (!boardAll) {
      // ── Mainboard-only: unchanged DB-level sort/paginate, cap filter now conditional ──
      const orderBy: Prisma.stocksOrderByWithRelationInput[] = SORTABLE_COLUMNS.includes(sort)
        ? [{ stock_performance: { [sort]: { sort: order, nulls: 'last' } } }, { nse_symbol: 'asc' }]
        : [{ nse_symbol: 'asc' }]

      const [count, stocks] = await Promise.all([
        prisma.stocks.count({ where: stocksWhere }),
        prisma.stocks.findMany({
          where: stocksWhere,
          take: PAGE_SIZE,
          skip,
          include: {
            daily_prices: { orderBy: { date: 'desc' }, take: 1, select: { close_price: true, date: true } },
            stock_performance: true,
          },
          orderBy,
        }) as Promise<Stock[]>,
      ])
      totalCount = count
      rows = stocks.map(stockToRow)
      priceStats = await fetchPriceStats(rows.map((r) => r.id))
    } else {
      // ── All boards: merge mainboard + SME, sort/paginate in JS ──
      // SME has no market_cap data - if the cap filter is on, no SME row could ever
      // pass it, so skip fetching SME entirely rather than fetching and discarding.
      const smeWhere: Prisma.sme_stocksWhereInput = {
        is_active: true,
        ...(query ? {
          OR: [
            { symbol: { contains: query, mode: 'insensitive' } },
            { name:   { contains: query, mode: 'insensitive' } },
          ],
        } : {}),
      }

      // Deliberately NOT including daily_prices/sme_daily_prices here: this
      // fetch is unpaginated (up to ~2,400 mainboard rows), and Prisma can't
      // push a per-parent take:1 on a one-to-many relation down into a single
      // cheap SQL query at this scale - it was observed to take 100+ seconds.
      // Only stock_performance/sme_performance (proper 1:1 relations, cheap
      // regardless of row count) are needed here for sorting; latest price is
      // patched in below via fetchPriceStats/fetchSMEPriceStats, same as the
      // 52W-high stats, only for the page actually being displayed.
      const [mainboardStocks, smeStocks] = await Promise.all([
        prisma.stocks.findMany({
          where: stocksWhere,
          include: { stock_performance: true },
        }),
        capOn
          ? Promise.resolve([])
          : prisma.sme_stocks.findMany({
              where: smeWhere,
              include: { sme_performance: true },
            }),
      ])

      const mainboardRows: UnifiedStockRow[] = mainboardStocks.map((s) => {
        const perf = s.stock_performance
        return {
          id: s.id,
          board: 'mainboard' as const,
          symbol: s.nse_symbol ?? '',
          name: s.name,
          price: null,
          marketCapCr: s.market_cap != null ? Number(s.market_cap) / 10_000_000 : null,
          change_1w: perf?.change_1w ?? null,
          change_1m: perf?.change_1m ?? null,
          change_3m: perf?.change_3m ?? null,
          change_6m: perf?.change_6m ?? null,
          change_1y: perf?.change_1y ?? null,
          change_3y: perf?.change_3y ?? null,
          change_5y: perf?.change_5y ?? null,
        }
      })
      const smeRows: UnifiedStockRow[] = smeStocks.map((s) => {
        const perf = s.sme_performance
        return {
          id: s.id,
          board: 'sme' as const,
          symbol: s.symbol,
          name: s.name,
          price: null,
          marketCapCr: null,
          change_1w: perf?.change_1w ?? null,
          change_1m: perf?.change_1m ?? null,
          change_3m: perf?.change_3m ?? null,
          change_6m: perf?.change_6m ?? null,
          change_1y: perf?.change_1y ?? null,
          change_3y: perf?.change_3y ?? null,
          change_5y: perf?.change_5y ?? null,
        }
      })

      const merged = [...mainboardRows, ...smeRows]
      const getter = SORT_GETTERS[sort] ?? SORT_GETTERS.change_1w
      merged.sort((a, b) => {
        const av = getter(a)
        const bv = getter(b)
        if (av == null && bv == null) return 0
        if (av == null) return 1
        if (bv == null) return -1
        return order === 'asc' ? av - bv : bv - av
      })

      totalCount = merged.length
      rows = merged.slice(skip, skip + PAGE_SIZE)

      const pageMainboardIds = rows.filter((r) => r.board === 'mainboard').map((r) => r.id)
      const pageSmeIds = rows.filter((r) => r.board === 'sme').map((r) => r.id)
      ;[priceStats, smePriceStats] = await Promise.all([
        fetchPriceStats(pageMainboardIds),
        fetchSMEPriceStats(pageSmeIds),
      ])

      // Patch in the latest price for just this page's rows (deferred above for performance)
      rows = rows.map((row) => ({
        ...row,
        price: row.board === 'mainboard'
          ? priceStats.get(row.id)?.latest_price ?? null
          : smePriceStats.get(row.id)?.latest_price ?? null,
      }))
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to fetch stocks'
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
  const filterQp = `&cap=${capOn ? 'on' : 'off'}&board=${boardAll ? 'all' : 'mainboard'}`

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
        <Link href={`/stocks?page=${page}&sort=${column}&order=${newOrder}${qp}${filterQp}`} className="inline-flex items-center hover:text-blue-600 whitespace-nowrap">
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
            <h1 className="text-2xl font-bold text-slate-900">Stock Dashboard</h1>
            <p className="text-slate-500 text-sm mt-1">
              {totalCount === 0 ? '0' : `${skip + 1}–${Math.min(skip + PAGE_SIZE, totalCount)}`} of {totalCount} {boardAll ? 'stocks (Mainboard + SME)' : 'NSE stocks'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="w-72">
              <Search placeholder="Search stocks…" />
            </div>
            <StocksFilters capOn={capOn} boardAll={boardAll} minMarketCapCr={minMarketCapCr} />
            <Pagination currentPage={page} totalPages={totalPages} sort={sort} order={order} basePath="/stocks" query={query} extraParams={filterQp} />
          </div>
        </header>

        <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Name</th>
                  {boardAll && <th className="px-4 py-3">Board</th>}
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">52W High</th>
                  <th className="px-4 py-3 text-right">Mkt Cap</th>
                  {PERFORMANCE_PERIODS.map((period) => (
                    <SortHeader key={period.key} column={period.key} label={period.label} align="right" />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const ps = row.board === 'mainboard' ? priceStats.get(row.id) : smePriceStats.get(row.id)
                  const high52w = ps?.high_52w ?? null
                  const highDate = ps?.high_date ?? null

                  const pctFromW52H = pctFromHigh(row.price, high52w)
                  const w52HighDays = fmtDaysAgo(daysAgo(highDate))
                  const detailHref = row.board === 'sme' ? `/sme-stocks/${row.symbol}` : `/stock/${row.symbol}`

                  return (
                    <tr key={`${row.board}-${row.id}`} className="hover:bg-slate-50 transition-colors">
                      {/* Symbol */}
                      <td className="px-4 py-3 font-semibold">
                        <Link href={detailHref} className="text-blue-600 hover:underline">
                          {row.symbol}
                        </Link>
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3 text-slate-500 truncate max-w-[180px]" title={row.name || ''}>
                        {row.name || '—'}
                      </td>

                      {/* Board */}
                      {boardAll && (
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${row.board === 'sme' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                            {row.board === 'sme' ? 'SME' : 'Mainboard'}
                          </span>
                        </td>
                      )}

                      {/* Price + % from 52W high */}
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-slate-800">
                          {row.price != null ? `₹${row.price.toFixed(2)}` : '—'}
                        </span>
                        {pctFromW52H != null && (
                          <span className={`block text-xs font-medium ${pctFromW52H >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {pctFromW52H >= 0 ? '+' : ''}{pctFromW52H.toFixed(1)}% from 52W H
                          </span>
                        )}
                      </td>

                      {/* 52W High */}
                      <td className="px-4 py-3 text-right">
                        {high52w != null ? (
                          <>
                            <span className="font-medium text-slate-700">₹{high52w.toFixed(2)}</span>
                            {w52HighDays && (
                              <span className="block text-xs text-slate-400">{w52HighDays}</span>
                            )}
                          </>
                        ) : <span className="text-slate-300">—</span>}
                      </td>

                      {/* Market Cap */}
                      <td className="px-4 py-3 text-right text-slate-500">
                        {row.marketCapCr != null
                          ? `₹${Math.round(row.marketCapCr).toLocaleString('en-IN')} Cr`
                          : '—'}
                      </td>

                      {/* Performance periods */}
                      {PERFORMANCE_PERIODS.map((period) => {
                        const value = row[period.key as keyof UnifiedStockRow] as number | null
                        return (
                          <td key={period.key} className="px-4 py-3 text-right">
                            <PercentageChange value={value} />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5 + (boardAll ? 1 : 0) + PERFORMANCE_PERIODS.length} className="px-4 py-12 text-center text-slate-400">
                      No stocks match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex justify-between items-center">
          <p className="text-sm text-slate-400">Page {page} of {totalPages}</p>
          <Pagination currentPage={page} totalPages={totalPages} sort={sort} order={order} basePath="/stocks" query={query} />
        </div>
      </div>
    </div>
  )
}
