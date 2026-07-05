'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, TrendingDown, ChevronDown, ChevronRight } from 'lucide-react'
import swingData from '@/data/backtest_results_swing_setup.json'

type HorizonStats = {
    n: number
    win_rate: number
    avg_return_pct: number
    median_return_pct: number
    benchmark_avg_return_pct: number | null
} | null

type FilterResult = {
    trade_count: number
    '10d': HorizonStats
    '20d': HorizonStats
    '60d': HorizonStats
}

type Trade = {
    symbol: string
    date: string
    entry_price: number
    rs_rank: number
    adr_pct: number
    sector_return_pct: number
    fwd_return_10d_pct: number | null
    fwd_return_20d_pct: number | null
    fwd_return_60d_pct: number | null
}

type ResultsBlock = {
    stage2_only: FilterResult
    stage2_plus_rs: FilterResult
    full_combo: FilterResult
}

type SwingData = {
    last_updated: string
    config: {
        min_market_cap_cr: number
        rs_threshold: number
        adr_threshold_pct: number
        sector_lookback_days: number
        forward_horizons: number[]
        benchmark: string
    }
    universe_size: number
    current_year: number
    results: ResultsBlock
    results_current_year: ResultsBlock
    trades_by_month: Record<string, Trade[]>
}

const data = swingData as SwingData

const retClass = (v: number | null) =>
    v == null ? 'text-gray-400' : v >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'
const fmtPct = (v: number | null) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`)

const FILTER_ROWS: { key: keyof ResultsBlock; label: string; subtitle: string }[] = [
    { key: 'stage2_only', label: 'Strong Stock only', subtitle: 'Stage 2 trend template pass' },
    { key: 'stage2_plus_rs', label: '+ High RS', subtitle: `Stage 2 + RS rank >= ${data.config.rs_threshold}` },
    { key: 'full_combo', label: '+ Strong Sector + High ADR (full setup)', subtitle: `+ sector momentum > 0, ADR% >= ${data.config.adr_threshold_pct}` },
]

function ComparisonTable({ results, tradeLabel }: { results: ResultsBlock; tradeLabel: string }) {
    return (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-gray-900 font-medium border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4">Filter</th>
                            <th className="px-6 py-4 text-right">{tradeLabel}</th>
                            {(['10d', '20d', '60d'] as const).map((h) => (
                                <th key={h} className="px-6 py-4 text-right" colSpan={2}>{h} forward</th>
                            ))}
                        </tr>
                        <tr className="text-xs text-gray-400">
                            <th className="px-6"></th>
                            <th className="px-6"></th>
                            {(['10d', '20d', '60d'] as const).map((h) => (
                                <Fragment key={h}>
                                    <th className="px-3 text-right font-normal">Avg / Win%</th>
                                    <th className="px-3 text-right font-normal">vs Bench</th>
                                </Fragment>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {FILTER_ROWS.map(({ key, label, subtitle }) => {
                            const row = results[key]
                            return (
                                <tr key={key} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{label}</div>
                                        <div className="text-xs text-gray-400">{subtitle}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-gray-900">{row.trade_count.toLocaleString()}</td>
                                    {(['10d', '20d', '60d'] as const).map((h) => {
                                        const stats = row[h]
                                        return (
                                            <Fragment key={h}>
                                                <td className="px-3 py-4 text-right whitespace-nowrap">
                                                    {stats ? (
                                                        <>
                                                            <span className={retClass(stats.avg_return_pct)}>{fmtPct(stats.avg_return_pct)}</span>
                                                            <span className="text-gray-400"> / {stats.win_rate.toFixed(1)}%</span>
                                                        </>
                                                    ) : '—'}
                                                </td>
                                                <td className="px-3 py-4 text-right whitespace-nowrap text-gray-500">
                                                    {stats?.benchmark_avg_return_pct != null ? fmtPct(stats.benchmark_avg_return_pct) : '—'}
                                                </td>
                                            </Fragment>
                                        )
                                    })}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function MonthTradesTable({ trades }: { trades: Trade[] }) {
    return (
        <div className="overflow-x-auto border-t border-gray-100">
            <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                    <tr>
                        <th className="px-6 py-2">Symbol</th>
                        <th className="px-6 py-2">Entry Date</th>
                        <th className="px-6 py-2 text-right">Entry</th>
                        <th className="px-6 py-2 text-right">RS Rank</th>
                        <th className="px-6 py-2 text-right">ADR%</th>
                        <th className="px-6 py-2 text-right">Sector Ret%</th>
                        <th className="px-6 py-2 text-right">+10d</th>
                        <th className="px-6 py-2 text-right">+20d</th>
                        <th className="px-6 py-2 text-right">+60d</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {trades.map((t, i) => (
                        <tr key={`${t.symbol}-${t.date}-${i}`} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-3 font-medium text-gray-900">
                                <Link href={`/stock/${encodeURIComponent(t.symbol)}`} className="hover:underline text-blue-600">{t.symbol}</Link>
                            </td>
                            <td className="px-6 py-3">{t.date}</td>
                            <td className="px-6 py-3 text-right">₹{t.entry_price.toFixed(2)}</td>
                            <td className="px-6 py-3 text-right">{t.rs_rank.toFixed(1)}</td>
                            <td className="px-6 py-3 text-right">{t.adr_pct.toFixed(2)}</td>
                            <td className="px-6 py-3 text-right">{fmtPct(t.sector_return_pct)}</td>
                            <td className={`px-6 py-3 text-right ${retClass(t.fwd_return_10d_pct)}`}>{fmtPct(t.fwd_return_10d_pct)}</td>
                            <td className={`px-6 py-3 text-right ${retClass(t.fwd_return_20d_pct)}`}>{fmtPct(t.fwd_return_20d_pct)}</td>
                            <td className={`px-6 py-3 text-right ${retClass(t.fwd_return_60d_pct)}`}>{fmtPct(t.fwd_return_60d_pct)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

export default function SwingSetupPage() {
    const [searchTerm, setSearchTerm] = useState('')
    const months = Object.keys(data.trades_by_month).sort((a, b) => b.localeCompare(a))
    const [openMonths, setOpenMonths] = useState<Set<string>>(new Set(months.slice(0, 2)))

    const filteredMonths = months
        .map((month) => ({
            month,
            trades: data.trades_by_month[month].filter((t) =>
                t.symbol.toLowerCase().includes(searchTerm.toLowerCase())
            ),
        }))
        .filter(({ trades }) => trades.length > 0)

    const toggleMonth = (month: string) => {
        setOpenMonths((prev) => {
            const next = new Set(prev)
            if (next.has(month)) next.delete(month)
            else next.add(month)
            return next
        })
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Swing Setup: Strong Stock + Strong Sector + High RS + High ADR</h1>
                        <p className="text-gray-500 mt-1">
                            Historical forward-return study, not a live rebalanced strategy — measures what happened
                            after each trade entry, at 10/20/60 trading-day horizons, vs {data.config.benchmark} (Nifty 500)
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Last Updated: {data.last_updated}</p>
                    </div>
                </div>

                {/* Caveats */}
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <TrendingDown className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-800">Read this as directional, not a live track record</h3>
                            <div className="text-sm text-yellow-700 mt-1 space-y-1">
                                <p>
                                    Each row below is one trade: the first day a stock enters a qualifying streak for
                                    that filter (re-qualifying on a later day while still in the same streak doesn&apos;t
                                    count again).
                                </p>
                                <p>
                                    This is a historical backtest on survived, currently-active stocks with ≥{data.config.min_market_cap_cr} Cr
                                    market cap today — it does not correct for stocks that were delisted or fell below
                                    that cap along the way. The {data.current_year} numbers are a partial year and can move a lot with a handful of trades, especially at the 60-day horizon.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Config */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-8">
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Screening Criteria</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
                        <div><span className="text-gray-400">Universe</span><div className="font-medium text-gray-900">{data.universe_size} stocks, ≥{data.config.min_market_cap_cr} Cr</div></div>
                        <div><span className="text-gray-400">Strong Stock</span><div className="font-medium text-gray-900">Stage 2 trend template</div></div>
                        <div><span className="text-gray-400">High RS</span><div className="font-medium text-gray-900">RS rank ≥ {data.config.rs_threshold}</div></div>
                        <div><span className="text-gray-400">Strong Sector</span><div className="font-medium text-gray-900">{data.config.sector_lookback_days}d sector return &gt; 0</div></div>
                        <div><span className="text-gray-400">High ADR</span><div className="font-medium text-gray-900">ADR% ≥ {data.config.adr_threshold_pct}</div></div>
                    </div>
                </div>

                {/* 2026 stats */}
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{data.current_year} Performance (Current Year)</h2>
                <div className="mb-8">
                    <ComparisonTable results={data.results_current_year} tradeLabel="Trades" />
                </div>

                {/* All-time stats */}
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">All-Time Backtest (2015–present)</h2>
                <div className="mb-8">
                    <ComparisonTable results={data.results} tradeLabel="Trades" />
                </div>

                {/* Trades by month */}
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                        Full-Setup Trades by Month
                    </h2>
                    <input
                        type="text"
                        placeholder="Search symbol..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="rounded-md border border-gray-200 py-2 px-3 text-sm outline-none w-64"
                    />
                </div>
                <div className="space-y-3">
                    {filteredMonths.map(({ month, trades }) => {
                        const isOpen = openMonths.has(month) || searchTerm.length > 0
                        return (
                            <div key={month} className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                                <button
                                    onClick={() => toggleMonth(month)}
                                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                                >
                                    <span className="font-medium text-gray-900">{month}</span>
                                    <span className="flex items-center gap-2 text-sm text-gray-500">
                                        {trades.length} trade{trades.length !== 1 ? 's' : ''}
                                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </span>
                                </button>
                                {isOpen && <MonthTradesTable trades={trades} />}
                            </div>
                        )
                    })}
                    {filteredMonths.length === 0 && (
                        <div className="bg-white shadow-sm rounded-lg border border-gray-200 px-6 py-8 text-center text-gray-500">
                            No trades match your search.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
