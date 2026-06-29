import prisma from '@/lib/prisma'
import Link from 'next/link'
import { TrendingUp } from 'lucide-react'
import PercentageChange from '@/components/PercentageChange'
import Search from '@/components/Search'
import CopyWatchlist from '@/components/CopyWatchlist'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ query?: string }>
}

interface VolumeShockerRow {
  stock_id: number
  date: Date
  volume: bigint
  close_price: number
  prev_close: number | null
  avg_vol_50: number
}

async function fetchVolumeShockers(minMarketCap: number): Promise<VolumeShockerRow[]> {
  const rows = await prisma.$queryRaw<VolumeShockerRow[]>`
    WITH ranked AS (
      SELECT dp.stock_id, dp.date, dp.volume, dp.close_price,
             ROW_NUMBER() OVER (PARTITION BY dp.stock_id ORDER BY dp.date DESC) AS rn
      FROM   daily_prices dp
      JOIN   stocks s ON s.id = dp.stock_id
      WHERE  s.is_active = true
        AND  s.market_cap >= ${minMarketCap}
        AND  dp.volume IS NOT NULL
        AND  dp.date >= CURRENT_DATE - INTERVAL '90 days'
    ),
    latest AS (
      SELECT stock_id, date, volume, close_price FROM ranked WHERE rn = 1
    ),
    prev AS (
      SELECT stock_id, close_price AS prev_close FROM ranked WHERE rn = 2
    ),
    avg50 AS (
      SELECT stock_id, AVG(volume)::float AS avg_vol_50, COUNT(*) AS cnt
      FROM   ranked
      WHERE  rn BETWEEN 2 AND 51
      GROUP  BY stock_id
    )
    SELECT l.stock_id, l.date, l.volume, l.close_price, p.prev_close, a.avg_vol_50
    FROM   latest l
    JOIN   avg50 a ON a.stock_id = l.stock_id AND a.cnt >= 30
    LEFT   JOIN prev p ON p.stock_id = l.stock_id
    WHERE  a.avg_vol_50 > 0
      AND  l.volume::float >= a.avg_vol_50 * 1.5
    ORDER  BY (l.volume::float / a.avg_vol_50) DESC
  `

  return rows.map((r) => ({
    ...r,
    stock_id: Number(r.stock_id),
    volume: BigInt(r.volume),
    close_price: Number(r.close_price),
    prev_close: r.prev_close != null ? Number(r.prev_close) : null,
    avg_vol_50: Number(r.avg_vol_50),
  }))
}

function getDayChange(row: VolumeShockerRow): number | null {
  return row.prev_close != null && row.prev_close !== 0
    ? ((row.close_price - row.prev_close) / row.prev_close) * 100
    : null
}

export default async function VolumeShockersPage(props: PageProps) {
  const searchParams = await props.searchParams
  const query = searchParams.query || ''
  const minMarketCap = Number(process.env.MIN_MARKET_CAP_CR || 2000) * 10_000_000

  let rows: VolumeShockerRow[] = []
  let error: string | null = null

  try {
    rows = await fetchVolumeShockers(minMarketCap)
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to fetch volume shockers'
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

  const stockIds = rows.map((r) => r.stock_id)
  const stocks = stockIds.length
    ? await prisma.stocks.findMany({
        where: { id: { in: stockIds } },
        select: {
          id: true, nse_symbol: true, name: true, market_cap: true,
          stock_performance: { select: { is_stage2: true } },
        },
      })
    : []
  const stockMap = new Map(stocks.map((s) => [s.id, s]))

  let combined = rows
    .map((r) => ({ row: r, stock: stockMap.get(r.stock_id) }))
    .filter((c) => c.stock)

  if (query) {
    const q = query.toLowerCase()
    combined = combined.filter(
      (c) =>
        c.stock!.nse_symbol?.toLowerCase().includes(q) ||
        c.stock!.name?.toLowerCase().includes(q)
    )
  }

  // Stage 2 stocks first, then by % above average volume (already descending)
  combined = [...combined].sort((a, b) => {
    const aStage2 = a.stock!.stock_performance?.is_stage2 ? 1 : 0
    const bStage2 = b.stock!.stock_performance?.is_stage2 ? 1 : 0
    if (aStage2 !== bStage2) return bStage2 - aStage2
    return (Number(b.row.volume) / b.row.avg_vol_50) - (Number(a.row.volume) / a.row.avg_vol_50)
  })

  const lastUpdated = combined.length
    ? new Date(Math.max(...combined.map((c) => new Date(c.row.date).getTime())))
    : null

  // TradingView watchlist: all Stage 2 volume shockers, plus the top 15 non-Stage 2
  // volume shockers (by % above avg volume — combined's existing sort order) that are
  // up on the day.
  const stage2Symbols = combined
    .filter((c) => c.stock!.stock_performance?.is_stage2)
    .map((c) => c.stock!.nse_symbol)
    .filter(Boolean) as string[]

  const topNonStage2Symbols = combined
    .filter((c) => !c.stock!.stock_performance?.is_stage2 && (getDayChange(c.row) ?? 0) > 0)
    .slice(0, 15)
    .map((c) => c.stock!.nse_symbol)
    .filter(Boolean) as string[]

  const watchlistSymbols = [...stage2Symbols, ...topNonStage2Symbols]

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="px-6 py-6">
        <header className="mb-5 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Volume Shockers</h1>
            <p className="text-slate-500 text-sm mt-1">
              {combined.length} NSE stocks trading at 50%+ above their 50-day average volume
              {lastUpdated && (
                <span className="text-slate-400">
                  {' '}· Last updated {lastUpdated.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-end gap-3">
            <CopyWatchlist symbols={watchlistSymbols} />
            <div className="w-72">
              <Search placeholder="Search stocks…" />
            </div>
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
                  <th className="px-4 py-3 text-right">Mkt Cap</th>
                  <th className="px-4 py-3 text-right">Day Change</th>
                  <th className="px-4 py-3 text-right">Volume</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">50D Avg Volume</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">% Above Avg</th>
                  <th className="px-4 py-3 text-center">Stage 2</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {combined.map(({ row, stock }) => {
                  const pctAboveAvg = ((Number(row.volume) - row.avg_vol_50) / row.avg_vol_50) * 100
                  const dayChange = getDayChange(row)

                  return (
                    <tr key={row.stock_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-semibold">
                        <Link href={`/stock/${stock!.nse_symbol}`} className="text-blue-600 hover:underline">
                          {stock!.nse_symbol}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-500 truncate max-w-[180px]" title={stock!.name || ''}>
                        {stock!.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        ₹{row.close_price.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {stock!.market_cap
                          ? `₹${Math.round(Number(stock!.market_cap) / 10_000_000).toLocaleString('en-IN')} Cr`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PercentageChange value={dayChange} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">
                        {Number(row.volume).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {Math.round(row.avg_vol_50).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-amber-600">+{pctAboveAvg.toFixed(0)}%</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {stock!.stock_performance?.is_stage2 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                            <TrendingUp className="w-3 h-3" /> Stage 2
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {combined.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                      No stocks currently trading 50%+ above their 50-day average volume.
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
