import prisma from '@/lib/prisma'
import Link from 'next/link'
import BreadthCharts, { type BreadthPoint } from './BreadthCharts'

export const dynamic = 'force-dynamic'

const HISTORY_DAYS = 60

export default async function MarketBreadthPage() {
  let history: BreadthPoint[] = []
  let error: string | null = null

  try {
    const rows = await prisma.market_breadth_history.findMany({
      orderBy: { date: 'desc' },
      take: HISTORY_DAYS,
    })
    history = rows
      .reverse()
      .map((r) => ({
        date: r.date.toISOString(),
        pct_above_ema20: r.pct_above_ema20,
        pct_above_ema50: r.pct_above_ema50,
        pct_above_ema200: r.pct_above_ema200,
        new_highs: r.new_highs,
        new_lows: r.new_lows,
        net_highs_lows: r.net_highs_lows,
      }))
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

  const latestRows = await prisma.market_breadth_history.findMany({ orderBy: { date: 'desc' }, take: 1 })
  const latest = latestRows[0]

  const total       = latest?.total ?? 0
  const advances    = latest?.advances ?? 0
  const declines    = latest?.declines ?? 0
  const unchanged   = latest?.unchanged ?? 0
  const near52wHigh = latest?.near_52w_high ?? 0
  const near52wLow  = latest?.near_52w_low ?? 0
  const asOfDate    = latest?.date ?? null

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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

        {/* EMA breadth & New Highs/Lows history */}
        {history.length > 0 && <BreadthCharts data={history} />}
      </div>
    </div>
  )
}
