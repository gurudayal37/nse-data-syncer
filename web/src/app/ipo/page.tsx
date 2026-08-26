import prisma from '@/lib/prisma'
import Link from 'next/link'
import { PAGE_SIZE, PERFORMANCE_PERIODS } from '@/lib/constants'
import PercentageChange from '@/components/PercentageChange'
import Pagination from '@/components/Pagination'
import Search from '@/components/Search'
import CopyWatchlist from '@/components/CopyWatchlist'

export const dynamic = 'force-dynamic'

interface IPOPageProps {
  searchParams: Promise<{ page?: string; sort?: string; order?: string; query?: string }>
}

type Board = 'mainboard' | 'sme'

interface IPORow {
  id: number
  board: Board
  symbol: string
  name: string | null
  listedOn: Date
  listingPrice: number | null
  currentPrice: number | null
  pctSinceListing: number | null
  change_1w: number | null
  change_1m: number | null
  change_3m: number | null
  change_6m: number | null
  change_1y: number | null
  change_3y: number | null
  change_5y: number | null
}

interface FirstTradeRow {
  id: number | bigint
  first_date: Date
  listing_price: number | null
}

// ── Helpers ──────────────────────────────────────────────────────────────

function daysAgo(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000)
}

function fmtDaysAgo(days: number): string {
  if (days === 0) return 'today'
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

function pctChange(from: number | null, to: number | null): number | null {
  if (!from || !to) return null
  return ((to - from) / from) * 100
}

// ── Data fetching ────────────────────────────────────────────────────────

async function fetchMainboardIPOs(): Promise<IPORow[]> {
  const firstTrades = await prisma.$queryRaw<FirstTradeRow[]>`
    SELECT DISTINCT ON (dp.stock_id)
           dp.stock_id AS id, dp.date AS first_date, dp.close_price AS listing_price
    FROM daily_prices dp
    JOIN (
      SELECT stock_id, MIN(date) AS first_date
      FROM daily_prices
      GROUP BY stock_id
      HAVING MIN(date) >= CURRENT_DATE - INTERVAL '365 days'
    ) f ON dp.stock_id = f.stock_id AND dp.date = f.first_date
    ORDER BY dp.stock_id, dp.date
  `
  if (firstTrades.length === 0) return []

  const firstTradeMap = new Map(firstTrades.map((r) => [Number(r.id), r]))
  const ids = [...firstTradeMap.keys()]

  const stocks = await prisma.stocks.findMany({
    where: { id: { in: ids } },
    include: {
      daily_prices: { orderBy: { date: 'desc' }, take: 1 },
      stock_performance: true,
    },
  })

  return stocks.map((s) => {
    const ft = firstTradeMap.get(s.id)!
    const currentPrice = s.daily_prices[0]?.close_price ?? null
    const listingPrice = ft.listing_price != null ? Number(ft.listing_price) : null
    const perf = s.stock_performance
    return {
      id: s.id,
      board: 'mainboard' as const,
      symbol: s.nse_symbol ?? '',
      name: s.name,
      listedOn: new Date(ft.first_date),
      listingPrice,
      currentPrice,
      pctSinceListing: pctChange(listingPrice, currentPrice),
      change_1w: perf?.change_1w ?? null,
      change_1m: perf?.change_1m ?? null,
      change_3m: perf?.change_3m ?? null,
      change_6m: perf?.change_6m ?? null,
      change_1y: perf?.change_1y ?? null,
      change_3y: perf?.change_3y ?? null,
      change_5y: perf?.change_5y ?? null,
    }
  })
}

async function fetchSMEIPOs(): Promise<IPORow[]> {
  const firstTrades = await prisma.$queryRaw<FirstTradeRow[]>`
    SELECT DISTINCT ON (dp.sme_stock_id)
           dp.sme_stock_id AS id, dp.date AS first_date, dp.close_price AS listing_price
    FROM sme_daily_prices dp
    JOIN (
      SELECT sme_stock_id, MIN(date) AS first_date
      FROM sme_daily_prices
      GROUP BY sme_stock_id
      HAVING MIN(date) >= CURRENT_DATE - INTERVAL '365 days'
    ) f ON dp.sme_stock_id = f.sme_stock_id AND dp.date = f.first_date
    ORDER BY dp.sme_stock_id, dp.date
  `
  if (firstTrades.length === 0) return []

  const firstTradeMap = new Map(firstTrades.map((r) => [Number(r.id), r]))
  const ids = [...firstTradeMap.keys()]

  const smeStocks = await prisma.sme_stocks.findMany({
    where: { id: { in: ids } },
    include: {
      sme_daily_prices: { orderBy: { date: 'desc' }, take: 1 },
      sme_performance: true,
    },
  })

  return smeStocks.map((s) => {
    const ft = firstTradeMap.get(s.id)!
    const currentPrice = s.sme_daily_prices[0]?.close_price ?? null
    const listingPrice = ft.listing_price != null ? Number(ft.listing_price) : null
    const perf = s.sme_performance
    return {
      id: s.id,
      board: 'sme' as const,
      symbol: s.symbol,
      name: s.name,
      listedOn: new Date(ft.first_date),
      listingPrice,
      currentPrice,
      pctSinceListing: pctChange(listingPrice, currentPrice),
      change_1w: perf?.change_1w ?? null,
      change_1m: perf?.change_1m ?? null,
      change_3m: perf?.change_3m ?? null,
      change_6m: perf?.change_6m ?? null,
      change_1y: perf?.change_1y ?? null,
      change_3y: perf?.change_3y ?? null,
      change_5y: perf?.change_5y ?? null,
    }
  })
}

// ── Sorting ──────────────────────────────────────────────────────────────

const SORT_GETTERS: Record<string, (r: IPORow) => number | null> = {
  listed_on: (r) => r.listedOn.getTime(),
  pct_since_listing: (r) => r.pctSinceListing,
  change_1w: (r) => r.change_1w,
  change_1m: (r) => r.change_1m,
  change_3m: (r) => r.change_3m,
  change_6m: (r) => r.change_6m,
  change_1y: (r) => r.change_1y,
  change_3y: (r) => r.change_3y,
  change_5y: (r) => r.change_5y,
}

// ── Page ─────────────────────────────────────────────────────────────────

export default async function IPOPage(props: IPOPageProps) {
  const searchParams = await props.searchParams
  const page = Number(searchParams.page) || 1
  const sort = searchParams.sort || 'listed_on'
  const order = searchParams.order || 'desc'
  const query = (searchParams.query || '').trim().toLowerCase()
  const skip = (page - 1) * PAGE_SIZE

  let rows: IPORow[] = []
  let error: string | null = null

  try {
    const [mainboard, sme] = await Promise.all([fetchMainboardIPOs(), fetchSMEIPOs()])
    rows = [...mainboard, ...sme]
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to fetch IPOs'
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

  if (query) {
    rows = rows.filter(
      (r) => r.symbol.toLowerCase().includes(query) || (r.name ?? '').toLowerCase().includes(query)
    )
  }

  const getter = SORT_GETTERS[sort] ?? SORT_GETTERS.listed_on
  rows.sort((a, b) => {
    const av = getter(a)
    const bv = getter(b)
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    return order === 'asc' ? av - bv : bv - av
  })

  const totalCount = rows.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const pageRows = rows.slice(skip, skip + PAGE_SIZE)
  const mainboardSymbols = rows.filter((r) => r.board === 'mainboard').map((r) => r.symbol).filter(Boolean)
  const smeSymbols = rows.filter((r) => r.board === 'sme').map((r) => r.symbol).filter(Boolean)

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
        <Link href={`/ipo?page=${page}&sort=${column}&order=${newOrder}${qp}`} className="inline-flex items-center hover:text-blue-600 whitespace-nowrap">
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
            <h1 className="text-2xl font-bold text-slate-900">IPO Tracker</h1>
            <p className="text-slate-500 text-sm mt-1">
              {totalCount === 0 ? '0' : `${skip + 1}–${Math.min(skip + PAGE_SIZE, totalCount)}`} of {totalCount} stocks listed in the last year (Mainboard + SME)
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-3">
              <CopyWatchlist symbols={mainboardSymbols} label="Copy Mainboard IPOs" />
              <CopyWatchlist symbols={smeSymbols} label="Copy SME IPOs" />
              <div className="w-72">
                <Search placeholder="Search IPOs…" />
              </div>
            </div>
            <Pagination currentPage={page} totalPages={totalPages} sort={sort} order={order} basePath="/ipo" query={query} />
          </div>
        </header>

        <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Board</th>
                  <SortHeader column="listed_on" label="Listed On" />
                  <th className="px-4 py-3 text-right whitespace-nowrap">Listing Price</th>
                  <th className="px-4 py-3 text-right">Current Price</th>
                  <SortHeader column="pct_since_listing" label="Since Listing" align="right" />
                  {PERFORMANCE_PERIODS.map((period) => (
                    <SortHeader key={period.key} column={period.key} label={period.label} align="right" />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.map((r) => {
                  const days = daysAgo(r.listedOn)
                  const detailHref = r.board === 'mainboard' ? `/stock/${r.symbol}` : `/sme-stocks/${r.symbol}`
                  return (
                    <tr key={`${r.board}-${r.id}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-semibold">
                        <Link href={detailHref} className="text-blue-600 hover:underline">
                          {r.symbol}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-500 truncate max-w-[180px]" title={r.name || ''}>
                        {r.name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${r.board === 'sme' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                          {r.board === 'sme' ? 'SME' : 'Mainboard'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-700">{r.listedOn.toLocaleDateString()}</span>
                        <span className="block text-xs text-slate-400">{fmtDaysAgo(days)}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {r.listingPrice != null ? `₹${r.listingPrice.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-slate-800">
                          {r.currentPrice != null ? `₹${r.currentPrice.toFixed(2)}` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PercentageChange value={r.pctSinceListing} />
                      </td>
                      {PERFORMANCE_PERIODS.map((period) => (
                        <td key={period.key} className="px-4 py-3 text-right">
                          <PercentageChange value={r[period.key as keyof IPORow] as number | null} />
                        </td>
                      ))}
                    </tr>
                  )
                })}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={7 + PERFORMANCE_PERIODS.length} className="px-4 py-12 text-center text-slate-400">
                      No stocks listed in the last year match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex justify-between items-center">
          <p className="text-sm text-slate-400">Page {page} of {totalPages}</p>
          <Pagination currentPage={page} totalPages={totalPages} sort={sort} order={order} basePath="/ipo" query={query} />
        </div>
      </div>
    </div>
  )
}
