
import Link from 'next/link'
import { ArrowLeft, ArrowUpDown, Zap } from 'lucide-react'
import prisma from '@/lib/prisma'
import PercentageChange from '@/components/PercentageChange'
import Search from '@/components/Search'

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
    | 'swing_score'
    | 'strong_stock_score'
    | 'stage2_rs_rank'
    | 'sector_score'
    | 'adr_score'
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

const scoreClass = (v: number | null | undefined) =>
    v == null ? 'bg-gray-100 text-gray-700' :
        v >= 80 ? 'bg-emerald-100 text-emerald-700' :
            v >= 60 ? 'bg-green-100 text-green-700' :
                v >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'

const ScoreBadge = ({ v }: { v: number | null | undefined }) => (
    v != null ? (
        <span className={`inline-block font-bold px-2 py-0.5 rounded text-sm ${scoreClass(v)}`}>
            {v.toFixed(1)}
        </span>
    ) : <span className="text-gray-400">-</span>
)

export default async function SwingStockPage(props: PageProps) {
    const searchParams = await props.searchParams
    const page = Number(searchParams.page) || 1
    const sort = (searchParams.sort as SortField) || 'swing_score'
    const order = (searchParams.order as SortOrder) || 'desc'
    const query = searchParams.query || ''
    const limit = 50
    const skip = (page - 1) * limit

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBy: any = {}
    if (sort === 'nse_symbol' || sort === 'name' || sort === 'market_cap') {
        orderBy[sort] = order
    } else {
        orderBy.stock_performance = {
            [sort]: { sort: order, nulls: 'last' }
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderByArray: any[] = [orderBy]
    if (sort !== 'nse_symbol') orderByArray.push({ nse_symbol: 'asc' })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
        is_active: true,
        stock_performance: { swing_score: { not: null } }
    }
    if (query) {
        whereClause.OR = [
            { nse_symbol: { contains: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } }
        ]
    }

    const [stocks, totalCount] = await Promise.all([
        prisma.stocks.findMany({
            where: whereClause,
            include: { stock_performance: true },
            orderBy: orderByArray,
            take: limit,
            skip,
        }),
        prisma.stocks.count({ where: whereClause }),
    ])

    const totalPages = Math.ceil(totalCount / limit)

    const sortLink = (field: SortField) => {
        const newOrder = sort === field && order === 'desc' ? 'asc' : 'desc'
        const queryParam = query ? `&query=${encodeURIComponent(query)}` : ''
        return `/swing-stock?page=${page}&sort=${field}&order=${newOrder}${queryParam}`
    }

    const sortIcon = (field: SortField) => {
        const active = sort === field
        return (
            <ArrowUpDown
                className={`w-4 h-4 ${active ? (order === 'asc' ? 'text-orange-600 rotate-180' : 'text-orange-600') : 'text-gray-300'}`}
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
                                <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg shadow-md">
                                    <Zap className="w-5 h-5 text-white" />
                                </div>
                                <h1 className="text-3xl font-bold text-gray-900">Swing Score</h1>
                            </div>
                            <p className="text-gray-500 mt-1 ml-[52px]">
                                Strong Stock + High RS + Strong Sector + High ADR, equal-weighted composite
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                        <div className="w-full sm:w-64">
                            <Search placeholder="Search stocks..." />
                        </div>
                        <div className="text-sm text-gray-500 bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-sm whitespace-nowrap">
                            <span className="font-semibold text-gray-900">{totalCount}</span> Scored
                        </div>
                    </div>
                </div>

                {/* Score components summary */}
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-5 mb-6">
                    <h2 className="text-sm font-bold text-orange-800 mb-3 uppercase tracking-wide">
                        4 Components, Equal Weight (25% each)
                    </h2>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-orange-700">
                        <div><span className="font-bold">Strong Stock</span> — Stage 2 trend template criteria passed (0-7), scaled to 0-100</div>
                        <div><span className="font-bold">High RS</span> — 63-day return percentile rank vs. universe</div>
                        <div><span className="font-bold">Strong Sector</span> — mapped sector index&apos;s 1-month return, percentile ranked vs. other sectors</div>
                        <div><span className="font-bold">High ADR</span> — 20-day average daily range %, percentile ranked vs. universe</div>
                    </div>
                    <p className="text-xs text-orange-600 mt-3">
                        Universe: active stocks, market cap ≥ 2000 Cr, with an industry mapped to an NSE sector index.
                        Stocks without a sector mapping are excluded (no Strong Sector component possible).
                    </p>
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
                                    <SortTh field="swing_score" label="Swing Score" />
                                    <SortTh field="strong_stock_score" label="Strong Stock" />
                                    <SortTh field="stage2_rs_rank" label="RS" />
                                    <SortTh field="sector_score" label="Sector" />
                                    <SortTh field="adr_score" label="ADR" />
                                    <SortTh field="change_1w" label="1W %" />
                                    <SortTh field="change_1m" label="1M %" />
                                    <SortTh field="change_3m" label="3M %" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {stocks.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="px-6 py-12 text-center text-gray-400">
                                            No scored stocks found. Results update daily.
                                        </td>
                                    </tr>
                                ) : stocks.map((stock) => {
                                    const perf = stock.stock_performance
                                    return (
                                        <tr key={stock.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                <Link href={`/stock/${stock.nse_symbol}`} className="hover:text-orange-600 hover:underline">
                                                    {stock.nse_symbol}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 max-w-[200px] truncate" title={stock.name ?? undefined}>
                                                {stock.name}
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-600">
                                                {stock.market_cap
                                                    ? `₹${formatIndianNumber(Math.round(Number(stock.market_cap) / 10_000_000))} Cr`
                                                    : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <ScoreBadge v={perf?.swing_score} />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <ScoreBadge v={perf?.strong_stock_score} />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <ScoreBadge v={perf?.stage2_rs_rank} />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <ScoreBadge v={perf?.sector_score} />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <ScoreBadge v={perf?.adr_score} />
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
                                    href={`/swing-stock?page=${page - 1}&sort=${sort}&order=${order}${query ? `&query=${encodeURIComponent(query)}` : ''}`}
                                    className={`px-3 py-1 rounded border ${page <= 1 ? 'bg-gray-100 text-gray-400 pointer-events-none' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                >
                                    Previous
                                </Link>
                                <Link
                                    href={`/swing-stock?page=${page + 1}&sort=${sort}&order=${order}${query ? `&query=${encodeURIComponent(query)}` : ''}`}
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
