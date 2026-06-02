'use client'

import React, { useMemo } from 'react'
import { TrendingUp, TrendingDown, Zap, BarChart2, Activity, Star, Shield, Sun, CloudRain } from 'lucide-react'

interface Props {
    monthlyData: any[]  // backtest data in ascending order
    timeKey?: string    // 'month' or 'week'
}

function fmt(v: number) {
    return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

function computeInsights(data: any[], timeKey: string) {
    if (!data || data.length < 6) return null

    const returns = data.map(r => r.portfolio_return as number)
    const benchReturns = data.map(r => r.benchmark_return as number)
    const labels = data.map(r => r[timeKey] as string)

    // Build runs of consecutive wins / losses
    type Run = { type: 'win' | 'loss'; length: number; endIdx: number }
    const runs: Run[] = []
    let cur: Run = { type: returns[0] >= 0 ? 'win' : 'loss', length: 1, endIdx: 0 }
    for (let i = 1; i < returns.length; i++) {
        const isWin = returns[i] >= 0
        if ((isWin && cur.type === 'win') || (!isWin && cur.type === 'loss')) {
            cur.length++
            cur.endIdx = i
        } else {
            runs.push({ ...cur })
            cur = { type: isWin ? 'win' : 'loss', length: 1, endIdx: i }
        }
    }
    runs.push(cur)

    // Max streaks
    const maxWins = Math.max(...runs.filter(r => r.type === 'win').map(r => r.length))
    const maxLosses = Math.max(...runs.filter(r => r.type === 'loss').map(r => r.length))

    // After N+ consecutive wins → next period is a loss?
    const checkAfterStreak = (type: 'win' | 'loss', minLen: number) => {
        let total = 0, opposite = 0
        for (let i = 0; i < runs.length - 1; i++) {
            if (runs[i].type === type && runs[i].length >= minLen) {
                total++
                if (runs[i + 1].type !== type) opposite++
            }
        }
        return { total, oppositePct: total > 0 ? Math.round((opposite / total) * 100) : null }
    }

    const after2Wins = checkAfterStreak('win', 2)
    const after3Wins = checkAfterStreak('win', 3)
    const after2Losses = checkAfterStreak('loss', 2)

    // Win rate after a single loss vs overall
    const overallWinRate = Math.round((returns.filter(r => r >= 0).length / returns.length) * 100)
    const afterLoss = returns.filter((_, i) => i > 0 && returns[i - 1] < 0)
    const winRateAfterLoss = afterLoss.length > 0
        ? Math.round((afterLoss.filter(r => r >= 0).length / afterLoss.length) * 100)
        : null

    // Best / worst period
    const bestRet = Math.max(...returns)
    const worstRet = Math.min(...returns)
    const bestLabel = labels[returns.indexOf(bestRet)]
    const worstLabel = labels[returns.indexOf(worstRet)]

    // Benchmark outperformance rate
    const beatBench = returns.filter((r, i) => r > benchReturns[i]).length
    const beatBenchPct = Math.round((beatBench / returns.length) * 100)

    // Avg return in up-market vs down-market months
    const upIdx = returns.filter((_, i) => benchReturns[i] >= 0)
    const downIdx = returns.filter((_, i) => benchReturns[i] < 0)
    const avgUpMkt = upIdx.length > 0 ? upIdx.reduce((a, b) => a + b, 0) / upIdx.length : 0
    const avgDownMkt = downIdx.length > 0 ? downIdx.reduce((a, b) => a + b, 0) / downIdx.length : 0

    // Loss clustering: % of losing runs that are 2+ long
    const lossRuns = runs.filter(r => r.type === 'loss')
    const clusteredPct = lossRuns.length > 0
        ? Math.round((lossRuns.filter(r => r.length >= 2).length / lossRuns.length) * 100)
        : 0

    // Avg return following a winning period vs following a losing period
    const avgAfterWin = (() => {
        const vals = returns.filter((_, i) => i > 0 && returns[i - 1] >= 0)
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    })()
    const avgAfterLoss = afterLoss.length ? afterLoss.reduce((a, b) => a + b, 0) / afterLoss.length : 0

    return {
        maxWins, maxLosses,
        after2Wins, after3Wins, after2Losses,
        overallWinRate, winRateAfterLoss,
        bestRet, worstRet, bestLabel, worstLabel,
        beatBenchPct,
        avgUpMkt, avgDownMkt,
        clusteredPct,
        avgAfterWin, avgAfterLoss,
        n: returns.length,
    }
}

interface CardProps {
    icon: React.ReactNode
    title: string
    value: string
    valueColor?: string
    sub: string
    border?: string
}

function InsightCard({ icon, title, value, valueColor = 'text-gray-900', sub, border = 'border-gray-100' }: CardProps) {
    return (
        <div className={`bg-white rounded-xl border ${border} p-5 shadow-sm`}>
            <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">{icon}</div>
                <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{title}</p>
                    <p className={`text-xl font-bold leading-tight ${valueColor}`}>{value}</p>
                    <p className="text-xs text-gray-500 mt-1 leading-snug">{sub}</p>
                </div>
            </div>
        </div>
    )
}

export default function KeyInsights({ monthlyData, timeKey = 'month' }: Props) {
    const unit = timeKey === 'week' ? 'week' : 'month'
    const Unit = unit.charAt(0).toUpperCase() + unit.slice(1)

    const ins = useMemo(() => computeInsights(monthlyData, timeKey), [monthlyData, timeKey])

    if (!ins) return null

    return (
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 mt-8">
            <div className="flex items-center gap-2 mb-5">
                <Zap className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-bold text-gray-900">Key Insights</h2>
                <span className="text-xs text-gray-400 ml-1">— computed from {ins.n} {unit}s of backtest data</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                {/* After 2+ wins */}
                {ins.after2Wins.oppositePct !== null && (
                    <InsightCard
                        icon={<TrendingDown className="w-4 h-4 text-red-400" />}
                        title={`After 2+ Winning ${Unit}s`}
                        value={`${ins.after2Wins.oppositePct}% → Loss`}
                        valueColor={ins.after2Wins.oppositePct >= 60 ? 'text-red-600' : 'text-gray-900'}
                        sub={`Out of ${ins.after2Wins.total} occurrences, a losing ${unit} followed ${ins.after2Wins.oppositePct}% of the time.`}
                        border="border-red-100"
                    />
                )}

                {/* After 2+ losses → bounce? */}
                {ins.after2Losses.oppositePct !== null && (
                    <InsightCard
                        icon={<TrendingUp className="w-4 h-4 text-green-500" />}
                        title={`After 2+ Losing ${Unit}s`}
                        value={`${ins.after2Losses.oppositePct}% → Win`}
                        valueColor={ins.after2Losses.oppositePct >= 60 ? 'text-green-600' : 'text-gray-900'}
                        sub={`Out of ${ins.after2Losses.total} occurrences, a winning ${unit} followed ${ins.after2Losses.oppositePct}% of the time.`}
                        border="border-green-100"
                    />
                )}

                {/* Win rate after a single loss */}
                {ins.winRateAfterLoss !== null && (
                    <InsightCard
                        icon={<Activity className="w-4 h-4 text-sky-500" />}
                        title={`Win Rate After a Loss`}
                        value={`${ins.winRateAfterLoss}%`}
                        valueColor={ins.winRateAfterLoss > ins.overallWinRate ? 'text-green-600' : ins.winRateAfterLoss < ins.overallWinRate ? 'text-red-500' : 'text-gray-900'}
                        sub={`vs ${ins.overallWinRate}% overall. ${ins.winRateAfterLoss > ins.overallWinRate ? 'Losses tend to be followed by a bounce.' : 'Losses tend to cluster — no mean reversion.'}`}
                        border="border-sky-100"
                    />
                )}

                {/* Max consecutive wins */}
                <InsightCard
                    icon={<Star className="w-4 h-4 text-amber-400" />}
                    title={`Longest Winning Streak`}
                    value={`${ins.maxWins} ${unit}s`}
                    valueColor="text-green-600"
                    sub={`The longest run of consecutive positive ${unit}s in the backtest period.`}
                    border="border-amber-100"
                />

                {/* Max consecutive losses */}
                <InsightCard
                    icon={<Shield className="w-4 h-4 text-red-400" />}
                    title={`Longest Losing Streak`}
                    value={`${ins.maxLosses} ${unit}s`}
                    valueColor="text-red-600"
                    sub={`The longest consecutive drawdown run. ${ins.clusteredPct}% of losing runs were 2+ ${unit}s long.`}
                    border="border-red-100"
                />

                {/* Best / worst */}
                <InsightCard
                    icon={<BarChart2 className="w-4 h-4 text-violet-400" />}
                    title={`Best vs Worst ${Unit}`}
                    value={`${fmt(ins.bestRet)} / ${fmt(ins.worstRet)}`}
                    valueColor="text-violet-700"
                    sub={`Best: ${ins.bestLabel} · Worst: ${ins.worstLabel}`}
                    border="border-violet-100"
                />

                {/* Beats benchmark */}
                <InsightCard
                    icon={<Activity className="w-4 h-4 text-indigo-400" />}
                    title={`Beats Nifty`}
                    value={`${ins.beatBenchPct}% of ${unit}s`}
                    valueColor={ins.beatBenchPct >= 55 ? 'text-green-600' : 'text-red-500'}
                    sub={`Strategy outperformed Nifty in ${ins.beatBenchPct}% of all backtest ${unit}s.`}
                    border="border-indigo-100"
                />

                {/* Up market vs Down market */}
                <InsightCard
                    icon={<Sun className="w-4 h-4 text-orange-400" />}
                    title={`Up-Market Avg Return`}
                    value={fmt(ins.avgUpMkt)}
                    valueColor={ins.avgUpMkt >= 0 ? 'text-green-600' : 'text-red-500'}
                    sub={`Average return when Nifty was positive that ${unit}.`}
                    border="border-orange-100"
                />

                <InsightCard
                    icon={<CloudRain className="w-4 h-4 text-slate-400" />}
                    title={`Down-Market Avg Return`}
                    value={fmt(ins.avgDownMkt)}
                    valueColor={ins.avgDownMkt >= 0 ? 'text-green-600' : 'text-red-500'}
                    sub={`Average return when Nifty was negative that ${unit}. Positive = downside protection.`}
                    border="border-slate-200"
                />

            </div>
        </div>
    )
}
