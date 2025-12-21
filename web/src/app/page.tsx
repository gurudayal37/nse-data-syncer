'use client'

import Link from 'next/link'
import { TrendingUp, BarChart3, Calendar, Zap, Database, ArrowRight } from 'lucide-react'

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
        return: '~1400%',
        sharpe: '1.2+'
      }
    },
    {
      title: 'Simple Momentum Strategy',
      description: 'Simplified momentum using only 6M and 1Y returns (excluding 3M)',
      href: '/simple-momentum-strategy',
      icon: Zap,
      color: 'purple',
      rebalancing: 'Monthly',
      metrics: {
        return: '1415%',
        sharpe: '1.21'
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
        return: '~1300%',
        sharpe: '1.1+'
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
        return: '996%',
        sharpe: '~1.0'
      }
    }
  ]

  const dataPages = [
    {
      title: 'Momentum Stocks',
      description: 'Live rankings of all stocks by full momentum score',
      href: '/momentum',
      icon: TrendingUp,
      color: 'indigo'
    },
    {
      title: 'Simple Momentum Stocks',
      description: 'Live rankings by simple momentum score (6M + 1Y only)',
      href: '/simple-momentum',
      icon: Zap,
      color: 'violet'
    },
    {
      title: 'All Stocks Database',
      description: 'Complete stock database with performance metrics and filtering',
      href: '/stocks',
      icon: Database,
      color: 'gray'
    }
  ]

  const colorClasses = {
    blue: 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
    purple: 'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
    green: 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
    orange: 'from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700',
    indigo: 'from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700',
    violet: 'from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700',
    gray: 'from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            NSE Momentum Strategies
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Systematic momentum-based investment strategies for Indian equities.
            Backtested over 8 years with comprehensive risk metrics.
          </p>
        </div>

        {/* Strategy Cards */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-blue-600" />
            Backtest Strategies
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {strategies.map((strategy) => {
              const Icon = strategy.icon
              return (
                <Link
                  key={strategy.href}
                  href={strategy.href}
                  className="group block"
                >
                  <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 h-full">
                    <div className={`h-2 bg-gradient-to-r ${colorClasses[strategy.color as keyof typeof colorClasses]}`} />
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-lg bg-gradient-to-br ${colorClasses[strategy.color as keyof typeof colorClasses]} bg-opacity-10`}>
                            <Icon className={`w-6 h-6 text-${strategy.color}-600`} />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                              {strategy.title}
                            </h3>
                            <span className="text-sm text-gray-500">{strategy.rebalancing} Rebalancing</span>
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                      </div>
                      <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                        {strategy.description}
                      </p>
                      <div className="flex gap-4 pt-4 border-t border-gray-100">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Total Return</div>
                          <div className="text-lg font-bold text-green-600">{strategy.metrics.return}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Sharpe Ratio</div>
                          <div className="text-lg font-bold text-blue-600">{strategy.metrics.sharpe}</div>
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
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Database className="w-7 h-7 text-indigo-600" />
            Live Data & Rankings
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {dataPages.map((page) => {
              const Icon = page.icon
              return (
                <Link
                  key={page.href}
                  href={page.href}
                  className="group block"
                >
                  <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 h-full">
                    <div className={`h-2 bg-gradient-to-r ${colorClasses[page.color as keyof typeof colorClasses]}`} />
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2.5 rounded-lg bg-gradient-to-br ${colorClasses[page.color as keyof typeof colorClasses]} bg-opacity-10`}>
                          <Icon className={`w-5 h-5 text-${page.color}-600`} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                          {page.title}
                        </h3>
                      </div>
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

        {/* Footer Note */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            All strategies are backtested from 2017 onwards. Past performance does not guarantee future results.
          </p>
        </div>
      </div>
    </div>
  )
}
