'use client'

import { useSearchParams, usePathname, useRouter } from 'next/navigation'

interface Props {
    capOn: boolean
    boardAll: boolean
    minMarketCapCr: number
}

export default function StocksFilters({ capOn, boardAll, minMarketCapCr }: Props) {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const { replace } = useRouter()

    const toggle = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams)
        params.set(key, value)
        params.set('page', '1')
        replace(`${pathname}?${params.toString()}`)
    }

    const pillCls = (active: boolean) =>
        `text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${
            active
                ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                : 'bg-white text-slate-500 border-slate-300 hover:border-indigo-400 hover:text-indigo-600'
        }`

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <button
                onClick={() => toggle('cap', capOn ? 'off' : 'on')}
                className={pillCls(capOn)}
            >
                Mkt Cap ≥ ₹{minMarketCapCr.toLocaleString('en-IN')} Cr {capOn ? 'On' : 'Off'}
            </button>
            <button
                onClick={() => toggle('board', boardAll ? 'mainboard' : 'all')}
                className={pillCls(boardAll)}
            >
                Include SME {boardAll ? 'On' : 'Off'}
            </button>
        </div>
    )
}
