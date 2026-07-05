import Link from 'next/link'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { notFound } from 'next/navigation'
import PercentageChange from '@/components/PercentageChange'
import StockChart from '@/components/StockChart'
import Pagination from '@/components/Pagination'
import Search from '@/components/Search'
import { PAGE_SIZE, SORTABLE_COLUMNS, PERFORMANCE_PERIODS, type SortableColumn } from '@/lib/constants'
import sectorIndexMap from '@/data/sector_index_map.json'

// industry -> sector index symbol (from app/sector_mapping.py, see
// scripts/export_sector_mapping.py). Build the reverse lookup once at
// module load: symbol -> industries mapped to it.
const INDUSTRIES_BY_SYMBOL = Object.entries(sectorIndexMap as Record<string, string>).reduce(
    (acc, [industry, symbol]) => {
        (acc[symbol] ??= []).push(industry)
        return acc
    },
    {} as Record<string, string[]>
)

export const dynamic = 'force-dynamic'

interface IndexDetailProps {
    params: Promise<{ symbol: string }>
    searchParams: Promise<{ page?: string; sort?: string; order?: string; query?: string }>
}

export default async function IndexDetailPage(props: IndexDetailProps) {
    const params = await props.params
    const symbol = decodeURIComponent(params.symbol)

    const searchParams = await props.searchParams
    const page = Number(searchParams.page) || 1
    // Default: most recent 1-week gainers on top.
    const sort = (searchParams.sort || 'change_1w') as SortableColumn
    const order = searchParams.order || 'desc'
    const query = searchParams.query || ''
    const skip = (page - 1) * PAGE_SIZE

    // Fetch Index data
    const marketIndex = await prisma.indices.findUnique({
        where: { symbol: symbol },
        include: {
            index_daily_prices: {
                orderBy: { date: 'asc' },
            },
            index_performance: true
        }
    })

    if (!marketIndex) {
        notFound()
    }

    // Stocks mapped to this sector via their `industry` classification (a
    // proxy for sector membership, not official index constituents - see
    // app/sector_mapping.py for how/why).
    const mappedIndustries = INDUSTRIES_BY_SYMBOL[symbol] ?? []

    const where: Prisma.stocksWhereInput = {
        is_active: true,
        industry: { in: mappedIndustries },
        ...(query ? {
            OR: [
                { nse_symbol: { contains: query, mode: 'insensitive' } },
                { name: { contains: query, mode: 'insensitive' } },
            ],
        } : {}),
    }

    const orderBy: Prisma.stocksOrderByWithRelationInput[] = SORTABLE_COLUMNS.includes(sort)
        ? [{ stock_performance: { [sort]: { sort: order, nulls: 'last' } } }, { nse_symbol: 'asc' }]
        : [{ nse_symbol: 'asc' }]

    const [totalCount, sectorStocks] = mappedIndustries.length > 0
        ? await Promise.all([
            prisma.stocks.count({ where }),
            prisma.stocks.findMany({
                where,
                take: PAGE_SIZE,
                skip,
                include: { stock_performance: true },
                orderBy,
            }),
        ])
        : [0, []]

    const totalPages = Math.ceil(totalCount / PAGE_SIZE)

    const prices = marketIndex.index_daily_prices
    const latestPrice = prices[prices.length - 1]

    const chartData = prices.map(p => ({
        date: p.date.toISOString(),
        close: p.close_price || 0,
        volume: Number(p.volume || 0)
    }))

    const perf = marketIndex.index_performance

    const SortIcon = ({ column }: { column: string }) => {
        if (sort !== column) return <span className="ml-1 text-gray-400">↕</span>
        return order === 'asc' ? <span className="ml-1 text-blue-600">↑</span> : <span className="ml-1 text-blue-600">↓</span>
    }

    const SortHeader = ({ column, label, align = 'left' }: { column: string; label: string; align?: string }) => {
        const newOrder = sort === column && order === 'desc' ? 'asc' : 'desc'
        const qp = query ? `&query=${encodeURIComponent(query)}` : ''
        return (
            <th className={`px-4 py-3 ${align === 'right' ? 'text-right' : ''}`}>
                <Link href={`/indices/${encodeURIComponent(symbol)}?page=${page}&sort=${column}&order=${newOrder}${qp}`} className="inline-flex items-center hover:text-blue-600 whitespace-nowrap">
                    {label}<SortIcon column={column} />
                </Link>
            </th>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">{symbol}</h1>
                            <p className="text-gray-600">{marketIndex.name || 'Market Index'}</p>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-gray-500 mb-1">Current Value</div>
                            <div className="text-3xl font-bold text-gray-900">
                                {latestPrice && latestPrice.close_price ? `₹${latestPrice.close_price.toFixed(2)}` : '-'}
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
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Chart</h2>
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

                {/* Stocks mapped to this sector */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
                        <h2 className="text-xl font-bold text-gray-900">Stocks in this Sector</h2>
                        <div className="w-full sm:w-64">
                            <Search placeholder="Search stocks..." />
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">
                        Stocks whose industry classification maps to {symbol} ({totalCount} stocks) —
                        an industry-based proxy, not official index constituents.
                    </p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 font-medium text-gray-700">Symbol</th>
                                    <th className="px-4 py-3 font-medium text-gray-700">Name</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-700">Market Cap</th>
                                    {PERFORMANCE_PERIODS.map((period) => (
                                        <SortHeader key={period.key} column={period.key} label={period.label} align="right" />
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {sectorStocks.length === 0 ? (
                                    <tr>
                                        <td colSpan={3 + PERFORMANCE_PERIODS.length} className="px-4 py-8 text-center text-gray-400">
                                            No stocks mapped to this sector yet.
                                        </td>
                                    </tr>
                                ) : sectorStocks.map((stock) => {
                                    const stockPerf = stock.stock_performance
                                    return (
                                        <tr key={stock.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 font-medium text-gray-900">
                                                <Link href={`/stock/${stock.nse_symbol}`} className="hover:underline text-blue-600">
                                                    {stock.nse_symbol}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 max-w-[220px] truncate" title={stock.name ?? undefined}>
                                                {stock.name}
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-600">
                                                {stock.market_cap
                                                    ? `₹${(Number(stock.market_cap) / 10_000_000).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`
                                                    : '-'}
                                            </td>
                                            {PERFORMANCE_PERIODS.map((period) => (
                                                <td key={period.key} className="px-4 py-3 text-right">
                                                    <PercentageChange value={stockPerf?.[period.key as keyof typeof stockPerf] as number | null | undefined} />
                                                </td>
                                            ))}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="mt-4 flex justify-between items-center">
                            <p className="text-sm text-gray-500">
                                Showing {totalCount > 0 ? skip + 1 : 0}-{Math.min(skip + PAGE_SIZE, totalCount)} of {totalCount}
                            </p>
                            <Pagination currentPage={page} totalPages={totalPages} sort={sort} order={order} basePath={`/indices/${encodeURIComponent(symbol)}`} query={query} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
