import React from 'react';

interface DetailedMetricsProps {
    metrics: any;
    title: string;
}

const n = (v: number | null | undefined, fallback = 0): number => v ?? fallback

export default function DetailedMetrics({ metrics, title }: DetailedMetricsProps) {
    if (!metrics) return null;

    return (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">{title}</h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Time Metrics */}
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Time Metrics</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-900">Start</span>
                            <span className="text-sm font-medium text-gray-900">{metrics.time_metrics.start}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-900">End</span>
                            <span className="text-sm font-medium text-gray-900">{metrics.time_metrics.end}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-900">Period</span>
                            <span className="text-sm font-medium text-gray-900">{metrics.time_metrics.period}</span>
                        </div>
                    </div>
                </div>

                {/* Capital Metrics */}
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Capital Metrics</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-900">Start Value</span>
                            <span className="text-sm font-medium text-gray-900">₹{metrics.capital_metrics.start_value}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-900">End Value</span>
                            <span className="text-sm font-medium text-green-600">₹{n(metrics.capital_metrics.end_value).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-900">Total Fees</span>
                            <span className="text-sm font-medium text-gray-900">₹{metrics.capital_metrics.total_fees_paid}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-900">Open Trade PnL</span>
                            <span className="text-sm font-medium text-gray-900">₹{metrics.capital_metrics.open_trade_pnl}</span>
                        </div>
                    </div>
                </div>

                {/* Return Metrics */}
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Return Metrics</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-900">Total Return</span>
                            <span className="text-sm font-medium text-green-600">{n(metrics.return_metrics.total_return).toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-900">Net Return (After Fees)</span>
                            <span className="text-sm font-medium text-green-600 font-bold">{n(metrics.return_metrics.net_return_after_fees).toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-900">Benchmark Return</span>
                            <span className="text-sm font-medium text-gray-900">{n(metrics.return_metrics.benchmark_return).toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-900">Expectancy</span>
                            <span className="text-sm font-medium text-gray-900">{n(metrics.return_metrics.expectancy).toFixed(2)}%</span>
                        </div>
                    </div>
                </div>

                {/* Risk Metrics */}
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Risk Metrics</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-900">Max Drawdown</span>
                            <span className="text-sm font-medium text-red-600">{n(metrics.risk_metrics.max_drawdown).toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-900">Max DD Duration</span>
                            <span className="text-sm font-medium text-gray-900">{metrics.risk_metrics.max_drawdown_duration} months</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-900">Sharpe Ratio</span>
                            <span className={`text-sm font-medium ${metrics.risk_metrics.sharpe_ratio >= 1 ? 'text-green-600' : 'text-yellow-600'}`}>
                                {n(metrics.risk_metrics.sharpe_ratio).toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-900">Calmar Ratio</span>
                            <span className="text-sm font-medium text-gray-900">{n(metrics.risk_metrics.calmar_ratio).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-900">Omega Ratio</span>
                            <span className="text-sm font-medium text-gray-900">{n(metrics.risk_metrics.omega_ratio).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-900">Sortino Ratio</span>
                            <span className="text-sm font-medium text-gray-900">{n(metrics.risk_metrics.sortino_ratio).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Trade Statistics (Full Width) */}
            <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Trade Statistics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <div className="bg-gray-50 p-3 rounded">
                        <div className="text-xs text-gray-900 mb-1">Rebalancing Periods</div>
                        <div className="text-lg font-semibold text-gray-900">{metrics.trade_statistics.total_trades}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                        <div className="text-xs text-gray-900 mb-1">Stock Transactions</div>
                        <div className="text-lg font-semibold text-blue-600">{metrics.trade_statistics.total_stock_transactions}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                        <div className="text-xs text-gray-900 mb-1">Win Rate</div>
                        <div className="text-lg font-semibold text-green-600">{n(metrics.trade_statistics.win_rate).toFixed(1)}%</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                        <div className="text-xs text-gray-900 mb-1">Best Trade</div>
                        <div className="text-lg font-semibold text-green-600">+{n(metrics.trade_statistics.best_trade).toFixed(2)}%</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                        <div className="text-xs text-gray-900 mb-1">Worst Trade</div>
                        <div className="text-lg font-semibold text-red-600">{n(metrics.trade_statistics.worst_trade).toFixed(2)}%</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                        <div className="text-xs text-gray-900 mb-1">Avg Win</div>
                        <div className="text-lg font-semibold text-green-600">+{n(metrics.trade_statistics.avg_winning_trade).toFixed(2)}%</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                        <div className="text-xs text-gray-900 mb-1">Avg Loss</div>
                        <div className="text-lg font-semibold text-red-600">{n(metrics.trade_statistics.avg_losing_trade).toFixed(2)}%</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                        <div className="text-xs text-gray-900 mb-1">Profit Factor</div>
                        <div className="text-lg font-semibold text-gray-900">{n(metrics.trade_statistics.profit_factor).toFixed(2)}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                        <div className="text-xs text-gray-900 mb-1">Max Exposure</div>
                        <div className="text-lg font-semibold text-gray-900">{metrics.exposure_metrics.max_gross_exposure}%</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
