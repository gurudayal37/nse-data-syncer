'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, TrendingDown, Activity, ChevronDown, ChevronRight } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import backtestData from '@/data/backtest_results_simple.json'

export default function SimpleMomentumStrategyPage() {
    const [data, setData] = useState<any[]>([])
    const [summary, setSummary] = useState<any>({})
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

    useEffect(() => {
        // Process data for chart (cumulative returns)
        let portValue = 100
        let benchValue = 100

        // Ensure data is sorted by month ASCENDING (Oldest First) for cumulative calculation
        const sortedRawData = [...backtestData].sort((a: any, b: any) =>
            new Date(a.month).getTime() - new Date(b.month).getTime()
        )

        const chartData = sortedRawData.map((item: any) => {
            portValue = portValue * (1 + item.portfolio_return / 100)
            benchValue = benchValue * (1 + item.benchmark_return / 100)
            return {
                month: item.month,
                Portfolio: parseFloat(portValue.toFixed(2)),
                Benchmark: parseFloat(benchValue.toFixed(2)),
                ...item
            }
        })

        setData(chartData)

        // Calculate Summary Stats from the full dataset
        const totalMonths = backtestData.length
        const winningMonths = backtestData.filter((d: any) => d.portfolio_return > d.benchmark_return).length
        const totalPortReturn = ((portValue - 100) / 100) * 100
        const totalBenchReturn = ((benchValue - 100) / 100) * 100

        setSummary({
            totalMonths,
            winningMonths,
            winRate: totalMonths > 0 ? (winningMonths / totalMonths * 100).toFixed(1) : 0,
            totalPortReturn: totalPortReturn.toFixed(2),
            totalBenchReturn: totalBenchReturn.toFixed(2),
            outperformance: (totalPortReturn - totalBenchReturn).toFixed(2)
        })
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
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Simple Momentum Strategy</h1>
                        <p className="text-gray-500 mt-1">
                            Buying Top 15 Simple Momentum Stocks (6M & 1Y only) • Monthly Rebalancing
                        </p>
                    </div>
                </div>

                {/* Strategy Description */}
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
                                Portfolio is rebalanced on the <strong>1st of every month</strong>.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Performance Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-sm text-gray-500 mb-1">Total Return (Since 2017)</div>
                        <div className={`text-3xl font-bold ${parseFloat(summary.totalPortReturn) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {summary.totalPortReturn}%
                        </div>
                        <div className="text-xs text-gray-400 mt-2">vs Benchmark: {summary.totalBenchReturn}%</div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-sm text-gray-500 mb-1">Alpha (Outperformance)</div>
                        <div className={`text-3xl font-bold ${parseFloat(summary.outperformance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {summary.outperformance > 0 ? '+' : ''}{summary.outperformance}%
                        </div>
                        <div className="text-xs text-gray-400 mt-2">Over Nifty 50</div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-sm text-gray-500 mb-1">Win Rate (Months)</div>
                        <div className="text-3xl font-bold text-blue-600">
                            {summary.winRate}%
                        </div>
                        <div className="text-xs text-gray-400 mt-2">{summary.winningMonths} out of {summary.totalMonths} months</div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-sm text-gray-500 mb-1">Current Status</div>
                        <div className="flex items-center gap-2 mt-1">
                            <Activity className="w-5 h-5 text-green-500" />
                            <span className="font-medium text-gray-900">Active</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-2">Last rebalanced: {data.length > 0 ? data[data.length - 1].month : '-'}</div>
                    </div>
                </div>

                {/* Chart */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Equity Curve (Rebased to 100)</h2>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis
                                    dataKey="month"
                                    tick={{ fontSize: 12, fill: '#6b7280' }}
                                    tickLine={false}
                                    axisLine={false}
                                    minTickGap={30}
                                />
                                <YAxis
                                    tick={{ fontSize: 12, fill: '#6b7280' }}
                                    tickLine={false}
                                    axisLine={false}
                                    domain={['auto', 'auto']}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="Portfolio"
                                    stroke="#2563eb"
                                    strokeWidth={3}
                                    dot={false}
                                    activeDot={{ r: 6 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="Benchmark"
                                    stroke="#9ca3af"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Monthly Table */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900">Monthly Breakdown</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-900 font-medium">
                                <tr className="text-right">
                                    <th className="px-6 py-4 w-12 text-left"></th>
                                    <th className="px-6 py-4 text-left">Month</th>
                                    <th className="px-6 py-4">Portfolio Return</th>
                                    <th className="px-6 py-4">Benchmark (Nifty 50)</th>
                                    <th className="px-6 py-4">Excess Return</th>
                                    <th className="px-6 py-4 text-left">Holdings</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {[...data].reverse().map((row: any, i) => {
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
                                                <td className="px-6 py-4 font-medium text-gray-900">{row.month}</td>
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
