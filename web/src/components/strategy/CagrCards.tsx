import React, { useMemo } from 'react'

interface CagrCardsProps {
    monthlyData: any[]
    label: string
}

function computeCagr(monthlyData: any[]) {
    if (!monthlyData || monthlyData.length === 0) return { strategy: 0, benchmark: 0, months: 0, years: 0 }
    const months = monthlyData.length
    const years = months / 12
    const cumPort = monthlyData.reduce((acc, r) => acc * (1 + r.portfolio_return / 100), 1)
    const cumBench = monthlyData.reduce((acc, r) => acc * (1 + r.benchmark_return / 100), 1)
    return {
        strategy: (Math.pow(cumPort, 1 / years) - 1) * 100,
        benchmark: (Math.pow(cumBench, 1 / years) - 1) * 100,
        months,
        years,
    }
}

export default function CagrCards({ monthlyData, label }: CagrCardsProps) {
    const cagr = useMemo(() => computeCagr(monthlyData), [monthlyData])
    const alpha = cagr.strategy - cagr.benchmark
    const fmt = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Strategy CAGR</div>
                <div className={`text-3xl font-bold ${cagr.strategy >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {fmt(cagr.strategy)}
                </div>
                <div className="text-xs text-gray-400 mt-1">{label} · {cagr.months} months</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Benchmark CAGR</div>
                <div className={`text-3xl font-bold ${cagr.benchmark >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                    {fmt(cagr.benchmark)}
                </div>
                <div className="text-xs text-gray-400 mt-1">Nifty 50</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">CAGR Alpha</div>
                <div className={`text-3xl font-bold ${alpha >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {fmt(alpha)}
                </div>
                <div className="text-xs text-gray-400 mt-1">Annualised outperformance</div>
            </div>
        </div>
    )
}
