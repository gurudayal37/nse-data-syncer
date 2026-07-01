'use client'

import { useSearchParams, usePathname, useRouter } from 'next/navigation'

const DAYS_OPTIONS = [5, 7, 10, 15, 20]
const RANGE_OPTIONS = [5, 7, 8, 10]
const FROM52H_OPTIONS = [10, 12, 15, 20]
const TREND_OPTIONS = [5, 8, 10, 15, 20]
const VOL_OPTIONS = [
    { value: 0.6, label: '≤ 0.6× (strong)' },
    { value: 0.7, label: '≤ 0.7×' },
    { value: 0.75, label: '≤ 0.75×' },
    { value: 0.8, label: '≤ 0.8× (mild)' },
]

interface Props {
    days: number
    range: number
    from52h: number
    trend: number
    vol: number
    volEnabled: boolean
}

export default function TightFlagFilters({ days, range, from52h, trend, vol, volEnabled }: Props) {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const { replace } = useRouter()

    const update = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams)
        params.set(key, value)
        replace(`${pathname}?${params.toString()}`)
    }

    const toggleVol = () => {
        const params = new URLSearchParams(searchParams)
        params.set('volEnabled', volEnabled ? 'false' : 'true')
        replace(`${pathname}?${params.toString()}`)
    }

    const selectCls =
        'text-sm border border-slate-200 rounded-md px-2.5 py-1.5 bg-white text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-400'

    return (
        <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Lookback</span>
                <select value={days} onChange={(e) => update('days', e.target.value)} className={selectCls}>
                    {DAYS_OPTIONS.map((d) => (
                        <option key={d} value={d}>{d} days</option>
                    ))}
                </select>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Max Range</span>
                <select value={range} onChange={(e) => update('range', e.target.value)} className={selectCls}>
                    {RANGE_OPTIONS.map((r) => (
                        <option key={r} value={r}>≤ {r}%</option>
                    ))}
                </select>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">From 52W High</span>
                <select value={from52h} onChange={(e) => update('from52h', e.target.value)} className={selectCls}>
                    {FROM52H_OPTIONS.map((f) => (
                        <option key={f} value={f}>within {f}%</option>
                    ))}
                </select>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Min 1M Return</span>
                <select value={trend} onChange={(e) => update('trend', e.target.value)} className={selectCls}>
                    {TREND_OPTIONS.map((t) => (
                        <option key={t} value={t}>≥ {t}%</option>
                    ))}
                </select>
            </div>

            {/* Vol contraction toggle + conditional select */}
            <div className="flex items-center gap-2">
                <button
                    onClick={toggleVol}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${
                        volEnabled
                            ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                            : 'bg-white text-slate-500 border-slate-300 hover:border-indigo-400 hover:text-indigo-600'
                    }`}
                >
                    Vol Contraction {volEnabled ? 'On' : 'Off'}
                </button>
                {volEnabled && (
                    <select value={vol} onChange={(e) => update('vol', e.target.value)} className={selectCls}>
                        {VOL_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                )}
            </div>
        </div>
    )
}
