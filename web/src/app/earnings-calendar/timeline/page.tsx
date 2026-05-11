import Link from 'next/link'
import { ChevronLeft, Calendar, Clock, FileText } from 'lucide-react'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: "Today's Results Timeline",
  description: 'Real-time tracker of quarterly result announcements on NSE — who has filed and who is pending.',
}

// ── NSE filtering logic (mirrors test_pead_local.py) ─────────────────────────

const RESULT_KEYWORDS = [
  'financial result', 'quarterly result', 'unaudited result',
  'audited result', 'half yearly result', 'annual result',
]

const EXCLUDE_CATEGORIES = [
  'copy of newspaper publication',
  'clarification - financial results',
  'reply to clarification',
  'analysts/institutional investor meet',
  'corporate insolvency',
  'general updates',
]

const CATEGORY_PRIORITY: Record<string, number> = {
  'outcome of board meeting': 0,
  'press release': 1,
  'updates': 2,
}

interface NseAnn {
  seq_id: string
  symbol: string
  sm_name: string
  an_dt: string
  desc: string
  attchmntFile: string
  attchmntText: string
}

function isResult(ann: NseAnn): boolean {
  const cat = (ann.desc ?? '').toLowerCase()
  if (EXCLUDE_CATEGORIES.some(e => cat.includes(e))) return false
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
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
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
  } catch {
    return []
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TimelinePage() {
  // IST "today"
  const now = new Date()
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const dd = String(ist.getDate()).padStart(2, '0')
  const mm = String(ist.getMonth() + 1).padStart(2, '0')
  const yyyy = ist.getFullYear()
  const nseDate = `${dd}-${mm}-${yyyy}` // DD-MM-YYYY for NSE API
  const dbDate  = new Date(yyyy, ist.getMonth(), ist.getDate()) // midnight for DB query
  const dbDateEnd = new Date(yyyy, ist.getMonth(), ist.getDate(), 23, 59, 59)

  const displayDate = ist.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // Scheduled companies from board_meetings
  let scheduled: { symbol: string; company_name: string | null }[] = []
  try {
    scheduled = await prisma.board_meetings.findMany({
      where: { meeting_date: { gte: dbDate, lte: dbDateEnd } },
      select: { symbol: true, company_name: true },
      orderBy: { symbol: 'asc' },
    })
  } catch { /* show empty */ }

  const calendarSymbols = new Set(scheduled.map(s => s.symbol.toUpperCase()))

  // NSE result announcements for today
  const allNse = await fetchNseResults(nseDate)
  const announced = deduplicate(allNse.filter(isResult))
    .filter(r => calendarSymbols.has(r.symbol.toUpperCase()))
    .sort((a, b) => {
      const ta = parseNseTime(a.an_dt)?.getTime() ?? 0
      const tb = parseNseTime(b.an_dt)?.getTime() ?? 0
      return ta - tb
    })

  const announcedSymbols = new Set(announced.map(r => r.symbol.toUpperCase()))
  const pending = scheduled.filter(s => !announcedSymbols.has(s.symbol.toUpperCase()))

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-3">
          <Link href="/earnings-calendar/upcoming-results" className="text-slate-400 hover:text-slate-600 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <Calendar className="w-5 h-5 text-sky-500" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">Today's Results Timeline</h1>
            <p className="text-xs text-slate-400 mt-0.5">{displayDate} · IST</p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              {announced.length} announced
            </span>
            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-1 font-medium">
              {pending.length} pending
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">

        {/* Announced table */}
        {announced.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            No result announcements detected yet for today.
          </div>
        ) : (
          <div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wide w-28">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> Time (IST)
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wide">Symbol</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wide">Company</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wide w-24">Filing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {announced.map((ann) => (
                    <tr key={ann.seq_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-700 text-xs">
                        {fmtTime(ann.an_dt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-800">{ann.symbol}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                        {ann.sm_name}
                      </td>
                      <td className="px-4 py-3">
                        {ann.attchmntFile ? (
                          <a
                            href={ann.attchmntFile}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800 font-medium"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            PDF
                          </a>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-400 text-right">
              Source: NSE · Sorted by announcement time · Refreshes on each page load
            </p>
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
                <span
                  key={s.symbol}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-500"
                >
                  <span className="font-semibold text-slate-700">{s.symbol}</span>
                  {s.company_name && (
                    <span className="text-xs text-slate-400 max-w-[140px] truncate">{s.company_name}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {scheduled.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-8">
            No companies scheduled in the earnings calendar for today.
          </p>
        )}
      </div>
    </div>
  )
}
