import prisma from '@/lib/prisma'
import StockChart from '@/components/StockChart'
import PercentageChange from '@/components/PercentageChange'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import type { NewsItem } from '@/types/stock'

export const dynamic = 'force-dynamic'


export default async function StockPage(props: { params: Promise<{ symbol: string }> }) {
    const params = await props.params
    const { symbol } = params

    const decodedSymbol = decodeURIComponent(symbol)

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

    const chartData = stock.daily_prices.map((p: { date: Date; close_price: number }) => ({
        date: new Date(p.date).toISOString(),
        close: p.close_price,
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

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    {/* Chart Section */}
                    <div className="lg:col-span-2 bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Price History</h2>
                        <div className="h-[400px]">
                            <StockChart data={chartData} />
                        </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance</h2>
                        <div className="space-y-4">
                            {performanceMetrics.map((metric) => (
                                <div key={metric.label} className="flex justify-between items-center py-2 border-b border-gray-50">
                                    <span className="text-gray-500">{metric.label}</span>
                                    <PercentageChange value={metric.value} className="font-medium" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

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
            </div>
        </div>
    )
}
