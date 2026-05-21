'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, TrendingDown, AlertTriangle } from 'lucide-react'
import backtestData from '@/data/backtest_results_simple_10pct_stop.json'

import MetricsGrid from '@/components/strategy/MetricsGrid'
import DetailedMetrics from '@/components/strategy/DetailedMetrics'
import PerformanceChart from '@/components/strategy/PerformanceChart'
import PerformanceTable from '@/components/strategy/PerformanceTable'

function computeCagr(monthlyData: any[]) {
    if (!monthlyData || monthlyData.length === 0) return { strategy: 0, benchmark: 0, months: 0, years: 0 }
    const months = monthlyData.length
    const years = months / 12
    const cumPort = monthlyData.reduce((acc, r) => acc * (1 + r.portfolio_return / 100), 1)
    const cumBench = monthlyData.reduce((acc, r) => acc * (1 + r.benchmark_return / 100), 1)
    return {
        strategy: (Math.pow(cumPort, 1 / years) - 1) * 100,
        benchmark: (Math.pow(cumBench, 1 / years) - 1) * 100,
        months,
        years,
    }
}

function computeYearlyReturns(monthlyData: any[]) {
    const years: Record<string, { port: number; bench: number }> = {}
    for (const r of monthlyData) {
        const year = r.month.substring(0, 4)
        if (!years[year]) years[year] = { port: 1, bench: 1 }
        years[year].port *= (1 + r.portfolio_return / 100)
        years[year].bench *= (1 + r.benchmark_return / 100)
    }
    return Object.entries(years)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([year, v]) => ({
            year,
            strategy: (v.port - 1) * 100,
            benchmark: (v.bench - 1) * 100,
            alpha: ((v.port - 1) - (v.bench - 1)) * 100,
        }))
}

function CagrCards({ cagr, label }: { cagr: ReturnType<typeof computeCagr>; label: string }) {
    const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
    const alpha = cagr.strategy - cagr.benchmark
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Strategy CAGR</div>
                <div className={`text-3xl font-bold ${cagr.strategy >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {fmtPct(cagr.strategy)}
                </div>
                <div className="text-xs text-gray-400 mt-1">{label} · {cagr.months} months</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Benchmark CAGR</div>
                <div className={`text-3xl font-bold ${cagr.benchmark >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                    {fmtPct(cagr.benchmark)}
                </div>
                <div className="text-xs text-gray-400 mt-1">Nifty 50</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">CAGR Alpha</div>
                <div className={`text-3xl font-bold ${alpha >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {fmtPct(alpha)}
                </div>
                <div className="text-xs text-gray-400 mt-1">Annualised outperformance</div>
            </div>
        </div>
    )
}

function YearlyReturnsTable({ rows }: { rows: ReturnType<typeof computeYearlyReturns> }) {
    const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden mb-8">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">Annual Returns vs Benchmark</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100">
                            <th className="px-5 py-2.5 text-left">Year</th>
                            <th className="px-5 py-2.5 text-right">Strategy</th>
                            <th className="px-5 py-2.5 text-right">Nifty 50</th>
                            <th className="px-5 py-2.5 text-right">Alpha</th>
                            <th className="px-5 py-2.5 text-left pl-8">Bar</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {rows.map(r => {
                            const barMax = 160
                            const stratBar = Math.min(Math.abs(r.strategy), barMax)
                            const benchBar = Math.min(Math.abs(r.benchmark), barMax)
                            return (
                                <tr key={r.year} className="hover:bg-gray-50">
                                    <td className="px-5 py-3 font-semibold text-gray-800">{r.year}</td>
                                    <td className={`px-5 py-3 text-right font-semibold ${r.strategy >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {fmtPct(r.strategy)}
                                    </td>
                                    <td className={`px-5 py-3 text-right ${r.benchmark >= 0 ? 'text-blue-600' : 'text-red-400'}`}>
                                        {fmtPct(r.benchmark)}
                                    </td>
                                    <td className={`px-5 py-3 text-right font-medium ${r.alpha >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {fmtPct(r.alpha)}
                                    </td>
                                    <td className="px-5 py-3 pl-8">
                                        <div className="flex items-center gap-1 min-w-[160px]">
                                            <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden flex">
                                                <div
                                                    className={`h-full rounded ${r.strategy >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                                                    style={{ width: `${(stratBar / barMax) * 100}%` }}
                                                />
                                            </div>
                                            <div className="flex-1 h-2.5 bg-gray-100 rounded overflow-hidden flex">
                                                <div
                                                    className={`h-full rounded ${r.benchmark >= 0 ? 'bg-blue-300' : 'bg-orange-300'}`}
                                                    style={{ width: `${(benchBar / barMax) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50 flex gap-5 text-[11px] text-gray-400">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-400 inline-block" />Strategy return</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-blue-300 inline-block" />Nifty 50 return</span>
            </div>
        </div>
    )
}

export default function SimpleMomentum10PctStopStrategyPage() {
    const data = backtestData as any
    const backtestMetrics = data.backtest_metrics
    const currentMetrics = data.current_metrics
    const backtestResults = useMemo(() => [...(data.backtest_results || [])].sort((a: any, b: any) => a.month.localeCompare(b.month)), [])
    const currentPerformance = useMemo(() => [...(data.current_performance || [])].sort((a: any, b: any) => a.month.localeCompare(b.month)), [])

    const btCagr = useMemo(() => computeCagr(backtestResults), [backtestResults])
    const curCagr = useMemo(() => computeCagr(currentPerformance), [currentPerformance])
    const btYearly = useMemo(() => computeYearlyReturns(backtestResults), [backtestResults])
    const curYearly = useMemo(() => computeYearlyReturns(currentPerformance), [currentPerformance])

    if (!backtestMetrics) {
        return (
            <div className="min-h-screen bg-gray-50 p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center gap-4 mb-8">
                        <Link href="/strategies" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                            <ArrowLeft className="w-6 h-6 text-gray-600" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Simple Momentum (Nifty) + 10% Stop</h1>
                            <p className="text-gray-500 mt-1">Run the backtest script to generate results.</p>
                        </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-blue-800">
                        <p className="font-semibold mb-2">Backtest not yet run</p>
                        <p className="text-sm font-mono">python scripts/backtest_simple_momentum_10pct_stop.py</p>
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
                        <h1 className="text-3xl font-bold text-gray-900">Simple Momentum (Nifty) + 10% Stop</h1>
                        <p className="text-gray-500 mt-1">
                            Top 15 from Nifty Total Market (6M & 1Y only) • Monthly Rebalancing • −10% stop per stock per month
                        </p>
                    </div>
                </div>

                {/* Survivorship Bias Warning */}
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                    <div className="flex">
                        <TrendingDown className="h-5 w-5 text-yellow-400 shrink-0" />
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-800">Survivorship Bias Warning</h3>
                            <p className="mt-1 text-sm text-yellow-700">
                                This backtest uses the <strong>current</strong> Nifty Total Market universe.
                                Stocks that delisted or shrank below 2000 Cr market cap are excluded from history — actual returns would be lower.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Backtest Audit */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-5 mb-8">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                        <div>
                            <h3 className="text-sm font-semibold text-orange-900 mb-2">Backtest Audit — Why the ~1600% return may be inflated</h3>
                            <ul className="text-sm text-orange-800 space-y-1.5 list-disc list-inside">
                                <li>
                                    <strong>Look-ahead bias on universe:</strong> Market cap filter uses today's values.
                                    Small-caps from 2018 that grew large are included retroactively, biasing selection toward winners.
                                </li>
                                <li>
                                    <strong>Stop-loss uses daily close, not intraday:</strong> If a stock gaps down −15% at open,
                                    the model still records only −10%. Real execution would record the actual gap loss.
                                </li>
                                <li>
                                    <strong>Illiquid extreme movers:</strong> Several holdings had &gt;50% single-month returns
                                    (ORCHPHARMA +176% Dec 2020, TTML +104% Nov 2021). These stocks had thin float —
                                    in practice large positions couldn't be built or exited at those prices.
                                </li>
                                <li>
                                    <strong>2020–2021 outlier years (+157%, +156%):</strong> The COVID recovery + pharma/telecom rally
                                    was a once-in-a-decade event. The compounded gains from those two years alone account for
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

                {/* Strategy Logic */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Strategy Logic</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <h3 className="font-semibold text-blue-900 mb-2">1. Selection</h3>
                            <p className="text-blue-800">
                                Top 15 stocks from <strong>Nifty Total Market</strong> by volatility-adjusted momentum score
                                over <strong>6M and 1Y</strong> (no 3M).
                            </p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                            <h3 className="font-semibold text-purple-900 mb-2">2. Weighting</h3>
                            <p className="text-purple-800">Equal weighting — 6.67% per stock.</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                            <h3 className="font-semibold text-green-900 mb-2">3. Rebalancing</h3>
                            <p className="text-green-800">
                                1st of every month. Stocks outside Top 15 are sold; new entrants bought at next-day open.
                            </p>
                        </div>
                        <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                            <h3 className="font-semibold text-red-900 mb-2">4. Stop Loss</h3>
                            <p className="text-red-800">
                                Exit if daily close falls <strong>≥10%</strong> from entry. Loss capped at <strong>−10%</strong> per stock per month.
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
                        <CagrCards cagr={curCagr} label="Annualised from live period" />

                        <DetailedMetrics
                            metrics={currentMetrics}
                            title={`Current Metrics (${currentMetrics.time_metrics.start} to ${currentMetrics.time_metrics.end})`}
                        />

                        {curYearly.length > 0 && <YearlyReturnsTable rows={curYearly} />}

                        <div className="mt-8">
                            <PerformanceChart
                                data={currentPerformance}
                                title="Equity Curve (Live Period)"
                                showBenchmark={true}
                                benchmarkName="Nifty 50"
                            />
                        </div>

                        <div className="mt-8">
                            <PerformanceTable data={currentPerformance} title="Monthly Live Performance" />
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
                    <CagrCards cagr={btCagr} label={`${btCagr.years.toFixed(1)}-year backtest`} />
                    <YearlyReturnsTable rows={btYearly} />

                    <DetailedMetrics metrics={backtestMetrics} title="Historical Backtest Metrics" />

                    <div className="mt-8">
                        <PerformanceChart
                            data={backtestResults}
                            title="Historical Equity Curve"
                            showBenchmark={true}
                            benchmarkName="Nifty 50"
                        />
                    </div>

                    <div className="mt-8">
                        <PerformanceTable data={backtestResults} title="Monthly Backtest Returns" />
                    </div>
                </div>
            </div>
        </div>
    )
}
