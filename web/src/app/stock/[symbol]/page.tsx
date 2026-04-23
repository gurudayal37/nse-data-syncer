import prisma from '@/lib/prisma'
import StockChart from '@/components/StockChart'
import SyncButton from '@/components/SyncButton'
import StockTags from '@/components/StockTags'
import Link from 'next/link'
import { ArrowLeft, TrendingUp } from 'lucide-react'
import { notFound } from 'next/navigation'
import type { NewsItem } from '@/types/stock'
import athData from '@/data/backtest_results_ath.json'
import simpleData from '@/data/backtest_results_simple.json'

export const dynamic = 'force-dynamic'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(a: number | null | undefined, b: number | null | undefined): number | null {
    if (a == null || b == null || b === 0) return null
    return ((a - b) / Math.abs(b)) * 100
}

function fmtNum(v: number | null | undefined, dec = 0): string {
    if (v == null) return '—'
    return v.toLocaleString('en-IN', { maximumFractionDigits: dec, minimumFractionDigits: dec })
}

function fmtCr(v: number | bigint | null | undefined): string {
    if (v == null) return '—'
    return `₹${Math.round(Number(v) / 10_000_000).toLocaleString('en-IN')} Cr`
}

function GrowthCell({ value }: { value: number | null }) {
    if (value == null) return <td className="px-3 py-3 text-slate-300 text-right text-xs">—</td>
    const pos = value >= 0
    return (
        <td className={`px-3 py-3 text-right text-xs font-semibold ${pos ? 'text-emerald-600' : 'text-red-500'}`}>
            {pos ? '+' : ''}{value.toFixed(1)}%
        </td>
    )
}

function MetricRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0">
            <span className="text-sm text-slate-500">{label}</span>
            <span className="text-sm font-semibold text-slate-800">{value}</span>
        </div>
    )
}

function PerfTab({ label, value }: { label: string; value: number | null | undefined }) {
    const isNull = value == null
    const pos = !isNull && value! >= 0
    const color = isNull ? 'text-slate-400' : pos ? 'text-emerald-600' : 'text-red-500'
    const border = isNull ? 'border-slate-200' : pos ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'
    return (
        <div className={`flex flex-col items-center justify-center py-3 border rounded-lg w-full ${border}`}>
            <span className="text-[11px] text-slate-400 font-medium mb-0.5">{label}</span>
            <span className={`text-sm font-bold ${color}`}>
                {isNull ? '—' : `${value! >= 0 ? '+' : ''}${value!.toFixed(2)}%`}
            </span>
        </div>
    )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function StockPage(props: { params: Promise<{ symbol: string }> }) {
    const { symbol } = await props.params
    const sym = decodeURIComponent(symbol)

    // Strategy data
    const athTrades = (athData.trades || []).filter((t: any) => t.symbol === sym)
    const momentumTrades: any[] = []
    ;(simpleData.backtest_results ?? []).forEach((month: any) => {
        const h = month.holdings.find((h: any) => h.symbol === sym)
        if (h) momentumTrades.push({ month: month.month, return: h.return, score: h.score })
    })
    ;((simpleData as any).current_performance ?? []).forEach((month: any) => {
        const h = month.holdings.find((h: any) => h.symbol === sym)
        if (h) momentumTrades.push({ month: month.month, return: h.return, score: h.score })
    })
    momentumTrades.sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())

    const stock = await prisma.stocks.findFirst({
        where: { nse_symbol: sym },
        include: {
            daily_prices: { orderBy: { date: 'asc' } },
            stock_performance: true,
            news: { orderBy: { published_date: 'desc' }, take: 8 },
        },
    })
    if (!stock) notFound()

    const chartData = stock.daily_prices.map((p: any) => ({
        date: p.date.toISOString(),
        close: p.close_price,
        volume: Number(p.volume || 0),
    }))

    // Quarterly results
    const qRaw = await prisma.quarterly_results.findMany({
        where: { stock_id: stock.id },
        orderBy: [{ year: 'desc' }, { quarter_number: 'desc' }],
        take: 8,
    })
    const quarters = qRaw.map((r) => ({
        quarter: r.quarter,
        year: r.year,
        quarter_number: r.quarter_number,
        revenue: r.revenue,
        ebitda: r.ebitda,
        operating_profit: r.operating_profit,
        opm_percent: r.opm_percent ? Number(r.opm_percent) : null,
        net_profit: r.net_profit,
        eps: r.eps,
    }))

    const tagRows = await prisma.stock_tags.findMany({
        where: { stock_id: stock.id },
        orderBy: { created_at: 'asc' },
    })
    const tags = tagRows.map((r) => r.tag)

    const latest = stock.daily_prices.at(-1)
    const prev   = stock.daily_prices.at(-2)
    const perf   = stock.stock_performance

    const dailyChange = latest && prev
        ? ((latest.close_price - prev.close_price) / prev.close_price) * 100
        : null
    const isUp = dailyChange != null && dailyChange >= 0

    // 52W High/Low from last 252 trading days of daily prices
    const last252 = stock.daily_prices.slice(-252)
    const w52High = last252.length ? Math.max(...last252.map((p: any) => p.high_price)) : null
    const w52Low  = last252.length ? Math.min(...last252.map((p: any) => p.low_price))  : null

    // All-time high from full price history
    const ath = stock.daily_prices.length
        ? Math.max(...stock.daily_prices.map((p: any) => p.close_price))
        : null

    return (
        <div className="min-h-screen bg-slate-100">
            {/* ── Top nav bar ───────────────────────────────────────────── */}
            <div className="bg-white border-b border-slate-200 px-6 py-3">
                <Link href="/" className="inline-flex items-center text-slate-500 hover:text-slate-800 text-sm transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-1.5" />
                    Dashboard
                </Link>
            </div>

            <div className="px-6 py-5 space-y-4">

                {/* ── Header card ───────────────────────────────────────── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Title bar */}
                    <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4 border-b border-slate-100">
                        <div>
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{stock.name}</h1>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-bold text-slate-800">
                                        {latest ? `₹${latest.close_price.toFixed(2)}` : '—'}
                                    </span>
                                    {dailyChange != null && (
                                        <span className={`inline-flex items-center gap-1 text-sm font-semibold px-2 py-0.5 rounded-full ${
                                            isUp ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                                        }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${isUp ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                            {isUp ? '+' : ''}{dailyChange.toFixed(2)}%
                                        </span>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                                {latest ? new Date(latest.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · close price' : ''}
                            </p>
                            {/* NSE / BSE badges */}
                            <div className="flex items-center gap-3 mt-2.5">
                                <span className="text-xs text-slate-500 border border-slate-200 px-2 py-0.5 rounded">
                                    NSE: <span className="font-semibold text-slate-700">{stock.nse_symbol}</span>
                                </span>
                                {stock.bse_symbol && (
                                    <span className="text-xs text-slate-500 border border-slate-200 px-2 py-0.5 rounded">
                                        BSE: <span className="font-semibold text-slate-700">{stock.bse_symbol}</span>
                                    </span>
                                )}
                                {tags.map((tag) => (
                                    <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded font-medium">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                        {/* Sync button */}
                        <div className="shrink-0 pt-1">
                            <SyncButton symbol={sym} />
                        </div>
                    </div>

                    {/* Metrics + description */}
                    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                        {/* Col 1: price metrics */}
                        <div className="px-6 py-4">
                            <MetricRow label="Market Cap"     value={fmtCr(stock.market_cap)} />
                            <MetricRow label="Current Price"  value={latest ? `₹${latest.close_price.toFixed(2)}` : '—'} />
                            <MetricRow label="52W High / Low" value={w52High && w52Low ? `₹${fmtNum(w52High, 2)} / ₹${fmtNum(w52Low, 2)}` : '—'} />
                            <MetricRow label="All Time High"  value={ath ? `₹${fmtNum(ath, 2)}` : '—'} />
                        </div>
                        {/* Col 2: sector classification */}
                        <div className="px-6 py-4">
                            <MetricRow label="Sector"       value={stock.sector    || '—'} />
                            <MetricRow label="Industry"     value={stock.subsector1 || '—'} />
                            <MetricRow label="Group"        value={stock.subsector2 || '—'} />
                            <MetricRow label="Sub-group"    value={stock.subsector3 || '—'} />
                        </div>
                        {/* Col 3: scores + about */}
                        <div className="px-6 py-4 flex flex-col gap-3">
                            {/* Score cards row */}
                            <div className="grid grid-cols-3 gap-2">
                                {perf?.momentum_score != null && (
                                    <div className={`flex flex-col items-center px-2 py-2.5 rounded-lg border text-center ${
                                        perf.momentum_score >= 2
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                            : perf.momentum_score >= 1
                                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                                : 'bg-slate-50 border-slate-200 text-slate-500'
                                    }`}>
                                        <TrendingUp className="w-3.5 h-3.5 mb-1 opacity-70" />
                                        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 leading-none mb-1">Momentum</p>
                                        <p className="text-lg font-bold leading-none">{perf.momentum_score.toFixed(2)}</p>
                                    </div>
                                )}
                                {perf?.simple_momentum_score != null && (
                                    <div className={`flex flex-col items-center px-2 py-2.5 rounded-lg border text-center ${
                                        perf.simple_momentum_score >= 2
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                            : perf.simple_momentum_score >= 1
                                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                                : 'bg-slate-50 border-slate-200 text-slate-500'
                                    }`}>
                                        <TrendingUp className="w-3.5 h-3.5 mb-1 opacity-70" />
                                        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 leading-none mb-1">Simple Mom.</p>
                                        <p className="text-lg font-bold leading-none">{perf.simple_momentum_score.toFixed(2)}</p>
                                    </div>
                                )}
                                {perf?.stage2_rs_rank != null && (
                                    <div className={`flex flex-col items-center px-2 py-2.5 rounded-lg border text-center ${
                                        perf.stage2_rs_rank >= 80
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                            : perf.stage2_rs_rank >= 50
                                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                                : 'bg-slate-50 border-slate-200 text-slate-500'
                                    }`}>
                                        <TrendingUp className="w-3.5 h-3.5 mb-1 opacity-70" />
                                        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 leading-none mb-1">Rel. Strength</p>
                                        <p className="text-lg font-bold leading-none">{perf.stage2_rs_rank.toFixed(1)}</p>
                                    </div>
                                )}
                            </div>
                            {stock.long_business_summary && (
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">About</p>
                                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-4">
                                        {stock.long_business_summary}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Performance strip — full width grid */}
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 grid grid-cols-7 gap-2">
                        <PerfTab label="1W"  value={perf?.change_1w} />
                        <PerfTab label="1M"  value={perf?.change_1m} />
                        <PerfTab label="3M"  value={perf?.change_3m} />
                        <PerfTab label="6M"  value={perf?.change_6m} />
                        <PerfTab label="1Y"  value={perf?.change_1y} />
                        <PerfTab label="3Y"  value={perf?.change_3y} />
                        <PerfTab label="5Y"  value={perf?.change_5y} />
                    </div>
                </div>

                {/* ── Tags card ─────────────────────────────────────────── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Tags</p>
                    <StockTags symbol={sym} initialTags={tags} />
                </div>

                {/* ── Chart card ────────────────────────────────────────── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5">
                    <StockChart data={chartData} />
                </div>

                {/* ── Quarterly Results ─────────────────────────────────── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quarterly Results</p>
                        <span className="text-xs text-slate-400">Values in ₹ Cr</span>
                    </div>
                    {quarters.length === 0 ? (
                        <p className="text-sm text-slate-400 italic py-4">
                            No data yet — click <strong className="text-slate-600 font-semibold">Sync Now</strong> to fetch from Screener.in.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-slate-200">
                                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Quarter</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Sales</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-300">QoQ</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-300">YoY</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">EBITDA</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-300">QoQ</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-300">YoY</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Net Profit</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-300">QoQ</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-300">YoY</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">EPS</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-300">QoQ</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-300">YoY</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">OPM%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {quarters.map((q, i) => {
                                        const prev4 = quarters[i + 4]
                                        const prev1 = quarters[i + 1]
                                        const isLatest = i === 0
                                        return (
                                            <tr
                                                key={`${q.quarter}-${q.year}`}
                                                className={`border-b border-slate-100 transition-colors ${
                                                    isLatest
                                                        ? 'bg-blue-50 hover:bg-blue-100/70'
                                                        : 'hover:bg-slate-50'
                                                }`}
                                            >
                                                <td className={`px-3 py-3 whitespace-nowrap ${isLatest ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                                                    {isLatest && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 mb-0.5 align-middle" />}
                                                    {q.quarter}
                                                </td>
                                                <td className={`px-3 py-3 text-right tabular-nums ${isLatest ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{fmtNum(q.revenue)}</td>
                                                <GrowthCell value={pct(q.revenue, prev1?.revenue)} />
                                                <GrowthCell value={pct(q.revenue, prev4?.revenue)} />
                                                <td className={`px-3 py-3 text-right tabular-nums ${isLatest ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{fmtNum(q.ebitda)}</td>
                                                <GrowthCell value={pct(q.ebitda, prev1?.ebitda)} />
                                                <GrowthCell value={pct(q.ebitda, prev4?.ebitda)} />
                                                <td className={`px-3 py-3 text-right tabular-nums ${isLatest ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{fmtNum(q.net_profit)}</td>
                                                <GrowthCell value={pct(q.net_profit, prev1?.net_profit)} />
                                                <GrowthCell value={pct(q.net_profit, prev4?.net_profit)} />
                                                <td className={`px-3 py-3 text-right tabular-nums ${isLatest ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{fmtNum(q.eps, 2)}</td>
                                                <GrowthCell value={pct(q.eps, prev1?.eps)} />
                                                <GrowthCell value={pct(q.eps, prev4?.eps)} />
                                                <td className={`px-3 py-3 text-right tabular-nums text-slate-500 ${isLatest ? 'font-bold' : ''}`}>
                                                    {q.opm_percent != null ? `${q.opm_percent.toFixed(1)}%` : '—'}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ── Two-column: News + Strategies ─────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* News */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Latest News</p>
                        {stock.news && stock.news.length > 0 ? (
                            <div className="divide-y divide-slate-100">
                                {stock.news.map((item: NewsItem) => (
                                    <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="min-w-0">
                                                <h3 className="text-sm font-medium text-slate-800 leading-snug mb-0.5">
                                                    {item.url ? (
                                                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">
                                                            {item.title}
                                                        </a>
                                                    ) : item.title}
                                                </h3>
                                                <p className="text-xs text-slate-400 line-clamp-1">{item.content}</p>
                                            </div>
                                            <span className="text-xs text-slate-300 whitespace-nowrap shrink-0 pt-0.5">
                                                {new Date(item.published_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400 italic">No recent news available.</p>
                        )}
                    </div>

                    {/* Strategy history stacked */}
                    <div className="space-y-4">
                        {/* ATH */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">ATH Strategy</p>
                            {athTrades.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead className="text-slate-400 border-b border-slate-100">
                                            <tr>
                                                <th className="pb-2 text-left font-medium">Entry</th>
                                                <th className="pb-2 text-right font-medium">Price</th>
                                                <th className="pb-2 text-right font-medium">Exit</th>
                                                <th className="pb-2 text-right font-medium">Price</th>
                                                <th className="pb-2 text-right font-medium">PnL</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {athTrades.map((t: any, i: number) => (
                                                <tr key={i} className="hover:bg-slate-50">
                                                    <td className="py-2 text-slate-500">{t.entry_date}</td>
                                                    <td className="py-2 text-right font-medium text-slate-700">₹{t.entry_price}</td>
                                                    <td className="py-2 text-right text-slate-500">{t.exit_date || '—'}</td>
                                                    <td className="py-2 text-right font-medium text-slate-700">{t.exit_price ? `₹${t.exit_price}` : '—'}</td>
                                                    <td className={`py-2 text-right font-bold ${t.pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400 italic">No trades in ATH Strategy.</p>
                            )}
                        </div>

                        {/* Simple Momentum */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Simple Momentum</p>
                            {momentumTrades.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead className="text-slate-400 border-b border-slate-100">
                                            <tr>
                                                <th className="pb-2 text-left font-medium">Month</th>
                                                <th className="pb-2 text-right font-medium">Score</th>
                                                <th className="pb-2 text-right font-medium">Return</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {momentumTrades.map((t: any, i: number) => (
                                                <tr key={i} className="hover:bg-slate-50">
                                                    <td className="py-2 text-slate-500">{t.month}</td>
                                                    <td className="py-2 text-right font-medium text-slate-700">{t.score.toFixed(2)}</td>
                                                    <td className={`py-2 text-right font-bold ${t.return >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {t.return >= 0 ? '+' : ''}{t.return.toFixed(2)}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400 italic">Not selected in Simple Momentum.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
