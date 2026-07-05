import Link from 'next/link'
import { Shield, ArrowLeft, PauseCircle } from 'lucide-react'
import momentumData from '@/data/backtest_results.json'
import simpleMomentumData from '@/data/backtest_results_simple.json'
import simpleAllNiftyData from '@/data/backtest_results_simple_all_nifty.json'
import weeklyMomentumData from '@/data/backtest_results_weekly.json'
import simpleWeeklyData from '@/data/backtest_results_simple_weekly.json'
import momentum10PctStopData from '@/data/backtest_results_10pct_stop.json'
import simpleMomentum10PctStopData from '@/data/backtest_results_simple_10pct_stop.json'
import simpleAllNifty10PctStopData from '@/data/backtest_results_simple_all_nifty_10pct_stop.json'
import longShortData from '@/data/backtest_results_long_short.json'
import quickMomentumData from '@/data/backtest_results_quick_momentum.json'
import quickMomentum10PctStopData from '@/data/backtest_results_quick_momentum_10pct_stop.json'
import usMomentumData from '@/data/backtest_results_us_momentum.json'
import usMomentum10PctStopData from '@/data/backtest_results_us_momentum_10pct_stop.json'
import usSimpleMomentumData from '@/data/backtest_results_us_simple_momentum.json'
import usSimpleMomentum10PctStopData from '@/data/backtest_results_us_simple_momentum_10pct_stop.json'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = (obj: any, path: string, fallback: number | string = 0) => {
  const val = path.split('.').reduce((o: any, k: string) => o?.[k], obj)
  return val ?? fallback
}
const fmtPct = (v: number) => { const s = v > 0 ? '+' : ''; return `${s}${v.toFixed(1)}%` }
const fmtNum = (v: number | string, d = 2) => typeof v === 'number' ? v.toFixed(d) : String(v)
const retClass = (v: number | null) => v == null ? 'text-gray-400' : v >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'

const DiffBadge = ({ ret, bench }: { ret: number; bench: number }) => {
  const diff = ret - bench
  return <span className={`text-xs font-medium ${diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{diff >= 0 ? '+' : ''}{diff.toFixed(1)}%</span>
}

const FreqBadge = ({ label }: { label: string }) => (
  <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap ${label.toLowerCase().includes('weekly') ? 'bg-violet-50 text-violet-600 border border-violet-100' : 'bg-sky-50 text-sky-600 border border-sky-100'}`}>
    {label}
  </span>
)

const strategies = [
  // ── Active strategies (updated daily) ──────────────────────────────────
  {
    title: 'Momentum Strategy', subtitle: '3M + 6M + 1Y, Equal Weight',
    href: '/momentum-strategy', dot: 'bg-sky-400', rebalancing: 'Monthly',
    historical: { period: g(momentumData, 'backtest_metrics.time_metrics.period') as string, totalReturn: g(momentumData, 'backtest_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(momentumData, 'backtest_metrics.return_metrics.benchmark_return') as number, sharpe: g(momentumData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number, drawdown: g(momentumData, 'backtest_metrics.risk_metrics.max_drawdown') as number, winRate: g(momentumData, 'backtest_metrics.trade_statistics.win_rate') as number },
    current: { period: g(momentumData, 'current_metrics.time_metrics.period') as string, totalReturn: g(momentumData, 'current_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(momentumData, 'current_metrics.return_metrics.benchmark_return') as number, drawdown: g(momentumData, 'current_metrics.risk_metrics.max_drawdown') as number },
  },
  {
    title: 'Momentum + 10% Stop', subtitle: '3M + 6M + 1Y, -10% Monthly Stop Loss',
    href: '/momentum-10pct-stop-strategy', dot: 'bg-red-400', rebalancing: 'Monthly',
    historical: g(momentum10PctStopData, 'backtest_metrics') ? { period: g(momentum10PctStopData, 'backtest_metrics.time_metrics.period') as string, totalReturn: g(momentum10PctStopData, 'backtest_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(momentum10PctStopData, 'backtest_metrics.return_metrics.benchmark_return') as number, sharpe: g(momentum10PctStopData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number, drawdown: g(momentum10PctStopData, 'backtest_metrics.risk_metrics.max_drawdown') as number, winRate: g(momentum10PctStopData, 'backtest_metrics.trade_statistics.win_rate') as number } : null,
    current: g(momentum10PctStopData, 'current_metrics') ? { period: g(momentum10PctStopData, 'current_metrics.time_metrics.period') as string, totalReturn: g(momentum10PctStopData, 'current_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(momentum10PctStopData, 'current_metrics.return_metrics.benchmark_return') as number, drawdown: g(momentum10PctStopData, 'current_metrics.risk_metrics.max_drawdown') as number } : null,
  },
  {
    title: 'Simple Momentum (Nifty)', subtitle: '6M + 1Y, Nifty Total Market',
    href: '/simple-momentum-strategy', dot: 'bg-violet-400', rebalancing: 'Monthly',
    historical: { period: g(simpleMomentumData, 'backtest_metrics.time_metrics.period') as string, totalReturn: g(simpleMomentumData, 'backtest_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(simpleMomentumData, 'backtest_metrics.return_metrics.benchmark_return') as number, sharpe: g(simpleMomentumData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number, drawdown: g(simpleMomentumData, 'backtest_metrics.risk_metrics.max_drawdown') as number, winRate: g(simpleMomentumData, 'backtest_metrics.trade_statistics.win_rate') as number },
    current: { period: g(simpleMomentumData, 'current_metrics.time_metrics.period') as string, totalReturn: g(simpleMomentumData, 'current_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(simpleMomentumData, 'current_metrics.return_metrics.benchmark_return') as number, drawdown: g(simpleMomentumData, 'current_metrics.risk_metrics.max_drawdown') as number },
  },
  {
    title: 'Simple Momentum (Nifty) + 10% Stop', subtitle: '6M + 1Y, Nifty Total Market, -10% Monthly Stop',
    href: '/simple-momentum-10pct-stop-strategy', dot: 'bg-amber-400', rebalancing: 'Monthly',
    historical: g(simpleMomentum10PctStopData, 'backtest_metrics') ? { period: g(simpleMomentum10PctStopData, 'backtest_metrics.time_metrics.period') as string, totalReturn: g(simpleMomentum10PctStopData, 'backtest_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(simpleMomentum10PctStopData, 'backtest_metrics.return_metrics.benchmark_return') as number, sharpe: g(simpleMomentum10PctStopData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number, drawdown: g(simpleMomentum10PctStopData, 'backtest_metrics.risk_metrics.max_drawdown') as number, winRate: g(simpleMomentum10PctStopData, 'backtest_metrics.trade_statistics.win_rate') as number } : null,
    current: g(simpleMomentum10PctStopData, 'current_metrics') ? { period: g(simpleMomentum10PctStopData, 'current_metrics.time_metrics.period') as string, totalReturn: g(simpleMomentum10PctStopData, 'current_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(simpleMomentum10PctStopData, 'current_metrics.return_metrics.benchmark_return') as number, drawdown: g(simpleMomentum10PctStopData, 'current_metrics.risk_metrics.max_drawdown') as number } : null,
  },
  {
    title: 'Simple Momentum (High Cap)', subtitle: '6M + 1Y, >2000 Cr Market Cap',
    href: '/simple-momentum-all-nifty', dot: 'bg-pink-400', rebalancing: 'Monthly',
    historical: { period: g(simpleAllNiftyData, 'backtest_metrics.time_metrics.period') as string, totalReturn: g(simpleAllNiftyData, 'backtest_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(simpleAllNiftyData, 'backtest_metrics.return_metrics.benchmark_return') as number, sharpe: g(simpleAllNiftyData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number, drawdown: g(simpleAllNiftyData, 'backtest_metrics.risk_metrics.max_drawdown') as number, winRate: g(simpleAllNiftyData, 'backtest_metrics.trade_statistics.win_rate') as number },
    current: { period: g(simpleAllNiftyData, 'current_metrics.time_metrics.period') as string, totalReturn: g(simpleAllNiftyData, 'current_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(simpleAllNiftyData, 'current_metrics.return_metrics.benchmark_return') as number, drawdown: g(simpleAllNiftyData, 'current_metrics.risk_metrics.max_drawdown') as number },
  },
  {
    title: 'Simple Momentum (High Cap) + 10% Stop', subtitle: '6M + 1Y, >2000 Cr, -10% Monthly Stop',
    href: '/simple-momentum-all-nifty-10pct-stop', dot: 'bg-fuchsia-400', rebalancing: 'Monthly',
    historical: g(simpleAllNifty10PctStopData, 'backtest_metrics') ? { period: g(simpleAllNifty10PctStopData, 'backtest_metrics.time_metrics.period') as string, totalReturn: g(simpleAllNifty10PctStopData, 'backtest_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(simpleAllNifty10PctStopData, 'backtest_metrics.return_metrics.benchmark_return') as number, sharpe: g(simpleAllNifty10PctStopData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number, drawdown: g(simpleAllNifty10PctStopData, 'backtest_metrics.risk_metrics.max_drawdown') as number, winRate: g(simpleAllNifty10PctStopData, 'backtest_metrics.trade_statistics.win_rate') as number } : null,
    current: g(simpleAllNifty10PctStopData, 'current_metrics') ? { period: g(simpleAllNifty10PctStopData, 'current_metrics.time_metrics.period') as string, totalReturn: g(simpleAllNifty10PctStopData, 'current_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(simpleAllNifty10PctStopData, 'current_metrics.return_metrics.benchmark_return') as number, drawdown: g(simpleAllNifty10PctStopData, 'current_metrics.risk_metrics.max_drawdown') as number } : null,
  },
  // ── US Strategies ──────────────────────────────────────────────────────
  {
    title: 'US Momentum', subtitle: '3M + 6M + 1Y, Russell 1000 Universe',
    href: '/us-momentum-strategy', dot: 'bg-blue-500', rebalancing: 'Monthly',
    historical: g(usMomentumData, 'backtest_metrics') ? { period: g(usMomentumData, 'backtest_metrics.time_metrics.period') as string, totalReturn: g(usMomentumData, 'backtest_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(usMomentumData, 'backtest_metrics.return_metrics.benchmark_return') as number, sharpe: g(usMomentumData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number, drawdown: g(usMomentumData, 'backtest_metrics.risk_metrics.max_drawdown') as number, winRate: g(usMomentumData, 'backtest_metrics.trade_statistics.win_rate') as number } : null,
    current: g(usMomentumData, 'current_metrics') ? { period: g(usMomentumData, 'current_metrics.time_metrics.period') as string, totalReturn: g(usMomentumData, 'current_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(usMomentumData, 'current_metrics.return_metrics.benchmark_return') as number, drawdown: g(usMomentumData, 'current_metrics.risk_metrics.max_drawdown') as number } : null,
  },
  {
    title: 'US Momentum + 10% Stop', subtitle: '3M + 6M + 1Y, -10% Monthly Stop',
    href: '/us-momentum-10pct-stop-strategy', dot: 'bg-blue-700', rebalancing: 'Monthly',
    historical: g(usMomentum10PctStopData, 'backtest_metrics') ? { period: g(usMomentum10PctStopData, 'backtest_metrics.time_metrics.period') as string, totalReturn: g(usMomentum10PctStopData, 'backtest_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(usMomentum10PctStopData, 'backtest_metrics.return_metrics.benchmark_return') as number, sharpe: g(usMomentum10PctStopData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number, drawdown: g(usMomentum10PctStopData, 'backtest_metrics.risk_metrics.max_drawdown') as number, winRate: g(usMomentum10PctStopData, 'backtest_metrics.trade_statistics.win_rate') as number } : null,
    current: g(usMomentum10PctStopData, 'current_metrics') ? { period: g(usMomentum10PctStopData, 'current_metrics.time_metrics.period') as string, totalReturn: g(usMomentum10PctStopData, 'current_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(usMomentum10PctStopData, 'current_metrics.return_metrics.benchmark_return') as number, drawdown: g(usMomentum10PctStopData, 'current_metrics.risk_metrics.max_drawdown') as number } : null,
  },
  {
    title: 'US Simple Momentum', subtitle: '6M + 1Y, Russell 1000 Universe',
    href: '/us-simple-momentum-strategy', dot: 'bg-indigo-500', rebalancing: 'Monthly',
    historical: g(usSimpleMomentumData, 'backtest_metrics') ? { period: g(usSimpleMomentumData, 'backtest_metrics.time_metrics.period') as string, totalReturn: g(usSimpleMomentumData, 'backtest_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(usSimpleMomentumData, 'backtest_metrics.return_metrics.benchmark_return') as number, sharpe: g(usSimpleMomentumData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number, drawdown: g(usSimpleMomentumData, 'backtest_metrics.risk_metrics.max_drawdown') as number, winRate: g(usSimpleMomentumData, 'backtest_metrics.trade_statistics.win_rate') as number } : null,
    current: g(usSimpleMomentumData, 'current_metrics') ? { period: g(usSimpleMomentumData, 'current_metrics.time_metrics.period') as string, totalReturn: g(usSimpleMomentumData, 'current_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(usSimpleMomentumData, 'current_metrics.return_metrics.benchmark_return') as number, drawdown: g(usSimpleMomentumData, 'current_metrics.risk_metrics.max_drawdown') as number } : null,
  },
  {
    title: 'US Simple Momentum + 10% Stop', subtitle: '6M + 1Y, -10% Monthly Stop',
    href: '/us-simple-momentum-10pct-stop-strategy', dot: 'bg-indigo-700', rebalancing: 'Monthly',
    historical: g(usSimpleMomentum10PctStopData, 'backtest_metrics') ? { period: g(usSimpleMomentum10PctStopData, 'backtest_metrics.time_metrics.period') as string, totalReturn: g(usSimpleMomentum10PctStopData, 'backtest_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(usSimpleMomentum10PctStopData, 'backtest_metrics.return_metrics.benchmark_return') as number, sharpe: g(usSimpleMomentum10PctStopData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number, drawdown: g(usSimpleMomentum10PctStopData, 'backtest_metrics.risk_metrics.max_drawdown') as number, winRate: g(usSimpleMomentum10PctStopData, 'backtest_metrics.trade_statistics.win_rate') as number } : null,
    current: g(usSimpleMomentum10PctStopData, 'current_metrics') ? { period: g(usSimpleMomentum10PctStopData, 'current_metrics.time_metrics.period') as string, totalReturn: g(usSimpleMomentum10PctStopData, 'current_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(usSimpleMomentum10PctStopData, 'current_metrics.return_metrics.benchmark_return') as number, drawdown: g(usSimpleMomentum10PctStopData, 'current_metrics.risk_metrics.max_drawdown') as number } : null,
  },
]

const pausedStrategies = [
  {
    title: 'Quick Momentum', subtitle: '1M + 3M + 6M + 1Y, Equal Weight',
    href: '/quick-momentum-strategy', dot: 'bg-teal-400', rebalancing: 'Monthly',
    historical: g(quickMomentumData, 'backtest_metrics') ? { period: g(quickMomentumData, 'backtest_metrics.time_metrics.period') as string, totalReturn: g(quickMomentumData, 'backtest_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(quickMomentumData, 'backtest_metrics.return_metrics.benchmark_return') as number, sharpe: g(quickMomentumData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number, drawdown: g(quickMomentumData, 'backtest_metrics.risk_metrics.max_drawdown') as number, winRate: g(quickMomentumData, 'backtest_metrics.trade_statistics.win_rate') as number } : null,
    current: g(quickMomentumData, 'current_metrics') ? { period: g(quickMomentumData, 'current_metrics.time_metrics.period') as string, totalReturn: g(quickMomentumData, 'current_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(quickMomentumData, 'current_metrics.return_metrics.benchmark_return') as number, drawdown: g(quickMomentumData, 'current_metrics.risk_metrics.max_drawdown') as number } : null,
  },
  {
    title: 'Quick Momentum + 10% Stop', subtitle: '1M + 3M + 6M + 1Y, -10% Monthly Stop Loss',
    href: '/quick-momentum-10pct-stop-strategy', dot: 'bg-teal-600', rebalancing: 'Monthly',
    historical: g(quickMomentum10PctStopData, 'backtest_metrics') ? { period: g(quickMomentum10PctStopData, 'backtest_metrics.time_metrics.period') as string, totalReturn: g(quickMomentum10PctStopData, 'backtest_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(quickMomentum10PctStopData, 'backtest_metrics.return_metrics.benchmark_return') as number, sharpe: g(quickMomentum10PctStopData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number, drawdown: g(quickMomentum10PctStopData, 'backtest_metrics.risk_metrics.max_drawdown') as number, winRate: g(quickMomentum10PctStopData, 'backtest_metrics.trade_statistics.win_rate') as number } : null,
    current: g(quickMomentum10PctStopData, 'current_metrics') ? { period: g(quickMomentum10PctStopData, 'current_metrics.time_metrics.period') as string, totalReturn: g(quickMomentum10PctStopData, 'current_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(quickMomentum10PctStopData, 'current_metrics.return_metrics.benchmark_return') as number, drawdown: g(quickMomentum10PctStopData, 'current_metrics.risk_metrics.max_drawdown') as number } : null,
  },
  {
    title: 'Weekly Momentum', subtitle: 'Full Momentum, Weekly Rebalancing',
    href: '/momentum-weekly-strategy', dot: 'bg-emerald-400', rebalancing: 'Weekly',
    historical: { period: g(weeklyMomentumData, 'backtest_metrics.time_metrics.period') as string, totalReturn: g(weeklyMomentumData, 'backtest_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(weeklyMomentumData, 'backtest_metrics.return_metrics.benchmark_return') as number, sharpe: g(weeklyMomentumData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number, drawdown: g(weeklyMomentumData, 'backtest_metrics.risk_metrics.max_drawdown') as number, winRate: g(weeklyMomentumData, 'backtest_metrics.trade_statistics.win_rate') as number },
    current: { period: g(weeklyMomentumData, 'current_metrics.time_metrics.period') as string, totalReturn: g(weeklyMomentumData, 'current_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(weeklyMomentumData, 'current_metrics.return_metrics.benchmark_return') as number, drawdown: g(weeklyMomentumData, 'current_metrics.risk_metrics.max_drawdown') as number },
  },
  {
    title: 'Simple Momentum Weekly', subtitle: '6M + 1Y, Friday Rebalancing',
    href: '/simple-momentum-weekly-strategy', dot: 'bg-orange-400', rebalancing: 'Weekly',
    historical: { period: g(simpleWeeklyData, 'backtest_metrics.time_metrics.period') as string, totalReturn: g(simpleWeeklyData, 'backtest_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(simpleWeeklyData, 'backtest_metrics.return_metrics.benchmark_return') as number, sharpe: g(simpleWeeklyData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number, drawdown: g(simpleWeeklyData, 'backtest_metrics.risk_metrics.max_drawdown') as number, winRate: g(simpleWeeklyData, 'backtest_metrics.trade_statistics.win_rate') as number },
    current: { period: g(simpleWeeklyData, 'current_metrics.time_metrics.period') as string, totalReturn: g(simpleWeeklyData, 'current_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(simpleWeeklyData, 'current_metrics.return_metrics.benchmark_return') as number, drawdown: g(simpleWeeklyData, 'current_metrics.risk_metrics.max_drawdown') as number },
  },
  {
    title: 'Long-Short Momentum (Futures)', subtitle: 'Top 7 Long + Bottom 7 Short, Dollar-Neutral',
    href: '/long-short-strategy', dot: 'bg-cyan-400', rebalancing: 'Monthly',
    historical: g(longShortData, 'backtest_metrics') ? { period: g(longShortData, 'backtest_metrics.time_metrics.period') as string, totalReturn: g(longShortData, 'backtest_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(longShortData, 'backtest_metrics.return_metrics.benchmark_return') as number, sharpe: g(longShortData, 'backtest_metrics.risk_metrics.sharpe_ratio') as number, drawdown: g(longShortData, 'backtest_metrics.risk_metrics.max_drawdown') as number, winRate: g(longShortData, 'backtest_metrics.trade_statistics.win_rate') as number } : null,
    current: g(longShortData, 'current_metrics') ? { period: g(longShortData, 'current_metrics.time_metrics.period') as string, totalReturn: g(longShortData, 'current_metrics.return_metrics.net_return_after_fees') as number, benchmark: g(longShortData, 'current_metrics.return_metrics.benchmark_return') as number, drawdown: g(longShortData, 'current_metrics.risk_metrics.max_drawdown') as number } : null,
  },
  {
    title: 'ATH Breakout', subtitle: 'Monthly Breakouts > All-Time High',
    href: '/ath', dot: 'bg-rose-400', rebalancing: 'Daily/Weekly',
    historical: null, current: null,
  },
  {
    title: 'Swing Setup', subtitle: 'Strong Stock + Strong Sector + High RS + High ADR',
    href: '/swing-setup', dot: 'bg-orange-400', rebalancing: 'Signal-based',
    historical: null, current: null,
  },
]

export default function StrategiesPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="px-6 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Backtested Strategies</h1>
          <p className="text-sm text-slate-500 mt-1">Indian strategies: backtested from 2017 on NSE equities · US strategies: backtested from 2010 on Russell 1000 · Returns net after fees</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wider border-b border-slate-100">
                  <th className="px-5 py-2.5 text-left text-slate-400 bg-slate-50" colSpan={2} />
                  <th className="px-4 py-2.5 text-center text-sky-500 bg-sky-50 border-l border-sky-100" colSpan={6}>Historical Performance</th>
                  <th className="px-4 py-2.5 text-center text-violet-500 bg-violet-50 border-l border-violet-100" colSpan={4}>Current Period</th>
                </tr>
                <tr className="bg-slate-50 text-[11px] text-slate-600 font-semibold border-b border-slate-200">
                  <th className="px-5 py-3 text-left text-slate-700 whitespace-nowrap">Strategy</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap">Freq</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap border-l border-slate-100">Period</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Net Return</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">vs Bench</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Sharpe</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Max DD</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Win %</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap border-l border-slate-100">Period</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Net Return</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">vs Bench</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Max DD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {strategies.map((s) => (
                  <tr key={s.href} className="group hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                        <div>
                          <Link href={s.href} target="_blank" rel="noopener noreferrer" className="font-bold text-slate-900 text-sm hover:text-sky-600 transition-colors">{s.title}</Link>
                          <div className="text-[11px] text-slate-500 mt-0.5">{s.subtitle}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-center"><FreqBadge label={s.rebalancing} /></td>
                    {s.historical ? (
                      <>
                        <td className="px-4 py-4 text-center text-slate-500 text-xs font-medium whitespace-nowrap border-l border-slate-100">{s.historical.period}</td>
                        <td className="px-4 py-4 text-center"><span className={`text-sm ${retClass(s.historical.totalReturn)}`}>{fmtPct(s.historical.totalReturn)}</span></td>
                        <td className="px-4 py-4 text-center"><DiffBadge ret={s.historical.totalReturn} bench={s.historical.benchmark} /></td>
                        <td className="px-4 py-4 text-center"><span className={`text-sm font-medium ${s.historical.sharpe >= 1 ? 'text-emerald-600' : 'text-amber-500'}`}>{fmtNum(s.historical.sharpe)}</span></td>
                        <td className="px-4 py-4 text-center text-red-500 text-sm font-semibold">{fmtPct(s.historical.drawdown)}</td>
                        <td className="px-4 py-4 text-center text-slate-700 text-sm font-medium">{fmtNum(s.historical.winRate, 1)}%</td>
                      </>
                    ) : (
                      <td className="px-4 py-4 text-center text-slate-300 text-xs border-l border-slate-100" colSpan={6}>In progress</td>
                    )}
                    {s.current ? (
                      <>
                        <td className="px-4 py-4 text-center text-slate-500 text-xs font-medium whitespace-nowrap border-l border-slate-100">{s.current.period}</td>
                        <td className="px-4 py-4 text-center"><span className={`text-sm ${retClass(s.current.totalReturn)}`}>{fmtPct(s.current.totalReturn)}</span></td>
                        <td className="px-4 py-4 text-center"><DiffBadge ret={s.current.totalReturn} bench={s.current.benchmark} /></td>
                        <td className="px-4 py-4 text-center text-red-500 text-sm font-semibold">{fmtPct(s.current.drawdown)}</td>
                      </>
                    ) : (
                      <td className="px-4 py-4 text-center text-slate-300 text-xs border-l border-slate-100" colSpan={4}>—</td>
                    )}
                  </tr>
                ))}

                {/* Paused strategies separator */}
                <tr>
                  <td colSpan={12} className="px-5 py-2 bg-slate-50 border-t border-slate-200">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <PauseCircle className="w-3.5 h-3.5" />
                      Paused — data frozen, no longer updated
                    </div>
                  </td>
                </tr>

                {pausedStrategies.map((s) => (
                  <tr key={s.href} className="group hover:bg-slate-50 transition-colors opacity-60">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot} opacity-50`} />
                        <div>
                          <Link href={s.href} target="_blank" rel="noopener noreferrer" className="font-bold text-slate-500 text-sm hover:text-sky-600 transition-colors">{s.title}</Link>
                          <div className="text-[11px] text-slate-400 mt-0.5">{s.subtitle}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-center"><FreqBadge label={s.rebalancing} /></td>
                    {s.historical ? (
                      <>
                        <td className="px-4 py-3.5 text-center text-slate-400 text-xs font-medium whitespace-nowrap border-l border-slate-100">{s.historical.period}</td>
                        <td className="px-4 py-3.5 text-center"><span className={`text-sm ${retClass(s.historical.totalReturn)}`}>{fmtPct(s.historical.totalReturn)}</span></td>
                        <td className="px-4 py-3.5 text-center"><DiffBadge ret={s.historical.totalReturn} bench={s.historical.benchmark} /></td>
                        <td className="px-4 py-3.5 text-center"><span className={`text-sm font-medium ${s.historical.sharpe >= 1 ? 'text-emerald-600' : 'text-amber-500'}`}>{fmtNum(s.historical.sharpe)}</span></td>
                        <td className="px-4 py-3.5 text-center text-red-500 text-sm font-semibold">{fmtPct(s.historical.drawdown)}</td>
                        <td className="px-4 py-3.5 text-center text-slate-700 text-sm font-medium">{fmtNum(s.historical.winRate, 1)}%</td>
                      </>
                    ) : (
                      <td className="px-4 py-3.5 text-center text-slate-300 text-xs border-l border-slate-100" colSpan={6}>In progress</td>
                    )}
                    {s.current ? (
                      <>
                        <td className="px-4 py-3.5 text-center text-slate-400 text-xs font-medium whitespace-nowrap border-l border-slate-100">{s.current.period}</td>
                        <td className="px-4 py-3.5 text-center"><span className={`text-sm ${retClass(s.current.totalReturn)}`}>{fmtPct(s.current.totalReturn)}</span></td>
                        <td className="px-4 py-3.5 text-center"><DiffBadge ret={s.current.totalReturn} bench={s.current.benchmark} /></td>
                        <td className="px-4 py-3.5 text-center text-red-500 text-sm font-semibold">{fmtPct(s.current.drawdown)}</td>
                      </>
                    ) : (
                      <td className="px-4 py-3.5 text-center text-slate-300 text-xs border-l border-slate-100" colSpan={4}>—</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-5 px-5 py-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-sky-300 rounded inline-block" />Historical = backtest (2017+ Indian · 2010+ US), net after fees</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-violet-300 rounded inline-block" />Current = live period from late 2025 / early 2026</span>
            <span className="flex items-center gap-1 ml-auto"><Shield className="w-3 h-3" />vs Bench = alpha vs benchmark (Nifty for Indian, S&amp;P 500 for US)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
