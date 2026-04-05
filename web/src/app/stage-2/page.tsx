
import Link from 'next/link'
import { ArrowLeft, ArrowUpDown, TrendingUp } from 'lucide-react'
import prisma from '@/lib/prisma'
import PercentageChange from '@/components/PercentageChange'
import Search from '@/components/Search'
import CopyWatchlist from '@/components/CopyWatchlist'

export const dynamic = 'force-dynamic'

// Deterministic Indian number formatter (avoids server/client locale mismatch with toLocaleString)
function formatIndianNumber(n: number): string {
    const s = String(n)
    if (s.length <= 3) return s
    const last3 = s.slice(-3)
    const rest = s.slice(0, -3)
    return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3
}

type SortField =
    | 'nse_symbol'
    | 'name'
    | 'market_cap'
    | 'stage2_rs_rank'
    | 'stage2_pct_from_52w_high'
    | 'change_1w'
    | 'change_1m'
    | 'change_3m'

type SortOrder = 'asc' | 'desc'

interface PageProps {
    searchParams: Promise<{
        page?: string
        sort?: string
        order?: string
        query?: string
    }>
}

export default async function Stage2Page(props: PageProps) {
    const searchParams = await props.searchParams
    const page = Number(searchParams.page) || 1
    const sort = (searchParams.sort as SortField) || 'stage2_rs_rank'
    const order = (searchParams.order as SortOrder) || 'desc'
    const query = searchParams.query || ''
    const limit = 50
    const skip = (page - 1) * limit

    // Build Prisma orderBy
    let orderBy: any = {}
    if (sort === 'nse_symbol' || sort === 'name' || sort === 'market_cap') {
        orderBy[sort] = order
    } else {
        orderBy.stock_performance = {
            [sort]: { sort: order, nulls: 'last' }
        }
    }
    const orderByArray: any[] = [orderBy]
    if (sort !== 'nse_symbol') orderByArray.push({ nse_symbol: 'asc' })

    const whereClause: any = {
        is_active: true,
        stock_performance: { is_stage2: true }
    }
    if (query) {
        whereClause.OR = [
            { nse_symbol: { contains: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } }
        ]
    }

    const [stocks, totalCount, allSymbols] = await Promise.all([
        prisma.stocks.findMany({
            where: whereClause,
            include: { stock_performance: true },
            orderBy: orderByArray,
            take: limit,
            skip,
        }),
        prisma.stocks.count({ where: whereClause }),
        prisma.stocks.findMany({
            where: whereClause,
            select: { nse_symbol: true },
            orderBy: orderByArray,
        }),
    ])

    const symbolsList = allSymbols.map((s: any) => s.nse_symbol).filter(Boolean) as string[]

    const totalPages = Math.ceil(totalCount / limit)

    // Build sort link — same pattern as VCP page
    const sortLink = (field: SortField) => {
        const newOrder = sort === field && order === 'desc' ? 'asc' : 'desc'
        const queryParam = query ? `&query=${encodeURIComponent(query)}` : ''
        return `/stage-2?page=${page}&sort=${field}&order=${newOrder}${queryParam}`
    }

    // Inline sort icon — not extracted as a sub-component to avoid hydration issues
    const sortIcon = (field: SortField) => {
        const active = sort === field
        return (
            <ArrowUpDown
                className={`w-4 h-4 ${active ? (order === 'asc' ? 'text-emerald-600 rotate-180' : 'text-emerald-600') : 'text-gray-300'}`}
            />
        )
    }

    const SortTh = ({ field, label, align = 'right' }: { field: SortField; label: string; align?: 'left' | 'right' }) => (
        <th className={`px-6 py-4${align === 'right' ? ' text-right' : ''} whitespace-nowrap`}>
            <Link
                href={sortLink(field)}
                className={`flex items-center gap-1 hover:bg-gray-50 py-1 px-2 rounded cursor-pointer group${align === 'right' ? ' justify-end' : ''}`}
            >
                <span className="font-semibold text-gray-600 group-hover:text-gray-900">{label}</span>
                {sortIcon(field)}
            </Link>
        </th>
    )

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-[95%] mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                            <ArrowLeft className="w-6 h-6 text-gray-600" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-md">
                                    <TrendingUp className="w-5 h-5 text-white" />
                                </div>
                                <h1 className="text-3xl font-bold text-gray-900">Stage 2 Stocks</h1>
                            </div>
                            <p className="text-gray-500 mt-1 ml-[52px]">
                                Stocks in Stage 2 uptrend — Minervini Trend Template (all 8 criteria)
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                        <div className="w-full sm:w-64">
                            <Search placeholder="Search stocks..." />
                        </div>
                        <CopyWatchlist symbols={symbolsList} />
                        <div className="text-sm text-gray-500 bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-sm whitespace-nowrap">
                            <span className="font-semibold text-gray-900">{totalCount}</span> Candidates
                        </div>
                    </div>
                </div>

                {/* Criteria Summary */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5 mb-6">
                    <h2 className="text-sm font-bold text-emerald-800 mb-3 uppercase tracking-wide">
                        Screening Criteria (all must pass)
                    </h2>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs text-emerald-700">
                        {[
                            'Price > 150 DMA & 200 DMA',
                            '150 DMA > 200 DMA',
                            '200 DMA trending up ≥ 1 month',
                            '50 DMA > 150 DMA & 200 DMA',
                            'Price > 50 DMA',
                            'Price ≥ 30% above 52-week low',
                            'Within 25% of 52-week high',
                            'Relative Strength rank ≥ 70',
                        ].map((criterion) => (
                            <div key={criterion} className="flex items-start gap-2">
                                <span className="font-bold text-emerald-500 shrink-0">✓</span>
                                <span>{criterion}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-900 border-b border-gray-200">
                                <tr>
                                    <SortTh field="nse_symbol" label="Symbol" align="left" />
                                    <SortTh field="name" label="Company Name" align="left" />
                                    <SortTh field="market_cap" label="Market Cap" />
                                    <SortTh field="stage2_rs_rank" label="RS Rank" />
                                    <SortTh field="stage2_pct_from_52w_high" label="% from 52W High" />
                                    <th className="px-6 py-4 text-right whitespace-nowrap">
                                        <span className="font-semibold text-gray-600 block text-right px-2">% above 52W Low</span>
                                    </th>
                                    <SortTh field="change_1w" label="1W %" />
                                    <SortTh field="change_1m" label="1M %" />
                                    <SortTh field="change_3m" label="3M %" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {stocks.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-12 text-center text-gray-400">
                                            No stocks match Stage 2 criteria at this time. Results update daily.
                                        </td>
                                    </tr>
                                ) : stocks.map((stock) => {
                                    const perf = stock.stock_performance
                                    const fromHigh = perf?.stage2_pct_from_52w_high ?? null
                                    const aboveLow = perf?.stage2_pct_above_52w_low ?? null
                                    const rsRank = perf?.stage2_rs_rank ?? null
                                    return (
                                        <tr key={stock.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                <Link href={`/stock/${stock.nse_symbol}`} className="hover:text-emerald-600 hover:underline">
                                                    {stock.nse_symbol}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 max-w-[200px] truncate" title={stock.name}>
                                                {stock.name}
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-600">
                                                {stock.market_cap
                                                    ? `₹${formatIndianNumber(Math.round(Number(stock.market_cap) / 10_000_000))} Cr`
                                                    : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {rsRank != null ? (
                                                    <span className={`inline-block font-bold px-2 py-0.5 rounded text-sm ${rsRank >= 90 ? 'bg-emerald-100 text-emerald-700' : rsRank >= 80 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                                        {Math.round(rsRank)}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {fromHigh != null ? (
                                                    <span className={`font-medium ${fromHigh >= -5 ? 'text-emerald-600' : fromHigh >= -15 ? 'text-amber-600' : 'text-gray-600'}`}>
                                                        {fromHigh.toFixed(1)}%
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-700">
                                                {aboveLow != null ? `+${aboveLow.toFixed(1)}%` : '-'}
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
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                            <div className="text-sm text-gray-500">
                                Showing <span className="font-medium">{skip + 1}</span> to{' '}
                                <span className="font-medium">{Math.min(skip + limit, totalCount)}</span> of{' '}
                                <span className="font-medium">{totalCount}</span> results
                            </div>
                            <div className="flex gap-2">
                                <Link
                                    href={`/stage-2?page=${page - 1}&sort=${sort}&order=${order}${query ? `&query=${encodeURIComponent(query)}` : ''}`}
                                    className={`px-3 py-1 rounded border ${page <= 1 ? 'bg-gray-100 text-gray-400 pointer-events-none' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                >
                                    Previous
                                </Link>
                                <Link
                                    href={`/stage-2?page=${page + 1}&sort=${sort}&order=${order}${query ? `&query=${encodeURIComponent(query)}` : ''}`}
                                    className={`px-3 py-1 rounded border ${page >= totalPages ? 'bg-gray-100 text-gray-400 pointer-events-none' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                >
                                    Next
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
