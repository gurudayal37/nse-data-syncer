import Link from 'next/link'
import { ChevronLeft, Calendar, Clock, FileText } from 'lucide-react'
import prisma from '@/lib/prisma'
import AnalyseButton, { AnalysisDisplay } from './AnalyseButton'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: "Today's Results Timeline",
  description: 'Real-time tracker of quarterly result announcements on NSE.',
}

// ── NSE filtering (mirrors test_pead_local.py) ────────────────────────────────

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

async function fetchNseResults(dateStr: string): Promise<NseAnn[]> {
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TimelinePage() {
  const now = new Date()
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const dd   = String(ist.getDate()).padStart(2, '0')
  const mm   = String(ist.getMonth() + 1).padStart(2, '0')
  const yyyy = ist.getFullYear()
  const nseDate  = `${dd}-${mm}-${yyyy}`
  const dbDate   = new Date(yyyy, ist.getMonth(), ist.getDate())
  const dbDateEnd = new Date(yyyy, ist.getMonth(), ist.getDate(), 23, 59, 59)
  const isoDate  = `${yyyy}-${mm}-${dd}` // for client component

  const displayDate = ist.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // Scheduled companies
  let scheduled: { symbol: string; company_name: string | null }[] = []
  try {
    scheduled = await prisma.board_meetings.findMany({
      where: { meeting_date: { gte: dbDate, lte: dbDateEnd } },
      select: { symbol: true, company_name: true },
      orderBy: { symbol: 'asc' },
    })
  } catch { /* empty */ }

  const calendarSymbols = new Set(scheduled.map(s => s.symbol.toUpperCase()))

  // Stored Claude analyses for today
  const analyses = await prisma.result_analyses.findMany({
    where: { result_date: { gte: dbDate, lte: dbDateEnd } },
  }).catch(() => [])

  const analysisMap = new Map(analyses.map(a => [a.symbol.toUpperCase(), a]))

  // NSE announcements
  const allNse = await fetchNseResults(nseDate)
  const announced = deduplicate(allNse.filter(isResult))
    .filter(r => calendarSymbols.has(r.symbol.toUpperCase()))
    .sort((a, b) => (parseNseTime(a.an_dt)?.getTime() ?? 0) - (parseNseTime(b.an_dt)?.getTime() ?? 0))

  const announcedSymbols = new Set(announced.map(r => r.symbol.toUpperCase()))
  const pending = scheduled.filter(s => !announcedSymbols.has(s.symbol.toUpperCase()))

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
            <h1 className="text-xl font-bold text-slate-900">Today&apos;s Results Timeline</h1>
            <p className="text-xs text-slate-400 mt-0.5">{displayDate} · IST</p>
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
            No result announcements detected yet for today.
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-56">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Filing</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Claude Analysis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {announced.map((ann) => {
                  const sym      = ann.symbol.toUpperCase()
                  const saved    = analysisMap.get(sym)

                  return (
                    <tr key={ann.seq_id} className="align-top hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-4 font-mono text-slate-600 text-xs whitespace-nowrap">{fmtTime(ann.an_dt)}</td>
                      <td className="px-4 py-4 font-bold text-slate-800 whitespace-nowrap">{ann.symbol}</td>
                      <td className="px-4 py-4 text-slate-600 text-xs">{ann.sm_name}</td>
                      <td className="px-4 py-4">
                        {ann.attchmntFile ? (
                          <a href={ann.attchmntFile} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800 font-medium text-xs">
                            <FileText className="w-3.5 h-3.5" /> PDF
                          </a>
                        ) : <span className="text-slate-300 text-xs">—</span>}
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
