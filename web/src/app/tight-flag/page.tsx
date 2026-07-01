import prisma from '@/lib/prisma'
import Link from 'next/link'
import { TrendingUp } from 'lucide-react'
import PercentageChange from '@/components/PercentageChange'
import Search from '@/components/Search'
import CopyWatchlist from '@/components/CopyWatchlist'
import TightFlagFilters from '@/components/TightFlagFilters'

export const dynamic = 'force-dynamic'

interface PageProps {
    searchParams: Promise<{
        query?: string
        days?: string
        range?: string
        from52h?: string
        trend?: string
        vol?: string
        volEnabled?: string
    }>
}

interface TightFlagRow {
    stock_id: number
    latest_date: Date
    latest_close: number
    latest_volume: bigint | null
    prev_close: number | null
    range_high: number
    range_low: number
    range_pct: number
    window_bars: number
    high_52w: number
    change_1m: number | null
    vol_ratio: number | null
}

async function fetchTightFlags(
    minMarketCap: number,
    days: number,
    maxRangePct: number,
    maxFrom52hPct: number,
    minTrend1m: number,
    maxVolRatio: number  // pass 99 to disable vol filter
): Promise<TightFlagRow[]> {
    const minPriceRatio = (100 - maxFrom52hPct) / 100
    const priorEnd = days * 2

    const rows = await prisma.$queryRaw<TightFlagRow[]>`
        WITH recent AS (
            SELECT dp.stock_id,
                   ROW_NUMBER() OVER (PARTITION BY dp.stock_id ORDER BY dp.date DESC) AS rn,
                   dp.date, dp.close_price, dp.volume
            FROM   daily_prices dp
            JOIN   stocks s ON s.id = dp.stock_id
            WHERE  s.is_active = true
              AND  s.market_cap >= ${minMarketCap}
              AND  dp.date >= CURRENT_DATE - INTERVAL '90 days'
        ),
        high52w AS (
            SELECT dp2.stock_id, MAX(dp2.high_price) AS high_52w
            FROM   daily_prices dp2
            JOIN   stocks s2 ON s2.id = dp2.stock_id
            WHERE  s2.is_active = true
              AND  s2.market_cap >= ${minMarketCap}
              AND  dp2.date >= CURRENT_DATE - INTERVAL '365 days'
            GROUP BY dp2.stock_id
        ),
        window_stats AS (
            SELECT
                stock_id,
                MAX(close_price) FILTER (WHERE rn = 1)                             AS latest_close,
                MAX(date)        FILTER (WHERE rn = 1)                             AS latest_date,
                MAX(volume)      FILTER (WHERE rn = 1)                             AS latest_volume,
                MAX(close_price) FILTER (WHERE rn = 2)                             AS prev_close,
                MAX(close_price) FILTER (WHERE rn <= ${days})                      AS range_high,
                MIN(close_price) FILTER (WHERE rn <= ${days})                      AS range_low,
                COUNT(*)         FILTER (WHERE rn <= ${days})                      AS window_bars,
                AVG(volume)      FILTER (WHERE rn <= ${days})                      AS avg_vol_window,
                AVG(volume)      FILTER (WHERE rn > ${days} AND rn <= ${priorEnd}) AS avg_vol_prior
            FROM recent
            GROUP BY stock_id
            HAVING COUNT(*) FILTER (WHERE rn <= ${days}) >= 5
        ),
        results AS (
            SELECT
                ws.stock_id,
                ws.latest_date,
                ws.latest_close,
                ws.latest_volume,
                ws.prev_close,
                ws.range_high,
                ws.range_low,
                ws.window_bars,
                (ws.range_high - ws.range_low) / ws.range_low * 100           AS range_pct,
                ws.avg_vol_window / NULLIF(ws.avg_vol_prior, 0)                AS vol_ratio,
                h.high_52w,
                sp.change_1m
            FROM   window_stats ws
            JOIN   stocks s  ON s.id  = ws.stock_id
            JOIN   stock_performance sp ON sp.stock_id = ws.stock_id
            JOIN   high52w h ON h.stock_id = ws.stock_id
            WHERE  ws.range_low > 0
              AND  (ws.range_high - ws.range_low) / ws.range_low * 100 <= ${maxRangePct}
              AND  h.high_52w > 0
              AND  ws.latest_close >= h.high_52w * ${minPriceRatio}
              AND  sp.change_1m >= ${minTrend1m}
              AND  (${maxVolRatio}::float > 5 OR ws.avg_vol_window / NULLIF(ws.avg_vol_prior, 0) <= ${maxVolRatio})
        )
        SELECT * FROM results ORDER BY range_pct ASC
    `

    return rows.map((r) => ({
        ...r,
        stock_id: Number(r.stock_id),
        latest_close: Number(r.latest_close),
        latest_volume: r.latest_volume != null ? BigInt(r.latest_volume) : null,
        prev_close: r.prev_close != null ? Number(r.prev_close) : null,
        range_high: Number(r.range_high),
        range_low: Number(r.range_low),
        range_pct: Number(r.range_pct),
        window_bars: Number(r.window_bars),
        high_52w: Number(r.high_52w),
        change_1m: r.change_1m != null ? Number(r.change_1m) : null,
        vol_ratio: r.vol_ratio != null ? Number(r.vol_ratio) : null,
    }))
}

export default async function TightFlagPage(props: PageProps) {
    const searchParams = await props.searchParams
    const query = searchParams.query || ''
    const days = Math.min(20, Math.max(5, Number(searchParams.days) || 10))
    const maxRangePct = Math.min(10, Math.max(5, Number(searchParams.range) || 8))
    const maxFrom52hPct = Math.min(20, Math.max(10, Number(searchParams.from52h) || 15))
    const minTrend1m = Math.min(20, Math.max(5, Number(searchParams.trend) || 10))
    const volEnabled = searchParams.volEnabled === 'true'
    const maxVolRatio = volEnabled ? Math.min(1.0, Math.max(0.5, Number(searchParams.vol) || 0.8)) : 99
    const minMarketCap = Number(process.env.MIN_MARKET_CAP_CR || 2000) * 10_000_000

    let rows: TightFlagRow[] = []
    let error: string | null = null

    try {
        rows = await fetchTightFlags(minMarketCap, days, maxRangePct, maxFrom52hPct, minTrend1m, maxVolRatio)
    } catch (e) {
        error = e instanceof Error ? e.message : 'Failed to fetch tight flag stocks'
        if (process.env.NODE_ENV === 'development') console.error(e)
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                        <h1 className="text-2xl font-bold text-red-900 mb-2">Database Error</h1>
                        <p className="text-red-700">{error}</p>
                    </div>
                </div>
            </div>
        )
    }

    const stockIds = rows.map((r) => r.stock_id)
    const stocks = stockIds.length
        ? await prisma.stocks.findMany({
            where: { id: { in: stockIds } },
            select: {
                id: true,
                nse_symbol: true,
                name: true,
                market_cap: true,
                stock_performance: { select: { is_stage2: true } },
            },
        })
        : []
    const stockMap = new Map(stocks.map((s) => [s.id, s]))

    let combined = rows
        .map((r) => ({ row: r, stock: stockMap.get(r.stock_id) }))
        .filter((c) => c.stock)

    if (query) {
        const q = query.toLowerCase()
        combined = combined.filter(
            (c) =>
                c.stock!.nse_symbol?.toLowerCase().includes(q) ||
                c.stock!.name?.toLowerCase().includes(q)
        )
    }

    const watchlistSymbols = combined
        .filter((c) => c.stock!.stock_performance?.is_stage2)
        .map((c) => c.stock!.nse_symbol)
        .filter(Boolean) as string[]

    return (
        <div className="min-h-screen bg-slate-100">
            <div className="px-6 py-6">
                <header className="mb-4 flex justify-between items-start gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Tight Flag Stocks</h1>
                        <p className="text-slate-500 text-sm mt-1">
                            {combined.length} NSE stocks consolidating in a ≤{maxRangePct}% range over {days} days, within {maxFrom52hPct}% of 52W high, up ≥{minTrend1m}% last month{volEnabled ? `, vol ≤${maxVolRatio}× prior` : ''}
                        </p>
                    </div>
                    <div className="flex items-end gap-3 shrink-0">
                        <CopyWatchlist symbols={watchlistSymbols} />
                        <div className="w-64">
                            <Search placeholder="Search stocks…" />
                        </div>
                    </div>
                </header>

                {/* Filter bar */}
                <div className="mb-5 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
                    <TightFlagFilters
                        days={days}
                        range={maxRangePct}
                        from52h={maxFrom52hPct}
                        trend={minTrend1m}
                        vol={Math.min(1.0, Math.max(0.5, Number(searchParams.vol) || 0.8))}
                        volEnabled={volEnabled}
                    />
                </div>

                <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200 text-xs uppercase tracking-wide">
                                <tr>
                                    <th className="px-4 py-3">Symbol</th>
                                    <th className="px-4 py-3">Name</th>
                                    <th className="px-4 py-3 text-right">Market Cap</th>
                                    <th className="px-4 py-3 text-right">Price</th>
                                    <th className="px-4 py-3 text-right">Day Change</th>
                                    <th className="px-4 py-3 text-right whitespace-nowrap">Range %</th>
                                    <th className="px-4 py-3 text-right whitespace-nowrap">Days</th>
                                    <th className="px-4 py-3 text-right whitespace-nowrap">From 52W High</th>
                                    <th className="px-4 py-3 text-right whitespace-nowrap">1M %</th>
                                    <th className="px-4 py-3 text-right whitespace-nowrap">Vol Ratio</th>
                                    <th className="px-4 py-3 text-center">Stage 2</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {combined.map(({ row, stock }) => {
                                    const dayChange =
                                        row.prev_close != null && row.prev_close !== 0
                                            ? ((row.latest_close - row.prev_close) / row.prev_close) * 100
                                            : null
                                    const pctFromHigh =
                                        row.high_52w > 0
                                            ? ((row.high_52w - row.latest_close) / row.high_52w) * 100
                                            : null

                                    return (
                                        <tr key={row.stock_id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 font-semibold">
                                                <Link href={`/stock/${stock!.nse_symbol}`} className="text-blue-600 hover:underline">
                                                    {stock!.nse_symbol}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 truncate max-w-[180px]" title={stock!.name || ''}>
                                                {stock!.name || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-500">
                                                {stock!.market_cap
                                                    ? `₹${Math.round(Number(stock!.market_cap) / 10_000_000).toLocaleString('en-IN')} Cr`
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-slate-800">
                                                ₹{row.latest_close.toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <PercentageChange value={dayChange} />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`font-semibold ${row.range_pct <= 5 ? 'text-emerald-600' : row.range_pct <= 7 ? 'text-green-600' : 'text-amber-600'}`}>
                                                    {row.range_pct.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-500">
                                                {row.window_bars}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {pctFromHigh != null && pctFromHigh >= 0 ? (
                                                    <span className={`font-medium ${pctFromHigh <= 5 ? 'text-emerald-600' : pctFromHigh <= 10 ? 'text-green-600' : 'text-slate-600'}`}>
                                                        -{pctFromHigh.toFixed(1)}%
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <PercentageChange value={row.change_1m} />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {row.vol_ratio != null ? (
                                                    <span className={`font-semibold ${row.vol_ratio <= 0.6 ? 'text-emerald-600' : row.vol_ratio <= 0.75 ? 'text-green-600' : 'text-amber-600'}`}>
                                                        {row.vol_ratio.toFixed(2)}×
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {stock!.stock_performance?.is_stage2 ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                        <TrendingUp className="w-3 h-3" /> Stage 2
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                                {combined.length === 0 && (
                                    <tr>
                                        <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                                            No stocks match the current filter settings. Try relaxing the range or 52-week high threshold.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
