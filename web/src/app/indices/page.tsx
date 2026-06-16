import prisma from '@/lib/prisma'
import Link from 'next/link'
import { PAGE_SIZE, SORTABLE_COLUMNS, PERFORMANCE_PERIODS, type SortableColumn } from '@/lib/constants'
import PercentageChange from '@/components/PercentageChange'
import Pagination from '@/components/Pagination'
import Search from '@/components/Search'
import type { MarketIndex } from '@/types/index'

export const dynamic = 'force-dynamic'

interface IndexPageProps {
    searchParams: Promise<{ page?: string; sort?: string; order?: string; query?: string }>
}

export default async function IndexPage(props: IndexPageProps) {
    const searchParams = await props.searchParams
    const page = Number(searchParams.page) || 1
    const sort = (searchParams.sort || 'change_1w') as SortableColumn
    const order = searchParams.order || 'desc'
    const query = searchParams.query || ''
    const skip = (page - 1) * PAGE_SIZE

    let indices: MarketIndex[] = []
    let usIndices: MarketIndex[] = []
    let totalCount = 0
    let error: string | null = null

    // Construct orderBy
    let orderBy: any = {}
    if (SORTABLE_COLUMNS.includes(sort as SortableColumn)) {
        orderBy = [
            {
                index_performance: {
                    [sort]: { sort: order, nulls: 'last' }
                }
            },
            { symbol: 'asc' }
        ]
    } else {
        orderBy = { symbol: 'asc' }
    }

    try {
        // Fetch US indices (symbols starting with ^) — shown separately, not paginated
        usIndices = await prisma.indices.findMany({
            where: { symbol: { startsWith: '^' } },
            include: {
                index_daily_prices: {
                    orderBy: { date: 'desc' },
                    take: 1,
                    select: { close_price: true, date: true }
                },
                index_performance: true
            },
            orderBy: { symbol: 'asc' },
        }) as MarketIndex[]

        // Get total count for NSE indices only (not US)
        totalCount = await prisma.indices.count({
            where: {
                NOT: { symbol: { startsWith: '^' } },
                OR: query
                    ? [
                        { symbol: { contains: query, mode: 'insensitive' } },
                        { name: { contains: query, mode: 'insensitive' } },
                    ]
                    : undefined,
            }
        })

        // Fetch NSE Indices with pagination and sorting
        indices = await prisma.indices.findMany({
            where: {
                NOT: { symbol: { startsWith: '^' } },
                OR: query
                    ? [
                        { symbol: { contains: query, mode: 'insensitive' } },
                        { name: { contains: query, mode: 'insensitive' } },
                    ]
                    : undefined,
            },
            take: PAGE_SIZE,
            skip: skip,
            include: {
                index_daily_prices: {
                    orderBy: { date: 'desc' },
                    take: 1,
                    select: {
                        close_price: true,
                        date: true
                    }
                },
                index_performance: true
            },
            orderBy: orderBy,
        }) as MarketIndex[]
    } catch (e: unknown) {
        error = e instanceof Error ? e.message : 'Failed to fetch Indices'
        if (process.env.NODE_ENV === 'development') {
            console.error('Database error:', e)
        }
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 p-8">
                <div className="max-w-[95%] mx-auto">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                        <h1 className="text-2xl font-bold text-red-900 mb-2">Database Connection Error</h1>
                        <p className="text-red-700 mb-4">{error}</p>
                        <p className="text-sm text-red-600">Please check your DATABASE_URL environment variable and ensure the database is accessible.</p>
                    </div>
                </div>
            </div>
        )
    }

    const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1

    const SortIcon = ({ column }: { column: string }) => {
        if (sort !== column) return <span className="ml-1 text-gray-400">↕</span>
        return order === 'asc' ? <span className="ml-1 text-blue-600">↑</span> : <span className="ml-1 text-blue-600">↓</span>
    }

    const SortHeader = ({ column, label, align = 'left' }: { column: string, label: string, align?: string }) => {
        const newOrder = sort === column && order === 'desc' ? 'asc' : 'desc'
        const queryParam = query ? `&query=${encodeURIComponent(query)}` : ''
        return (
            <th className={`px-6 py-4 ${align === 'right' ? 'text-right' : ''}`}>
                <Link href={`/indices?page=${page}&sort=${column}&order=${newOrder}${queryParam}`} className="group inline-flex items-center hover:text-blue-600">
                    {label}
                    <SortIcon column={column} />
                </Link>
            </th>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-[95%] mx-auto">
                <header className="mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Indices Dashboard</h1>
                        <p className="text-gray-500 mt-2">
                            Showing {totalCount > 0 ? skip + 1 : 0}-{Math.min(skip + PAGE_SIZE, totalCount)} of {totalCount} NSE Indices · {usIndices.length} US Indices
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-4">
                        <div className="w-full sm:w-80">
                            <Search placeholder="Search Indices..." />
                        </div>
                        <Pagination currentPage={page} totalPages={totalPages} sort={sort} order={order} basePath="/indices" query={query} />
                    </div>
                </header>

                {/* US Indices strip */}
                {usIndices.length > 0 && (
                    <div className="mb-6">
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">US Markets</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                            {usIndices.map((idx) => {
                                const perf = idx.index_performance
                                const latest = idx.index_daily_prices?.[0]
                                const change1w = perf?.change_1w as number | null | undefined
                                const change1m = perf?.change_1m as number | null | undefined
                                const change1y = perf?.change_1y as number | null | undefined
                                const isVix = idx.symbol === '^VIX'
                                return (
                                    <Link key={idx.symbol} href={`/indices/${encodeURIComponent(idx.symbol || '')}`}
                                        className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-blue-300 transition-all">
                                        <div className="text-xs text-gray-500 mb-0.5 truncate">{idx.name}</div>
                                        <div className="text-base font-bold text-gray-900 mb-1">
                                            {latest?.close_price ? `$${latest.close_price.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}
                                        </div>
                                        <div className="flex flex-col gap-0.5 text-xs">
                                            <span className="flex justify-between"><span className="text-gray-400">1W</span><PercentageChange value={change1w} /></span>
                                            <span className="flex justify-between"><span className="text-gray-400">1M</span><PercentageChange value={change1m} /></span>
                                            {!isVix && <span className="flex justify-between"><span className="text-gray-400">1Y</span><PercentageChange value={change1y} /></span>}
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                )}

                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">NSE Indices</h2>
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-50 text-gray-900 font-medium border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4">Symbol</th>
                                    <th className="px-6 py-4">Index Name</th>
                                    <th className="px-6 py-4 text-right">Price</th>
                                    {PERFORMANCE_PERIODS.map((period) => (
                                        <SortHeader
                                            key={period.key}
                                            column={period.key}
                                            label={period.label}
                                            align="right"
                                        />
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {indices.map((indexObj) => {
                                    const latest = indexObj.index_daily_prices?.[0]
                                    const perf = indexObj.index_performance

                                    return (
                                        <tr key={indexObj.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                <Link href={`/indices/${encodeURIComponent(indexObj.symbol || '')}`} className="hover:underline text-blue-600">
                                                    {indexObj.symbol}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 truncate max-w-xs" title={indexObj.name || ''}>
                                                {indexObj.name || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-gray-900">
                                                {latest && latest.close_price ? `₹${latest.close_price.toFixed(2)}` : '-'}
                                            </td>
                                            {PERFORMANCE_PERIODS.map((period) => {
                                                const value = perf?.[period.key as keyof typeof perf] as number | null | undefined
                                                return (
                                                    <td key={period.key} className="px-6 py-4 text-right">
                                                        <PercentageChange value={value} />
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    )
                                })}
                                {indices.length === 0 && (
                                    <tr>
                                        <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                                            No indices completely matches your search.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mt-4 flex justify-between items-center">
                    <p className="text-sm text-gray-500">
                        Page {page} of {totalPages}
                    </p>
                    <Pagination currentPage={page} totalPages={totalPages} sort={sort} order={order} basePath="/indices" query={query} />
                </div>
            </div>
        </div>
    )
}
