'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, TrendingDown, AlertTriangle, ListChecks, BellRing, CheckCircle2 } from 'lucide-react'
import backtestData from '@/data/backtest_results_10pct_stop.json'
import picksData from '@/data/strategy_picks.json'
import stopAlerts from '@/data/stop_alerts.json'

import MetricsGrid from '@/components/strategy/MetricsGrid'
import DetailedMetrics from '@/components/strategy/DetailedMetrics'
import PerformanceChart from '@/components/strategy/PerformanceChart'
import PerformanceTable from '@/components/strategy/PerformanceTable'
import CagrCards from '@/components/strategy/CagrCards'
import YearlyReturnsTable from '@/components/strategy/YearlyReturnsTable'
import KeyInsights from '@/components/strategy/KeyInsights'

export default function Momentum10PctStopStrategyPage() {
    const data = backtestData as any
    const backtestMetrics = data.backtest_metrics
    const currentMetrics = data.current_metrics

    const backtestAsc = useMemo(() =>
        [...(data.backtest_results || [])].sort((a: any, b: any) => a.month.localeCompare(b.month)), [])
    const backtestDesc = useMemo(() => [...backtestAsc].reverse(), [backtestAsc])

    const currentAsc = useMemo(() =>
        [...(data.current_performance || [])].sort((a: any, b: any) => a.month.localeCompare(b.month)), [])
    const currentDesc = useMemo(() => [...currentAsc].reverse(), [currentAsc])

    if (!backtestMetrics) {
        return (
            <div className="min-h-screen bg-gray-50 p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center gap-4 mb-8">
                        <Link href="/strategies" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                            <ArrowLeft className="w-6 h-6 text-gray-600" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Momentum + 10% Monthly Stop</h1>
                            <p className="text-gray-500 mt-1">Run the backtest script to generate results.</p>
                        </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-blue-800">
                        <p className="font-semibold mb-2">Backtest not yet run</p>
                        <p className="text-sm font-mono">python scripts/backtest_momentum_10pct_stop.py</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/strategies" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Momentum + 10% Monthly Stop</h1>
                        <p className="text-gray-500 mt-1">
                            Top 15 Momentum Stocks from High Cap (&gt; 2000 Cr) (3M, 6M &amp; 1Y) • Monthly Rebalancing • −10% close-price stop, exit next-day open
                        </p>
                    </div>
                </div>

                {/* ── Stop-Loss Alerts ─────────────────────────────────────── */}
                {(() => {
                    const alerts = (stopAlerts as any)?.alerts?.momentum ?? []
                    const hits = alerts.filter((a: any) => a.stop_hit)
                    const latestDate = (stopAlerts as any)?.latest_date?.slice(0, 10)
                    const nextDay = (stopAlerts as any)?.next_trading_day
                    if (alerts.length === 0) return null

                    // exitedHits: GTT (auto-sold) + overdue close_stops (user already sold per rule)
                    const exitedHits  = hits.filter((a: any) => a.stop_type === 'gtt_gap_down' || a.stop_type === 'gtt_intraday' || (a.stop_type === 'close_stop' && a.overdue))
                    const actionHits  = hits.filter((a: any) => a.stop_type === 'close_stop' && !a.overdue)

                    const stopTypeBadge = (t: string | null) => {
                        if (t === 'gtt_gap_down')  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">GTT gap-down</span>
                        if (t === 'gtt_intraday')  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">GTT intraday</span>
                        if (t === 'close_stop')    return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">close stop</span>
                        return null
                    }

                    const entryDate = hits[0]?.entry_date?.slice(0, 10) ?? ''

                    return hits.length > 0 ? (
                        <div className="mb-6 space-y-3">
                            {/* Action required — close stop triggered, exit at tomorrow's open */}
                            {actionHits.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-xl shadow-sm overflow-hidden">
                                    <div className="flex items-center gap-2.5 px-5 py-3.5 bg-red-100 border-b border-red-200">
                                        <BellRing className="w-4 h-4 text-red-600 shrink-0" />
                                        <span className="font-semibold text-red-900 text-sm">Stop-Loss Alert — Sell at Tomorrow's Open</span>
                                        <span className="ml-auto text-[11px] text-red-500 font-mono">as of {latestDate}</span>
                                    </div>
                                    <div className="px-5 py-3 text-xs text-red-700">
                                        {actionHits.length} stock{actionHits.length > 1 ? 's have' : ' has'} closed below the −10% stop.
                                        Place a <strong>market sell order</strong> at <strong>{nextDay}</strong> open.
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm border-t border-red-100">
                                            <thead>
                                                <tr className="bg-red-50 text-[11px] font-semibold uppercase tracking-wider text-red-400 border-b border-red-100">
                                                    <th className="px-4 py-2 text-left">Symbol</th>
                                                    <th className="px-4 py-2 text-left">Name</th>
                                                    <th className="px-4 py-2 text-right">Entry ({entryDate})</th>
                                                    <th className="px-4 py-2 text-right">Close ({latestDate})</th>
                                                    <th className="px-4 py-2 text-right">Return</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-red-50">
                                                {actionHits.map((a: any) => (
                                                    <tr key={a.symbol} className="bg-white">
                                                        <td className="px-4 py-2.5 font-bold text-red-700 font-mono text-xs">{a.symbol}</td>
                                                        <td className="px-4 py-2.5 text-gray-600 text-xs">{a.name}</td>
                                                        <td className="px-4 py-2.5 text-right text-xs font-mono text-gray-600">₹{a.entry_price.toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-2.5 text-right text-xs font-mono text-gray-600">₹{a.current_close.toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-2.5 text-right text-xs font-mono font-bold text-red-600">{a.return_pct.toFixed(2)}%</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="px-5 py-2.5 bg-red-50 border-t border-red-100 text-[11px] text-red-400">
                                        Sell at market open when daily close ≤ entry × 0.90.
                                    </div>
                                </div>
                            )}

                            {/* Already exited — GTT auto-sold or close-stop exit already done */}
                            {exitedHits.length > 0 && (
                                <div className="bg-orange-50 border border-orange-200 rounded-xl shadow-sm overflow-hidden">
                                    <div className="flex items-center gap-2.5 px-5 py-3.5 bg-orange-100 border-b border-orange-200">
                                        <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" />
                                        <span className="font-semibold text-orange-900 text-sm">Stop-Loss Exits This Month</span>
                                        <span className="ml-auto text-[11px] text-orange-500 font-mono">as of {latestDate}</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm border-t border-orange-100">
                                            <thead>
                                                <tr className="bg-orange-50 text-[11px] font-semibold uppercase tracking-wider text-orange-400 border-b border-orange-100">
                                                    <th className="px-4 py-2 text-left">Symbol</th>
                                                    <th className="px-4 py-2 text-left">Name</th>
                                                    <th className="px-4 py-2 text-right">Entry ({entryDate})</th>
                                                    <th className="px-4 py-2 text-right">Stop Date</th>
                                                    <th className="px-4 py-2 text-right">Exit Date</th>
                                                    <th className="px-4 py-2 text-right">Return</th>
                                                    <th className="px-4 py-2 text-left">Trigger</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-orange-50">
                                                {exitedHits.map((a: any) => (
                                                    <tr key={a.symbol} className="bg-white">
                                                        <td className="px-4 py-2.5 font-bold text-orange-700 font-mono text-xs">{a.symbol}</td>
                                                        <td className="px-4 py-2.5 text-gray-600 text-xs">{a.name}</td>
                                                        <td className="px-4 py-2.5 text-right text-xs font-mono text-gray-600">₹{a.entry_price.toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-2.5 text-right text-xs font-mono text-gray-500">{a.stop_date}</td>
                                                        <td className="px-4 py-2.5 text-right text-xs font-mono text-gray-500">{a.exit_date}</td>
                                                        <td className="px-4 py-2.5 text-right text-xs font-mono font-bold text-orange-600">{a.return_pct.toFixed(2)}%</td>
                                                        <td className="px-4 py-2.5">{stopTypeBadge(a.stop_type)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="px-5 py-2.5 bg-orange-50 border-t border-orange-100 text-[11px] text-orange-400">
                                        GTT: sold at open or −15% trigger. Close stop: sold at exit-date open.
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg mb-6 text-sm text-emerald-700">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>All {alerts.length} positions are within stop-loss limits as of {latestDate}.</span>
                        </div>
                    )
                })()}

                {/* ── Next-Month Picks ──────────────────────────────────────── */}
                {(() => {
                    const picks = (picksData as any)?.picks?.momentum
                    if (!picks?.stocks?.length) return null
                    const asOf = (picksData as any).as_of_date
                    const generatedAt = (picksData as any).generated_at
                    return (
                        <div className="bg-white border border-emerald-200 rounded-xl shadow-sm mb-8 overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-3.5 bg-emerald-50 border-b border-emerald-100">
                                <div className="flex items-center gap-2.5">
                                    <ListChecks className="w-4.5 h-4.5 text-emerald-600" />
                                    <span className="font-semibold text-emerald-900 text-sm">Current Month Selection</span>
                                    <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full font-medium">
                                        Scores as of {asOf}
                                    </span>
                                </div>
                                <span className="text-[11px] text-emerald-500 font-mono">Updated {generatedAt?.slice(0, 10)}</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100">
                                            <th className="px-4 py-2.5 text-center w-10">#</th>
                                            <th className="px-4 py-2.5 text-left">Symbol</th>
                                            <th className="px-4 py-2.5 text-left">Name</th>
                                            <th className="px-4 py-2.5 text-right">Mkt Cap (Cr)</th>
                                            <th className="px-4 py-2.5 text-right">3M Ret</th>
                                            <th className="px-4 py-2.5 text-right">6M Ret</th>
                                            <th className="px-4 py-2.5 text-right">1Y Ret</th>
                                            <th className="px-4 py-2.5 text-right">Score (z)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {picks.stocks.map((s: any) => (
                                            <tr key={s.symbol} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-2.5 text-center text-gray-400 text-xs font-mono">{s.rank}</td>
                                                <td className="px-4 py-2.5 font-bold text-gray-900 font-mono text-xs">{s.symbol}</td>
                                                <td className="px-4 py-2.5 text-gray-600 text-xs">{s.name}</td>
                                                <td className="px-4 py-2.5 text-right text-gray-600 text-xs font-mono">
                                                    {s.market_cap_cr != null ? `₹${s.market_cap_cr.toLocaleString('en-IN')}` : '—'}
                                                </td>
                                                <td className={`px-4 py-2.5 text-right text-xs font-mono font-semibold ${s.mr_3m >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                    {s.mr_3m != null ? `${(s.mr_3m * 100).toFixed(1)}%` : '—'}
                                                </td>
                                                <td className={`px-4 py-2.5 text-right text-xs font-mono font-semibold ${s.mr_6m >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                    {s.mr_6m != null ? `${(s.mr_6m * 100).toFixed(1)}%` : '—'}
                                                </td>
                                                <td className={`px-4 py-2.5 text-right text-xs font-mono font-semibold ${s.mr_1y >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                    {s.mr_1y != null ? `${(s.mr_1y * 100).toFixed(1)}%` : '—'}
                                                </td>
                                                <td className="px-4 py-2.5 text-right text-xs font-mono text-gray-700">
                                                    {s.weighted_z != null ? (s.weighted_z > 0 ? '+' : '') + s.weighted_z.toFixed(3) : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-400">
                                Z-scores computed within High Cap universe ({(picksData as any).universe_size} stocks). Matches backtest selection logic exactly. Buy at market open on the first trading day of the month.
                            </div>
                        </div>
                    )
                })()}

                {/* Survivorship Bias Warning */}
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <TrendingDown className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-800">Survivorship Bias Warning</h3>
                            <div className="mt-2 text-sm text-yellow-700">
                                <p>
                                    This backtest uses the <strong>current</strong> universe of listed stocks (&gt;2000 Cr Market Cap) for historical simulation.
                                    This introduces survivorship bias. Actual historical returns would likely be lower.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Strategy Logic */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Strategy Logic</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <h3 className="font-semibold text-blue-900 mb-2">1. Selection</h3>
                            <p className="text-blue-800">
                                Select top 15 stocks from High Cap Universe (&gt; 2000 Cr) with highest Momentum Score.
                                Score is based on volatility-adjusted returns over <strong>3M, 6M, and 1Y</strong> periods (equal weight).
                            </p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                            <h3 className="font-semibold text-purple-900 mb-2">2. Weighting</h3>
                            <p className="text-purple-800">
                                Equal weighting (6.67% per stock) to avoid concentration risk in a single winner.
                            </p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                            <h3 className="font-semibold text-green-900 mb-2">3. Rebalancing</h3>
                            <p className="text-green-800">
                                Portfolio is rebalanced on the <strong>1st of every month</strong>.
                                Stocks dropping out of Top 15 are sold, new entrants are bought.
                            </p>
                        </div>
                        <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                            <h3 className="font-semibold text-red-900 mb-2">4. Stop Loss</h3>
                            <p className="text-red-800">
                                If daily <strong>close</strong> drops ≥10% from entry, sell at <strong>next morning's open</strong>.
                                Actual exit return varies — may be better or worse than −10%.
                                GTT at −15% remains active as catastrophic gap-down protection.
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Current Performance ─────────────────── */}
                {currentMetrics && (
                    <div className="mb-12">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-2 h-8 bg-green-500 rounded-full" />
                            <h2 className="text-2xl font-bold text-gray-900">Current Performance (Live)</h2>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200 ml-2">
                                Jan 2026 Onwards
                            </span>
                        </div>

                        <MetricsGrid metrics={currentMetrics} />
                        <CagrCards monthlyData={currentAsc} label="Annualised from live period" />

                        <DetailedMetrics
                            metrics={currentMetrics}
                            title={`Current Metrics (${currentMetrics.time_metrics.start} to ${currentMetrics.time_metrics.end})`}
                        />

                        <YearlyReturnsTable monthlyData={currentAsc} />

                        <div className="mt-8">
                            <PerformanceChart
                                data={currentAsc}
                                title="Equity Curve (Live Period)"
                                showBenchmark={true}
                                benchmarkName="Nifty 50"
                            />
                        </div>

                        <div className="mt-8">
                            <PerformanceTable data={currentDesc} title="Monthly Live Performance" />
                        </div>
                    </div>
                )}

                {/* Divider */}
                <div className="relative flex py-5 items-center mb-12">
                    <div className="flex-grow border-t border-gray-300" />
                    <span className="flex-shrink-0 mx-4 text-gray-400 text-sm font-medium uppercase tracking-wider">Historical Data</span>
                    <div className="flex-grow border-t border-gray-300" />
                </div>

                {/* ── Backtest Data ────────────────────────── */}
                <div>
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-2 h-8 bg-gray-500 rounded-full" />
                        <h2 className="text-2xl font-bold text-gray-900">Backtest Data</h2>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 ml-2">
                            {backtestMetrics.time_metrics.start} to {backtestMetrics.time_metrics.end}
                        </span>
                    </div>

                    <MetricsGrid metrics={backtestMetrics} />
                    <CagrCards monthlyData={backtestAsc} label={`${(backtestAsc.length / 12).toFixed(1)}-year backtest`} />
                    <YearlyReturnsTable monthlyData={backtestAsc} />

                    <DetailedMetrics metrics={backtestMetrics} title="Historical Backtest Metrics" />

                    <div className="mt-8">
                        <PerformanceChart
                            data={backtestAsc}
                            title="Historical Equity Curve"
                            showBenchmark={true}
                            benchmarkName="Nifty 50"
                        />
                    </div>

                    <div className="mt-8">
                        <PerformanceTable data={backtestDesc} title="Monthly Backtest Returns" />
                    </div>
                </div>

                {/* ── Backtest Audit ─────────────────────── */}
                
                <KeyInsights monthlyData={backtestAsc} />

                <div className="mt-12 bg-orange-50 border border-orange-200 rounded-lg p-5">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                        <div>
                            <h3 className="text-sm font-semibold text-orange-900 mb-2">Backtest Audit — Why the headline return may be inflated</h3>
                            <ul className="text-sm text-orange-800 space-y-1.5 list-disc list-inside">
                                <li>
                                    <strong>Look-ahead bias on universe:</strong> Market cap filter uses today's values.
                                    Small-caps from 2018 that grew large are included retroactively, biasing selection toward winners.
                                </li>
                                <li>
                                    <strong>Illiquid extreme movers:</strong> Several holdings had &gt;50% single-month returns
                                    (ORCHPHARMA, TTML, OPTIEMUS during 2020–2021). In practice, large positions
                                    couldn't be built or exited at those prices.
                                </li>
                                <li>
                                    <strong>2020–2021 outlier years:</strong> The COVID recovery + pharma/telecom rally was a
                                    once-in-a-decade event. The compounded gains from those two years alone account for
                                    the bulk of the total return.
                                </li>
                                <li>
                                    <strong>No slippage or market impact modelled.</strong> Monthly rebalancing across 15 stocks
                                    assumes perfect execution at open price — unrealistic for thinly traded names.
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
