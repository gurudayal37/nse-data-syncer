'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, TrendingDown, Activity, Clock, Calendar } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import athData from '@/data/backtest_results_ath.json'

// Define types based on our JSON structure
type Trade = {
    symbol: string
    entry_date: string
    entry_price: number
    exit_date: string | null
    exit_price: number | null
    status: 'OPEN' | 'CLOSED'
    pnl: number
    pnl_pct: number
    duration_days: number
}

type Summary = {
    total_trades: number
    closed_trades: number
    active_trades: number
    win_rate: number
    total_pnl_abs: number
    avg_pnl_per_trade: number
    profit_factor?: number
    max_drawdown?: number
    avg_win?: number
    avg_loss?: number
}

type EquityPoint = {
    date: string
    equity: number
    pnl: number
}

type EligibleStock = {
    symbol: string
    breakout_month: string
    breakout_date: string
    entry_trigger: number
    previous_ath: number
    ath_date: string
    gap_days: number
    close_price: number
    current_price: number
    entry_month: string
}

export default function ATHStrategyPage() {
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL')
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 100

    const { summary, trades, last_updated, equity_curve, eligible_stocks } = athData as {
        summary: Summary,
        trades: Trade[],
        last_updated: string,
        equity_curve?: EquityPoint[],
        eligible_stocks?: EligibleStock[]
    }

    const filteredTrades = trades.filter(trade => {
        const matchesSearch = trade.symbol.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesStatus = statusFilter === 'ALL' || trade.status === statusFilter
        return matchesSearch && matchesStatus
    })

    const totalPages = Math.ceil(filteredTrades.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentTrades = filteredTrades.slice(startIndex, endIndex)

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage)
            const tableElement = document.getElementById('trades-table')
            if (tableElement) {
                tableElement.scrollIntoView({ behavior: 'smooth' })
            }
        }
    }

    if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(1)
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
                        <h1 className="text-3xl font-bold text-gray-900">ATH Breakout Strategy</h1>
                        <p className="text-gray-500 mt-1">
                            Buying All-Time High Breakouts with 2-Month Gap • Exit on Weekly Close &lt; 30-Week SMA
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Last Updated: {last_updated}</p>
                    </div>
                </div>

                {/* Strategy Logic Card */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Strategy Rules</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <h3 className="font-semibold text-blue-900 mb-2">1. Setup (Monthly)</h3>
                            <p className="text-blue-800">
                                Monthly Close &gt; Previous All-Time High.<br />
                                <span className="text-xs opacity-75">Condition: Previous ATH must be at least 2 months old.</span>
                            </p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                            <h3 className="font-semibold text-purple-900 mb-2">2. Entry (Daily)</h3>
                            <p className="text-purple-800">
                                Buy <b>Next Month</b> if Price breaks above the Setup Month's High.
                            </p>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                            <h3 className="font-semibold text-orange-900 mb-2">3. Exit (Weekly)</h3>
                            <p className="text-orange-800">
                                Check every Friday.<br />
                                Exit Monday Open if <b>Friday Close &lt; 30-Week SMA</b>.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Eligible Stocks - Waiting for Entry */}
                {eligible_stocks && eligible_stocks.length > 0 && (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 shadow-sm rounded-lg border-2 border-green-200 p-6 mb-8">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-green-500 p-2 rounded-lg">
                                <TrendingUp className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">
                                    Eligible Stocks - Waiting for Entry
                                </h2>
                                <p className="text-sm text-gray-600">
                                    {eligible_stocks.length} stock{eligible_stocks.length !== 1 ? 's' : ''} with recent breakout signals (Conditions 1 & 2 fulfilled)
                                </p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-white/60 text-gray-900 font-medium">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Symbol</th>
                                        <th className="px-4 py-3 text-left">Breakout Month</th>
                                        <th className="px-4 py-3 text-right">Entry Trigger</th>
                                        <th className="px-4 py-3 text-right">Current Price</th>
                                        <th className="px-4 py-3 text-right">Previous ATH</th>
                                        <th className="px-4 py-3 text-center">Gap (Days)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-green-100">
                                    {eligible_stocks.map((stock, i) => {
                                        const distanceToTrigger = stock.entry_trigger - stock.current_price
                                        const priceVsTrigger = ((stock.current_price - stock.entry_trigger) / stock.entry_trigger * 100).toFixed(2)

                                        return (
                                            <tr key={i} className="hover:bg-white/40 transition-colors">
                                                <td className="px-4 py-3">
                                                    <Link
                                                        href={`/stock/${stock.symbol}`}
                                                        className="font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                                                    >
                                                        {stock.symbol}
                                                    </Link>
                                                </td>
                                                <td className="px-4 py-3 text-gray-700">
                                                    <div>{stock.breakout_month}</div>
                                                    <div className="text-xs text-gray-500">Entry: {stock.entry_month}</div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-gray-900">
                                                    ₹{stock.entry_trigger.toLocaleString('en-IN')}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="font-medium text-gray-900">
                                                        ₹{stock.current_price.toLocaleString('en-IN')}
                                                    </div>
                                                    <div className="text-xs text-gray-600">
                                                        {distanceToTrigger > 0 ? (
                                                            <>₹{distanceToTrigger.toFixed(2)} below</>
                                                        ) : (
                                                            <>{priceVsTrigger}% vs trigger</>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-700">
                                                    <div>₹{stock.previous_ath.toLocaleString('en-IN')}</div>
                                                    <div className="text-xs text-gray-500">
                                                        {new Date(stock.ath_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                        {stock.gap_days}d
                                                    </span>
                                                </td>

                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-xs text-blue-900">
                                <strong>Note:</strong> These stocks have fulfilled conditions 1 & 2 (Monthly Close &gt; Previous ATH with 60+ day gap).
                                Entry is triggered when the daily high breaks above the entry trigger price during the entry month.
                            </p>
                        </div>
                    </div>
                )}

                {/* Main Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-sm text-gray-500 mb-1">Total PnL (1 Share)</div>
                        <div className={`text-3xl font-bold ${summary.total_pnl_abs >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ₹{summary.total_pnl_abs.toLocaleString('en-IN')}
                        </div>
                        <div className="text-xs text-gray-400 mt-2">Avg per trade: ₹{summary.avg_pnl_per_trade}</div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-sm text-gray-500 mb-1">Win Rate</div>
                        <div className="text-3xl font-bold text-blue-600">
                            {summary.win_rate}%
                        </div>
                        <div className="text-xs text-gray-400 mt-2">{summary.closed_trades} closed trades</div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-sm text-gray-500 mb-1">Profit Factor</div>
                        <div className="text-3xl font-bold text-indigo-600">
                            {summary.profit_factor || '-'}
                        </div>
                        <div className="text-xs text-gray-400 mt-2">Gross Win / Gross Loss</div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-sm text-gray-500 mb-1">Max Drawdown</div>
                        <div className="text-3xl font-bold text-red-600">
                            ₹{summary.max_drawdown?.toLocaleString('en-IN') || '-'}
                        </div>
                        <div className="text-xs text-gray-400 mt-2">Peak to Trough drop</div>
                    </div>
                </div>

                {/* Equity Curve */}
                {equity_curve && equity_curve.length > 0 && (
                    <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Equity Curve (Realized PnL)</h2>
                        <div className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={equity_curve}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(val) => new Date(val).getFullYear().toString()}
                                        minTickGap={30}
                                        style={{ fontSize: 12 }}
                                    />
                                    <YAxis
                                        tickFormatter={(val) => `₹${val / 1000}k`}
                                        style={{ fontSize: 12 }}
                                    />
                                    <Tooltip
                                        formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Total PnL']}
                                        labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="equity"
                                        stroke="#2563eb"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Advanced Stats Row 2 */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-sm text-gray-500 mb-1">Active Positions</div>
                        <div className="text-2xl font-bold text-gray-900">
                            {summary.active_trades}
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-sm text-gray-500 mb-1">Avg Win</div>
                        <div className="text-2xl font-bold text-green-600">
                            ₹{summary.avg_win?.toLocaleString('en-IN') || '-'}
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-sm text-gray-500 mb-1">Avg Loss</div>
                        <div className="text-2xl font-bold text-red-600">
                            ₹{summary.avg_loss?.toLocaleString('en-IN') || '-'}
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-sm text-gray-500 mb-1">Total Signals</div>
                        <div className="text-2xl font-bold text-gray-900">
                            {summary.total_trades}
                        </div>
                    </div>
                </div>

                {/* Trades Table */}
                <div id="trades-table" className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-4">
                        <h2 className="text-lg font-semibold text-gray-900">Trade History</h2>
                        <div className="flex gap-4">
                            <input
                                type="text"
                                placeholder="Search Symbol..."
                                className="px-3 py-2 border rounded text-sm"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value)
                                    setCurrentPage(1)
                                }}
                            />
                            <select
                                className="px-3 py-2 border rounded text-sm"
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value as any)
                                    setCurrentPage(1)
                                }}
                            >
                                <option value="ALL">All Status</option>
                                <option value="OPEN">Open</option>
                                <option value="CLOSED">Closed</option>
                            </select>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-900 font-medium">
                                <tr>
                                    <th className="px-6 py-4">Symbol</th>
                                    <th className="px-6 py-4">Entry</th>
                                    <th className="px-6 py-4">Exit</th>
                                    <th className="px-6 py-4 text-right">PnL (₹)</th>
                                    <th className="px-6 py-4 text-right">PnL (%)</th>
                                    <th className="px-6 py-4">Duration</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {currentTrades.map((trade, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            <Link href={`/stock/${trade.symbol}`} className="hover:text-blue-600 hover:underline">
                                                {trade.symbol}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-gray-900">{trade.entry_date}</div>
                                            <div className="text-xs text-gray-500">₹{trade.entry_price}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {trade.exit_date ? (
                                                <>
                                                    <div className="text-gray-900">{trade.exit_date}</div>
                                                    <div className="text-xs text-gray-500">₹{trade.exit_price}</div>
                                                </>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className={`px-6 py-4 text-right font-medium ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {trade.pnl > 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${trade.pnl_pct >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {trade.pnl_pct > 0 ? '+' : ''}{trade.pnl_pct.toFixed(2)}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {trade.duration_days} days
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${trade.status === 'OPEN' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                {trade.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {filteredTrades.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                            No trades found matching your filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                            <div className="text-sm text-gray-500">
                                Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, filteredTrades.length)}</span> of <span className="font-medium">{filteredTrades.length}</span> results
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className={`px-3 py-1 rounded border text-sm ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-50 text-gray-700'}`}
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className={`px-3 py-1 rounded border text-sm ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-50 text-gray-700'}`}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
