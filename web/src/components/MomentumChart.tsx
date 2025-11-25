'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface MomentumChartProps {
    data: {
        date: string
        score: number
        rank: number
    }[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg">
                <p className="text-sm font-medium text-gray-900 mb-1">
                    {new Date(label).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
                <p className="text-sm text-blue-600">
                    Score: <span className="font-bold">{Number(payload[0].value).toFixed(2)}</span>
                </p>
                {payload[0].payload.rank && (
                    <p className="text-sm text-gray-500">
                        Rank: <span className="font-bold">#{payload[0].payload.rank}</span>
                    </p>
                )}
            </div>
        )
    }
    return null
}

export default function MomentumChart({ data }: MomentumChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="h-[300px] w-full flex items-center justify-center text-gray-400 bg-gray-50 rounded-lg border border-gray-100">
                No momentum history available
            </div>
        )
    }

    return (
        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis
                        dataKey="date"
                        tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                        minTickGap={50}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        domain={['auto', 'auto']}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="#e5e7eb" />
                    <Line
                        type="monotone"
                        dataKey="score"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}
