import prisma from '@/lib/prisma'
import StockChart from '@/components/StockChart'
import MomentumChart from '@/components/MomentumChart'
import PercentageChange from '@/components/PercentageChange'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import type { NewsItem } from '@/types/stock'
import athData from '@/data/backtest_results_ath.json'
import simpleData from '@/data/backtest_results_simple.json'

export const dynamic = 'force-dynamic'


export default async function StockPage(props: { params: Promise<{ symbol: string }> }) {
    const params = await props.params
    const { symbol } = params

    const decodedSymbol = decodeURIComponent(symbol)

    // Filter Strategy Data
    const athTrades = (athData.trades || []).filter((t: any) => t.symbol === decodedSymbol)

    // Filter Simple Momentum Data
    // We need to iterate over all monthly results and check 'holdings'
    const momentumTrades: any[] = []

    // Check backtest results
    if (simpleData.backtest_results) {
        simpleData.backtest_results.forEach((month: any) => {
            const holding = month.holdings.find((h: any) => h.symbol === decodedSymbol)
            if (holding) {
                momentumTrades.push({
                    month: month.month,
                    return: holding.return,
                    score: holding.score
                })
            }
        })
    }

    // Check current performance (live/forward test data)
    if ((simpleData as any).current_performance) {
        (simpleData as any).current_performance.forEach((month: any) => {
            const holding = month.holdings.find((h: any) => h.symbol === decodedSymbol)
            if (holding) {
                momentumTrades.push({
                    month: month.month,
                    return: holding.return, // might be null if current month open?
                    score: holding.score
                })
            }
        })
    }

    // Sort reverse chronological
    momentumTrades.sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())

    const stock = await prisma.stocks.findFirst({
        where: { nse_symbol: decodedSymbol },
        include: {
            daily_prices: {
                orderBy: { date: 'asc' },
            },
            stock_performance: true,
            news: {
                orderBy: { published_date: 'desc' },
                take: 10
            }
        },
    })

    if (!stock) {
        notFound()
    }

    const chartData = stock.daily_prices.map((p: any) => ({
        date: p.date.toISOString(),
        close: p.close_price,
        volume: Number(p.volume || 0)
    }))

    // Fetch momentum history
    const momentumHistory = await prisma.momentum_history.findMany({
        where: {
            stock_id: stock.id
        },
        orderBy: {
            date: 'asc'
        },
        select: {
            date: true,
            momentum_score: true,
            rank: true
        }
    })

    const momentumChartData = momentumHistory.map((h: any) => ({
        date: h.date.toISOString(),
        score: h.momentum_score || 0,
        rank: h.rank || 0
    }))
    const latest = stock.daily_prices[stock.daily_prices.length - 1]
    const perf = stock.stock_performance

    const performanceMetrics = [
        { label: '1 Week', value: perf?.change_1w },
        { label: '1 Month', value: perf?.change_1m },
        { label: '3 Months', value: perf?.change_3m },
        { label: '6 Months', value: perf?.change_6m },
        { label: '1 Year', value: perf?.change_1y },
        { label: '3 Years', value: perf?.change_3y },
        { label: '5 Years', value: perf?.change_5y },
    ]

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                <Link href="/" className="inline-flex items-center text-gray-500 hover:text-gray-900 mb-6">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                </Link>

                {/* Header Section */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">{stock.nse_symbol}</h1>
                            <p className="text-gray-500 mt-1 text-lg">{stock.name}</p>
                            <div className="flex gap-4 mt-4 text-sm text-gray-600">
                                {stock.market_cap && (
                                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full flex items-center font-medium">
                                        <span className="mr-1">M.Cap:</span>
                                        ₹{Math.round(Number(stock.market_cap) / 10000000).toLocaleString('en-IN')} Cr
                                    </span>
                                )}
                                {stock.sector && (
                                    <span className="bg-gray-100 px-3 py-1 rounded-full">
                                        Sector: {stock.sector}
                                    </span>
                                )}
                                {stock.subsector && (
                                    <span className="bg-gray-100 px-3 py-1 rounded-full">
                                        Industry: {stock.subsector}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-4xl font-bold text-gray-900">
                                {latest ? `₹${latest.close_price?.toFixed(2)}` : '-'}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                                {latest ? new Date(latest.date).toLocaleDateString() : '-'}
                            </p>
                        </div>
                    </div>

                    {stock.long_business_summary && (
                        <div className="mt-6 border-t border-gray-100 pt-4">
                            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2">Overview</h3>
                            <p className="text-gray-600 leading-relaxed text-sm">
                                {stock.long_business_summary}
                            </p>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    {/* Chart Section */}
                    <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Price History</h2>
                        <div className="h-[400px]">
                            <StockChart data={chartData} />
                        </div>
                    </div>

                    {/* Momentum History Chart */}
                    {momentumChartData.length > 0 && (
                        <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Momentum Score History</h2>
                            <MomentumChart data={momentumChartData} />
                        </div>
                    )}

                    {/* Performance Table */}
                    <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance</h2>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                <span className="text-gray-500">1 Week</span>
                                <PercentageChange value={perf?.change_1w} />
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                <span className="text-gray-500">1 Month</span>
                                <PercentageChange value={perf?.change_1m} />
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                <span className="text-gray-500">3 Months</span>
                                <PercentageChange value={perf?.change_3m} />
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                <span className="text-gray-500">6 Months</span>
                                <PercentageChange value={perf?.change_6m} />
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                <span className="text-gray-500">1 Year</span>
                                <PercentageChange value={perf?.change_1y} />
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                <span className="text-gray-500">3 Years</span>
                                <PercentageChange value={perf?.change_3y} />
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                <span className="text-gray-500">5 Years</span>
                                <PercentageChange value={perf?.change_5y} />
                            </div>
                        </div>
                    </div>

                    {/* Momentum Score Card */}
                    <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">Momentum Score</h2>
                        <div className="flex items-end gap-2">
                            <span className={`text-4xl font-bold ${(perf?.momentum_score || 0) >= 2 ? 'text-green-600' :
                                (perf?.momentum_score || 0) >= 1 ? 'text-blue-600' : 'text-gray-600'
                                }`}>
                                {perf?.momentum_score ? perf.momentum_score.toFixed(2) : '-'}
                            </span>
                            <span className="text-sm text-gray-500 mb-1">/ 10.0</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Based on volatility-adjusted returns (3M, 6M, 1Y) relative to the market.
                        </p>

                        {/* Mini Calculation Details */}
                        {perf?.volatility && (
                            <div className="mt-4 pt-4 border-t border-gray-100 text-sm">
                                <div className="flex justify-between py-1">
                                    <span className="text-gray-500">Volatility (1Y)</span>
                                    <span className="font-medium">{(perf.volatility * 100).toFixed(2)}%</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Momentum Calculation Details */}
                    {perf?.mr_3m && (
                        <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Momentum Calculation Breakdown</h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-gray-600">
                                    <thead className="bg-gray-50 text-gray-900 font-medium">
                                        <tr>
                                            <th className="px-4 py-2">Period</th>
                                            <th className="px-4 py-2 text-right">Return</th>
                                            <th className="px-4 py-2 text-right">Volatility (Ann.)</th>
                                            <th className="px-4 py-2 text-right">Momentum Ratio</th>
                                            <th className="px-4 py-2 text-right">Z-Score</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        <tr>
                                            <td className="px-4 py-2 font-medium">3 Months</td>
                                            <td className="px-4 py-2 text-right">{perf.change_3m?.toFixed(2)}%</td>
                                            <td className="px-4 py-2 text-right">{(perf.volatility! * 100).toFixed(2)}%</td>
                                            <td className="px-4 py-2 text-right">{perf.mr_3m?.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-right">{perf.z_3m?.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-2 font-medium">6 Months</td>
                                            <td className="px-4 py-2 text-right">{perf.change_6m?.toFixed(2)}%</td>
                                            <td className="px-4 py-2 text-right">{(perf.volatility! * 100).toFixed(2)}%</td>
                                            <td className="px-4 py-2 text-right">{perf.mr_6m?.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-right">{perf.z_6m?.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-2 font-medium">1 Year</td>
                                            <td className="px-4 py-2 text-right">{perf.change_1y?.toFixed(2)}%</td>
                                            <td className="px-4 py-2 text-right">{(perf.volatility! * 100).toFixed(2)}%</td>
                                            <td className="px-4 py-2 text-right">{perf.mr_1y?.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-right">{perf.z_1y?.toFixed(2)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* News Section */}
                    <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Latest News</h2>
                        {stock.news && stock.news.length > 0 ? (
                            <div className="grid gap-4">
                                {stock.news.map((item: NewsItem) => (
                                    <div key={item.id} className="border-b border-gray-50 last:border-0 pb-4 last:pb-0">
                                        <div className="flex justify-between items-start gap-4">
                                            <div>
                                                <h3 className="font-medium text-gray-900 mb-1">
                                                    {item.url ? (
                                                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline">
                                                            {item.title}
                                                        </a>
                                                    ) : (
                                                        item.title
                                                    )}
                                                </h3>
                                                <p className="text-sm text-gray-500 line-clamp-2">{item.content}</p>
                                            </div>
                                            <span className="text-xs text-gray-400 whitespace-nowrap">
                                                {new Date(item.published_date).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm italic">No recent news available for this stock.</p>
                        )}
                    </div>

                    {/* ATH Strategy History */}
                    <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">ATH Strategy History</h2>
                        {athTrades.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-900 font-medium">
                                        <tr>
                                            <th className="px-6 py-4">Entry Date</th>
                                            <th className="px-6 py-4">Entry Price</th>
                                            <th className="px-6 py-4">Exit Date</th>
                                            <th className="px-6 py-4">Exit Price</th>
                                            <th className="px-6 py-4 text-center">Status</th>
                                            <th className="px-6 py-4 text-right">PnL</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {athTrades.map((trade: any, i: number) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 text-gray-900">{trade.entry_date}</td>
                                                <td className="px-6 py-4 text-gray-900">₹{trade.entry_price}</td>
                                                <td className="px-6 py-4 text-gray-900">{trade.exit_date || '-'}</td>
                                                <td className="px-6 py-4 text-gray-900">{trade.exit_price ? `₹${trade.exit_price}` : '-'}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${trade.status === 'OPEN' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {trade.status}
                                                    </span>
                                                </td>
                                                <td className={`px-6 py-4 text-right font-medium ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {trade.pnl > 0 ? '+' : ''}{trade.pnl.toFixed(2)} ({trade.pnl_pct.toFixed(2)}%)
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm italic">No trades found for this stock in ATH Strategy.</p>
                        )}
                    </div>

                    {/* Simple Momentum History */}
                    <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Simple Momentum Strategy History</h2>
                        {momentumTrades.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-900 font-medium">
                                        <tr>
                                            <th className="px-6 py-4">Month</th>
                                            <th className="px-6 py-4">Momentum Score</th>
                                            <th className="px-6 py-4 text-right">Monthly Return</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {momentumTrades.map((trade: any, i: number) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 text-gray-900">{trade.month}</td>
                                                <td className="px-6 py-4 text-gray-900">{trade.score.toFixed(2)}</td>
                                                <td className={`px-6 py-4 text-right font-medium ${trade.return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {trade.return > 0 ? '+' : ''}{trade.return.toFixed(2)}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm italic">This stock was never selected in Simple Momentum Strategy.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
