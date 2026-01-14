'use client'

import Link from 'next/link'
import { TrendingUp, BarChart3, Calendar, Zap, Database, ArrowRight, Sparkles, PieChart } from 'lucide-react'

import momentumData from '@/data/backtest_results.json'
import simpleMomentumData from '@/data/backtest_results_simple.json'
import simpleAllNiftyData from '@/data/backtest_results_simple_all_nifty.json'
import weeklyMomentumData from '@/data/backtest_results_weekly.json'
import simpleWeeklyData from '@/data/backtest_results_simple_weekly.json'

// Helper to format return
const formatReturn = (val: number) => `${Math.round(val)}%`

export default function HomePage() {
  const strategies = [
    {
      title: 'Momentum Strategy',
      description: 'Full momentum strategy using 3M, 6M, and 1Y returns with equal weighting',
      href: '/momentum-strategy',
      icon: TrendingUp,
      color: 'blue',
      rebalancing: 'Monthly',
      metrics: {
        return: formatReturn(momentumData.backtest_metrics.return_metrics.net_return_after_fees),
        sharpe: momentumData.backtest_metrics.risk_metrics.sharpe_ratio.toString()
      }
    },
    {
      title: 'Simple Momentum (Nifty)',
      description: 'Buying Top 15 Nifty Total Market Stocks (> 2000 Cr) (6M & 1Y only)',
      href: '/simple-momentum-strategy',
      icon: Zap,
      color: 'purple',
      rebalancing: 'Monthly',
      metrics: {
        return: formatReturn(simpleMomentumData.backtest_metrics.return_metrics.net_return_after_fees),
        sharpe: simpleMomentumData.backtest_metrics.risk_metrics.sharpe_ratio.toString()
      }
    },
    {
      title: 'Simple Momentum (High Cap)',
      description: 'Strategy with just top 15 stocks from > 2000 Cr cap (6M + 1Y)',
      href: '/simple-momentum-all-nifty',
      icon: Zap,
      color: 'pink',
      rebalancing: 'Monthly',
      metrics: {
        return: formatReturn(simpleAllNiftyData.backtest_metrics.return_metrics.net_return_after_fees),
        sharpe: simpleAllNiftyData.backtest_metrics.risk_metrics.sharpe_ratio.toString()
      }
    },
    {
      title: 'Weekly Momentum Strategy',
      description: 'Full momentum strategy with weekly rebalancing for faster response',
      href: '/momentum-weekly-strategy',
      icon: Calendar,
      color: 'green',
      rebalancing: 'Weekly',
      metrics: {
        return: formatReturn(weeklyMomentumData.backtest_metrics.return_metrics.net_return_after_fees),
        sharpe: (weeklyMomentumData.backtest_metrics as any).risk_metrics?.sharpe_ratio?.toString() || 'N/A'
      }
    },
    {
      title: 'Simple Momentum Weekly',
      description: 'Simplified momentum (6M + 1Y) with weekly Friday rebalancing',
      href: '/simple-momentum-weekly-strategy',
      icon: BarChart3,
      color: 'orange',
      rebalancing: 'Weekly',
      metrics: {
        return: formatReturn(simpleWeeklyData.backtest_metrics.return_metrics.net_return_after_fees),
        sharpe: simpleWeeklyData.backtest_metrics.risk_metrics.sharpe_ratio.toString()
      }
    },
    {
      title: 'ATH Breakout Strategy',
      description: 'Buy Monthly Breakouts > All-Time High with >2 Month Gap',
      href: '/ath',
      icon: TrendingUp,
      color: 'pink',
      rebalancing: 'Daily Entry / Weekly Exit',
      metrics: {
        return: 'Calculating...',
        sharpe: 'N/A'
      }
    }
  ]

  const dataPages = [
    {
      title: 'Momentum Stocks',
      description: 'Live rankings of all stocks by full momentum score',
      href: '/momentum',
      icon: TrendingUp,
      color: 'indigo',
      badge: 'Live'
    },
    {
      title: 'Simple Momentum Stocks',
      description: 'Live rankings by simple momentum score (6M + 1Y only)',
      href: '/simple-momentum',
      icon: Zap,
      color: 'violet',
      badge: 'Live'
    },
    {
      title: 'All Stocks Database',
      description: 'Complete stock database with performance metrics and filtering',
      href: '/stocks',
      icon: Database,
      color: 'slate',
      badge: 'Database'
    },
    {
      title: 'ETF Dashboard',
      description: 'Browse 304+ ETFs with OHLCV data and performance metrics',
      href: '/etf',
      icon: PieChart,
      color: 'emerald',
      badge: 'New'
    }
  ]

  const colorClasses = {
    blue: 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
    purple: 'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
    green: 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
    orange: 'from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700',
    indigo: 'from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700',
    violet: 'from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700',
    pink: 'from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700',
    slate: 'from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700',
    emerald: 'from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16 relative">
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <Sparkles className="w-96 h-96 text-blue-600" />
          </div>
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              Systematic Momentum Investing
            </div>
            <h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 mb-6">
              NSE Momentum Strategies
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Data-driven investment strategies for Indian equities.
              <br />
              <span className="font-semibold text-gray-700">Backtested over 8 years</span> with comprehensive risk metrics.
            </p>
          </div>
        </div>

        {/* Strategy Cards */}
        <div className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              Backtest Strategies
            </h2>
            <span className="text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-full">
              {strategies.length} Strategies Available
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {strategies.map((strategy) => {
              const Icon = strategy.icon
              return (
                <Link
                  key={strategy.href}
                  href={strategy.href}
                  className="group block"
                >
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-200/50 h-full transform hover:-translate-y-1">
                    <div className={`h-1.5 bg-gradient-to-r ${colorClasses[strategy.color as keyof typeof colorClasses]}`} />
                    <div className="p-7">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className={`p-3.5 rounded-xl bg-gradient-to-br ${colorClasses[strategy.color as keyof typeof colorClasses]} shadow-lg`}>
                            <Icon className="w-7 h-7 text-white" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors mb-1">
                              {strategy.title}
                            </h3>
                            <span className="text-sm text-gray-500 font-medium">{strategy.rebalancing} Rebalancing</span>
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                      </div>
                      <p className="text-gray-600 mb-5 text-sm leading-relaxed">
                        {strategy.description}
                      </p>
                      <div className="flex gap-6 pt-5 border-t border-gray-100">
                        <div className="flex-1">
                          <div className="text-xs text-gray-500 mb-1.5 font-medium">Total Return</div>
                          <div className="text-2xl font-bold text-green-600">{strategy.metrics.return}</div>
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-gray-500 mb-1.5 font-medium">Sharpe Ratio</div>
                          <div className="text-2xl font-bold text-blue-600">{strategy.metrics.sharpe}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Data Pages */}
        <div>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg">
                <Database className="w-7 h-7 text-white" />
              </div>
              Live Data & Rankings
            </h2>
            <span className="text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-full">
              Real-time Updates
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {dataPages.map((page) => {
              const Icon = page.icon
              return (
                <Link
                  key={page.href}
                  href={page.href}
                  className="group block"
                >
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-200/50 h-full transform hover:-translate-y-1">
                    <div className={`h-1.5 bg-gradient-to-r ${colorClasses[page.color as keyof typeof colorClasses]}`} />
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[page.color as keyof typeof colorClasses]} shadow-lg`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        {page.badge && (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${page.badge === 'New'
                            ? 'bg-emerald-100 text-emerald-700'
                            : page.badge === 'Live'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                            }`}>
                            {page.badge}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors mb-2">
                        {page.title}
                      </h3>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        {page.description}
                      </p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Stats Section */}
        <div className="mt-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold mb-2">5</div>
              <div className="text-blue-100 text-sm">Strategies</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">304+</div>
              <div className="text-blue-100 text-sm">ETFs Tracked</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">8+</div>
              <div className="text-blue-100 text-sm">Years Backtested</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">Daily</div>
              <div className="text-blue-100 text-sm">Data Updates</div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 bg-white/50 backdrop-blur-sm px-6 py-3 rounded-full inline-block">
            ⚠️ All strategies are backtested from 2017 onwards. Past performance does not guarantee future results.
          </p>
        </div>
      </div>
    </div>
  )
}
