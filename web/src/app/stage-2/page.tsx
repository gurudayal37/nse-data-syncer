
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

    const [stocks, totalCount, allSymbols, recentChanges] = await Promise.all([
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
        // Fetch last 7 distinct run dates of changes
        prisma.stage2_changes.findMany({
            orderBy: { run_date: 'desc' },
            where: {
                run_date: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                },
            },
        }),
    ])

    const symbolsList = allSymbols.map((s: any) => s.nse_symbol).filter(Boolean) as string[]

    // Group changes by run_date, newest first
    const changesByDate = recentChanges.reduce((acc, row) => {
        const key = row.run_date.toISOString().slice(0, 10)
        if (!acc[key]) acc[key] = { added: [], removed: [] }
        if (row.change_type === 'added') acc[key].added.push(row)
        else acc[key].removed.push(row)
        return acc
    }, {} as Record<string, { added: typeof recentChanges; removed: typeof recentChanges }>)

    const changeDates = Object.keys(changesByDate).sort((a, b) => b.localeCompare(a))
    const latestChangeDate = changeDates[0] ?? null
    const latestChanges = latestChangeDate ? changesByDate[latestChangeDate] : null

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

                {/* ── Daily Changes Panel ─────────────────────────────── */}
                {latestChanges && (latestChanges.added.length > 0 || latestChanges.removed.length > 0) ? (
                    <div className="mb-6 space-y-3">
                        {/* Latest run header */}
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-gray-700">
                                Changes on {new Date(latestChangeDate! + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            <span className="h-px flex-1 bg-gray-200" />
                            {latestChanges.added.length > 0 && (
                                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                                    +{latestChanges.added.length} added
                                </span>
                            )}
                            {latestChanges.removed.length > 0 && (
                                <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
                                    −{latestChanges.removed.length} removed
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Added */}
                            {latestChanges.added.length > 0 && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                        <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">+</span>
                                        Newly Added
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {latestChanges.added.map((c) => (
                                            <Link
                                                key={c.id}
                                                href={`/stock/${c.nse_symbol}`}
                                                className="inline-flex flex-col bg-white border border-emerald-200 rounded-lg px-3 py-1.5 hover:border-emerald-400 hover:shadow-sm transition-all"
                                            >
                                                <span className="text-xs font-bold text-emerald-700">{c.nse_symbol}</span>
                                                <span className="text-[10px] text-gray-400 leading-tight max-w-[120px] truncate">{c.stock_name}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Removed */}
                            {latestChanges.removed.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                    <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                        <span className="w-4 h-4 rounded-full bg-red-400 text-white flex items-center justify-center text-[10px] font-bold">−</span>
                                        Removed
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {latestChanges.removed.map((c) => (
                                            <Link
                                                key={c.id}
                                                href={`/stock/${c.nse_symbol}`}
                                                className="inline-flex flex-col bg-white border border-red-200 rounded-lg px-3 py-1.5 hover:border-red-400 hover:shadow-sm transition-all"
                                            >
                                                <span className="text-xs font-bold text-red-600">{c.nse_symbol}</span>
                                                <span className="text-[10px] text-gray-400 leading-tight max-w-[120px] truncate">{c.stock_name}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Previous days compact strip */}
                        {changeDates.length > 1 && (
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] text-gray-400 font-medium">Earlier:</span>
                                {changeDates.slice(1).map((date) => {
                                    const d = changesByDate[date]
                                    return (
                                        <span key={date} className="text-[11px] text-gray-500 bg-white border border-gray-200 rounded-full px-2.5 py-0.5 font-medium">
                                            {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                            {d.added.length > 0 && <span className="text-emerald-600 ml-1">+{d.added.length}</span>}
                                            {d.removed.length > 0 && <span className="text-red-500 ml-1">−{d.removed.length}</span>}
                                        </span>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="mb-6 flex items-center gap-2 text-xs text-gray-400 bg-white border border-gray-200 rounded-xl px-4 py-3">
                        <span className="w-2 h-2 rounded-full bg-gray-300" />
                        No changes recorded yet — will populate after the next daily sync run.
                    </div>
                )}

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
