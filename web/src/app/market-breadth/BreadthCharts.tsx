'use client'

import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

export interface BreadthPoint {
  date: string
  pct_above_ema20: number | null
  pct_above_ema50: number | null
  pct_above_ema200: number | null
  new_highs: number | null
  new_lows: number | null
  net_highs_lows: number | null
}

const dateTick = (val: string) => new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })

function EmaChart({ data, dataKey, label, color, value }: {
  data: BreadthPoint[]; dataKey: keyof BreadthPoint; label: string; color: string; value: number | null
}) {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <span className="text-lg font-bold" style={{ color }}>
          {value != null ? `${value.toFixed(1)}%` : '—'}
        </span>
      </div>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="date" tickFormatter={dateTick} minTickGap={30} style={{ fontSize: 11 }} stroke="#9CA3AF" />
            <YAxis style={{ fontSize: 11 }} stroke="#9CA3AF" domain={[0, 100]} />
            <Tooltip
              labelFormatter={(label) => new Date(label as string).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
              formatter={(v: number) => [`${v.toFixed(1)}%`, label]}
            />
            <Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function CountBarChart({ data, dataKey, label, color, value, valueColor }: {
  data: BreadthPoint[]; dataKey: keyof BreadthPoint; label: string; color: string; value: number | null; valueColor: string
}) {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <span className="text-lg font-bold" style={{ color: valueColor }}>
          {value != null ? value : '—'}
        </span>
      </div>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="date" tickFormatter={dateTick} minTickGap={30} style={{ fontSize: 11 }} stroke="#9CA3AF" />
            <YAxis style={{ fontSize: 11 }} stroke="#9CA3AF" />
            <Tooltip
              labelFormatter={(label) => new Date(label as string).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
              formatter={(v: number) => [v, label]}
            />
            <Bar dataKey={dataKey} fill={color} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function BreadthCharts({ data }: { data: BreadthPoint[] }) {
  const latest = data[data.length - 1]

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <EmaChart data={data} dataKey="pct_above_ema20" label="% Above 20 EMA" color="#0ea5e9" value={latest?.pct_above_ema20 ?? null} />
        <EmaChart data={data} dataKey="pct_above_ema50" label="% Above 50 EMA" color="#8b5cf6" value={latest?.pct_above_ema50 ?? null} />
        <EmaChart data={data} dataKey="pct_above_ema200" label="% Above 200 EMA" color="#10b981" value={latest?.pct_above_ema200 ?? null} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <CountBarChart data={data} dataKey="new_highs" label="New Highs" color="#86efac" value={latest?.new_highs ?? null} valueColor="#16a34a" />
        <CountBarChart data={data} dataKey="new_lows" label="New Lows" color="#fca5a5" value={latest?.new_lows ?? null} valueColor="#dc2626" />
        <CountBarChart data={data} dataKey="net_highs_lows" label="Net Highs - Lows" color="#94a3b8" value={latest?.net_highs_lows ?? null} valueColor={(latest?.net_highs_lows ?? 0) >= 0 ? '#16a34a' : '#dc2626'} />
      </div>
    </>
  )
}
