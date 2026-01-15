import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PerformanceChartProps {
    data: any[];
    title: string;
    timeKey?: string;
    showBenchmark?: boolean;
    benchmarkName?: string;
}

export default function PerformanceChart({
    data,
    title,
    timeKey = 'month',
    showBenchmark = true,
    benchmarkName = 'Nifty 50'
}: PerformanceChartProps) {
    const chartData = useMemo(() => {
        if (!data || data.length === 0) return [];

        let portValue = 100000;
        let benchValue = 100000;

        // Data should be pre-sorted or we sort here
        // Assuming data is sorted by time asc
        const sortedData = [...data].sort((a: any, b: any) =>
            new Date(a[timeKey]).getTime() - new Date(b[timeKey]).getTime()
        );

        return sortedData.map((item: any) => {
            portValue = portValue * (1 + item.portfolio_return / 100);
            benchValue = benchValue * (1 + item.benchmark_return / 100);
            return {
                [timeKey]: item[timeKey],
                Portfolio: parseFloat(portValue.toFixed(2)),
                Benchmark: parseFloat(benchValue.toFixed(2)),
                ...item
            }
        });
    }, [data]);

    if (!data || data.length === 0) return <div className="p-4 text-center text-gray-500">No data available for chart</div>;

    return (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">{title}</h2>
            <div className="h-[500px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis
                            dataKey={timeKey}
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            tickLine={false}
                            axisLine={{ stroke: '#d1d5db' }}
                            minTickGap={40}
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            tickLine={false}
                            axisLine={{ stroke: '#d1d5db' }}
                            domain={['auto', 'auto']}
                            tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#fff',
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                padding: '12px'
                            }}
                            formatter={(value: any, name: string) => {
                                const formattedValue = `₹${parseFloat(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                                return [formattedValue, name]
                            }}
                            labelFormatter={(label) => `${timeKey === 'month' ? 'Month' : 'Date'}: ${label}`}
                        />
                        <Legend
                            wrapperStyle={{ paddingTop: '20px' }}
                            iconType="line"
                        />
                        <Line
                            type="linear"
                            dataKey="Portfolio"
                            stroke="#2563eb"
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 6, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                            name="Strategy Portfolio"
                        />
                        {showBenchmark && (
                            <Line
                                type="linear"
                                dataKey="Benchmark"
                                stroke="#9ca3af"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={false}
                                activeDot={{ r: 5, fill: '#9ca3af', stroke: '#fff', strokeWidth: 2 }}
                                name={benchmarkName}
                            />
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
