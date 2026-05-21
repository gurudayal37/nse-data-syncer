import React, { useMemo } from 'react'

interface YearlyReturnsTableProps {
    monthlyData: any[]
}

function computeYearlyReturns(monthlyData: any[]) {
    const years: Record<string, { port: number; bench: number }> = {}
    for (const r of monthlyData) {
        const year = r.month.substring(0, 4)
        if (!years[year]) years[year] = { port: 1, bench: 1 }
        years[year].port *= (1 + r.portfolio_return / 100)
        years[year].bench *= (1 + r.benchmark_return / 100)
    }
    return Object.entries(years)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([year, v]) => ({
            year,
            strategy: (v.port - 1) * 100,
            benchmark: (v.bench - 1) * 100,
            alpha: ((v.port - 1) - (v.bench - 1)) * 100,
        }))
}

export default function YearlyReturnsTable({ monthlyData }: YearlyReturnsTableProps) {
    const rows = useMemo(() => computeYearlyReturns(monthlyData), [monthlyData])
    if (rows.length === 0) return null

    const fmt = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
    const barMax = 160

    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden mb-8">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">Annual Returns vs Benchmark</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100">
                            <th className="px-5 py-2.5 text-left">Year</th>
                            <th className="px-5 py-2.5 text-right">Strategy</th>
                            <th className="px-5 py-2.5 text-right">Nifty 50</th>
                            <th className="px-5 py-2.5 text-right">Alpha</th>
                            <th className="px-5 py-2.5 text-left pl-8">Bar</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {rows.map(r => {
                            const stratBar = Math.min(Math.abs(r.strategy), barMax)
                            const benchBar = Math.min(Math.abs(r.benchmark), barMax)
                            return (
                                <tr key={r.year} className="hover:bg-gray-50">
                                    <td className="px-5 py-3 font-semibold text-gray-800">{r.year}</td>
                                    <td className={`px-5 py-3 text-right font-semibold ${r.strategy >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {fmt(r.strategy)}
                                    </td>
                                    <td className={`px-5 py-3 text-right ${r.benchmark >= 0 ? 'text-blue-600' : 'text-red-400'}`}>
                                        {fmt(r.benchmark)}
                                    </td>
                                    <td className={`px-5 py-3 text-right font-medium ${r.alpha >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {fmt(r.alpha)}
                                    </td>
                                    <td className="px-5 py-3 pl-8">
                                        <div className="flex items-center gap-1 min-w-[160px]">
                                            <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                                                <div
                                                    className={`h-full rounded ${r.strategy >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                                                    style={{ width: `${(stratBar / barMax) * 100}%` }}
                                                />
                                            </div>
                                            <div className="flex-1 h-2.5 bg-gray-100 rounded overflow-hidden">
                                                <div
                                                    className={`h-full rounded ${r.benchmark >= 0 ? 'bg-blue-300' : 'bg-orange-300'}`}
                                                    style={{ width: `${(benchBar / barMax) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50 flex gap-5 text-[11px] text-gray-400">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-400 inline-block" />Strategy return</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-blue-300 inline-block" />Nifty 50 return</span>
            </div>
        </div>
    )
}
