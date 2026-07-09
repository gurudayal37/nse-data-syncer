import React, { useState } from 'react';
import { TrendingUp, TrendingDown, ChevronDown, ChevronRight } from 'lucide-react';

interface PerformanceTableProps {
    data: any[];
    title: string;
    subtitle?: string;
    indexOffset?: number; // Used to avoid key collision if multiple tables exist
    timeKey?: string;
    timeLabel?: string;
}

export default function PerformanceTable({
    data,
    title,
    subtitle,
    indexOffset = 0,
    timeKey = 'month',
    timeLabel = 'Month'
}: PerformanceTableProps) {
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

    const toggleRow = (index: number) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedRows(newExpanded);
    };

    if (!data || data.length === 0) return null;

    return (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-900 font-medium">
                        <tr className="text-right">
                            <th className="px-6 py-4 w-12 text-left"></th>
                            <th className="px-6 py-4 text-left">{timeLabel}</th>
                            <th className="px-6 py-4">Portfolio Return</th>
                            <th className="px-6 py-4">Benchmark (Nifty 50)</th>
                            <th className="px-6 py-4">Excess Return</th>
                            <th className="px-6 py-4 text-left">Holdings</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {data.map((row: any, i: number) => {
                            const excess = row.portfolio_return - row.benchmark_return;
                            const uniqueIndex = indexOffset + i;
                            const isExpanded = expandedRows.has(uniqueIndex);
                            return (
                                <React.Fragment key={uniqueIndex}>
                                    <tr className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => toggleRow(uniqueIndex)}
                                                className="text-gray-400 hover:text-gray-600"
                                            >
                                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </button>
                                        </td>

                                        <td className="px-6 py-4 font-medium text-gray-900">{row[timeKey]}</td>
                                        <td className={`px-6 py-4 text-right font-medium ${row.portfolio_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {row.portfolio_return > 0 ? '+' : ''}{row.portfolio_return}%
                                        </td>
                                        <td className={`px-6 py-4 text-right ${row.benchmark_return >= 0 ? 'text-gray-900' : 'text-gray-600'}`}>
                                            {row.benchmark_return > 0 ? '+' : ''}{row.benchmark_return}%
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${excess > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {excess > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                                                {excess.toFixed(2)}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 text-xs">
                                            {row.holdings?.length || 0} stocks
                                        </td>
                                    </tr>
                                    {isExpanded && row.holdings && (
                                        <tr key={`${uniqueIndex}-expanded`}>
                                            <td colSpan={6} className="px-6 py-4 bg-gray-50">
                                                <div className="grid grid-cols-3 gap-2">
                                                    {row.holdings.map((holding: any, j: number) => (
                                                        <div key={j} className={`px-3 py-2 rounded border ${holding.stop_triggered ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                                                            <div className="flex justify-between items-center">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-medium text-gray-700">{holding.symbol}</span>
                                                                    {holding.score !== undefined && (
                                                                        <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 rounded" title="Momentum Score">
                                                                            {holding.score}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className={`font-medium text-sm ${holding.return === null ? 'text-gray-400' :
                                                                    holding.return >= 0 ? 'text-green-600' : 'text-red-600'
                                                                    }`}>
                                                                    {holding.return === null ? 'N/A' : `${holding.return > 0 ? '+' : ''}${holding.return}%`}
                                                                </span>
                                                            </div>
                                                            {holding.entry_price != null && (
                                                                <div className="flex justify-between mt-1 text-xs">
                                                                    <span className="text-gray-500">Entry ₹{holding.entry_price.toFixed(2)}</span>
                                                                    {holding.stop_triggered && holding.exit_date ? (
                                                                        <span className="text-red-500 font-medium">Exited {holding.exit_date}</span>
                                                                    ) : (
                                                                        <span className="text-red-400">SL ₹{(holding.entry_price * 0.9).toFixed(2)}</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div >
        </div >
    );
}
