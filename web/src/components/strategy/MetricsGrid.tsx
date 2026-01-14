import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricsGridProps {
    metrics: any; // Using any for flexibility, but ideally should be typed
    title?: string;
}

export default function MetricsGrid({ metrics, title }: MetricsGridProps) {
    if (!metrics) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Total Return</div>
                <div className="text-3xl font-bold text-green-600">
                    {metrics.return_metrics.total_return.toFixed(2)}%
                </div>
                <div className="text-xs text-gray-400 mt-2">vs Benchmark: {metrics.return_metrics.benchmark_return.toFixed(2)}%</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Alpha (Outperformance)</div>
                <div className="text-3xl font-bold text-green-600">
                    +{(metrics.return_metrics.total_return - metrics.return_metrics.benchmark_return).toFixed(2)}%
                </div>
                <div className="text-xs text-gray-400 mt-2">Over Nifty 50</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Win Rate</div>
                <div className="text-3xl font-bold text-blue-600">
                    {metrics.trade_statistics.win_rate.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-400 mt-2">{Math.round(metrics.trade_statistics.total_trades * metrics.trade_statistics.win_rate / 100)} out of {metrics.trade_statistics.total_trades} months</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Sharpe Ratio</div>
                <div className={`text-3xl font-bold ${metrics.risk_metrics.sharpe_ratio >= 1 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {metrics.risk_metrics.sharpe_ratio.toFixed(2)}
                </div>
                <div className="text-xs text-gray-400 mt-2">Risk-adjusted return</div>
            </div>
        </div>
    );
}
