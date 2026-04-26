'use client'

import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Search, TrendingUp, BarChart2 } from 'lucide-react'

interface Result {
  symbol: string
  name: string
  type: 'stock' | 'etf'
}

export default function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        const data = await res.json()
        setResults(data.results ?? [])
        setOpen(true)
        setHighlighted(0)
      } finally {
        setLoading(false)
      }
    }, 180)
  }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const navigate = (r: Result) => {
    setOpen(false)
    setQuery('')
    router.push(r.type === 'etf' ? `/etf/${r.symbol}` : `/stock/${r.symbol}`)
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); navigate(results[highlighted]) }
    else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
  }

  return (
    <div ref={wrapperRef} className="relative w-full max-w-2xl mx-auto">
      <div className={`flex items-center gap-3 bg-white border-2 rounded-2xl px-4 py-3.5 shadow-sm transition-all ${open || query ? 'border-blue-400 shadow-blue-100' : 'border-slate-200 hover:border-slate-300'}`}>
        <Search className={`w-5 h-5 shrink-0 transition-colors ${open || query ? 'text-blue-500' : 'text-slate-400'}`} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder="Search for a company, stock or ETF…"
          className="flex-1 text-base text-slate-800 placeholder-slate-400 bg-transparent outline-none"
        />
        {loading && (
          <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-500 rounded-full animate-spin shrink-0" />
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
          {results.map((r, i) => (
            <li
              key={`${r.type}-${r.symbol}`}
              onMouseDown={() => navigate(r)}
              onMouseEnter={() => setHighlighted(i)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${highlighted === i ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
            >
              <div className={`p-1.5 rounded-lg shrink-0 ${r.type === 'etf' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                {r.type === 'etf' ? <BarChart2 className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-sm font-semibold text-slate-800">{r.symbol}</span>
                <span className="text-xs text-slate-500 ml-2 truncate">{r.name}</span>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${r.type === 'etf' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                {r.type.toUpperCase()}
              </span>
            </li>
          ))}
        </ul>
      )}

      {open && query && results.length === 0 && !loading && (
        <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl px-4 py-4 text-sm text-slate-400 text-center">
          No results for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  )
}
