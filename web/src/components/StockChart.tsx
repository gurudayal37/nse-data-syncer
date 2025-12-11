'use client'

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts'
import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'

interface StockChartProps {
    data: {
        date: string
        close: number
    }[]
}

type Period = '1W' | '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'All'

export default function StockChart({ data }: StockChartProps) {
    const [period, setPeriod] = useState<Period>('1Y')

    const filteredData = useMemo(() => {
        if (period === 'All') return data
        if (!data.length) return data

        const now = new Date(data[data.length - 1].date).getTime()
        const DAY = 24 * 60 * 60 * 1000

        let daysToSubtract = 0
        switch (period) {
            case '1W': daysToSubtract = 7; break;
            case '1M': daysToSubtract = 30; break;
            case '3M': daysToSubtract = 90; break;
            case '6M': daysToSubtract = 180; break;
            case '1Y': daysToSubtract = 365; break;
            case '3Y': daysToSubtract = 365 * 3; break;
            case '5Y': daysToSubtract = 365 * 5; break;
        }

        const cutoff = now - (daysToSubtract * DAY)
        return data.filter(d => new Date(d.date).getTime() >= cutoff)
    }, [data, period])

    return (
        <div className="w-full">
            <div className="flex flex-wrap gap-2 mb-4">
                {(['1W', '1M', '3M', '6M', '1Y', '3Y', '5Y', 'All'] as Period[]).map((p) => (
                    <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={cn(
                            "px-3 py-1 text-xs font-medium rounded-full transition-colors",
                            period === p
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                    >
                        {p}
                    </button>
                ))}
            </div>
            <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filteredData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10, fill: '#6b7280' }}
                            tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                            minTickGap={50}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            domain={['auto', 'auto']}
                            tick={{ fontSize: 10, fill: '#6b7280' }}
                            tickFormatter={(value) => `₹${value.toLocaleString()}`}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            labelFormatter={(value) => new Date(value).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                            formatter={(value: number) => [`₹${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Close Price']}
                        />
                        <Line
                            type="monotone"
                            dataKey="close"
                            stroke="#2563eb"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
