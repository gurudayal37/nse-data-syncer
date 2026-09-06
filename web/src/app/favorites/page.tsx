import prisma from '@/lib/prisma'
import Link from 'next/link'
import { PERFORMANCE_PERIODS, type SortableColumn } from '@/lib/constants'
import PercentageChange from '@/components/PercentageChange'
import Search from '@/components/Search'
import AddFavorite from '@/components/AddFavorite'
import RemoveFavoriteButton from '@/components/RemoveFavoriteButton'
import { daysAgo, fmtDaysAgo, pctFromHigh, fetchPriceStats } from '@/lib/priceStats'
import type { Stock } from '@/types/stock'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ sort?: string; order?: string; query?: string }>
}

interface FavoriteRow {
  id: number
  symbol: string
  name: string | null
  price: number | null
  change_1w: number | null
  change_1m: number | null
  change_3m: number | null
  change_6m: number | null
  change_1y: number | null
  change_3y: number | null
  change_5y: number | null
}

const SORT_GETTERS: Record<string, (r: FavoriteRow) => number | null> = {
  change_1w: (r) => r.change_1w,
  change_1m: (r) => r.change_1m,
  change_3m: (r) => r.change_3m,
  change_6m: (r) => r.change_6m,
  change_1y: (r) => r.change_1y,
  change_3y: (r) => r.change_3y,
  change_5y: (r) => r.change_5y,
}

function stockToRow(s: Stock): FavoriteRow {
  const perf = s.stock_performance
  return {
    id: s.id,
    symbol: s.nse_symbol ?? '',
    name: s.name,
    price: s.daily_prices[0]?.close_price ?? null,
    change_1w: perf?.change_1w ?? null,
    change_1m: perf?.change_1m ?? null,
    change_3m: perf?.change_3m ?? null,
    change_6m: perf?.change_6m ?? null,
    change_1y: perf?.change_1y ?? null,
    change_3y: perf?.change_3y ?? null,
    change_5y: perf?.change_5y ?? null,
  }
}

export default async function FavoritesPage(props: PageProps) {
  const searchParams = await props.searchParams
  const sort = (searchParams.sort || 'change_1w') as SortableColumn
  const order = searchParams.order || 'desc'
  const query = (searchParams.query || '').trim().toLowerCase()

  let rows: FavoriteRow[] = []
  let error: string | null = null

  try {
    const favorites = await prisma.favorite_stocks.findMany({
      include: {
        stocks: {
          include: {
            daily_prices: { orderBy: { date: 'desc' }, take: 1, select: { close_price: true, date: true } },
            stock_performance: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    })

    rows = favorites.map((f) => stockToRow(f.stocks as unknown as Stock))

    if (query) {
      rows = rows.filter(
        (r) => r.symbol.toLowerCase().includes(query) || r.name?.toLowerCase().includes(query)
      )
    }

    const getter = SORT_GETTERS[sort] ?? SORT_GETTERS.change_1w
    rows.sort((a, b) => {
      const av = getter(a)
      const bv = getter(b)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return order === 'asc' ? av - bv : bv - av
    })
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to fetch favorites'
    if (process.env.NODE_ENV === 'development') console.error(e)
  }

  const priceStats = error ? new Map() : await fetchPriceStats(rows.map((r) => r.id))

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

  const SortIcon = ({ column }: { column: string }) => {
    if (sort !== column) return <span className="ml-1 text-gray-400">↕</span>
    return order === 'asc' ? <span className="ml-1 text-blue-600">↑</span> : <span className="ml-1 text-blue-600">↓</span>
  }

  const SortHeader = ({ column, label, align = 'left' }: { column: string; label: string; align?: string }) => {
    const newOrder = sort === column && order === 'desc' ? 'asc' : 'desc'
    const qp = query ? `&query=${encodeURIComponent(query)}` : ''
    return (
      <th className={`px-4 py-3 ${align === 'right' ? 'text-right' : ''}`}>
        <Link href={`/favorites?sort=${column}&order=${newOrder}${qp}`} className="inline-flex items-center hover:text-blue-600 whitespace-nowrap">
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
            <h1 className="text-2xl font-bold text-slate-900">Favorites</h1>
            <p className="text-slate-500 text-sm mt-1">{rows.length} favorite {rows.length === 1 ? 'stock' : 'stocks'}</p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="w-72">
              <Search placeholder="Search favorites…" />
            </div>
            <AddFavorite />
          </div>
        </header>

        <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">52W High</th>
                  {PERFORMANCE_PERIODS.map((period) => (
                    <SortHeader key={period.key} column={period.key} label={period.label} align="right" />
                  ))}
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const ps = priceStats.get(row.id)
                  const high52w = ps?.high_52w ?? null
                  const highDate = ps?.high_date ?? null
                  const price = ps?.latest_price ?? row.price

                  const pctFromW52H = pctFromHigh(price, high52w)
                  const w52HighDays = fmtDaysAgo(daysAgo(highDate))

                  return (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-semibold">
                        <Link href={`/stock/${row.symbol}`} className="text-blue-600 hover:underline">
                          {row.symbol}
                        </Link>
                      </td>

                      <td className="px-4 py-3 text-slate-500 truncate max-w-[220px]" title={row.name || ''}>
                        {row.name || '—'}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-slate-800">
                          {price != null ? `₹${price.toFixed(2)}` : '—'}
                        </span>
                        {pctFromW52H != null && (
                          <span className={`block text-xs font-medium ${pctFromW52H >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {pctFromW52H >= 0 ? '+' : ''}{pctFromW52H.toFixed(1)}% from 52W H
                          </span>
                        )}
                      </td>

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

                      {PERFORMANCE_PERIODS.map((period) => {
                        const value = row[period.key as keyof FavoriteRow] as number | null
                        return (
                          <td key={period.key} className="px-4 py-3 text-right">
                            <PercentageChange value={value} />
                          </td>
                        )
                      })}

                      <td className="px-4 py-3 text-right">
                        <RemoveFavoriteButton symbol={row.symbol} />
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5 + PERFORMANCE_PERIODS.length} className="px-4 py-12 text-center text-slate-400">
                      No favorites yet. Use the box above to add a stock.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
