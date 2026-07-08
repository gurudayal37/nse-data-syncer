import prisma from '@/lib/prisma'
import { notFound } from 'next/navigation'
import PercentageChange from '@/components/PercentageChange'
import StockChart from '@/components/StockChart'
import { PERFORMANCE_PERIODS } from '@/lib/constants'

export const dynamic = 'force-dynamic'

interface SMEDetailProps {
    params: Promise<{ symbol: string }>
}

export default async function SMEDetailPage(props: SMEDetailProps) {
    const params = await props.params
    const symbol = params.symbol

    const sme = await prisma.sme_stocks.findUnique({
        where: { symbol: symbol },
        include: {
            sme_daily_prices: {
                orderBy: { date: 'asc' },
            },
            sme_performance: true
        }
    })

    if (!sme) {
        notFound()
    }

    const latestPrice = sme.sme_daily_prices[sme.sme_daily_prices.length - 1]
    const chartData = sme.sme_daily_prices.map(p => ({
        date: p.date.toISOString(),
        close: p.close_price || 0,
        volume: Number(p.volume || 0)
    }))
    const perf = sme.sme_performance

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">{symbol}</h1>
                            <p className="text-gray-600">{sme.name || 'SME Stock'}</p>
                            <p className="text-xs text-gray-400 mt-1">NSE SME Board{sme.series ? ` · Series ${sme.series}` : ''}</p>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-gray-500 mb-1">Current Price</div>
                            <div className="text-3xl font-bold text-gray-900">
                                {latestPrice?.close_price ? `₹${latestPrice.close_price.toFixed(2)}` : '-'}
                            </div>
                            {latestPrice && (
                                <div className="text-sm text-gray-500 mt-1">
                                    as of {new Date(latestPrice.date).toLocaleDateString()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Chart Section */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Price History</h2>
                    <div className="h-[400px]">
                        <StockChart data={chartData} />
                    </div>
                </div>

                {/* Performance Metrics */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Performance Metrics</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                        {PERFORMANCE_PERIODS.map((period) => {
                            const value = perf?.[period.key as keyof typeof perf] as number | null | undefined
                            return (
                                <div key={period.key} className="text-center p-4 bg-gray-50 rounded-lg">
                                    <div className="text-sm text-gray-500 mb-2">{period.label}</div>
                                    <PercentageChange value={value} className="text-lg font-bold" />
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Additional Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">SME Stock Information</h2>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Symbol</span>
                                <span className="font-medium text-gray-900">{symbol}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Name</span>
                                <span className="font-medium text-gray-900">{sme.name || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">ISIN</span>
                                <span className="font-medium text-gray-900">{sme.isin || '-'}</span>
                            </div>
                            {perf?.daily_volume && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Daily Volume</span>
                                    <span className="font-medium text-gray-900">{perf.daily_volume.toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Latest OHLC</h2>
                        {latestPrice ? (
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Open</span>
                                    <span className="font-medium text-gray-900">₹{latestPrice.open_price?.toFixed(2) || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">High</span>
                                    <span className="font-medium text-green-600">₹{latestPrice.high_price?.toFixed(2) || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Low</span>
                                    <span className="font-medium text-red-600">₹{latestPrice.low_price?.toFixed(2) || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Close</span>
                                    <span className="font-medium text-gray-900">₹{latestPrice.close_price?.toFixed(2) || '-'}</span>
                                </div>
                                {latestPrice.volume && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Volume</span>
                                        <span className="font-medium text-gray-900">{latestPrice.volume.toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-gray-500">No price data available</p>
                        )}
                    </div>
                </div>

                {/* Recent Price History */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Price History</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-gray-700">Date</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-700">Open</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-700">High</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-700">Low</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-700">Close</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-700">Volume</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {[...sme.sme_daily_prices].reverse().slice(0, 20).map((price) => (
                                    <tr key={price.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-gray-900">
                                            {new Date(price.date).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-900">₹{price.open_price?.toFixed(2) || '-'}</td>
                                        <td className="px-4 py-3 text-right text-green-600">₹{price.high_price?.toFixed(2) || '-'}</td>
                                        <td className="px-4 py-3 text-right text-red-600">₹{price.low_price?.toFixed(2) || '-'}</td>
                                        <td className="px-4 py-3 text-right font-medium text-gray-900">₹{price.close_price?.toFixed(2) || '-'}</td>
                                        <td className="px-4 py-3 text-right text-gray-600">
                                            {price.volume ? price.volume.toLocaleString() : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
