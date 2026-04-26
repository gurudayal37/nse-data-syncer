'use client'

import Link from 'next/link'
import {
  TrendingUp, BarChart3, Zap, Database,
  ArrowRight, PieChart, Activity, Shield,
  AlertCircle, ChevronRight, TrendingDown,
} from 'lucide-react'
import GlobalSearch from '@/components/GlobalSearch'

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
const fmtPct = (v: number) => { const s = v > 0 ? '+' : ''; return `${s}${v.toFixed(1)}%` }

export default function HomePage() {
  const strategies = [
    {
      title: 'Momentum Strategy', subtitle: '3M + 6M + 1Y', href: '/momentum-strategy',
      dot: 'bg-sky-400', rebalancing: 'Monthly',
      ret: g(momentumData, 'backtest_metrics.return_metrics.net_return_after_fees') as number,
      bench: g(momentumData, 'backtest_metrics.return_metrics.benchmark_return') as number,
      sharpe: g(momentumData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number,
      current: g(momentumData, 'current_metrics.return_metrics.net_return_after_fees') as number,
    },
    {
      title: 'Simple Momentum (Nifty)', subtitle: '6M + 1Y · Nifty TM', href: '/simple-momentum-strategy',
      dot: 'bg-violet-400', rebalancing: 'Monthly',
      ret: g(simpleMomentumData, 'backtest_metrics.return_metrics.net_return_after_fees') as number,
      bench: g(simpleMomentumData, 'backtest_metrics.return_metrics.benchmark_return') as number,
      sharpe: g(simpleMomentumData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number,
      current: g(simpleMomentumData, 'current_metrics.return_metrics.net_return_after_fees') as number,
    },
    {
      title: 'Simple Momentum (High Cap)', subtitle: '>2000 Cr Market Cap', href: '/simple-momentum-all-nifty',
      dot: 'bg-pink-400', rebalancing: 'Monthly',
      ret: g(simpleAllNiftyData, 'backtest_metrics.return_metrics.net_return_after_fees') as number,
      bench: g(simpleAllNiftyData, 'backtest_metrics.return_metrics.benchmark_return') as number,
      sharpe: g(simpleAllNiftyData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number,
      current: g(simpleAllNiftyData, 'current_metrics.return_metrics.net_return_after_fees') as number,
    },
    {
      title: 'Weekly Momentum', subtitle: 'Weekly Rebalancing', href: '/momentum-weekly-strategy',
      dot: 'bg-emerald-400', rebalancing: 'Weekly',
      ret: g(weeklyMomentumData, 'backtest_metrics.return_metrics.net_return_after_fees') as number,
      bench: g(weeklyMomentumData, 'backtest_metrics.return_metrics.benchmark_return') as number,
      sharpe: g(weeklyMomentumData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number,
      current: g(weeklyMomentumData, 'current_metrics.return_metrics.net_return_after_fees') as number,
    },
    {
      title: 'Simple Momentum Weekly', subtitle: 'Friday Rebalancing', href: '/simple-momentum-weekly-strategy',
      dot: 'bg-orange-400', rebalancing: 'Weekly',
      ret: g(simpleWeeklyData, 'backtest_metrics.return_metrics.net_return_after_fees') as number,
      bench: g(simpleWeeklyData, 'backtest_metrics.return_metrics.benchmark_return') as number,
      sharpe: g(simpleWeeklyData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number,
      current: g(simpleWeeklyData, 'current_metrics.return_metrics.net_return_after_fees') as number,
    },
    {
      title: 'ATH Breakout', subtitle: 'Breakouts > All-Time High', href: '/ath',
      dot: 'bg-rose-400', rebalancing: 'Daily',
      ret: null, bench: null, sharpe: null, current: null,
    },
  ]

  const dataPages = [
    { title: 'Momentum Stocks', desc: 'Full momentum score rankings', href: '/momentum', icon: TrendingUp, badge: 'Live', color: 'sky' },
    { title: 'Simple Momentum', desc: 'Simplified 6M + 1Y rankings', href: '/simple-momentum', icon: Zap, badge: 'Live', color: 'violet' },
    { title: 'All Stocks', desc: '750+ stocks with full metrics', href: '/stocks', icon: Database, badge: 'DB', color: 'slate' },
    { title: 'ETF Dashboard', desc: '300+ ETFs with OHLCV data', href: '/etf', icon: PieChart, badge: 'New', color: 'emerald' },
    { title: 'Stage 2 Stocks', desc: 'Minervini Trend Template', href: '/stage-2', icon: Activity, badge: 'Live', color: 'teal' },
    { title: 'Market Indices', desc: 'Nifty 50, Midcap & more', href: '/indices', icon: BarChart3, badge: 'New', color: 'indigo' },
  ]

  const iconBgMap: Record<string, string> = {
    sky: 'bg-sky-100 text-sky-600', violet: 'bg-violet-100 text-violet-600',
    slate: 'bg-slate-100 text-slate-500', emerald: 'bg-emerald-100 text-emerald-600',
    teal: 'bg-teal-100 text-teal-600', indigo: 'bg-indigo-100 text-indigo-600',
  }
  const badgeMap: Record<string, string> = {
    sky: 'bg-sky-50 text-sky-600 border border-sky-100', violet: 'bg-violet-50 text-violet-600 border border-violet-100',
    slate: 'bg-slate-50 text-slate-500 border border-slate-100', emerald: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    teal: 'bg-teal-50 text-teal-600 border border-teal-100', indigo: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-screen-xl mx-auto px-6 py-14 flex flex-col items-center text-center gap-6">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
            NSE India · Updated Daily
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Guru Momentum App
          </h1>
          <p className="text-slate-500 text-base max-w-xl">
            Systematic momentum investing for Indian equities — live rankings, backtested strategies, and research tools.
          </p>

          {/* Search */}
          <div className="w-full max-w-2xl">
            <GlobalSearch />
            <p className="text-xs text-slate-400 mt-2">Search 750+ NSE stocks and 300+ ETFs</p>
          </div>

        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-10 space-y-12">

        {/* ── Live Data & Rankings ──────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-500" />
              <h2 className="text-lg font-bold text-slate-800">Live Data &amp; Rankings</h2>
            </div>
            <span className="text-xs text-slate-400 font-medium">Updated daily</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {dataPages.map((page) => {
              const Icon = page.icon
              return (
                <Link key={page.href} href={page.href}
                  className="group bg-white rounded-2xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-md transition-all flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className={`p-2 rounded-xl ${iconBgMap[page.color]}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeMap[page.color]}`}>
                      {page.badge}
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-sm leading-tight">{page.title}</div>
                    <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">{page.desc}</div>
                  </div>
                  <div className="flex items-center gap-0.5 text-[11px] text-slate-400 group-hover:text-sky-500 font-medium mt-auto transition-colors">
                    Open <ArrowRight className="w-3 h-3" />
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        {/* ── Backtested Strategies ────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-500" />
              <h2 className="text-lg font-bold text-slate-800">Backtested Strategies</h2>
            </div>
            <Link href="/strategies" className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:text-sky-700 transition-colors">
              View full comparison <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {strategies.map((s) => {
              const alpha = s.ret != null && s.bench != null ? s.ret - s.bench : null
              const isWeekly = s.rebalancing.toLowerCase().includes('weekly')
              return (
                <Link key={s.href} href={s.href}
                  className="group bg-white rounded-2xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-md transition-all flex flex-col gap-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot}`} />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-sm truncate">{s.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{s.subtitle}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${isWeekly ? 'bg-violet-50 text-violet-600 border border-violet-100' : 'bg-sky-50 text-sky-600 border border-sky-100'}`}>
                      {s.rebalancing}
                    </span>
                  </div>

                  {/* Metrics */}
                  {s.ret != null ? (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-slate-50 rounded-xl px-3 py-2.5 text-center">
                        <div className="text-[10px] text-slate-400 font-medium mb-0.5">Net Return</div>
                        <div className={`text-sm font-bold ${s.ret >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtPct(s.ret)}</div>
                      </div>
                      <div className="bg-slate-50 rounded-xl px-3 py-2.5 text-center">
                        <div className="text-[10px] text-slate-400 font-medium mb-0.5">Alpha</div>
                        <div className={`text-sm font-bold ${alpha != null && alpha >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {alpha != null ? fmtPct(alpha) : '—'}
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-xl px-3 py-2.5 text-center">
                        <div className="text-[10px] text-slate-400 font-medium mb-0.5">Sharpe</div>
                        <div className={`text-sm font-bold ${s.sharpe != null && s.sharpe >= 1 ? 'text-emerald-600' : 'text-amber-500'}`}>
                          {s.sharpe != null ? s.sharpe.toFixed(2) : '—'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-xl px-3 py-3 text-center text-xs text-slate-400">Backtest in progress</div>
                  )}

                  {/* Current period */}
                  {s.current != null && (
                    <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-3">
                      <span className="text-slate-400 font-medium">Current period</span>
                      <div className={`flex items-center gap-1 font-bold ${s.current >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {s.current >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {fmtPct(s.current)}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-[11px] text-slate-400 group-hover:text-sky-500 font-medium transition-colors mt-auto">
                    View strategy <ChevronRight className="w-3 h-3" />
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        {/* ── Disclaimer ───────────────────────────────────────────── */}
        <div className="flex items-start gap-2.5 text-[11px] text-slate-400 bg-white border border-slate-100 rounded-2xl px-5 py-3.5">
          <AlertCircle className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5" />
          <span>All strategies are backtested from 2017 onwards on NSE-listed equities. Past performance does not guarantee future results. This is not financial advice.</span>
          <Shield className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5 ml-auto" />
        </div>
      </div>
    </div>
  )
}
