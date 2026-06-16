import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricsGridProps {
    metrics: any; // Using any for flexibility, but ideally should be typed
    title?: string;
}

const n = (v: number | null | undefined, fallback = 0): number => v ?? fallback

export default function MetricsGrid({ metrics, title }: MetricsGridProps) {
    if (!metrics) return null;

    const totalRet = n(metrics.return_metrics.total_return)
    const benchRet = n(metrics.return_metrics.benchmark_return)
    const winRate = n(metrics.trade_statistics.win_rate)
    const sharpe = n(metrics.risk_metrics.sharpe_ratio)

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Total Return</div>
                <div className="text-3xl font-bold text-green-600">
                    {totalRet.toFixed(2)}%
                </div>
                <div className="text-xs text-gray-400 mt-2">vs Benchmark: {benchRet.toFixed(2)}%</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Alpha (Outperformance)</div>
                <div className="text-3xl font-bold text-green-600">
                    +{(totalRet - benchRet).toFixed(2)}%
                </div>
                <div className="text-xs text-gray-400 mt-2">Over Nifty 50</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Win Rate</div>
                <div className="text-3xl font-bold text-blue-600">
                    {winRate.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-400 mt-2">{Math.round(metrics.trade_statistics.total_trades * winRate / 100)} out of {metrics.trade_statistics.total_trades} months</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Sharpe Ratio</div>
                <div className={`text-3xl font-bold ${sharpe >= 1 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {sharpe.toFixed(2)}
                </div>
                <div className="text-xs text-gray-400 mt-2">Risk-adjusted return</div>
            </div>
        </div>
    );
}
