'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, TrendingDown } from 'lucide-react'
import backtestData from '@/data/backtest_results_10pct_stop.json'

import MetricsGrid from '@/components/strategy/MetricsGrid'
import DetailedMetrics from '@/components/strategy/DetailedMetrics'
import PerformanceChart from '@/components/strategy/PerformanceChart'
import PerformanceTable from '@/components/strategy/PerformanceTable'

export default function Momentum10PctStopStrategyPage() {
    const data = backtestData as any
    const backtestMetrics = data.backtest_metrics
    const currentMetrics = data.current_metrics
    const backtestResults = data.backtest_results || []
    const currentPerformance = data.current_performance || []

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
                            Top 15 Momentum Stocks from High Cap (&gt; 2000 Cr) (3M, 6M & 1Y) • Monthly Rebalancing • -10% stop per stock per month
                        </p>
                    </div>
                </div>

                {/* Audit Warning */}
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
                                If any stock falls <strong>10% or more</strong> from its entry price during the month
                                (checked at daily close), it is exited at <strong>−10%</strong>.
                                Maximum loss per stock per month is capped at −10%.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Current Performance */}
                {currentMetrics && (
                    <div className="mb-12">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-2 h-8 bg-green-500 rounded-full"></div>
                            <h2 className="text-2xl font-bold text-gray-900">Current Performance (Live)</h2>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200 ml-2">
                                Jan 2026 Onwards
                            </span>
                        </div>

                        <MetricsGrid metrics={currentMetrics} />

                        <DetailedMetrics
                            metrics={currentMetrics}
                            title={`Current Metrics (${currentMetrics.time_metrics.start} to ${currentMetrics.time_metrics.end})`}
                        />

                        <div className="mt-8">
                            <PerformanceChart
                                data={currentPerformance}
                                title="Equity Curve (Live Period)"
                                showBenchmark={true}
                                benchmarkName="Nifty 50"
                            />
                        </div>

                        <div className="mt-8">
                            <PerformanceTable
                                data={currentPerformance}
                                title="Monthly Live Performance"
                            />
                        </div>
                    </div>
                )}

                {/* Divider */}
                <div className="relative flex py-5 items-center mb-12">
                    <div className="flex-grow border-t border-gray-300"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-400 text-sm font-medium uppercase tracking-wider">Historical Data</span>
                    <div className="flex-grow border-t border-gray-300"></div>
                </div>

                {/* Backtest Data */}
                <div>
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-2 h-8 bg-gray-500 rounded-full"></div>
                        <h2 className="text-2xl font-bold text-gray-900">Backtest Data</h2>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 ml-2">
                            {backtestMetrics.time_metrics.start} to {backtestMetrics.time_metrics.end}
                        </span>
                    </div>

                    <MetricsGrid metrics={backtestMetrics} />
                    <DetailedMetrics
                        metrics={backtestMetrics}
                        title="Historical Backtest Metrics"
                    />

                    <div className="mt-8">
                        <PerformanceChart
                            data={backtestResults}
                            title="Historical Equity Curve"
                            showBenchmark={true}
                            benchmarkName="Nifty 50"
                        />
                    </div>

                    <div className="mt-8">
                        <PerformanceTable
                            data={backtestResults}
                            title="Monthly Backtest Returns"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
