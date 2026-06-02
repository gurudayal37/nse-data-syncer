'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'
import backtestData from '@/data/backtest_results_long_short.json'

import MetricsGrid from '@/components/strategy/MetricsGrid'
import DetailedMetrics from '@/components/strategy/DetailedMetrics'
import PerformanceChart from '@/components/strategy/PerformanceChart'
import CagrCards from '@/components/strategy/CagrCards'
import YearlyReturnsTable from '@/components/strategy/YearlyReturnsTable'
import KeyInsights from '@/components/strategy/KeyInsights'

// Inline monthly table that shows long + short leg breakdown
function LongShortTable({ data, title }: { data: any[]; title: string }) {
    const [expanded, setExpanded] = React.useState<Set<number>>(new Set())
    if (!data || data.length === 0) return null

    const toggle = (i: number) => {
        const s = new Set(expanded)
        s.has(i) ? s.delete(i) : s.add(i)
        setExpanded(s)
    }

    return (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-600 font-medium">
                        <tr className="text-right">
                            <th className="px-4 py-3 w-8" />
                            <th className="px-4 py-3 text-left">Month</th>
                            <th className="px-4 py-3">Portfolio</th>
                            <th className="px-4 py-3">Long Leg</th>
                            <th className="px-4 py-3">Short Leg</th>
                            <th className="px-4 py-3">Nifty</th>
                            <th className="px-4 py-3 text-left">Stocks</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {data.map((row: any, i: number) => {
                            const isExp = expanded.has(i)
                            const longs = (row.holdings || []).filter((h: any) => h.side === 'long')
                            const shorts = (row.holdings || []).filter((h: any) => h.side === 'short')
                            return (
                                <React.Fragment key={i}>
                                    <tr className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <button onClick={() => toggle(i)} className="text-gray-400 hover:text-gray-600 text-xs">
                                                {isExp ? '▼' : '▶'}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-900">{row.month}</td>
                                        <td className={`px-4 py-3 text-right font-semibold ${row.portfolio_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {row.portfolio_return > 0 ? '+' : ''}{row.portfolio_return}%
                                        </td>
                                        <td className={`px-4 py-3 text-right ${row.long_return >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {row.long_return > 0 ? '+' : ''}{row.long_return}%
                                        </td>
                                        <td className={`px-4 py-3 text-right ${row.short_return >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {row.short_return > 0 ? '+' : ''}{row.short_return}%
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-500">
                                            {row.benchmark_return > 0 ? '+' : ''}{row.benchmark_return}%
                                        </td>
                                        <td className="px-4 py-3 text-gray-400 text-xs">
                                            {longs.length}L / {shorts.length}S
                                        </td>
                                    </tr>
                                    {isExp && (
                                        <tr key={`${i}-exp`}>
                                            <td colSpan={7} className="px-4 py-4 bg-gray-50">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-xs font-semibold text-green-700 mb-2 uppercase tracking-wide">Long (Top 7)</p>
                                                        <div className="space-y-1">
                                                            {longs.map((h: any, j: number) => (
                                                                <div key={j} className="flex justify-between items-center bg-white px-3 py-1.5 rounded border border-green-100">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">L</span>
                                                                        <span className="font-medium text-gray-700 text-xs">{h.symbol}</span>
                                                                        <span className="text-[10px] text-gray-400">z={h.score}</span>
                                                                    </div>
                                                                    <span className={`text-xs font-semibold ${h.return >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                                        {h.return > 0 ? '+' : ''}{h.return}%
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-semibold text-red-700 mb-2 uppercase tracking-wide">Short (Bottom 7)</p>
                                                        <div className="space-y-1">
                                                            {shorts.map((h: any, j: number) => (
                                                                <div key={j} className="flex justify-between items-center bg-white px-3 py-1.5 rounded border border-red-100">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded">S</span>
                                                                        <span className="font-medium text-gray-700 text-xs">{h.symbol}</span>
                                                                        <span className="text-[10px] text-gray-400">z={h.score}</span>
                                                                    </div>
                                                                    <span className={`text-xs font-semibold ${h.return >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                                        {h.return > 0 ? '+' : ''}{h.return}%
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export default function LongShortStrategyPage() {
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
                        <h1 className="text-3xl font-bold text-gray-900">Long-Short Momentum (Futures)</h1>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-blue-800">
                        <p className="font-semibold mb-2">Backtest not yet run</p>
                        <p className="text-sm font-mono">python scripts/backtest_long_short.py</p>
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
                        <h1 className="text-3xl font-bold text-gray-900">Long-Short Momentum (Futures)</h1>
                        <p className="text-gray-500 mt-1">
                            Top 7 Long + Bottom 7 Short from NSE Futures Universe • Monthly Rebalancing • Dollar-Neutral
                        </p>
                    </div>
                </div>

                {/* Strategy Logic */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Strategy Logic</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <h3 className="font-semibold text-blue-900 mb-2">1. Universe</h3>
                            <p className="text-blue-800">
                                All <strong>~195 NSE F&O stocks</strong> in the Dhan futures universe. Scored using
                                volatility-adjusted returns over <strong>3M, 6M, and 1Y</strong>.
                            </p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                            <h3 className="font-semibold text-green-900 mb-2">2. Long Leg</h3>
                            <p className="text-green-800">
                                <strong>Buy top 7</strong> stocks with highest momentum score.
                                Equal weight — ~7.14% each. Hold for the full month.
                            </p>
                        </div>
                        <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                            <h3 className="font-semibold text-red-900 mb-2">3. Short Leg</h3>
                            <p className="text-red-800">
                                <strong>Sell short bottom 7</strong> stocks with lowest momentum score.
                                Equal weight — ~7.14% each. Hold for the full month.
                            </p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                            <h3 className="font-semibold text-purple-900 mb-2">4. Return</h3>
                            <p className="text-purple-800">
                                Dollar-neutral: <strong>50% capital long + 50% short</strong>.
                                Portfolio return = (long return + short P&L) ÷ 2.
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
                            <LongShortTable data={currentDesc} title="Monthly Live Performance" />
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
                        <LongShortTable data={backtestDesc} title="Monthly Backtest Performance" />
                    </div>
                </div>

                {/* ── Audit ─────────────── */}
                
                <KeyInsights monthlyData={backtestAsc} />

                <div className="mt-12 bg-orange-50 border border-orange-200 rounded-lg p-5">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                        <div>
                            <h3 className="text-sm font-semibold text-orange-900 mb-2">Backtest Limitations</h3>
                            <ul className="text-sm text-orange-800 space-y-1.5 list-disc list-inside">
                                <li>
                                    <strong>Short-side execution in India is hard:</strong> NSE futures have lot-size constraints.
                                    A short position requires sufficient F&O margin and the stock must have active near-month contracts.
                                    This backtest treats shorts identically to longs, which overstates feasibility.
                                </li>
                                <li>
                                    <strong>Short-period backtest (2 years):</strong> Only 2024–2025 data. This is a strong
                                    bull-then-correction cycle — not representative of all market regimes.
                                </li>
                                <li>
                                    <strong>No margin or funding cost:</strong> Short positions require margin. Real returns
                                    would be reduced by the cost of carry on the short side.
                                </li>
                                <li>
                                    <strong>Roll costs not modelled:</strong> Futures must be rolled monthly at expiry.
                                    Roll cost / contango / backwardation is not accounted for.
                                </li>
                                <li>
                                    <strong>Price used is equity close price:</strong> Actual execution would be via
                                    futures contracts, which may trade at a premium or discount to spot.
                                </li>
                                <li>
                                    <strong>No slippage or impact cost modelled</strong> for either leg.
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
