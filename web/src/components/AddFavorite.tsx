'use client'

import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus } from 'lucide-react'

interface Result {
  symbol: string
  name: string
}

export default function AddFavorite() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [adding, setAdding] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
      const data = await res.json()
      const stockResults = ((data.results ?? []) as { symbol: string; name: string; type: string }[])
        .filter((r) => r.type === 'stock')
      setResults(stockResults)
      setOpen(true)
      setHighlighted(0)
    }, 180)
  }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const add = async (r: Result) => {
    setOpen(false)
    setQuery('')
    setAdding(true)
    try {
      await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: r.symbol }),
      })
      router.refresh()
    } finally {
      setAdding(false)
    }
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); add(results[highlighted]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative w-64">
      <div className={`flex items-center gap-2 bg-white border rounded-lg px-3 py-1.5 transition-colors
        ${open || query ? 'border-indigo-400' : 'border-slate-300 hover:border-slate-400'}`}>
        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder={adding ? 'Adding…' : 'Add a stock to favorites…'}
          disabled={adding}
          className="flex-1 text-sm text-slate-800 placeholder-slate-400 bg-transparent outline-none min-w-0"
        />
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {results.map((r, i) => (
            <li
              key={r.symbol}
              onMouseDown={() => add(r)}
              onMouseEnter={() => setHighlighted(i)}
              className={`flex items-center justify-between gap-2 px-3 py-2 cursor-pointer text-sm ${highlighted === i ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              <div className="min-w-0">
                <span className="font-semibold">{r.symbol}</span>
                <span className="text-xs text-slate-500 ml-2 truncate">{r.name}</span>
              </div>
              <Plus className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            </li>
          ))}
        </ul>
      )}

      {open && query && results.length === 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-3 text-sm text-slate-400 text-center">
          No matching stocks
        </div>
      )}
    </div>
  )
}
