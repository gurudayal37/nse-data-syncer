import Link from 'next/link'
import { ChevronLeft, ChevronRight, Calendar, Clock, FileText } from 'lucide-react'
import prisma from '@/lib/prisma'
import AnalyseButton, { AnalysisDisplay } from './AnalyseButton'
import TradingViewWatchlist from './TradingViewWatchlist'
import AutoRefresh from './AutoRefresh'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: "Results Timeline",
  description: 'Real-time tracker of quarterly result announcements on NSE.',
}

// ── Doc helpers ───────────────────────────────────────────────────────────────

const CATEGORY_PRIORITY: Record<string, number> = {
  'outcome of board meeting': 0, 'press release': 1, 'updates': 2,
}

const DOC_LABELS: [RegExp, string][] = [
  [/investor\s*presentation/i,                  'Presentation'],
  [/transcript/i,                               'Concall Transcript'],
  [/concall|con\s*call/i,                      'Concall'],
  [/press\s*release/i,                         'Press Release'],
  [/annual\s*report/i,                         'Annual Report'],
  [/shareholder.*letter|letter.*shareholder/i, 'Shareholder Letter'],
  [/outcome\s*of\s*board/i,                    'Board Outcome'],
]

function docLabel(category: string): string {
  for (const [re, label] of DOC_LABELS) {
    if (re.test(category)) return label
  }
  return category.length > 28 ? category.slice(0, 26) + '…' : category
}

function fmtTime(d: Date): string {
  return new Date(d).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Kolkata',
  })
}

interface NseDoc {
  seq_id:         string
  symbol:         string
  company_name:   string
  category:       string
  attachment_url: string
  doc_type:       string
  nse_filed_at:   Date
}

function deduplicateResults(docs: NseDoc[]): NseDoc[] {
  const best = new Map<string, { doc: NseDoc; pri: number }>()
  for (const doc of docs) {
    const pri = CATEGORY_PRIORITY[(doc.category ?? '').toLowerCase()] ?? 99
    const cur = best.get(doc.symbol)
    if (!cur || pri < cur.pri) best.set(doc.symbol, { doc, pri })
  }
  return Array.from(best.values()).map(v => v.doc)
}

async function getPdfSize(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    return res.headers.get('content-length')
  } catch { return null }
}

function fmtCr(v: bigint | number | null | undefined): string {
  if (v == null) return '—'
  const n = Math.round(Number(v) / 10_000_000)
  return `₹${n.toLocaleString('en-IN')} Cr`
}

function yoyPct(curr: bigint | number | null, prev: bigint | number | null): { pct: number; pos: boolean } | null {
  if (curr == null || prev == null || Number(prev) === 0) return null
  const pct = ((Number(curr) - Number(prev)) / Math.abs(Number(prev))) * 100
  return { pct, pos: pct >= 0 }
}

function offsetDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const params = await searchParams

  let isoDate: string
  if (params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
    isoDate = params.date
  } else {
    const now = new Date()
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    const dd  = String(ist.getDate()).padStart(2, '0')
    const mm  = String(ist.getMonth() + 1).padStart(2, '0')
    isoDate = `${ist.getFullYear()}-${mm}-${dd}`
  }

  const dbDate    = new Date(`${isoDate}T00:00:00`)
  const dbDateEnd = new Date(`${isoDate}T23:59:59`)
  const prevDate  = offsetDate(isoDate, -1)
  const nextDate  = offsetDate(isoDate, +1)

  const nowIst   = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const todayIso = `${nowIst.getFullYear()}-${String(nowIst.getMonth()+1).padStart(2,'0')}-${String(nowIst.getDate()).padStart(2,'0')}`
  const isToday      = isoDate === todayIso
  const nextIsFuture = nextDate > todayIso

  const displayDate = new Date(`${isoDate}T12:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // Fetch scheduled companies, analyses, NSE docs, and quarterly results in parallel
  const [scheduled, analyses, allDocs] = await Promise.all([
    prisma.board_meetings.findMany({
      where: { meeting_date: { gte: dbDate, lte: dbDateEnd } },
      select: { symbol: true, company_name: true },
      orderBy: { symbol: 'asc' },
    }).catch(() => [] as { symbol: string; company_name: string | null }[]),

    prisma.result_analyses.findMany({
      where: { result_date: { gte: dbDate, lte: dbDateEnd } },
    }).catch(() => []),

    // Read from nse_documents — Lambda keeps this updated every ~1 min during market hours
    prisma.$queryRaw<NseDoc[]>`
      SELECT seq_id, symbol, company_name, category, attachment_url, doc_type, nse_filed_at
      FROM nse_documents
      WHERE DATE(nse_filed_at AT TIME ZONE 'Asia/Kolkata') IN (
        ${isoDate}::date, ${nextDate}::date
      )
      ORDER BY nse_filed_at ASC
    `,
  ])

  const calendarSymbols = new Set(scheduled.map(s => s.symbol.toUpperCase()))
  const analysisMap     = new Map(analyses.map(a => [a.symbol.toUpperCase(), a]))

  // Result announcements: doc_type='result', on the selected date, in the calendar
  const todayDocs  = allDocs.filter(d => {
    const dIso = new Date(d.nse_filed_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    return dIso === isoDate
  })
  const resultDocs = todayDocs.filter(d => d.doc_type === 'result')

  const announced = deduplicateResults(resultDocs)
    .filter(d => calendarSymbols.has(d.symbol.toUpperCase()))
    .sort((a, b) => new Date(a.nse_filed_at).getTime() - new Date(b.nse_filed_at).getTime())

  const announcedSymbols = new Set(announced.map(d => d.symbol.toUpperCase()))
  const pending = scheduled.filter(s => !announcedSymbols.has(s.symbol.toUpperCase()))

  // ── Quarterly financials for announced symbols ────────────────────────────
  interface QRow { symbol: string; quarter: string; year: number; quarter_number: number; revenue: bigint | null; ebitda: bigint | null; net_profit: bigint | null; eps: number | null }
  interface FinRow { latest: QRow; yoy: QRow | null }

  const financialsMap = new Map<string, FinRow>()
  if (announced.length > 0) {
    const syms = announced.map(d => d.symbol.toUpperCase())
    const qRows = await prisma.$queryRaw<QRow[]>`
      SELECT UPPER(s.nse_symbol) AS symbol, qr.quarter, qr.year, qr.quarter_number,
             qr.revenue, qr.ebitda, qr.net_profit, qr.eps
      FROM quarterly_results qr
      JOIN stocks s ON s.id = qr.stock_id
      WHERE UPPER(s.nse_symbol) = ANY(${syms})
      ORDER BY UPPER(s.nse_symbol), qr.year DESC, qr.quarter_number DESC
    `
    // Group and deduplicate by (symbol, year, quarter_number)
    const grouped = new Map<string, QRow[]>()
    const seenKeys = new Set<string>()
    for (const r of qRows) {
      const key = `${r.symbol}-${r.year}-${r.quarter_number}`
      if (seenKeys.has(key)) continue
      seenKeys.add(key)
      if (!grouped.has(r.symbol)) grouped.set(r.symbol, [])
      grouped.get(r.symbol)!.push(r)
    }
    for (const [sym, rows] of grouped) {
      const latest = rows[0]
      const yoy = rows.find(r => r.quarter_number === latest.quarter_number && r.year === latest.year - 1) ?? null
      financialsMap.set(sym, { latest, yoy })
    }
  }

  // Additional docs (non-result) for announced companies from both days
  const extraDocsMap = new Map<string, { category: string; url: string }[]>()
  const candidatesMap = new Map<string, { category: string; url: string }[]>()

  for (const sym of announcedSymbols) {
    const primaryUrl = announced.find(d => d.symbol.toUpperCase() === sym)?.attachment_url
    const seenUrls   = new Set<string>(primaryUrl ? [primaryUrl] : [])
    const docs: { category: string; url: string }[] = []
    for (const doc of allDocs) {
      if (doc.symbol.toUpperCase() !== sym) continue
      if (doc.doc_type === 'result') continue
      if (!doc.attachment_url || seenUrls.has(doc.attachment_url)) continue
      seenUrls.add(doc.attachment_url)
      docs.push({ category: doc.category, url: doc.attachment_url })
    }
    if (docs.length > 0) candidatesMap.set(sym, docs)
  }

  // Deduplicate by file size (HEAD request) to remove re-uploaded duplicates
  await Promise.all(
    Array.from(announcedSymbols).map(async (sym) => {
      const candidates = candidatesMap.get(sym)
      if (!candidates?.length) return

      const primaryUrl  = announced.find(d => d.symbol.toUpperCase() === sym)?.attachment_url
      const allUrls     = [primaryUrl, ...candidates.map(d => d.url)].filter(Boolean) as string[]
      const sizes       = await Promise.all(allUrls.map(getPdfSize))
      const primarySize = primaryUrl ? sizes[0] : null
      const seenSizes   = new Set<string>(primarySize ? [primarySize] : [])

      const unique: { category: string; url: string }[] = []
      for (let i = 0; i < candidates.length; i++) {
        const size = sizes[primaryUrl ? i + 1 : i]
        if (size && seenSizes.has(size)) continue
        if (size) seenSizes.add(size)
        unique.push(candidates[i])
      }
      if (unique.length > 0) extraDocsMap.set(sym, unique)
    })
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-6 py-5 flex items-center gap-3">
          <Link href="/earnings-calendar/upcoming-results" className="text-slate-400 hover:text-slate-600 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <Calendar className="w-5 h-5 text-sky-500 shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">Results Timeline</h1>
            <p className="text-xs text-slate-400 mt-0.5">{displayDate} · IST</p>
          </div>

          {/* Date navigation */}
          <div className="flex items-center gap-1 ml-4">
            <Link
              href={`/earnings-calendar/timeline?date=${prevDate}`}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            {!isToday && (
              <Link
                href="/earnings-calendar/timeline"
                className="px-2.5 py-1 rounded-lg text-xs font-medium text-sky-600 hover:bg-sky-50 transition-colors"
              >
                Today
              </Link>
            )}
            <Link
              href={`/earnings-calendar/timeline?date=${nextDate}`}
              className={`p-1.5 rounded-lg transition-colors ${nextIsFuture ? 'text-slate-200 pointer-events-none' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
              title="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-2 text-xs">
            <AutoRefresh isToday={isToday} />
            <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              {announced.length} announced
            </span>
            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-1 font-medium">
              {pending.length} pending
            </span>
            <span className="inline-flex items-center gap-1.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-full px-2.5 py-1 font-medium">
              🤖 {analyses.length} analysed
            </span>
          </div>
        </div>
      </div>

      <div className="px-6 py-8 space-y-10">

        {/* Announced table */}
        {announced.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            No result announcements detected for this date.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Time</span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">Symbol</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-48">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-48">Documents</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-64">Financials</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Claude Analysis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {announced.map((doc) => {
                  const sym       = doc.symbol.toUpperCase()
                  const saved     = analysisMap.get(sym)
                  const extraDocs = extraDocsMap.get(sym) ?? []

                  return (
                    <tr key={doc.seq_id} className="align-top hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-4 font-mono text-slate-600 text-xs whitespace-nowrap">
                        {fmtTime(doc.nse_filed_at)}
                      </td>
                      <td className="px-4 py-4 font-bold whitespace-nowrap">
                        <a href={`/stock/${doc.symbol}`} target="_blank" rel="noopener noreferrer"
                          className="text-blue-600 hover:underline">
                          {doc.symbol}
                        </a>
                      </td>
                      <td className="px-4 py-4 text-slate-600 text-xs">{doc.company_name}</td>

                      {/* Documents column */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1.5">
                          {doc.attachment_url ? (
                            <a href={doc.attachment_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800 font-semibold text-xs">
                              <FileText className="w-3.5 h-3.5 shrink-0" /> Result PDF
                            </a>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                          {extraDocs.map((d, i) => (
                            <a key={i} href={d.url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs">
                              <FileText className="w-3 h-3 shrink-0 text-slate-400" />
                              {docLabel(d.category)}
                            </a>
                          ))}
                        </div>
                      </td>

                      {/* Financials column */}
                      <td className="px-4 py-4">
                        {(() => {
                          const fin = financialsMap.get(sym)
                          if (!fin) return <span className="text-xs text-slate-300">Pending sync</span>
                          const { latest, yoy } = fin
                          const rows: { label: string; curr: bigint | number | null; prev: bigint | number | null; isEps?: boolean }[] = [
                            { label: 'Sales',       curr: latest.revenue,    prev: yoy?.revenue },
                            { label: 'EBITDA',      curr: latest.ebitda,     prev: yoy?.ebitda },
                            { label: 'Net Profit',  curr: latest.net_profit, prev: yoy?.net_profit },
                            { label: 'EPS',         curr: latest.eps,        prev: yoy?.eps, isEps: true },
                          ]
                          return (
                            <div className="text-xs">
                              <p className="text-[10px] text-slate-400 font-medium mb-1.5">{latest.quarter} · YoY</p>
                              <table className="border-collapse">
                                <tbody>
                                  {rows.map(r => {
                                    const chg = yoyPct(r.curr, r.prev)
                                    return (
                                      <tr key={r.label}>
                                        <td className="pr-2.5 py-0.5 text-slate-500 whitespace-nowrap">{r.label}</td>
                                        <td className="pr-2.5 py-0.5 text-slate-800 font-medium whitespace-nowrap">
                                          {r.isEps
                                            ? (r.curr != null ? `₹${Number(r.curr).toFixed(2)}` : '—')
                                            : fmtCr(r.curr)}
                                        </td>
                                        <td className="py-0.5 whitespace-nowrap font-semibold">
                                          {chg ? (
                                            <span className={chg.pos ? 'text-emerald-600' : 'text-red-500'}>
                                              {chg.pos ? '↑' : '↓'}{Math.abs(chg.pct).toFixed(0)}%
                                            </span>
                                          ) : <span className="text-slate-300">—</span>}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )
                        })()}
                      </td>

                      <td className="px-4 py-4 min-w-0">
                        {saved ? (
                          <AnalysisDisplay analysis={{
                            signal:        saved.signal        ?? undefined,
                            confidence:    saved.confidence    ?? undefined,
                            revenue:       saved.revenue       ? Number(saved.revenue)   : null,
                            ebit:          saved.ebit          ? Number(saved.ebit)       : null,
                            net_profit:    saved.net_profit    ? Number(saved.net_profit) : null,
                            eps:           saved.eps           ? Number(saved.eps)        : null,
                            key_positives: saved.key_positives ?? undefined,
                            key_negatives: saved.key_negatives ?? undefined,
                            reasoning:     saved.reasoning     ?? undefined,
                          }} />
                        ) : (
                          doc.attachment_url ? (
                            <AnalyseButton
                              symbol={doc.symbol}
                              pdfUrl={doc.attachment_url}
                              seqId={doc.seq_id}
                              resultDate={isoDate}
                            />
                          ) : (
                            <span className="text-xs text-slate-300">No PDF</span>
                          )
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* TradingView watchlist */}
        {announced.length > 0 && (
          <TradingViewWatchlist symbols={announced.map(d => d.symbol)} />
        )}

        {/* Pending companies */}
        {pending.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Not yet announced — {pending.length} companies
            </h2>
            <div className="flex flex-wrap gap-2">
              {pending.map(s => (
                <span key={s.symbol}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm">
                  <span className="font-semibold text-slate-700">{s.symbol}</span>
                  {s.company_name && (
                    <span className="text-xs text-slate-400 max-w-[140px] truncate">{s.company_name}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
