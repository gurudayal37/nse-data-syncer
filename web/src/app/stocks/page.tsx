import prisma from '@/lib/prisma'
import Link from 'next/link'
import { PAGE_SIZE, SORTABLE_COLUMNS, PERFORMANCE_PERIODS, type SortableColumn } from '@/lib/constants'
import PercentageChange from '@/components/PercentageChange'
import Pagination from '@/components/Pagination'
import type { Stock } from '@/types/stock'

export const dynamic = 'force-dynamic'

interface DashboardProps {
  searchParams: Promise<{ page?: string; sort?: string; order?: string }>
}

export default async function Dashboard(props: DashboardProps) {
  const searchParams = await props.searchParams
  const page = Number(searchParams.page) || 1
  const sort = (searchParams.sort || 'change_1w') as SortableColumn
  const order = searchParams.order || 'desc'
  const skip = (page - 1) * PAGE_SIZE

  const minMarketCapCr = Number(process.env.MIN_MARKET_CAP_CR || 2000)
  const minMarketCap = minMarketCapCr * 10000000 // Convert Crores to absolute value

  let stocks: Stock[] = []
  let totalCount = 0
  let error: string | null = null

  // Construct orderBy
  let orderBy: any = {}
  if (SORTABLE_COLUMNS.includes(sort as SortableColumn)) {
    orderBy = [
      {
        stock_performance: {
          [sort]: { sort: order, nulls: 'last' }
        }
      },
      { nse_symbol: 'asc' }
    ]
  } else {
    orderBy = { nse_symbol: 'asc' }
  }

  try {
    // Get total count first
    totalCount = await prisma.stocks.count({
      where: {
        is_active: true,
        market_cap: {
          gte: minMarketCap
        }
      }
    })

    // Fetch stocks with pagination and sorting
    stocks = await prisma.stocks.findMany({
      where: {
        is_active: true,
        market_cap: {
          gte: minMarketCap
        }
      },
      take: PAGE_SIZE,
      skip: skip,
      include: {
        daily_prices: {
          orderBy: { date: 'desc' },
          take: 1,
          select: {
            close_price: true,
            date: true
          }
        },
        stock_performance: true
      },
      orderBy: orderBy,
    }) as Stock[]
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : 'Failed to fetch stocks'
    if (process.env.NODE_ENV === 'development') {
      console.error('Database error:', e)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h1 className="text-2xl font-bold text-red-900 mb-2">Database Connection Error</h1>
            <p className="text-red-700 mb-4">{error}</p>
            <p className="text-sm text-red-600">Please check your DATABASE_URL environment variable and ensure the database is accessible.</p>
          </div>
        </div>
      </div>
    )
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const SortIcon = ({ column }: { column: string }) => {
    if (sort !== column) return <span className="ml-1 text-gray-400">↕</span>
    return order === 'asc' ? <span className="ml-1 text-blue-600">↑</span> : <span className="ml-1 text-blue-600">↓</span>
  }

  const SortHeader = ({ column, label, align = 'left' }: { column: string, label: string, align?: string }) => {
    const newOrder = sort === column && order === 'desc' ? 'asc' : 'desc'
    return (
      <th className={`px-6 py-4 ${align === 'right' ? 'text-right' : ''}`}>
        <Link href={`/stocks?page=${page}&sort=${column}&order=${newOrder}`} className="group inline-flex items-center hover:text-blue-600">
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
            <h1 className="text-3xl font-bold text-gray-900">Stock Dashboard</h1>
            <p className="text-gray-500 mt-2">
              Showing {skip + 1}-{Math.min(skip + PAGE_SIZE, totalCount)} of {totalCount} NSE stocks
            </p>
          </div>
          <Pagination currentPage={page} totalPages={totalPages} sort={sort} order={order} basePath="/stocks" />
        </header>

        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-900 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">Symbol</th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4 text-right">Price</th>
                  <th className="px-6 py-4 text-right">Market Cap</th>
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
                {stocks.map((stock) => {
                  const latest = stock.daily_prices[0]
                  const perf = stock.stock_performance

                  return (
                    <tr key={stock.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        <Link href={`/stock/${stock.nse_symbol}`} className="hover:underline text-blue-600">
                          {stock.nse_symbol}
                        </Link>
                      </td>
                      <td className="px-6 py-4 truncate max-w-xs" title={stock.name || ''}>
                        {stock.name || '-'}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">
                        {latest ? `₹${latest.close_price?.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {stock.market_cap ? `₹${Math.round(Number(stock.market_cap) / 10000000).toLocaleString('en-IN')} Cr` : '-'}
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
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex justify-between items-center">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <Pagination currentPage={page} totalPages={totalPages} sort={sort} order={order} basePath="/stocks" />
        </div>
      </div>
    </div>
  )
}
