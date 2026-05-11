'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Analysis {
  signal?: string
  confidence?: string
  revenue?: number | null
  ebit?: number | null
  net_profit?: number | null
  eps?: number | null
  key_positives?: string
  key_negatives?: string
  reasoning?: string
}

interface Props {
  symbol: string
  pdfUrl: string
  seqId?: string
  resultDate: string // ISO date string YYYY-MM-DD
}

function fmt(v: number | null | undefined) {
  if (v == null) return '—'
  return `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`
}

function parseList(raw: string | null | undefined): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [raw] }
}

export function AnalysisDisplay({ analysis }: { analysis: Analysis }) {
  const signal  = analysis.signal ?? '—'
  const conf    = analysis.confidence ?? ''
  const isLong  = signal === 'LONG'
  const isShort = signal === 'SHORT'
  const positives = parseList(analysis.key_positives)
  const negatives = parseList(analysis.key_negatives)

  return (
    <div className="mt-3 space-y-3">
      {/* Numbers row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          ['Revenue', fmt(analysis.revenue)],
          ['EBIT',    fmt(analysis.ebit)],
          ['Net Profit', fmt(analysis.net_profit)],
          ['EPS', analysis.eps != null ? `₹${Number(analysis.eps).toFixed(2)}` : '—'],
        ].map(([label, val]) => (
          <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="text-sm font-bold text-slate-800">{val}</p>
          </div>
        ))}
      </div>

      {/* Signal + reasoning */}
      <div className={`rounded-lg px-3 py-2 flex items-start gap-3 ${isLong ? 'bg-green-50 border border-green-200' : isShort ? 'bg-red-50 border border-red-200' : 'bg-slate-50 border border-slate-200'}`}>
        <span className={`text-lg font-black shrink-0 ${isLong ? 'text-green-600' : isShort ? 'text-red-600' : 'text-slate-500'}`}>
          {isLong ? '▲' : isShort ? '▼' : '—'} {signal}
        </span>
        <div className="min-w-0">
          <span className={`text-xs font-semibold ${isLong ? 'text-green-600' : isShort ? 'text-red-600' : 'text-slate-500'}`}>{conf}</span>
          {analysis.reasoning && <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{analysis.reasoning}</p>}
        </div>
      </div>

      {/* Positives / Negatives */}
      <div className="grid grid-cols-2 gap-3">
        {positives.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-green-700 mb-1">✓ Key Positives</p>
            <ul className="space-y-0.5">
              {positives.map((p, i) => (
                <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-green-500 shrink-0">+</span>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {negatives.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-red-700 mb-1">✗ Key Negatives</p>
            <ul className="space-y-0.5">
              {negatives.map((n, i) => (
                <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-red-500 shrink-0">−</span>{n}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AnalyseButton({ symbol, pdfUrl, seqId, resultDate }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/earnings-timeline/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, pdf_url: pdfUrl, seq_id: seqId, result_date: resultDate }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Analysis failed')
      setAnalysis(json.data)
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  if (analysis) return <AnalysisDisplay analysis={analysis} />

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
          bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 hover:border-violet-400
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            Analysing…
          </>
        ) : (
          <>🤖 Analyse with Claude</>
        )}
      </button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
