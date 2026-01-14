'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, TrendingDown } from 'lucide-react'
import backtestData from '@/data/backtest_results_simple_all_nifty.json'
import MetricsGrid from '@/components/strategy/MetricsGrid'
import DetailedMetrics from '@/components/strategy/DetailedMetrics'
import PerformanceChart from '@/components/strategy/PerformanceChart'
import PerformanceTable from '@/components/strategy/PerformanceTable'

export default function SimpleMomentumNonNiftyPage() {
    // Type assertion for backtestData to avoid TS errors if types aren't perfect
    const data = backtestData as any
    const metrics = data.backtest_metrics
    const backtestResults = data.backtest_results
    const currentPerformance = data.current_performance || []
    const currentMetrics = data.current_metrics

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Simple Momentum (High Cap)</h1>
                        <p className="text-gray-500 mt-1">
                            Buying Top 15 Stocks from Full Inverse (&gt;2000 Cr) (6M & 1Y only) • Monthly Rebalancing
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
                                    This introduces survivorship bias, as it excludes companies that were large in the past but have since delisted or crashed,
                                    while including stocks that have grown into the current criteria.
                                    <br />
                                    <strong>Actual historical returns would likely be lower.</strong>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 1. Strategy Logic */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Strategy Logic</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <h3 className="font-semibold text-blue-900 mb-2">1. Selection</h3>
                            <p className="text-blue-800">
                                Select top 15 stocks with highest Simple Momentum Score from <strong>All High Cap Universe (&gt;2000 Cr)</strong>.
                                Score is based on volatility-adjusted returns over <strong>6 Months and 1 Year</strong> only.
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

                {/* 2. Current Metrics Cards (New) */}
                {currentMetrics && (
                    <>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Current Performance (Live)</h2>
                        <MetricsGrid metrics={currentMetrics} />

                        {/* 3. Detailed Current Metrics (New) */}
                        <DetailedMetrics
                            metrics={currentMetrics}
                            title={`Current Metrics (${currentMetrics.time_metrics.start} to ${currentMetrics.time_metrics.end})`}
                        />
                    </>
                )}

                {/* 4. Equity Curve (Current) */}
                {currentPerformance.length > 0 && (
                    <PerformanceChart
                        data={currentPerformance}
                        title="Equity Curve (Current Period)"
                    />
                )}

                {/* 5. Current Performance Table (Existing) */}
                {currentPerformance.length > 0 && (
                    <PerformanceTable
                        data={currentPerformance}
                        title="Current Performance (Live)"
                        subtitle="Performance after backtest period (Dec 2025 onwards)"
                        indexOffset={0}
                    />
                )}

                {/* Divider */}
                <div className="border-t border-gray-300 my-12 relative">
                    <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-50 px-4 text-gray-500 font-medium">
                        Backtest Data
                    </span>
                </div>

                {/* 6. Backtest Metrics (Existing) */}
                <MetricsGrid metrics={metrics} />
                <DetailedMetrics
                    metrics={metrics}
                    title={`Backtest Metrics (${metrics.time_metrics.start} to ${metrics.time_metrics.end})`}
                />

                {/* 7. Equity Curve (Backtest) */}
                <PerformanceChart
                    data={backtestResults}
                    title="Equity Curve (Backtest Period)"
                />

                {/* 8. Backtest Performance Table */}
                <PerformanceTable
                    data={backtestResults}
                    title="Monthly Backtest Performance"
                    subtitle={`Historical performance from ${metrics.time_metrics.start} to ${metrics.time_metrics.end}`}
                    indexOffset={1000}
                />
            </div>
        </div>
    )
}

