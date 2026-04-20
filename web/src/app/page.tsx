'use client'

import Link from 'next/link'
import {
  TrendingUp, BarChart3, Calendar, Zap, Database,
  ArrowRight, Sparkles, PieChart, Activity, Shield,
  AlertCircle, ChevronRight
} from 'lucide-react'

import momentumData from '@/data/backtest_results.json'
import simpleMomentumData from '@/data/backtest_results_simple.json'
import simpleAllNiftyData from '@/data/backtest_results_simple_all_nifty.json'
import weeklyMomentumData from '@/data/backtest_results_weekly.json'
import simpleWeeklyData from '@/data/backtest_results_simple_weekly.json'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = (obj: any, path: string, fallback: number | string = 0) => {
  const val = path.split('.').reduce((o: any, k: string) => o?.[k], obj)
  return val ?? fallback
}

const fmtPct = (v: number) => {
  if (typeof v !== 'number') return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}%`
}

const fmtNum = (v: number | string, d = 2) =>
  typeof v === 'number' ? v.toFixed(d) : String(v)

const retClass = (v: number | null) => {
  if (v === null) return 'text-gray-400'
  return v >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'
}

const DiffBadge = ({ ret, bench }: { ret: number; bench: number }) => {
  const diff = ret - bench
  return (
    <span className={`text-xs font-medium ${diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
      {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
    </span>
  )
}

const FreqBadge = ({ label }: { label: string }) => {
  const isWeekly = label.toLowerCase().includes('weekly')
  return (
    <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap
      ${isWeekly ? 'bg-violet-50 text-violet-600 border border-violet-100' : 'bg-sky-50 text-sky-600 border border-sky-100'}`}>
      {label}
    </span>
  )
}

export default function HomePage() {
  const strategies = [
    {
      title: 'Momentum Strategy',
      subtitle: '3M + 6M + 1Y, Equal Weight',
      href: '/momentum-strategy',
      icon: TrendingUp,
      dot: 'bg-sky-400',
      rebalancing: 'Monthly',
      historical: {
        period: g(momentumData, 'backtest_metrics.time_metrics.period') as string,
        totalReturn: g(momentumData, 'backtest_metrics.return_metrics.net_return_after_fees') as number,
        benchmark: g(momentumData, 'backtest_metrics.return_metrics.benchmark_return') as number,
        sharpe: g(momentumData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number,
        drawdown: g(momentumData, 'backtest_metrics.risk_metrics.max_drawdown') as number,
        winRate: g(momentumData, 'backtest_metrics.trade_statistics.win_rate') as number,
      },
      current: {
        period: g(momentumData, 'current_metrics.time_metrics.period') as string,
        totalReturn: g(momentumData, 'current_metrics.return_metrics.net_return_after_fees') as number,
        benchmark: g(momentumData, 'current_metrics.return_metrics.benchmark_return') as number,
        drawdown: g(momentumData, 'current_metrics.risk_metrics.max_drawdown') as number,
      },
    },
    {
      title: 'Simple Momentum (Nifty)',
      subtitle: '6M + 1Y, Nifty Total Market',
      href: '/simple-momentum-strategy',
      icon: Zap,
      dot: 'bg-violet-400',
      rebalancing: 'Monthly',
      historical: {
        period: g(simpleMomentumData, 'backtest_metrics.time_metrics.period') as string,
        totalReturn: g(simpleMomentumData, 'backtest_metrics.return_metrics.net_return_after_fees') as number,
        benchmark: g(simpleMomentumData, 'backtest_metrics.return_metrics.benchmark_return') as number,
        sharpe: g(simpleMomentumData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number,
        drawdown: g(simpleMomentumData, 'backtest_metrics.risk_metrics.max_drawdown') as number,
        winRate: g(simpleMomentumData, 'backtest_metrics.trade_statistics.win_rate') as number,
      },
      current: {
        period: g(simpleMomentumData, 'current_metrics.time_metrics.period') as string,
        totalReturn: g(simpleMomentumData, 'current_metrics.return_metrics.net_return_after_fees') as number,
        benchmark: g(simpleMomentumData, 'current_metrics.return_metrics.benchmark_return') as number,
        drawdown: g(simpleMomentumData, 'current_metrics.risk_metrics.max_drawdown') as number,
      },
    },
    {
      title: 'Simple Momentum (High Cap)',
      subtitle: '6M + 1Y, >2000 Cr Market Cap',
      href: '/simple-momentum-all-nifty',
      icon: Zap,
      dot: 'bg-pink-400',
      rebalancing: 'Monthly',
      historical: {
        period: g(simpleAllNiftyData, 'backtest_metrics.time_metrics.period') as string,
        totalReturn: g(simpleAllNiftyData, 'backtest_metrics.return_metrics.net_return_after_fees') as number,
        benchmark: g(simpleAllNiftyData, 'backtest_metrics.return_metrics.benchmark_return') as number,
        sharpe: g(simpleAllNiftyData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number,
        drawdown: g(simpleAllNiftyData, 'backtest_metrics.risk_metrics.max_drawdown') as number,
        winRate: g(simpleAllNiftyData, 'backtest_metrics.trade_statistics.win_rate') as number,
      },
      current: {
        period: g(simpleAllNiftyData, 'current_metrics.time_metrics.period') as string,
        totalReturn: g(simpleAllNiftyData, 'current_metrics.return_metrics.net_return_after_fees') as number,
        benchmark: g(simpleAllNiftyData, 'current_metrics.return_metrics.benchmark_return') as number,
        drawdown: g(simpleAllNiftyData, 'current_metrics.risk_metrics.max_drawdown') as number,
      },
    },
    {
      title: 'Weekly Momentum',
      subtitle: 'Full Momentum, Weekly Rebalancing',
      href: '/momentum-weekly-strategy',
      icon: Calendar,
      dot: 'bg-emerald-400',
      rebalancing: 'Weekly',
      historical: {
        period: g(weeklyMomentumData, 'backtest_metrics.time_metrics.period') as string,
        totalReturn: g(weeklyMomentumData, 'backtest_metrics.return_metrics.net_return_after_fees') as number,
        benchmark: g(weeklyMomentumData, 'backtest_metrics.return_metrics.benchmark_return') as number,
        sharpe: g(weeklyMomentumData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number,
        drawdown: g(weeklyMomentumData, 'backtest_metrics.risk_metrics.max_drawdown') as number,
        winRate: g(weeklyMomentumData, 'backtest_metrics.trade_statistics.win_rate') as number,
      },
      current: {
        period: g(weeklyMomentumData, 'current_metrics.time_metrics.period') as string,
        totalReturn: g(weeklyMomentumData, 'current_metrics.return_metrics.net_return_after_fees') as number,
        benchmark: g(weeklyMomentumData, 'current_metrics.return_metrics.benchmark_return') as number,
        drawdown: g(weeklyMomentumData, 'current_metrics.risk_metrics.max_drawdown') as number,
      },
    },
    {
      title: 'Simple Momentum Weekly',
      subtitle: '6M + 1Y, Friday Rebalancing',
      href: '/simple-momentum-weekly-strategy',
      icon: BarChart3,
      dot: 'bg-orange-400',
      rebalancing: 'Weekly',
      historical: {
        period: g(simpleWeeklyData, 'backtest_metrics.time_metrics.period') as string,
        totalReturn: g(simpleWeeklyData, 'backtest_metrics.return_metrics.net_return_after_fees') as number,
        benchmark: g(simpleWeeklyData, 'backtest_metrics.return_metrics.benchmark_return') as number,
        sharpe: g(simpleWeeklyData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number,
        drawdown: g(simpleWeeklyData, 'backtest_metrics.risk_metrics.max_drawdown') as number,
        winRate: g(simpleWeeklyData, 'backtest_metrics.trade_statistics.win_rate') as number,
      },
      current: {
        period: g(simpleWeeklyData, 'current_metrics.time_metrics.period') as string,
        totalReturn: g(simpleWeeklyData, 'current_metrics.return_metrics.net_return_after_fees') as number,
        benchmark: g(simpleWeeklyData, 'current_metrics.return_metrics.benchmark_return') as number,
        drawdown: g(simpleWeeklyData, 'current_metrics.risk_metrics.max_drawdown') as number,
      },
    },
    {
      title: 'ATH Breakout',
      subtitle: 'Monthly Breakouts > All-Time High',
      href: '/ath',
      icon: TrendingUp,
      dot: 'bg-rose-400',
      rebalancing: 'Daily/Weekly',
      historical: null,
      current: null,
    },
  ]

  const dataPages = [
    { title: 'Momentum Stocks', desc: 'Full momentum score rankings', href: '/momentum', icon: TrendingUp, badge: 'Live', color: 'sky' },
    { title: 'Simple Momentum', desc: 'Simplified 6M + 1Y rankings', href: '/simple-momentum', icon: Zap, badge: 'Live', color: 'violet' },
    { title: 'All Stocks', desc: '750+ stocks with full metrics', href: '/stocks', icon: Database, badge: 'DB', color: 'slate' },
    { title: 'ETF Dashboard', desc: '304+ ETFs with OHLCV data', href: '/etf', icon: PieChart, badge: 'New', color: 'emerald' },
    { title: 'Stage 2 Stocks', desc: 'Minervini Trend Template', href: '/stage-2', icon: Activity, badge: 'Live', color: 'teal' },
    { title: 'Market Indices', desc: 'Nifty 50, Midcap & more', href: '/indices', icon: BarChart3, badge: 'New', color: 'indigo' },
  ]

  const iconBgMap: Record<string, string> = {
    sky: 'bg-sky-100 text-sky-600',
    violet: 'bg-violet-100 text-violet-600',
    slate: 'bg-slate-100 text-slate-500',
    emerald: 'bg-emerald-100 text-emerald-600',
    teal: 'bg-teal-100 text-teal-600',
    indigo: 'bg-indigo-100 text-indigo-600',
  }

  const badgeMap: Record<string, string> = {
    sky: 'bg-sky-50 text-sky-600 border border-sky-100',
    violet: 'bg-violet-50 text-violet-600 border border-violet-100',
    slate: 'bg-slate-50 text-slate-500 border border-slate-100',
    emerald: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    teal: 'bg-teal-50 text-teal-600 border border-teal-100',
    indigo: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
  }

  return (
    <div className="min-h-screen bg-white">

      {/* ─── Header ─── */}
      <div className="border-b border-gray-100 bg-white">
        <div className="w-full px-6 lg:px-10 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-1.5 text-sky-600 text-xs font-medium mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                Systematic Momentum Investing · NSE India
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-gray-900 tracking-tight mb-1.5">
                NSE Momentum Strategies
              </h1>
              <p className="text-gray-600 text-sm max-w-lg font-medium">
                Quant-driven strategies for Indian equities — backtested 6–8 years with full risk metrics.
              </p>
            </div>
            <div className="flex gap-3 shrink-0 flex-wrap">
              {[
                { value: '5', label: 'Strategies' },
                { value: '8+', label: 'Years Data' },
                { value: '750+', label: 'Stocks' },
                { value: 'Daily', label: 'Updates' },
              ].map(s => (
                <div key={s.label} className="text-center bg-gray-50 border border-gray-100 rounded-xl px-5 py-3 min-w-[72px]">
                  <div className="text-xl font-extrabold text-gray-800">{s.value}</div>
                  <div className="text-[11px] text-gray-500 font-medium mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-6 lg:px-10 py-8 space-y-10">

        {/* ─── Strategy Table ─── */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <h2 className="text-base font-bold text-gray-800">Backtest Strategies</h2>
            <span className="text-[11px] text-gray-500 font-medium ml-auto">All returns net of fees · Benchmark = Nifty TotalMarket</span>
          </div>

          <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  {/* Group header row */}
                  <tr className="text-[11px] font-semibold uppercase tracking-wider border-b border-gray-100">
                    <th className="px-5 py-2.5 text-left text-gray-400 bg-gray-50" colSpan={2} />
                    <th className="px-4 py-2.5 text-center text-sky-500 bg-sky-50 border-l border-sky-100" colSpan={6}>
                      Historical Performance
                    </th>
                    <th className="px-4 py-2.5 text-center text-violet-500 bg-violet-50 border-l border-violet-100" colSpan={4}>
                      Current Period
                    </th>
                    <th className="bg-gray-50 px-4 py-2.5 border-l border-gray-100" />
                  </tr>
                  {/* Column labels */}
                  <tr className="bg-gray-50 text-[11px] text-gray-600 font-semibold border-b border-gray-200">
                    <th className="px-5 py-3 text-left text-gray-700 whitespace-nowrap">Strategy</th>
                    <th className="px-3 py-3 text-center whitespace-nowrap">Freq</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap border-l border-gray-100">Period</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">Net Return</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">vs Nifty</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">Sharpe</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">Max DD</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">Win %</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap border-l border-gray-100">Period</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">Net Return</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">vs Nifty</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">Max DD</th>
                    <th className="px-4 py-3 text-center border-l border-gray-100" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {strategies.map((s) => {
                    const Icon = s.icon
                    return (
                      <tr key={s.href} className="group hover:bg-gray-50 transition-colors">

                        {/* Strategy name */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                            <div>
                              <div className="font-bold text-gray-900 text-sm leading-tight">{s.title}</div>
                              <div className="text-[11px] text-gray-500 mt-0.5">{s.subtitle}</div>
                            </div>
                          </div>
                        </td>

                        {/* Freq badge */}
                        <td className="px-3 py-4 text-center">
                          <FreqBadge label={s.rebalancing} />
                        </td>

                        {/* Historical columns */}
                        {s.historical ? (
                          <>
                            <td className="px-4 py-4 text-center text-gray-500 text-xs font-medium whitespace-nowrap border-l border-gray-100">
                              {s.historical.period}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className={`text-sm ${retClass(s.historical.totalReturn)}`}>
                                {fmtPct(s.historical.totalReturn)}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <DiffBadge ret={s.historical.totalReturn} bench={s.historical.benchmark} />
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className={`text-sm font-medium ${s.historical.sharpe >= 1 ? 'text-emerald-600' : 'text-amber-500'}`}>
                                {fmtNum(s.historical.sharpe)}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center text-red-500 text-sm font-semibold">
                              {fmtPct(s.historical.drawdown)}
                            </td>
                            <td className="px-4 py-4 text-center text-gray-700 text-sm font-medium">
                              {fmtNum(s.historical.winRate, 1)}%
                            </td>
                          </>
                        ) : (
                          <td className="px-4 py-4 text-center text-gray-300 text-xs border-l border-gray-100" colSpan={6}>
                            In progress
                          </td>
                        )}

                        {/* Current columns */}
                        {s.current ? (
                          <>
                            <td className="px-4 py-4 text-center text-gray-500 text-xs font-medium whitespace-nowrap border-l border-gray-100">
                              {s.current.period}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className={`text-sm ${retClass(s.current.totalReturn)}`}>
                                {fmtPct(s.current.totalReturn)}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <DiffBadge ret={s.current.totalReturn} bench={s.current.benchmark} />
                            </td>
                            <td className="px-4 py-4 text-center text-red-500 text-sm font-semibold">
                              {fmtPct(s.current.drawdown)}
                            </td>
                          </>
                        ) : (
                          <td className="px-4 py-4 text-center text-gray-300 text-xs border-l border-gray-100" colSpan={4}>
                            —
                          </td>
                        )}

                        {/* View link */}
                        <td className="px-4 py-4 text-center border-l border-gray-100">
                          <Link
                            href={s.href}
                            className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-sky-600 transition-colors whitespace-nowrap group-hover:text-sky-600"
                          >
                            <Icon className="w-3.5 h-3.5" />
                            View
                            <ChevronRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Table footer legend */}
            <div className="flex flex-wrap items-center gap-5 px-5 py-2.5 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-sky-300 rounded inline-block" />
                Historical = backtest from 2017, net after fees
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-violet-300 rounded inline-block" />
                Current = Dec 2025 to present
              </span>
              <span className="flex items-center gap-1 ml-auto">
                <Shield className="w-3 h-3" />
                vs Nifty shows alpha over Nifty TotalMarket index
              </span>
            </div>
          </div>
        </section>

        {/* ─── Live Data & Tools ─── */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <Database className="w-4 h-4 text-gray-500" />
            <h2 className="text-base font-bold text-gray-800">Live Data & Rankings</h2>
            <span className="text-[11px] text-gray-500 font-medium ml-auto">Updated daily</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {dataPages.map((page) => {
              const Icon = page.icon
              return (
                <Link
                  key={page.href}
                  href={page.href}
                  className="group bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all duration-150 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between">
                    <div className={`p-2 rounded-lg ${iconBgMap[page.color] ?? 'bg-gray-100 text-gray-500'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeMap[page.color] ?? 'bg-gray-50 text-gray-400'}`}>
                      {page.badge}
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-gray-800 text-sm leading-tight group-hover:text-gray-900 transition-colors">
                      {page.title}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1 leading-relaxed">{page.desc}</div>
                  </div>
                  <div className="flex items-center gap-0.5 text-[11px] text-gray-400 group-hover:text-sky-500 font-medium mt-auto transition-colors">
                    Open <ArrowRight className="w-3 h-3" />
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        {/* ─── Disclaimer ─── */}
        <div className="flex items-start gap-2.5 text-[11px] text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-5 py-3">
          <AlertCircle className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-0.5" />
          All strategies are backtested from 2017 onwards on NSE-listed equities. Past performance does not guarantee future results. This is not financial advice.
        </div>
      </div>
    </div>
  )
}
