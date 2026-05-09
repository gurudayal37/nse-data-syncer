import Link from 'next/link'
import { ChevronLeft, ChevronRight, Calendar, ArrowRight } from 'lucide-react'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Earnings Calendar — Upcoming Results',
  description: 'NSE/BSE companies announcing quarterly results, grouped by date.',
}

interface BoardMeeting {
  symbol: string
  companyName: string
  meetingDate: string
  purpose: string
  bm_desc: string
  attachment?: string
  sm_isin?: string
}

const RESULT_KEYWORDS = ['result', 'quarterly', 'financial result', 'annual result', 'half yearly', 'unaudited', 'audited']

function isResultMeeting(m: BoardMeeting) {
  const text = `${m.purpose} ${m.bm_desc}`.toLowerCase()
  return RESULT_KEYWORDS.some((kw) => text.includes(kw))
}

function parseNSEDate(dateStr: string): Date | null {
  if (!dateStr) return null
  // DD-MM-YYYY
  const parts = dateStr.split('-')
  if (parts.length === 3 && parts[0].length === 2) {
    return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]))
  }
  // YYYY-MM-DD or ISO
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? null : d
}

function fmtMonthYear(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
}

function dateDayLabel(d: Date, today: Date): string {
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { weekday: 'long' })
}

async function fetchBoardMeetings(month: string): Promise<{ data: BoardMeeting[]; error?: string }> {
  const hdrs = await headers()
  const host = hdrs.get('host') || 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'

  const res = await fetch(`${protocol}://${host}/api/earnings-calendar?month=${month}`, {
    cache: 'no-store',
  })

  if (!res.ok) return { data: [], error: 'Failed to load data' }
  return res.json()
}

interface PageProps {
  searchParams: Promise<{ month?: string }>
}

export default async function EarningsCalendarPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const month = sp.month || defaultMonth

  const [year, mon] = month.split('-').map(Number)
  const prevMonth = mon === 1
    ? `${year - 1}-12`
    : `${year}-${String(mon - 1).padStart(2, '0')}`
  const nextMonth = mon === 12
    ? `${year + 1}-01`
    : `${year}-${String(mon + 1).padStart(2, '0')}`

  const { data, error } = await fetchBoardMeetings(month)

  // Filter to only result announcements and sort by date
  const resultMeetings = data
    .filter(isResultMeeting)
    .sort((a, b) => {
      const da = parseNSEDate(a.meetingDate)
      const db = parseNSEDate(b.meetingDate)
      if (!da || !db) return 0
      return da.getTime() - db.getTime()
    })

  // Group by date string (YYYY-MM-DD key for stable grouping)
  const groups = new Map<string, { date: Date; meetings: BoardMeeting[] }>()
  for (const m of resultMeetings) {
    const d = parseNSEDate(m.meetingDate)
    if (!d) continue
    const key = d.toISOString().slice(0, 10)
    if (!groups.has(key)) groups.set(key, { date: d, meetings: [] })
    groups.get(key)!.meetings.push(m)
  }

  const sortedDays = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-400 hover:text-slate-600 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-sky-500" />
              <h1 className="text-xl font-bold text-slate-900">Earnings Calendar</h1>
            </div>
          </div>

          {/* Month navigation */}
          <div className="flex items-center gap-2">
            <Link
              href={`/earnings-calendar/upcoming-results?month=${prevMonth}`}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <span className="text-sm font-semibold text-slate-800 min-w-[130px] text-center">
              {fmtMonthYear(year, mon)}
            </span>
            <Link
              href={`/earnings-calendar/upcoming-results?month=${nextMonth}`}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600"
            >
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-5 py-3.5 text-sm">
            Could not fetch NSE data: {error}. Showing cached or empty results.
          </div>
        )}

        {sortedDays.length === 0 && !error && (
          <div className="text-center py-20 text-slate-400 text-sm">
            No result announcements found for {fmtMonthYear(year, mon)}.
          </div>
        )}

        <div className="space-y-8">
          {sortedDays.map(([key, { date, meetings }]) => {
            const diffDays = Math.round((date.getTime() - today.getTime()) / 86_400_000)
            const isPast = diffDays < 0
            const isToday = diffDays === 0

            const dayLabel = dateDayLabel(date, today)
            const dateFormatted = date.toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
            })

            return (
              <div key={key}>
                {/* Day header */}
                <div className="flex items-center gap-3 mb-3">
                  <h2 className={`text-base font-bold ${isPast ? 'text-slate-400' : 'text-slate-800'}`}>
                    {dateFormatted}
                    {dayLabel !== dateFormatted && (
                      <span className={`ml-2 text-sm font-medium ${isToday ? 'text-sky-600' : isPast ? 'text-slate-400' : 'text-slate-500'}`}>
                        ({dayLabel})
                      </span>
                    )}
                  </h2>
                  <div className={`h-px flex-1 ${isPast ? 'bg-slate-100' : 'bg-slate-200'}`} />
                  <span className={`text-xs font-medium ${isPast ? 'text-slate-300' : 'text-slate-400'}`}>
                    {meetings.length} {meetings.length === 1 ? 'company' : 'companies'}
                  </span>
                </div>

                {/* Company chips */}
                <div className="flex flex-wrap gap-2">
                  {meetings.map((m) => (
                    <Link
                      key={`${m.symbol}-${key}`}
                      href={`/stock/${m.symbol}`}
                      className={`
                        group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all
                        ${isPast
                          ? 'border-slate-100 bg-white text-slate-400 hover:border-slate-200 hover:text-slate-600'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 shadow-sm'}
                      `}
                    >
                      <span className="font-bold text-xs text-slate-500 group-hover:text-sky-500 transition-colors">
                        {m.symbol}
                      </span>
                      <span className={`text-[11px] ${isPast ? 'text-slate-300' : 'text-slate-500'} group-hover:text-sky-600 transition-colors max-w-[160px] truncate`}>
                        {m.companyName}
                      </span>
                      <ArrowRight className={`w-3 h-3 shrink-0 ${isPast ? 'text-slate-200' : 'text-slate-300'} group-hover:text-sky-400 transition-colors`} />
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer note */}
        {sortedDays.length > 0 && (
          <p className="mt-10 text-xs text-slate-400 text-center">
            Data sourced from NSE India board meeting announcements. Dates may change.
          </p>
        )}
      </div>
    </div>
  )
}
