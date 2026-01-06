'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, TrendingDown, Activity, ChevronDown, ChevronRight } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import backtestData from '@/data/backtest_results_simple_weekly.json'

export default function SimpleMomentumStrategyPage() {
    const [chartData, setChartData] = useState<any[]>([])
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

    const metrics = backtestData.backtest_metrics
    const backtestResults = backtestData.backtest_results
    const currentPerformance = backtestData.current_performance

    useEffect(() => {
        // Process backtest data for chart (cumulative returns)
        let portValue = 100000  // Start with 1 lakh
        let benchValue = 100000

        const sortedData = [...backtestResults].sort((a: any, b: any) =>
            new Date(a.week).getTime() - new Date(b.week).getTime()
        )

        const chartData = sortedData.map((item: any) => {
            portValue = portValue * (1 + item.portfolio_return / 100)
            benchValue = benchValue * (1 + item.benchmark_return / 100)
            return {
                week: item.week,
                Portfolio: parseFloat(portValue.toFixed(2)),
                Benchmark: parseFloat(benchValue.toFixed(2)),
                ...item
            }
        })

        setChartData(chartData)
    }, [])

    const toggleRow = (index: number) => {
        const newExpanded = new Set(expandedRows)
        if (newExpanded.has(index)) {
            newExpanded.delete(index)
        } else {
            newExpanded.add(index)
        }
        setExpandedRows(newExpanded)
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
                        <h1 className="text-3xl font-bold text-gray-900">Simple Momentum Strategy (Weekly Rebalancing)</h1>
                        <p className="text-gray-500 mt-1">
                            Buying Top 15 Simple Momentum Stocks (6M & 1Y only) • Weekly Rebalancing
                        </p>
                    </div>
                </div>

                {/* 1. Strategy Logic */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Strategy Logic</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <h3 className="font-semibold text-blue-900 mb-2">1. Selection</h3>
                            <p className="text-blue-800">
                                Select top 15 stocks with highest Simple Momentum Score.
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
                                Portfolio is rebalanced on <strong>every Friday</strong>.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 2. Key Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-sm text-gray-500 mb-1">Total Return</div>
                        <div className="text-3xl font-bold text-green-600">
                            {metrics.return_metrics.total_return.toFixed(2)}%
                        </div>
                        <div className="text-xs text-gray-400 mt-2">vs Benchmark: {metrics.return_metrics.benchmark_return.toFixed(2)}%</div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-sm text-gray-500 mb-1">Alpha (Outperformance)</div>
                        <div className="text-3xl font-bold text-green-600">
                            +{(metrics.return_metrics.total_return - metrics.return_metrics.benchmark_return).toFixed(2)}%
                        </div>
                        <div className="text-xs text-gray-400 mt-2">Over Nifty 50</div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-sm text-gray-500 mb-1">Win Rate</div>
                        <div className="text-3xl font-bold text-blue-600">
                            {metrics.trade_statistics.win_rate.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-400 mt-2">{Math.round(metrics.trade_statistics.total_trades * metrics.trade_statistics.win_rate / 100)} out of {metrics.trade_statistics.total_trades} weeks</div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-sm text-gray-500 mb-1">Sharpe Ratio</div>
                        <div className={`text-3xl font-bold ${metrics.risk_metrics.sharpe_ratio >= 1 ? 'text-green-600' : 'text-yellow-600'}`}>
                            {metrics.risk_metrics.sharpe_ratio.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-400 mt-2">Risk-adjusted return</div>
                    </div>
                </div>

                {/* 3. Current Performance Section (Dec 2025+) */}
                {currentPerformance && currentPerformance.length > 0 && (
                    <div className="bg-white shadow-sm rounded-lg border border-gray-200 mb-8">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
                            <h2 className="text-lg font-semibold text-gray-900">Current Performance (Live)</h2>
                            <p className="text-sm text-gray-600 mt-1">Performance after backtest period (Dec 2025 onwards)</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-900 font-medium">
                                    <tr className="text-right">
                                        <th className="px-6 py-4 w-12 text-left"></th>
                                        <th className="px-6 py-4 text-left">Week Ending Date</th>
                                        <th className="px-6 py-4">Portfolio Return</th>
                                        <th className="px-6 py-4">Benchmark (Nifty 50)</th>
                                        <th className="px-6 py-4">Excess Return</th>
                                        <th className="px-6 py-4 text-left">Holdings</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {currentPerformance.map((row: any, i) => {
                                        const excess = row.portfolio_return - row.benchmark_return
                                        const isExpanded = expandedRows.has(i)
                                        return (
                                            <>
                                                <tr key={i} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4">
                                                        <button
                                                            onClick={() => toggleRow(i)}
                                                            className="text-gray-400 hover:text-gray-600"
                                                        >
                                                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-4 font-medium text-gray-900">{row.week}</td>
                                                    <td className={`px-6 py-4 text-right font-medium ${row.portfolio_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {row.portfolio_return > 0 ? '+' : ''}{row.portfolio_return}%
                                                    </td>
                                                    <td className={`px-6 py-4 text-right ${row.benchmark_return >= 0 ? 'text-gray-900' : 'text-gray-600'}`}>
                                                        {row.benchmark_return > 0 ? '+' : ''}{row.benchmark_return}%
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${excess > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                            }`}>
                                                            {excess > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                                                            {excess.toFixed(2)}%
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-500 text-xs">
                                                        {row.holdings?.length || 0} stocks
                                                    </td>
                                                </tr>
                                                {isExpanded && row.holdings && (
                                                    <tr key={`${i}-expanded`}>
                                                        <td colSpan={6} className="px-6 py-4 bg-gray-50">
                                                            <div className="grid grid-cols-3 gap-2">
                                                                {row.holdings.map((holding: any, j: number) => (
                                                                    <div key={j} className="bg-white px-3 py-2 rounded border border-gray-200">
                                                                        <div className="flex justify-between items-center">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="font-medium text-gray-700">{holding.symbol}</span>
                                                                                {holding.score !== undefined && (
                                                                                    <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 rounded" title="Momentum Score">
                                                                                        {holding.score}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <span className={`font-medium text-sm ${holding.return === null ? 'text-gray-400' :
                                                                                holding.return >= 0 ? 'text-green-600' : 'text-red-600'
                                                                                }`}>
                                                                                {holding.return === null ? 'N/A' : `${holding.return > 0 ? '+' : ''}${holding.return}%`}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 4. Backtest Metrics Section */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Backtest Metrics ({metrics.time_metrics.start} to {metrics.time_metrics.end})</h2>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {/* Time Metrics */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Time Metrics</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-900">Start</span>
                                    <span className="text-sm font-medium text-gray-900">{metrics.time_metrics.start}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-900">End</span>
                                    <span className="text-sm font-medium text-gray-900">{metrics.time_metrics.end}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-900">Period</span>
                                    <span className="text-sm font-medium text-gray-900">{metrics.time_metrics.period}</span>
                                </div>
                            </div>
                        </div>

                        {/* Capital Metrics */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Capital Metrics</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-900">Start Value</span>
                                    <span className="text-sm font-medium text-gray-900">₹{metrics.capital_metrics.start_value}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-900">End Value</span>
                                    <span className="text-sm font-medium text-green-600">₹{metrics.capital_metrics.end_value.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-900">Total Fees</span>
                                    <span className="text-sm font-medium text-gray-900">₹{metrics.capital_metrics.total_fees_paid}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-900">Open Trade PnL</span>
                                    <span className="text-sm font-medium text-gray-900">₹{metrics.capital_metrics.open_trade_pnl}</span>
                                </div>
                            </div>
                        </div>

                        {/* Return Metrics */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Return Metrics</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-900">Total Return</span>
                                    <span className="text-sm font-medium text-green-600">{metrics.return_metrics.total_return.toFixed(2)}%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-900">Net Return (After Fees)</span>
                                    <span className="text-sm font-medium text-green-600 font-bold">{metrics.return_metrics.net_return_after_fees.toFixed(2)}%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-900">Benchmark Return</span>
                                    <span className="text-sm font-medium text-gray-900">{metrics.return_metrics.benchmark_return.toFixed(2)}%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-900">Expectancy</span>
                                    <span className="text-sm font-medium text-gray-900">{metrics.return_metrics.expectancy.toFixed(2)}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Risk Metrics */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Risk Metrics</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-900">Max Drawdown</span>
                                    <span className="text-sm font-medium text-red-600">{metrics.risk_metrics.max_drawdown.toFixed(2)}%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-900">Max DD Duration</span>
                                    <span className="text-sm font-medium text-gray-900">{metrics.risk_metrics.max_drawdown_duration} weeks</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-900">Sharpe Ratio</span>
                                    <span className={`text-sm font-medium ${metrics.risk_metrics.sharpe_ratio >= 1 ? 'text-green-600' : 'text-yellow-600'}`}>
                                        {metrics.risk_metrics.sharpe_ratio.toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-900">Calmar Ratio</span>
                                    <span className="text-sm font-medium text-gray-900">{metrics.risk_metrics.calmar_ratio.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-900">Omega Ratio</span>
                                    <span className="text-sm font-medium text-gray-900">{metrics.risk_metrics.omega_ratio.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-900">Sortino Ratio</span>
                                    <span className="text-sm font-medium text-gray-900">{metrics.risk_metrics.sortino_ratio.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Trade Statistics (Full Width) */}
                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Trade Statistics</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            <div className="bg-gray-50 p-3 rounded">
                                <div className="text-xs text-gray-900 mb-1">Rebalancing Periods</div>
                                <div className="text-lg font-semibold text-gray-900">{metrics.trade_statistics.total_trades}</div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded">
                                <div className="text-xs text-gray-900 mb-1">Stock Transactions</div>
                                <div className="text-lg font-semibold text-blue-600">{metrics.trade_statistics.total_stock_transactions}</div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded">
                                <div className="text-xs text-gray-900 mb-1">Win Rate</div>
                                <div className="text-lg font-semibold text-green-600">{metrics.trade_statistics.win_rate.toFixed(1)}%</div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded">
                                <div className="text-xs text-gray-900 mb-1">Best Trade</div>
                                <div className="text-lg font-semibold text-green-600">+{metrics.trade_statistics.best_trade.toFixed(2)}%</div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded">
                                <div className="text-xs text-gray-900 mb-1">Worst Trade</div>
                                <div className="text-lg font-semibold text-red-600">{metrics.trade_statistics.worst_trade.toFixed(2)}%</div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded">
                                <div className="text-xs text-gray-900 mb-1">Avg Win</div>
                                <div className="text-lg font-semibold text-green-600">+{metrics.trade_statistics.avg_winning_trade.toFixed(2)}%</div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded">
                                <div className="text-xs text-gray-900 mb-1">Avg Loss</div>
                                <div className="text-lg font-semibold text-red-600">{metrics.trade_statistics.avg_losing_trade.toFixed(2)}%</div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded">
                                <div className="text-xs text-gray-900 mb-1">Profit Factor</div>
                                <div className="text-lg font-semibold text-gray-900">{metrics.trade_statistics.profit_factor.toFixed(2)}</div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded">
                                <div className="text-xs text-gray-900 mb-1">Max Exposure</div>
                                <div className="text-lg font-semibold text-gray-900">{metrics.exposure_metrics.max_gross_exposure}%</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 5. Equity Curve Chart */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Equity Curve (Weekly Backtest Period)</h2>
                    <div className="h-[500px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="week"
                                    tick={{ fontSize: 11, fill: '#6b7280' }}
                                    tickLine={false}
                                    axisLine={{ stroke: '#d1d5db' }}
                                    minTickGap={40}
                                />
                                <YAxis
                                    tick={{ fontSize: 11, fill: '#6b7280' }}
                                    tickLine={false}
                                    axisLine={{ stroke: '#d1d5db' }}
                                    domain={['auto', 'auto']}
                                    tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#fff',
                                        borderRadius: '8px',
                                        border: '1px solid #e5e7eb',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                        padding: '12px'
                                    }}
                                    formatter={(value: any, name: string) => {
                                        const formattedValue = `₹${parseFloat(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                                        return [formattedValue, name]
                                    }}
                                    labelFormatter={(label) => `Week: ${label}`}
                                />
                                <Legend
                                    wrapperStyle={{ paddingTop: '20px' }}
                                    iconType="line"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="Portfolio"
                                    stroke="#2563eb"
                                    strokeWidth={3}
                                    dot={false}
                                    activeDot={{ r: 6, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                                    name="Simple Momentum Strategy"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="Benchmark"
                                    stroke="#9ca3af"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={false}
                                    activeDot={{ r: 5, fill: '#9ca3af', stroke: '#fff', strokeWidth: 2 }}
                                    name="Nifty 50"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 6. Backtest Performance Table */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900">Weekly Backtest Performance</h2>
                        <p className="text-sm text-gray-600 mt-1">Historical performance from {metrics.time_metrics.start} to {metrics.time_metrics.end}</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-900 font-medium">
                                <tr className="text-right">
                                    <th className="px-6 py-4 w-12 text-left"></th>
                                    <th className="px-6 py-4 text-left">Week Ending Date</th>
                                    <th className="px-6 py-4">Portfolio Return</th>
                                    <th className="px-6 py-4">Benchmark (Nifty 50)</th>
                                    <th className="px-6 py-4">Excess Return</th>
                                    <th className="px-6 py-4 text-left">Holdings</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {backtestResults.map((row: any, i) => {
                                    const excess = row.portfolio_return - row.benchmark_return
                                    const isExpanded = expandedRows.has(1000 + i) // Offset to avoid collision with current performance
                                    return (
                                        <>
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => toggleRow(1000 + i)}
                                                        className="text-gray-400 hover:text-gray-600"
                                                    >
                                                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 font-medium text-gray-900">{row.week}</td>
                                                <td className={`px-6 py-4 text-right font-medium ${row.portfolio_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {row.portfolio_return > 0 ? '+' : ''}{row.portfolio_return}%
                                                </td>
                                                <td className={`px-6 py-4 text-right ${row.benchmark_return >= 0 ? 'text-gray-900' : 'text-gray-600'}`}>
                                                    {row.benchmark_return > 0 ? '+' : ''}{row.benchmark_return}%
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${excess > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                        }`}>
                                                        {excess > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                                                        {excess.toFixed(2)}%
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 text-xs">
                                                    {row.holdings?.length || 0} stocks
                                                </td>
                                            </tr>
                                            {isExpanded && row.holdings && (
                                                <tr key={`${i}-expanded`}>
                                                    <td colSpan={6} className="px-6 py-4 bg-gray-50">
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {row.holdings.map((holding: any, j: number) => (
                                                                <div key={j} className="bg-white px-3 py-2 rounded border border-gray-200">
                                                                    <div className="flex justify-between items-center">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-medium text-gray-700">{holding.symbol}</span>
                                                                            {holding.score !== undefined && (
                                                                                <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 rounded" title="Momentum Score">
                                                                                    {holding.score}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <span className={`font-medium text-sm ${holding.return === null ? 'text-gray-400' :
                                                                            holding.return >= 0 ? 'text-green-600' : 'text-red-600'
                                                                            }`}>
                                                                            {holding.return === null ? 'N/A' : `${holding.return > 0 ? '+' : ''}${holding.return}%`}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
