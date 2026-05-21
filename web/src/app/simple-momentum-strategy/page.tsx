'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, TrendingDown } from 'lucide-react'
import backtestData from '@/data/backtest_results_simple.json'

// Import reusable components
import MetricsGrid from '@/components/strategy/MetricsGrid'
import DetailedMetrics from '@/components/strategy/DetailedMetrics'
import PerformanceChart from '@/components/strategy/PerformanceChart'
import PerformanceTable from '@/components/strategy/PerformanceTable'

export default function SimpleMomentumStrategyPage() {
    // Safe access to data
    const data = backtestData as any
    const backtestMetrics = data.backtest_metrics
    const currentMetrics = data.current_metrics
    const backtestResults = data.backtest_results || []
    const currentPerformance = data.current_performance || []

    // Prepare Equity Curve Data (Live) with Baseline
    const equityCurveData = React.useMemo(() => {
        if (!currentPerformance || currentPerformance.length === 0) return []

        // Add baseline entry for Nov 2025 so chart starts at 100k
        const baseline = {
            month: '2025-11',
            portfolio_return: 0,
            benchmark_return: 0
        }

        return [baseline, ...currentPerformance]
    }, [currentPerformance])

    if (!backtestMetrics) {
        return <div className="p-8 text-center text-gray-500">Loading metrics or invalid data format...</div>
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Simple Momentum Strategy</h1>
                        <p className="text-gray-500 mt-1">
                            Buying Top 15 Simple Momentum Stocks from Nifty total market(6M & 1Y only) • Monthly Rebalancing
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <h3 className="font-semibold text-blue-900 mb-2">1. Selection</h3>
                            <p className="text-blue-800">
                                Select top 15 stocks from Nifty total market universe with highest Simple Momentum Score.
                                Score is based on volatility-adjusted returns over <strong>6 Months and 1 Year</strong> only (excluding 3M).
                            </p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                            <h3 className="font-semibold text-purple-900 mb-2">2. Weighting</h3>
                            <p className="text-purple-800">
                                Equal weighting (6.67% per stock) to avoid concentration risk.
                            </p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                            <h3 className="font-semibold text-green-900 mb-2">3. Rebalancing</h3>
                            <p className="text-green-800">
                                Portfolio is rebalanced on the <strong>1st of every month</strong>.
                            </p>
                        </div>
                    </div>
                </div>

                {/* =========================================
                    CURRENT PERFORMANCE SECTION (Live)
                   ========================================= */}
                {currentMetrics && (
                    <div className="mb-12">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-2 h-8 bg-green-500 rounded-full"></div>
                            <h2 className="text-2xl font-bold text-gray-900">Current Performance (Live)</h2>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200 ml-2">
                                Jan 2026 Onwards
                            </span>
                        </div>

                        {/* Live Metrics Grid */}
                        <MetricsGrid metrics={currentMetrics} />

                        {/* Live Detailed Metrics */}
                        <DetailedMetrics
                            metrics={currentMetrics}
                            title={`Current Metrics (${currentMetrics.time_metrics.start} to ${currentMetrics.time_metrics.end})`}
                        />

                        {/* Live Equity Curve */}
                        <div className="mt-8">
                            <PerformanceChart
                                data={equityCurveData}
                                title="Equity Curve (Live Period)"
                                showBenchmark={true}
                                benchmarkName="Nifty 50"
                            />
                        </div>

                        {/* Live Monthly Table */}
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


                {/* =========================================
                    BACKTEST DATA SECTION (Historical)
                   ========================================= */}
                <div>
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-2 h-8 bg-gray-500 rounded-full"></div>
                        <h2 className="text-2xl font-bold text-gray-900">Backtest Data</h2>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 ml-2">
                            {backtestMetrics.time_metrics.start} to {backtestMetrics.time_metrics.end}
                        </span>
                    </div>

                    {/* Historical Detailed Metrics */}
                    <MetricsGrid metrics={backtestMetrics} />
                    <DetailedMetrics
                        metrics={backtestMetrics}
                        title="Historical Backtest Metrics"
                    />

                    {/* Historical Equity Curve */}
                    <div className="mt-8">
                        <PerformanceChart
                            data={backtestResults}
                            title="Historical Equity Curve"
                            showBenchmark={true}
                            benchmarkName="Nifty 50"
                        />
                    </div>

                    {/* Historical Monthly Table */}
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
