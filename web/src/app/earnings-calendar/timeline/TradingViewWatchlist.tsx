'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function TradingViewWatchlist({ symbols }: { symbols: string[] }) {
  const [copied, setCopied] = useState(false)

  // TradingView doesn't recognize '-' in symbols, so replace with '_'
  const watchlist = symbols.map(s => `NSE:${s.replace(/-/g, '_')}`).join(',')

  async function handleCopy() {
    await navigator.clipboard.writeText(watchlist)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">TradingView Watchlist</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Copy → open TradingView → Watchlist panel → Import symbols → Paste
          </p>
        </div>
        <button
          onClick={handleCopy}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
            ${copied
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 hover:border-slate-300'}`}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : `Copy ${symbols.length} symbols`}
        </button>
      </div>
      <textarea
        readOnly
        value={watchlist}
        rows={3}
        className="w-full font-mono text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 resize-none outline-none"
      />
    </div>
  )
}
