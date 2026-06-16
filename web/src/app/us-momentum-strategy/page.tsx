'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import backtestData from '@/data/backtest_results_us_momentum.json'

import MetricsGrid from '@/components/strategy/MetricsGrid'
import DetailedMetrics from '@/components/strategy/DetailedMetrics'
import PerformanceChart from '@/components/strategy/PerformanceChart'
import PerformanceTable from '@/components/strategy/PerformanceTable'
import CagrCards from '@/components/strategy/CagrCards'
import YearlyReturnsTable from '@/components/strategy/YearlyReturnsTable'
import KeyInsights from '@/components/strategy/KeyInsights'

export default function USMomentumStrategyPage() {
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
                        <h1 className="text-3xl font-bold text-gray-900">US Momentum Strategy</h1>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-blue-800">
                        <p className="font-semibold mb-2">Backtest not yet run</p>
                        <p className="text-sm font-mono">python3 scripts/backtest_us_momentum.py</p>
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
                        <h1 className="text-3xl font-bold text-gray-900">US Momentum Strategy</h1>
                        <p className="text-gray-500 mt-1">
                            Russell 1000 Universe · 3M + 6M + 1Y Vol-Adjusted · Top 15 Stocks · Monthly Rebalancing · No Stop-Loss
                        </p>
                    </div>
                </div>

                {/* Strategy Logic */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Strategy Logic</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <h3 className="font-semibold text-blue-900 mb-2">1. Universe</h3>
                            <p className="text-blue-800">Russell 1000 large- and mid-cap universe (~1000 stocks). OHLCV data via yfinance (auto-adjusted for splits &amp; dividends). Universe refreshed periodically from latest Russell-1000 CSV.</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                            <h3 className="font-semibold text-purple-900 mb-2">2. Scoring</h3>
                            <p className="text-purple-800">Volatility-adjusted returns over <strong>3M, 6M, and 1Y</strong> (equal weight), z-scored across the universe each month.</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                            <h3 className="font-semibold text-green-900 mb-2">3. Selection</h3>
                            <p className="text-green-800">Top 15 stocks by composite momentum score. Equal-weighted (6.67% each). Rebalanced on the first trading day of each month.</p>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                            <h3 className="font-semibold text-orange-900 mb-2">4. Benchmark</h3>
                            <p className="text-orange-800">S&amp;P 500 Total Return. Returns computed in USD. No currency hedging modelled.</p>
                        </div>
                    </div>
                </div>

                {/* Current Performance */}
                {currentMetrics && (
                    <div className="mb-12">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-2 h-8 bg-green-500 rounded-full" />
                            <h2 className="text-2xl font-bold text-gray-900">Current Performance (Live)</h2>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200 ml-2">Jan 2026 Onwards</span>
                        </div>
                        <MetricsGrid metrics={currentMetrics} />
                        <CagrCards monthlyData={currentAsc} label="Annualised from live period" />
                        <DetailedMetrics metrics={currentMetrics} title={`Current Metrics (${currentMetrics.time_metrics.start} to ${currentMetrics.time_metrics.end})`} />
                        <YearlyReturnsTable monthlyData={currentAsc} />
                        <div className="mt-8">
                            <PerformanceChart data={currentAsc} title="Equity Curve (Live Period)" showBenchmark={true} benchmarkName="S&P 500" />
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

                {/* Backtest */}
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
                        <PerformanceChart data={backtestAsc} title="Historical Equity Curve" showBenchmark={true} benchmarkName="S&P 500" />
                    </div>
                    <div className="mt-8">
                        <PerformanceTable data={backtestDesc} title="Monthly Backtest Returns" />
                    </div>
                </div>

                <KeyInsights monthlyData={backtestAsc} />

                <div className="mt-12 bg-orange-50 border border-orange-200 rounded-lg p-5">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                        <div>
                            <h3 className="text-sm font-semibold text-orange-900 mb-2">Backtest Audit</h3>
                            <ul className="text-sm text-orange-800 space-y-1.5 list-disc list-inside">
                                <li><strong>Survivorship bias:</strong> Uses current Russell 1000 constituents for the full history. Companies that were delisted, acquired, or removed from the index are excluded retroactively — this inflates backtest returns.</li>
                                <li><strong>No slippage or market impact.</strong> Monthly rebalancing at next-day open prices. Real execution on 15 large-caps would be near-frictionless.</li>
                                <li><strong>Auto-adjusted prices:</strong> yfinance applies split and dividend adjustments retroactively, which can cause small discrepancies vs real historical prices.</li>
                                <li><strong>USD only.</strong> No currency conversion or hedging costs modelled for non-US investors.</li>
                            </ul>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
