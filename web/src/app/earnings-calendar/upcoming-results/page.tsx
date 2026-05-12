import Link from 'next/link'
import { ChevronLeft, ChevronRight, Calendar, ArrowRight, Clock } from 'lucide-react'
import prisma from '@/lib/prisma'
import ScrollToToday from './ScrollToToday'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Earnings Calendar — Upcoming Results',
  description: 'NSE companies announcing quarterly results, grouped by date.',
}

function fmtMonthYear(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
}

function dayLabel(d: Date, today: Date): string {
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { weekday: 'long' })
}

interface PageProps {
  searchParams: Promise<{ month?: string }>
}

export default async function EarningsCalendarPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const today = new Date(ist.getFullYear(), ist.getMonth(), ist.getDate())

  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const month = sp.month || defaultMonth

  const [year, mon] = month.split('-').map(Number)
  const prevMonth = mon === 1
    ? `${year - 1}-12`
    : `${year}-${String(mon - 1).padStart(2, '0')}`
  const nextMonth = mon === 12
    ? `${year + 1}-01`
    : `${year}-${String(mon + 1).padStart(2, '0')}`

  const from = new Date(year, mon - 1, 1)
  const to = new Date(year, mon, 0, 23, 59, 59)

  let meetings: { symbol: string; company_name: string | null; meeting_date: Date }[] = []
  let dbError = false

  try {
    meetings = await prisma.board_meetings.findMany({
      where: { meeting_date: { gte: from, lte: to } },
      select: { symbol: true, company_name: true, meeting_date: true },
      orderBy: { meeting_date: 'asc' },
    })
  } catch {
    dbError = true
  }

  // Group by date
  const groups = new Map<string, { date: Date; items: typeof meetings }>()
  for (const m of meetings) {
    const key = m.meeting_date.toISOString().slice(0, 10)
    if (!groups.has(key)) groups.set(key, { date: m.meeting_date, items: [] })
    groups.get(key)!.items.push(m)
  }
  const sortedDays = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))

  const isFutureMonth = from > today
  const isNoData = !dbError && sortedDays.length === 0

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

          {/* Today's timeline link */}
          <Link
            href="/earnings-calendar/timeline"
            className="flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-800 border border-sky-200 hover:border-sky-400 bg-sky-50 hover:bg-sky-100 rounded-lg px-3 py-1.5 transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
            Today's Timeline
          </Link>

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
        {dbError && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 rounded-xl px-5 py-3.5 text-sm">
            Could not load earnings data from database.
          </div>
        )}

        {isNoData && isFutureMonth && (
          <div className="text-center py-20 text-slate-400 text-sm">
            No data yet for {fmtMonthYear(year, mon)}. The sync covers the next 90 days.
          </div>
        )}

        {isNoData && !isFutureMonth && (
          <div className="text-center py-20 text-slate-400 text-sm">
            No result announcements found for {fmtMonthYear(year, mon)}.
          </div>
        )}

        {month === defaultMonth && <ScrollToToday />}

        <div className="space-y-8">
          {sortedDays.map(([key, { date: d, items }]) => {
            const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000)
            const isPast = diff < 0
            const isToday = diff === 0
            const label = dayLabel(d, today)
            const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

            return (
              <div key={key} id={isToday ? 'today' : undefined}>
                {/* Day header */}
                <div className="flex items-center gap-3 mb-3">
                  <h2 className={`text-base font-bold ${isPast ? 'text-slate-400' : 'text-slate-800'}`}>
                    {dateStr}
                    <span className={`ml-2 text-sm font-medium ${isToday ? 'text-sky-600' : isPast ? 'text-slate-400' : 'text-slate-500'}`}>
                      ({label})
                    </span>
                  </h2>
                  <div className={`h-px flex-1 ${isPast ? 'bg-slate-100' : 'bg-slate-200'}`} />
                  <span className={`text-xs font-medium ${isPast ? 'text-slate-300' : 'text-slate-400'}`}>
                    {items.length} {items.length === 1 ? 'company' : 'companies'}
                  </span>
                </div>

                {/* Company chips */}
                <div className="flex flex-wrap gap-2">
                  {items.map((m) => (
                    <Link
                      key={`${m.symbol}-${key}`}
                      href={`/stock/${m.symbol}`}
                      className={`
                        group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm transition-all
                        ${isPast
                          ? 'border-slate-100 bg-white text-slate-400 hover:border-slate-200 hover:text-slate-600'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 shadow-sm'}
                      `}
                    >
                      <span className="font-bold text-xs text-slate-500 group-hover:text-sky-500 transition-colors">
                        {m.symbol}
                      </span>
                      <span className={`text-[11px] max-w-[160px] truncate ${isPast ? 'text-slate-300' : 'text-slate-500'} group-hover:text-sky-600 transition-colors`}>
                        {m.company_name}
                      </span>
                      <ArrowRight className={`w-3 h-3 shrink-0 ${isPast ? 'text-slate-200' : 'text-slate-300'} group-hover:text-sky-400 transition-colors`} />
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {sortedDays.length > 0 && (
          <p className="mt-10 text-xs text-slate-400 text-center">
            Sourced from NSE board meeting announcements. Synced daily at 6 AM IST. Dates may change.
          </p>
        )}
      </div>
    </div>
  )
}
