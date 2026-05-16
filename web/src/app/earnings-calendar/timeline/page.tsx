import Link from 'next/link'
import { ChevronLeft, ChevronRight, Calendar, Clock, FileText } from 'lucide-react'
import prisma from '@/lib/prisma'
import AnalyseButton, { AnalysisDisplay } from './AnalyseButton'
import TradingViewWatchlist from './TradingViewWatchlist'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: "Results Timeline",
  description: 'Real-time tracker of quarterly result announcements on NSE.',
}

// ── NSE filtering ─────────────────────────────────────────────────────────────

const RESULT_KEYWORDS = [
  'financial result', 'quarterly result', 'unaudited result',
  'audited result', 'half yearly result', 'annual result',
]
const EXCLUDE_CATEGORIES = [
  'copy of newspaper publication', 'clarification - financial results',
  'reply to clarification', 'analysts/institutional investor meet',
  'corporate insolvency', 'general updates',
]
const CATEGORY_PRIORITY: Record<string, number> = {
  'outcome of board meeting': 0, 'press release': 1, 'updates': 2,
}

// Docs we want to highlight with a friendly label
const DOC_LABELS: [RegExp, string][] = [
  [/investor\s*presentation/i,        'Presentation'],
  [/transcript/i,                      'Concall Transcript'],
  [/concall|con\s*call/i,             'Concall'],
  [/press\s*release/i,                'Press Release'],
  [/annual\s*report/i,                'Annual Report'],
  [/shareholder.*letter|letter.*shareholder/i, 'Shareholder Letter'],
  [/outcome\s*of\s*board/i,           'Board Outcome'],
]

function docLabel(desc: string): string {
  for (const [re, label] of DOC_LABELS) {
    if (re.test(desc)) return label
  }
  return desc.length > 28 ? desc.slice(0, 26) + '…' : desc
}

interface NseAnn {
  seq_id: string; symbol: string; sm_name: string
  an_dt: string; desc: string; attchmntFile: string; attchmntText: string
}

function isResult(ann: NseAnn): boolean {
  const cat = (ann.desc ?? '').toLowerCase()
  if (EXCLUDE_CATEGORIES.some(e => cat.includes(e))) return false
  if (cat.includes('outcome of board meeting')) return true
  const text = `${ann.desc ?? ''} ${ann.attchmntText ?? ''}`.toLowerCase()
  return RESULT_KEYWORDS.some(kw => text.includes(kw))
}

function deduplicate(results: NseAnn[]): NseAnn[] {
  const best = new Map<string, { ann: NseAnn; pri: number }>()
  for (const ann of results) {
    const pri = CATEGORY_PRIORITY[(ann.desc ?? '').toLowerCase()] ?? 99
    const cur = best.get(ann.symbol)
    if (!cur || pri < cur.pri) best.set(ann.symbol, { ann, pri })
  }
  return Array.from(best.values()).map(v => v.ann)
}

const MONTHS: Record<string, number> = {
  jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11,
}
function parseNseTime(s: string): Date | null {
  const m = s?.match(/(\d+)-(\w+)-(\d+)\s+(\d+):(\d+):(\d+)/)
  if (!m) return null
  const mon = MONTHS[m[2].toLowerCase()]
  if (mon === undefined) return null
  return new Date(+m[3], mon, +m[1], +m[4], +m[5], +m[6])
}
function fmtTime(s: string): string {
  const d = parseNseTime(s)
  if (!d) return '—'
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

async function fetchNseAnns(dateStr: string): Promise<NseAnn[]> {
  try {
    const res = await fetch(
      `https://www.nseindia.com/api/corporate-announcements?index=equities&from_date=${dateStr}&to_date=${dateStr}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.nseindia.com/companies-listing/corporate-filings-announcements',
        },
        cache: 'no-store',
      }
    )
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch { return [] }
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

function toNseDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

function offsetDate(isoDate: string, days: number): string {
  const d = new Date(isoDate)
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
  const isToday   = isoDate === todayIso
  const nextIsFuture = nextDate > todayIso

  const displayDate = new Date(`${isoDate}T12:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // Scheduled companies + analyses + NSE today + NSE next day (in parallel)
  const [scheduled, analyses, todayNse, nextDayNse] = await Promise.all([
    prisma.board_meetings.findMany({
      where: { meeting_date: { gte: dbDate, lte: dbDateEnd } },
      select: { symbol: true, company_name: true },
      orderBy: { symbol: 'asc' },
    }).catch(() => [] as { symbol: string; company_name: string | null }[]),

    prisma.result_analyses.findMany({
      where: { result_date: { gte: dbDate, lte: dbDateEnd } },
    }).catch(() => []),

    fetchNseAnns(toNseDate(isoDate)),
    fetchNseAnns(toNseDate(nextDate)),
  ])

  const calendarSymbols = new Set(scheduled.map(s => s.symbol.toUpperCase()))
  const analysisMap     = new Map(analyses.map(a => [a.symbol.toUpperCase(), a]))

  // Primary result announcements
  const announced = deduplicate(todayNse.filter(isResult))
    .filter(r => calendarSymbols.has(r.symbol.toUpperCase()))
    .sort((a, b) => (parseNseTime(a.an_dt)?.getTime() ?? 0) - (parseNseTime(b.an_dt)?.getTime() ?? 0))

  const announcedSymbols = new Set(announced.map(r => r.symbol.toUpperCase()))
  const pending = scheduled.filter(s => !announcedSymbols.has(s.symbol.toUpperCase()))

  // Additional docs: all PDFs from both days for announced companies, excluding primary filing
  // Step 1: deduplicate by URL only
  // Step 2: HEAD request to filter out docs with same file size as primary or each other
  const allDaysAnns = [...todayNse, ...nextDayNse]

  // Collect candidates per symbol (URL-deduped only — label dedup was dropping legit docs)
  const candidatesMap = new Map<string, { desc: string; url: string }[]>()
  for (const sym of announcedSymbols) {
    const primaryUrl = announced.find(a => a.symbol.toUpperCase() === sym)?.attchmntFile
    const seenUrls   = new Set<string>(primaryUrl ? [primaryUrl] : [])
    const docs: { desc: string; url: string }[] = []
    for (const ann of allDaysAnns) {
      if (ann.symbol.toUpperCase() !== sym) continue
      if (!ann.attchmntFile || seenUrls.has(ann.attchmntFile)) continue
      seenUrls.add(ann.attchmntFile)
      docs.push({ desc: ann.desc, url: ann.attchmntFile })
    }
    if (docs.length > 0) candidatesMap.set(sym, docs)
  }

  // Step 2: fetch primary + candidate sizes in parallel, then filter by size
  const extraDocsMap = new Map<string, { desc: string; url: string }[]>()
  await Promise.all(
    Array.from(announcedSymbols).map(async (sym) => {
      const candidates = candidatesMap.get(sym)
      if (!candidates?.length) return

      const primaryUrl  = announced.find(a => a.symbol.toUpperCase() === sym)?.attchmntFile
      const allUrls     = [primaryUrl, ...candidates.map(d => d.url)].filter(Boolean) as string[]
      const sizes       = await Promise.all(allUrls.map(getPdfSize))
      const primarySize = primaryUrl ? sizes[0] : null
      const seenSizes   = new Set<string>(primarySize ? [primarySize] : [])

      const unique: { desc: string; url: string }[] = []
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Claude Analysis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {announced.map((ann) => {
                  const sym      = ann.symbol.toUpperCase()
                  const saved    = analysisMap.get(sym)
                  const extraDocs = extraDocsMap.get(sym) ?? []

                  return (
                    <tr key={ann.seq_id} className="align-top hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-4 font-mono text-slate-600 text-xs whitespace-nowrap">{fmtTime(ann.an_dt)}</td>
                      <td className="px-4 py-4 font-bold text-slate-800 whitespace-nowrap">{ann.symbol}</td>
                      <td className="px-4 py-4 text-slate-600 text-xs">{ann.sm_name}</td>

                      {/* Documents column */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1.5">
                          {/* Primary filing */}
                          {ann.attchmntFile ? (
                            <a href={ann.attchmntFile} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800 font-semibold text-xs">
                              <FileText className="w-3.5 h-3.5 shrink-0" /> Result PDF
                            </a>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                          {/* Additional docs */}
                          {extraDocs.map((doc, i) => (
                            <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs">
                              <FileText className="w-3 h-3 shrink-0 text-slate-400" />
                              {docLabel(doc.desc)}
                            </a>
                          ))}
                        </div>
                      </td>

                      <td className="px-4 py-4 min-w-0">
                        {saved ? (
                          <AnalysisDisplay analysis={{
                            signal:        saved.signal        ?? undefined,
                            confidence:    saved.confidence    ?? undefined,
                            revenue:       saved.revenue       ? Number(saved.revenue)    : null,
                            ebit:          saved.ebit          ? Number(saved.ebit)        : null,
                            net_profit:    saved.net_profit    ? Number(saved.net_profit)  : null,
                            eps:           saved.eps           ? Number(saved.eps)         : null,
                            key_positives: saved.key_positives ?? undefined,
                            key_negatives: saved.key_negatives ?? undefined,
                            reasoning:     saved.reasoning     ?? undefined,
                          }} />
                        ) : (
                          ann.attchmntFile ? (
                            <AnalyseButton
                              symbol={ann.symbol}
                              pdfUrl={ann.attchmntFile}
                              seqId={ann.seq_id}
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
          <TradingViewWatchlist symbols={announced.map(a => a.symbol)} />
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
