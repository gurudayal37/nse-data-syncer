'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

const KEYWORDS = [
  { key: 'data_centre',    label: 'Data Centre' },
  { key: 'ai',             label: 'AI' },
  { key: 'semiconductor',  label: 'Semiconductor' },
  { key: 'defence',        label: 'Defence' },
  { key: 'drone',          label: 'Drone' },
  { key: 'anti_drone',     label: 'Anti Drone' },
  { key: 'aerospace',      label: 'Aerospace' },
  { key: 'cloud',          label: 'Cloud' },
  { key: 'ev',             label: 'EV' },
  { key: 'renewable',      label: 'Renewable' },
  { key: 'export',         label: 'Export' },
  { key: 'capex',          label: 'Capex' },
  { key: 'order_book',     label: 'Order Book' },
  { key: 'precision_engineering', label: 'Precision Engineering' },
  { key: 'best',           label: 'Best' },
  { key: 'top',            label: 'Top' },
  { key: 'leader',         label: 'Leader' },
  { key: 'highest',        label: 'Highest' },
  { key: 'sentiment',      label: 'Sentiment' },
]

export default function KeywordTabs({ active }: { active: string }) {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()

  const go = (key: string) => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('keyword', key)
    p.delete('sort')
    p.delete('order')
    router.push(`${pathname}?${p.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-2">
      {KEYWORDS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => go(key)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            active === key
              ? 'bg-sky-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
