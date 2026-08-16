import prisma from '@/lib/prisma'
import Link from 'next/link'
import { Flame } from 'lucide-react'

export const dynamic = 'force-dynamic'

function fmtTime(d: Date | null) {
    if (!d) return '-'
    return new Date(d).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtDate(d: Date) {
    return new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export default async function EtfLiveStrategyPage() {
    let picks: Awaited<ReturnType<typeof prisma.etf_live_strategy_picks.findMany>> = []
    let tradeDate: Date | null = null
    let error: string | null = null

    try {
        const latest = await prisma.etf_live_strategy_picks.aggregate({
            _max: { trade_date: true },
        })
        tradeDate = latest._max.trade_date

        if (tradeDate) {
            picks = await prisma.etf_live_strategy_picks.findMany({
                where: { trade_date: tradeDate },
                orderBy: { rank: 'asc' },
            })
        }
    } catch (e: unknown) {
        error = e instanceof Error ? e.message : 'Failed to fetch live strategy picks'
    }

    const totalNotional = picks.reduce((sum, p) => sum + p.notional, 0)
    const anyChecked = picks.some(p => p.last_checked_at)

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-[95%] mx-auto">
                <header className="mb-8">
                    <div className="flex items-center gap-2">
                        <Flame className="w-7 h-7 text-orange-500" />
                        <h1 className="text-3xl font-bold text-gray-900">ETF Opening Wick Fade</h1>
                    </div>
                    <p className="text-gray-500 mt-2 max-w-3xl">
                        Top 10 ETFs ranked by how often their own opening print is the day&apos;s high, and by how much
                        they typically fade from open to close. Sell price is set at half each ETF&apos;s own average fade
                        above yesterday&apos;s close; quantity sized to ~₹1,00,000 notional per pick. Recomputed nightly
                        after the Dhan data sync, from the last 60 trading days of that ETF&apos;s own history.
                    </p>
                    {tradeDate && (
                        <p className="mt-3 text-sm font-medium text-gray-700">
                            Picks for: <span className="text-orange-600">{fmtDate(tradeDate)}</span>
                        </p>
                    )}
                </header>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                        <h2 className="text-lg font-bold text-red-900 mb-2">Database Connection Error</h2>
                        <p className="text-red-700">{error}</p>
                    </div>
                )}

                {!error && picks.length === 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                        No picks stored yet. These are computed nightly by scripts/compute_etf_live_strategy.py as part
                        of the Daily Dhan Sync GitHub Action — check back after it next runs.
                    </div>
                )}

                {picks.length > 0 && (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                <div className="text-xs text-gray-500 uppercase tracking-wide">Picks</div>
                                <div className="text-2xl font-bold text-gray-900">{picks.length}</div>
                            </div>
                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                <div className="text-xs text-gray-500 uppercase tracking-wide">Total notional</div>
                                <div className="text-2xl font-bold text-gray-900">₹{totalNotional.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                            </div>
                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                <div className="text-xs text-gray-500 uppercase tracking-wide">Entries filled</div>
                                <div className="text-2xl font-bold text-gray-900">{picks.filter(p => p.entry_achieved).length} / {picks.length}</div>
                            </div>
                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                <div className="text-xs text-gray-500 uppercase tracking-wide">Live status</div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {anyChecked ? <span className="text-green-600">Tracking</span> : <span className="text-gray-400">Not started</span>}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-gray-600">
                                    <thead className="bg-gray-50 text-gray-900 font-medium border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-3">#</th>
                                            <th className="px-4 py-3">Symbol</th>
                                            <th className="px-4 py-3 text-right">Prev Close</th>
                                            <th className="px-4 py-3 text-right">Sell Price (GTT)</th>
                                            <th className="px-4 py-3 text-right">Quantity</th>
                                            <th className="px-4 py-3 text-right">Notional</th>
                                            <th className="px-4 py-3 text-right">Open=High %</th>
                                            <th className="px-4 py-3 text-right">Avg Fade %</th>
                                            <th className="px-4 py-3">Entry Status</th>
                                            <th className="px-4 py-3 text-right">Exit LTP (+5m)</th>
                                            <th className="px-4 py-3 text-right">Last Checked</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {picks.map((p) => (
                                            <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 text-gray-400">{p.rank}</td>
                                                <td className="px-4 py-3 font-medium text-gray-900">
                                                    <Link href={`/etf/${p.symbol}`} className="hover:underline text-blue-600">
                                                        {p.symbol}
                                                    </Link>
                                                </td>
                                                <td className="px-4 py-3 text-right">₹{p.prev_close.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right font-semibold text-orange-600">₹{p.sell_price.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right">{p.quantity.toLocaleString('en-IN')}</td>
                                                <td className="px-4 py-3 text-right">₹{p.notional.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                                                <td className="px-4 py-3 text-right">{p.open_eq_high_pct.toFixed(0)}%</td>
                                                <td className="px-4 py-3 text-right">{p.avg_fade_pct.toFixed(2)}%</td>
                                                <td className="px-4 py-3">
                                                    {p.entry_achieved ? (
                                                        <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-xs font-medium">
                                                            Filled @ ₹{p.entry_ltp?.toFixed(2)} · {fmtTime(p.entry_achieved_at)}
                                                        </span>
                                                    ) : p.last_checked_at ? (
                                                        <span className="inline-flex items-center gap-1 text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full text-xs font-medium">
                                                            Not yet · LTP ₹{p.last_ltp?.toFixed(2)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs">Not checked</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {p.exit_ltp ? `₹${p.exit_ltp.toFixed(2)} · ${fmtTime(p.exit_captured_at)}` : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-400">{fmtTime(p.last_checked_at)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-5 text-sm text-amber-900">
                    <p className="font-semibold mb-1">Before placing anything</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>Confirm intraday short-selling (MIS) is actually enabled on your broker for each symbol — thin, newly-listed ETFs are sometimes excluded even when short-selling is allowed generally.</li>
                        <li>These prices are computed from the prior session&apos;s close and each ETF&apos;s own trailing 60-day fade history — not a guaranteed fill level.</li>
                        <li>&quot;Exit LTP (+5m)&quot; is informational only (price captured ~5 minutes after entry), not a resting order — you cover manually.</li>
                        <li>No stop loss is modeled anywhere on this page. See the full backtest write-up for known risks before sizing beyond ₹1L.</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
