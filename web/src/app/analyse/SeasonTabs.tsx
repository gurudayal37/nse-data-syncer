'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export default function SeasonTabs({
  seasons,
  active,
}: {
  seasons: { key: string; label: string }[]
  active: string
}) {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()

  const go = (key: string) => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('season', key)
    p.delete('sort')
    p.delete('order')
    router.push(`${pathname}?${p.toString()}`)
  }

  return (
    <div className="flex gap-2 flex-wrap items-center">
      <span className="text-xs text-slate-400 font-medium uppercase tracking-wide mr-1">Quarter</span>
      {seasons.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => go(key)}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            active === key
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
