'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, TrendingDown, AlertTriangle } from 'lucide-react'
import backtestData from '@/data/backtest_results_simple_all_nifty_10pct_stop.json'

import MetricsGrid from '@/components/strategy/MetricsGrid'
import DetailedMetrics from '@/components/strategy/DetailedMetrics'
import PerformanceChart from '@/components/strategy/PerformanceChart'
import PerformanceTable from '@/components/strategy/PerformanceTable'
import CagrCards from '@/components/strategy/CagrCards'
import YearlyReturnsTable from '@/components/strategy/YearlyReturnsTable'

export default function SimpleMomentumAllNifty10PctStopPage() {
    const data = backtestData as any
    const backtestMetrics = data.backtest_metrics
    const currentMetrics = data.current_metrics

    // Ascending for chart + CAGR/yearly computation; descending for tables
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
                            <h1 className="text-3xl font-bold text-gray-900">Simple Momentum (High Cap) + 10% Stop</h1>
                            <p className="text-gray-500 mt-1">Run the backtest script to generate results.</p>
                        </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-blue-800">
                        <p className="font-semibold mb-2">Backtest not yet run</p>
                        <p className="text-sm font-mono">python scripts/backtest_simple_momentum_all_nifty_10pct_stop.py</p>
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
                        <h1 className="text-3xl font-bold text-gray-900">Simple Momentum (High Cap) + 10% Stop</h1>
                        <p className="text-gray-500 mt-1">
                            Top 15 from Full High Cap Universe (&gt;2000 Cr) (6M &amp; 1Y only) • Monthly Rebalancing • −10% stop per stock per month
                        </p>
                    </div>
                </div>

                {/* Survivorship Bias Warning */}
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
                    <div className="flex">
                        <TrendingDown className="h-5 w-5 text-yellow-400 shrink-0" />
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-800">Survivorship Bias Warning</h3>
                            <p className="mt-1 text-sm text-yellow-700">
                                This backtest uses the <strong>current</strong> high cap universe (&gt;2000 Cr).
                                Stocks that delisted or shrank below 2000 Cr are excluded from history — actual returns would be lower.
                            </p>
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
                                Top 15 stocks from <strong>All High Cap Universe (&gt;2000 Cr)</strong> by volatility-adjusted momentum
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

                {/* ── Backtest Audit (end of page) ─────────── */}
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
                                    <strong>Broader universe = more look-ahead bias:</strong> Unlike the Nifty Total Market variant,
                                    this strategy uses the full high-cap universe — meaning more stocks with survivorship bias are included.
                                </li>
                                <li>
                                    <strong>Stop-loss uses daily close, not intraday:</strong> If a stock gaps down −15% at open,
                                    the model records only −10%. Real execution would record the actual gap loss.
                                </li>
                                <li>
                                    <strong>Illiquid extreme movers:</strong> Several holdings had &gt;50% single-month returns
                                    in thinly traded stocks. Large positions couldn't be built or exited at those prices.
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
