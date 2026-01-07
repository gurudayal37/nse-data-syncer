import prisma from '@/lib/prisma'
import Link from 'next/link'
import PercentageChange from '@/components/PercentageChange'
import { ArrowLeft, ArrowUpDown } from 'lucide-react'

export const dynamic = 'force-dynamic'

type SortField = 'nse_symbol' | 'name' | 'simple_momentum_score' | 'change_1w' | 'change_1m' | 'change_3m' | 'change_6m' | 'change_1y'
type SortOrder = 'asc' | 'desc'

interface PageProps {
    searchParams: Promise<{
        page?: string
        sort?: string
        order?: string
    }>
}

export default async function SimpleMomentumPage(props: PageProps) {
    const searchParams = await props.searchParams
    const page = Number(searchParams.page) || 1
    const sort = (searchParams.sort as SortField) || 'simple_momentum_score'
    const order = (searchParams.order as SortOrder) || 'desc'
    const limit = 50
    const skip = (page - 1) * limit

    const minMarketCapCr = Number(process.env.MIN_MARKET_CAP_CR || 500)
    const minMarketCap = minMarketCapCr * 10000000

    // Construct orderBy for Prisma
    let orderBy: any = {}
    if (sort === 'nse_symbol' || sort === 'name') {
        orderBy[sort] = order
    } else {
        // Sort by related stock_performance
        orderBy.stock_performance = {
            [sort]: {
                sort: order,
                nulls: 'last'
            }
        }
    }

    // Secondary sort to ensure stable pagination
    const orderByArray = [orderBy]
    if (sort !== 'nse_symbol') {
        orderByArray.push({ nse_symbol: 'asc' })
    }

    const [stocks, totalCount] = await Promise.all([
        prisma.stocks.findMany({
            where: {
                is_active: true,
                market_cap: {
                    gte: minMarketCap
                },
                stock_performance: {
                    isNot: null
                }
            },
            include: {
                stock_performance: true,
            },
            orderBy: orderByArray,
            take: limit,
            skip: skip,
        }),
        prisma.stocks.count({
            where: {
                is_active: true,
                market_cap: {
                    gte: minMarketCap
                },
                stock_performance: {
                    isNot: null
                }
            }
        }),
    ])

    const totalPages = Math.ceil(totalCount / limit)

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sort !== field) return <ArrowUpDown className="w-4 h-4 text-gray-300" />
        return <ArrowUpDown className={`w-4 h-4 ${order === 'asc' ? 'text-blue-600 rotate-180' : 'text-blue-600'}`} />
    }

    const SortHeader = ({ field, label, align = 'right' }: { field: SortField, label: string, align?: 'left' | 'right' }) => {
        const newOrder = sort === field && order === 'desc' ? 'asc' : 'desc'
        return (
            <Link
                href={`/simple-momentum?page=${page}&sort=${field}&order=${newOrder}`}
                className={`flex items-center gap-1 hover:bg-gray-50 py-1 px-2 rounded cursor-pointer group ${align === 'right' ? 'justify-end' : ''}`}
            >
                <span className="font-semibold text-gray-600 group-hover:text-gray-900">{label}</span>
                <SortIcon field={field} />
            </Link>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-[95%] mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                            <ArrowLeft className="w-6 h-6 text-gray-600" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Simple Momentum Dashboard</h1>
                            <p className="text-gray-500 mt-1">Top stocks ranked by simple momentum (6M + 1Y only)</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-900 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 w-[120px]">
                                        <SortHeader field="nse_symbol" label="Symbol" align="left" />
                                    </th>
                                    <th className="px-6 py-4 w-[250px]">
                                        <SortHeader field="name" label="Company Name" align="left" />
                                    </th>
                                    <th className="px-6 py-4 text-right">
                                        <span className="font-semibold text-gray-600">Market Cap</span>
                                    </th>
                                    <th className="px-6 py-4 text-right">
                                        <SortHeader field="simple_momentum_score" label="Simple Score" />
                                    </th>
                                    <th className="px-6 py-4 text-right">
                                        <SortHeader field="change_1w" label="1W %" />
                                    </th>
                                    <th className="px-6 py-4 text-right">
                                        <SortHeader field="change_1m" label="1M %" />
                                    </th>
                                    <th className="px-6 py-4 text-right">
                                        <SortHeader field="change_3m" label="3M %" />
                                    </th>
                                    <th className="px-6 py-4 text-right">
                                        <SortHeader field="change_6m" label="6M %" />
                                    </th>
                                    <th className="px-6 py-4 text-right">
                                        <SortHeader field="change_1y" label="1Y %" />
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {stocks.map((stock) => {
                                    const perf = stock.stock_performance
                                    return (
                                        <tr key={stock.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                <Link href={`/stock/${stock.nse_symbol}`} className="hover:text-blue-600 hover:underline">
                                                    {stock.nse_symbol}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 truncate max-w-[250px]" title={stock.name}>
                                                {stock.name}
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-600">
                                                {stock.market_cap ? `₹${Math.round(Number(stock.market_cap) / 10000000).toLocaleString('en-IN')} Cr` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {perf?.simple_momentum_score ? (
                                                    <span className={`font-bold ${perf.simple_momentum_score >= 2 ? 'text-green-600' :
                                                        perf.simple_momentum_score >= 1 ? 'text-blue-600' : 'text-gray-600'
                                                        }`}>
                                                        {perf.simple_momentum_score.toFixed(2)}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <PercentageChange value={perf?.change_1w} />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <PercentageChange value={perf?.change_1m} />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <PercentageChange value={perf?.change_3m} />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <PercentageChange value={perf?.change_6m} />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <PercentageChange value={perf?.change_1y} />
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                        <div className="text-sm text-gray-500">
                            Showing <span className="font-medium">{skip + 1}</span> to <span className="font-medium">{Math.min(skip + limit, totalCount)}</span> of <span className="font-medium">{totalCount}</span> results
                        </div>
                        <div className="flex gap-2">
                            <Link
                                href={`/simple-momentum?page=${page - 1}&sort=${sort}&order=${order}`}
                                className={`px-3 py-1 rounded border ${page <= 1 ? 'bg-gray-100 text-gray-400 pointer-events-none' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                            >
                                Previous
                            </Link>
                            <Link
                                href={`/simple-momentum?page=${page + 1}&sort=${sort}&order=${order}`}
                                className={`px-3 py-1 rounded border ${page >= totalPages ? 'bg-gray-100 text-gray-400 pointer-events-none' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                            >
                                Next
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
