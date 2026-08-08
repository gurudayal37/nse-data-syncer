import prisma from '@/lib/prisma'
import StockChart from '@/components/StockChart'
import SyncButton from '@/components/SyncButton'
import StockTags from '@/components/StockTags'
import TimelineTable, { SerializedEvent } from '@/components/TimelineTable'
import StockAbout from '@/components/StockAbout'
import StockMeta from '@/components/StockMeta'
import Link from 'next/link'
import { ArrowLeft, TrendingUp } from 'lucide-react'
import { notFound } from 'next/navigation'
import athData from '@/data/backtest_results_ath.json'
import simpleData from '@/data/backtest_results_simple.json'

export const dynamic = 'force-dynamic'

// ─── Theme keyword labels (thematic only — excludes generic sentiment words) ──
const THEME_LABELS: [string, string][] = [
  ['data_centre', 'Data Centre'], ['ai', 'AI'], ['semiconductor', 'Semiconductor'],
  ['aerospace', 'Aerospace'],     ['defence', 'Defence'], ['drone', 'Drone'],
  ['anti_drone', 'Anti-Drone'],   ['cctv', 'CCTV'],       ['bess', 'BESS'],
  ['ems', 'EMS'],   ['odm', 'ODM'],   ['pcb', 'PCB'],     ['cdmo', 'CDMO'],
  ['us', 'US Market'], ['europe', 'Europe/UK'], ['china', 'China'],
  ['cloud', 'Cloud'],  ['ev', 'EV'],   ['renewable', 'Renewable'],
  ['export', 'Export'], ['capex', 'Capex'], ['order_book', 'Order Book'],
  ['precision_engineering', 'Precision Engg'],
]

function seasonLabel(d: Date): string {
  const m = d.getMonth() + 1
  const y = d.getFullYear()
  const fy2 = (n: number) => String(n).slice(-2)
  if (m >= 4 && m <= 6)   return `Q4 FY${fy2(y)}`
  if (m >= 7 && m <= 9)   return `Q1 FY${fy2(y + 1)}`
  if (m >= 10 && m <= 12) return `Q2 FY${fy2(y + 1)}`
  return `Q3 FY${fy2(y)}`
}

function toIST(date: Date): string {
  return new Date(date).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short',
    year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// ─── Google News RSS ─────────────────────────────────────────────────────────

interface LiveNewsItem {
  title: string
  url: string
  source: string
  pubDate: string
}

async function fetchGoogleNews(companyName: string, symbol: string): Promise<LiveNewsItem[]> {
  const query = encodeURIComponent(`${companyName} ${symbol} NSE stock`)
  const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`
  try {
    const res = await fetch(rssUrl, {
      next: { revalidate: 3600 },
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!res.ok) return []
    const xml = await res.text()

    const items: LiveNewsItem[] = []
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
    for (const match of itemMatches) {
      const block = match[1]
      const titleRaw = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1]
                    ?? block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''
      const link    = block.match(/<link>([^<]+)<\/link>/)?.[1]
                   ?? block.match(/<guid[^>]*>([^<]+)<\/guid>/)?.[1] ?? ''
      const pubDate = block.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] ?? ''
      const source  = block.match(/<source[^>]*>([^<]+)<\/source>/)?.[1] ?? ''
      const title = titleRaw.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim()
      if (title && link) items.push({ title, url: link.trim(), source: source.trim(), pubDate })
    }
    // Sort newest first, then take top 5
    items.sort((a, b) => {
      const da = a.pubDate ? new Date(a.pubDate).getTime() : 0
      const db = b.pubDate ? new Date(b.pubDate).getTime() : 0
      return db - da
    })
    return items.slice(0, 5)
  } catch {
    return []
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(a: number | null | undefined, b: number | null | undefined): number | null {
    if (a == null || b == null || b === 0) return null
    return ((a - b) / Math.abs(b)) * 100
}

function fmtNum(v: number | null | undefined, dec = 0): string {
    if (v == null) return '—'
    return v.toLocaleString('en-IN', { maximumFractionDigits: dec, minimumFractionDigits: dec })
}

function fmtCr(v: number | bigint | null | undefined): string {
    if (v == null) return '—'
    return `₹${Math.round(Number(v) / 10_000_000).toLocaleString('en-IN')} Cr`
}

function GrowthCell({ value }: { value: number | null }) {
    if (value == null) return <td className="px-3 py-3 text-slate-300 text-right text-xs">—</td>
    const pos = value >= 0
    return (
        <td className={`px-3 py-3 text-right text-xs font-semibold ${pos ? 'text-emerald-600' : 'text-red-500'}`}>
            {pos ? '+' : ''}{value.toFixed(1)}%
        </td>
    )
}

function MetricRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0">
            <span className="text-sm text-slate-500">{label}</span>
            <span className="text-sm font-semibold text-slate-800">{value}</span>
        </div>
    )
}

function PerfTab({ label, value }: { label: string; value: number | null | undefined }) {
    const isNull = value == null
    const pos = !isNull && value! >= 0
    const color = isNull ? 'text-slate-400' : pos ? 'text-emerald-600' : 'text-red-500'
    const border = isNull ? 'border-slate-200' : pos ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'
    return (
        <div className={`flex flex-col items-center justify-center py-3 border rounded-lg w-full ${border}`}>
            <span className="text-[11px] text-slate-400 font-medium mb-0.5">{label}</span>
            <span className={`text-sm font-bold ${color}`}>
                {isNull ? '—' : `${value! >= 0 ? '+' : ''}${value!.toFixed(2)}%`}
            </span>
        </div>
    )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function StockPage(props: { params: Promise<{ symbol: string }> }) {
    const { symbol } = await props.params
    const sym = decodeURIComponent(symbol)

    // Strategy data
    const athTrades = (athData.trades || []).filter((t: any) => t.symbol === sym)
    const momentumTrades: any[] = []
    ;(simpleData.backtest_results ?? []).forEach((month: any) => {
        const h = month.holdings.find((h: any) => h.symbol === sym)
        if (h) momentumTrades.push({ month: month.month, return: h.return, score: h.score })
    })
    ;((simpleData as any).current_performance ?? []).forEach((month: any) => {
        const h = month.holdings.find((h: any) => h.symbol === sym)
        if (h) momentumTrades.push({ month: month.month, return: h.return, score: h.score })
    })
    momentumTrades.sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())

    const stock = await prisma.stocks.findFirst({
        where: { nse_symbol: sym },
        include: {
            daily_prices: { orderBy: { date: 'asc' } },
            stock_performance: true,
        },
    })
    if (!stock) notFound()

    const chartData = stock.daily_prices.map((p: any) => ({
        date: p.date.toISOString(),
        close: p.close_price,
        volume: Number(p.volume || 0),
    }))

    // Fetch quarterly results, tags, notes, live news, keyword analysis, announcements, and concall/transcript docs in parallel
    const [qRaw, tagRows, noteRows, liveNews, shareholdingRaw, pkaRows, pеadRows, nseDocRows, upcomingRows] = await Promise.all([
        prisma.quarterly_results.findMany({
            where: { stock_id: stock.id },
            orderBy: [{ year: 'desc' }, { quarter_number: 'desc' }, { id: 'desc' }],
            take: 40, // fetch more, then deduplicate below
        }),
        prisma.stock_tags.findMany({
            where: { stock_id: stock.id },
            orderBy: { created_at: 'asc' },
        }),
        prisma.stock_notes.findMany({
            where: { stock_id: stock.id },
            orderBy: { created_at: 'desc' },
            select: { id: true, note: true, created_at: true },
        }),
        fetchGoogleNews(stock.name, sym),
        prisma.shareholding_patterns.findMany({
            where: { stock_id: stock.id },
            orderBy: [{ year: 'desc' }, { quarter_number: 'desc' }, { id: 'desc' }],
            take: 32,
        }),
        prisma.$queryRaw<any[]>`
            SELECT result_date, has_presentation, presentation_url, analysed_at,
                   data_centre, ai, semiconductor, aerospace, defence, drone, anti_drone,
                   cctv, bess, ems, odm, pcb, cdmo, us, europe, china,
                   cloud, ev, renewable, export, capex, order_book, precision_engineering,
                   sentiment_score, word_count
            FROM presentation_keyword_analysis
            WHERE symbol = ${sym}
            ORDER BY result_date DESC
        `,
        prisma.$queryRaw<any[]>`
            SELECT nse_filed_at AS announced_at, attachment_url
            FROM nse_documents
            WHERE symbol = ${sym}
              AND doc_type = 'result'
            ORDER BY nse_filed_at DESC
        `,
        prisma.$queryRaw<any[]>`
            SELECT doc_type, category, attachment_url, nse_filed_at
            FROM nse_documents
            WHERE symbol = ${sym}
              AND doc_type IN ('concall', 'transcript')
              AND attachment_url != ''
            ORDER BY nse_filed_at DESC
            LIMIT 20
        `,
        prisma.$queryRaw<any[]>`
            SELECT bm.meeting_date
            FROM board_meetings bm
            LEFT JOIN nse_documents nd
                ON UPPER(nd.symbol) = UPPER(bm.symbol)
               AND DATE(nd.nse_filed_at AT TIME ZONE 'Asia/Kolkata') = bm.meeting_date
               AND nd.doc_type = 'result'
            WHERE UPPER(bm.symbol) = ${sym.toUpperCase()}
              AND bm.meeting_date >= CURRENT_DATE
              AND nd.seq_id IS NULL
            ORDER BY bm.meeting_date ASC
            LIMIT 3
        `,
    ])

    // Deduplicate shareholding by (quarter_number, year), same reason as quarterly_results
    const seenSKey = new Set<string>()
    const shareholdingDeduped = shareholdingRaw
        .filter((r) => {
            const key = `${r.year}-${r.quarter_number}`
            if (seenSKey.has(key)) return false
            seenSKey.add(key)
            return true
        })
        .slice(0, 8)

    // Compute QoQ changes for shareholding
    const shareholding = shareholdingDeduped.map((r, i) => {
        const prev = shareholdingDeduped[i + 1]
        const chg = (curr: number | null, p: number | null) =>
            curr != null && p != null ? Number((curr - p).toFixed(2)) : null
        return {
            quarter: r.quarter,
            year: r.year,
            promoter: r.promoter_holding ? Number(r.promoter_holding) : null,
            fii:      r.fii_holding      ? Number(r.fii_holding)      : null,
            dii:      r.dii_holding      ? Number(r.dii_holding)      : null,
            public:   r.public_holding   ? Number(r.public_holding)   : null,
            govt:     r.government_holding ? Number(r.government_holding) : null,
            promoter_chg: chg(r.promoter_holding ? Number(r.promoter_holding) : null, prev?.promoter_holding ? Number(prev.promoter_holding) : null),
            fii_chg:      chg(r.fii_holding ? Number(r.fii_holding) : null, prev?.fii_holding ? Number(prev.fii_holding) : null),
            dii_chg:      chg(r.dii_holding ? Number(r.dii_holding) : null, prev?.dii_holding ? Number(prev.dii_holding) : null),
            public_chg:   chg(r.public_holding ? Number(r.public_holding) : null, prev?.public_holding ? Number(prev.public_holding) : null),
        }
    })

    // Deduplicate by (quarter_number, year) — keep the highest id (most recent sync).
    // Handles legacy "Q3 2023" rows coexisting with new "Sep 2023" rows for the same period.
    const seenQKey = new Set<string>()
    const quarters = qRaw
        .filter((r) => {
            const key = `${r.year}-${r.quarter_number}`
            if (seenQKey.has(key)) return false
            seenQKey.add(key)
            return true
        })
        .slice(0, 8)
        .map((r) => ({
            quarter: r.quarter,
            year: r.year,
            quarter_number: r.quarter_number,
            revenue: r.revenue,
            ebitda: r.ebitda,
            operating_profit: r.operating_profit,
            opm_percent: r.opm_percent ? Number(r.opm_percent) : null,
            net_profit: r.net_profit,
            eps: r.eps,
        }))

    const tags = tagRows.map((r) => r.tag)
    const notes = noteRows.map((r) => ({ ...r, created_at: r.created_at.toISOString() }))

    const latest = stock.daily_prices.at(-1)
    const prev   = stock.daily_prices.at(-2)
    const perf   = stock.stock_performance

    const dailyChange = latest && prev
        ? ((latest.close_price - prev.close_price) / prev.close_price) * 100
        : null
    const isUp = dailyChange != null && dailyChange >= 0

    // 52W High/Low from last 252 trading days
    const last252 = stock.daily_prices.slice(-252)
    const w52High = last252.length ? Math.max(...last252.map((p: any) => p.high_price)) : null
    const w52Low  = last252.length ? Math.min(...last252.map((p: any) => p.low_price))  : null

    // ── Stage 2 conditions ───────────────────────────────────────────────────
    const prices = stock.daily_prices
    const avgClose = (arr: typeof prices) =>
        arr.length ? arr.reduce((s: number, p: any) => s + p.close_price, 0) / arr.length : null

    const ma50      = prices.length >= 50  ? avgClose(prices.slice(-50))        : null
    const ma150     = prices.length >= 150 ? avgClose(prices.slice(-150))       : null
    const ma200     = prices.length >= 200 ? avgClose(prices.slice(-200))       : null
    // 200 DMA from ~22 trading days ago to check if it's trending up
    const ma200_1m  = prices.length >= 222 ? avgClose(prices.slice(-222, -22))  : null

    const curPrice  = latest?.close_price ?? null

    type CondResult = 'pass' | 'fail' | 'na'
    const cond = (test: boolean | null, na: boolean): CondResult =>
        na ? 'na' : test ? 'pass' : 'fail'

    const stage2Conditions: { label: string; result: CondResult; detail: string }[] = [
        {
            label: 'Price > 150 DMA & 200 DMA',
            result: cond(
                curPrice != null && ma150 != null && ma200 != null
                    ? curPrice > ma150 && curPrice > ma200 : false,
                curPrice == null || ma150 == null || ma200 == null,
            ),
            detail: ma150 != null && ma200 != null
                ? `150 DMA ₹${ma150.toFixed(1)} · 200 DMA ₹${ma200.toFixed(1)}`
                : 'Insufficient history',
        },
        {
            label: '150 DMA > 200 DMA',
            result: cond(
                ma150 != null && ma200 != null ? ma150 > ma200 : false,
                ma150 == null || ma200 == null,
            ),
            detail: ma150 != null && ma200 != null
                ? `₹${ma150.toFixed(1)} vs ₹${ma200.toFixed(1)}`
                : 'Insufficient history',
        },
        {
            label: '200 DMA trending up ≥ 1 month',
            result: cond(
                ma200 != null && ma200_1m != null ? ma200 > ma200_1m : false,
                ma200 == null || ma200_1m == null,
            ),
            detail: ma200 != null && ma200_1m != null
                ? `Now ₹${ma200.toFixed(1)} · 1M ago ₹${ma200_1m.toFixed(1)}`
                : 'Insufficient history',
        },
        {
            label: '50 DMA > 150 DMA & 200 DMA',
            result: cond(
                ma50 != null && ma150 != null && ma200 != null
                    ? ma50 > ma150 && ma50 > ma200 : false,
                ma50 == null || ma150 == null || ma200 == null,
            ),
            detail: ma50 != null ? `50 DMA ₹${ma50.toFixed(1)}` : 'Insufficient history',
        },
        {
            label: 'Price > 50 DMA',
            result: cond(
                curPrice != null && ma50 != null ? curPrice > ma50 : false,
                curPrice == null || ma50 == null,
            ),
            detail: ma50 != null ? `50 DMA ₹${ma50.toFixed(1)}` : 'Insufficient history',
        },
        {
            label: 'Price ≥ 30% above 52-week low',
            result: cond(
                curPrice != null && w52Low != null ? curPrice >= w52Low * 1.3 : false,
                curPrice == null || w52Low == null,
            ),
            detail: w52Low != null
                ? `52W Low ₹${w52Low.toFixed(0)} · need ≥ ₹${(w52Low * 1.3).toFixed(0)}`
                : 'No data',
        },
        {
            label: 'Within 25% of 52-week high',
            result: cond(
                curPrice != null && w52High != null ? curPrice >= w52High * 0.75 : false,
                curPrice == null || w52High == null,
            ),
            detail: w52High != null
                ? `52W High ₹${w52High.toFixed(0)} · need ≥ ₹${(w52High * 0.75).toFixed(0)}`
                : 'No data',
        },
        {
            label: 'Relative Strength rank ≥ 70',
            result: cond(
                perf?.stage2_rs_rank != null ? perf.stage2_rs_rank >= 70 : false,
                perf?.stage2_rs_rank == null,
            ),
            detail: perf?.stage2_rs_rank != null
                ? `RS Rank: ${perf.stage2_rs_rank.toFixed(1)}`
                : 'No RS data',
        },
    ]

    const passCount = stage2Conditions.filter(c => c.result === 'pass').length
    const naCount   = stage2Conditions.filter(c => c.result === 'na').length
    const eligible  = stage2Conditions.length - naCount

    // Dates when 52W high/low were hit
    const w52HighEntry = w52High != null
        ? last252.slice().reverse().find((p: any) => p.high_price === w52High) : null
    const w52LowEntry  = w52Low  != null
        ? last252.slice().reverse().find((p: any) => p.low_price  === w52Low)  : null

    // All-time high from full price history
    const ath = stock.daily_prices.length
        ? Math.max(...stock.daily_prices.map((p: any) => p.close_price))
        : null
    const athEntry = ath != null
        ? stock.daily_prices.slice().reverse().find((p: any) => p.close_price === ath) : null

    // ── Keyword chips from latest presentation ────────────────────────────────
    const latestPka = pkaRows.find((r: any) => r.has_presentation && r.presentation_url)
    const keywordChips = latestPka
        ? THEME_LABELS
            .map(([key, label]) => ({ key, label, count: Number(latestPka[key] ?? 0) }))
            .filter(c => c.count > 0)
            .sort((a, b) => b.count - a.count)
        : []
    const latestPkaDate = latestPka ? new Date(latestPka.result_date) : null

    // ── Timeline: merge result announcements + presentations + concall/transcript + upcoming ──
    interface TimelineEvent {
        type: 'result' | 'presentation' | 'concall' | 'transcript' | 'upcoming'
        date: Date
        title: string
        detail?: string
        chips?: { label: string; count: number }[]
        url?: string
        analysedAt?: string
    }
    const timelineEvents: TimelineEvent[] = []

    // Deduplicate result announcements: keep earliest per season
    const seenResultSeason = new Set<string>()
    const sortedAnnouncements = [...pеadRows].sort(
        (a: any, b: any) => new Date(a.announced_at).getTime() - new Date(b.announced_at).getTime()
    )
    for (const r of sortedAnnouncements) {
        const d = new Date(r.announced_at)
        const season = seasonLabel(d)
        if (seenResultSeason.has(season)) continue
        seenResultSeason.add(season)
        timelineEvents.push({
            type: 'result',
            date: d,
            title: `${season} Results Announced`,
            detail: toIST(d),
            url: r.attachment_url || undefined,
        })
    }
    for (const r of pkaRows) {
        if (!r.has_presentation || !r.presentation_url) continue
        const d = new Date(r.result_date)
        const chips = THEME_LABELS
            .map(([key, label]) => ({ label, count: Number(r[key] ?? 0) }))
            .filter(c => c.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)
        timelineEvents.push({
            type: 'presentation',
            date: d,
            title: `${seasonLabel(d)} Investor Presentation`,
            detail: chips.length
                ? chips.map(c => `${c.label} (${c.count})`).join(' · ')
                : undefined,
            chips,
            url: r.presentation_url,
            analysedAt: r.analysed_at ? new Date(r.analysed_at).toISOString() : undefined,
        })
    }
    for (const r of upcomingRows) {
        const d = new Date(r.meeting_date)
        timelineEvents.push({
            type: 'upcoming',
            date: d,
            title: `${seasonLabel(d)} Results Expected`,
        })
    }

    for (const r of nseDocRows) {
        const d = new Date(r.nse_filed_at)
        const type = r.doc_type as 'concall' | 'transcript'
        timelineEvents.push({
            type,
            date: d,
            title: `${seasonLabel(d)} ${type === 'concall' ? 'Concall' : 'Transcript'}`,
            url: r.attachment_url || undefined,
        })
    }

    timelineEvents.sort((a, b) => {
        const sA = seasonLabel(a.date)
        const sB = seasonLabel(b.date)
        if (sA !== sB) return b.date.getTime() - a.date.getTime()
        // Same quarter: presentation (uploaded after results) appears above results
        if (a.type === 'presentation' && b.type === 'result') return -1
        if (a.type === 'result' && b.type === 'presentation') return 1
        return b.date.getTime() - a.date.getTime()
    })

    // Serialize timeline events for the client component
    const serializedEvents: SerializedEvent[] = timelineEvents.map(ev => ({
        type: ev.type,
        dateISO: ev.date.toISOString(),
        season: seasonLabel(ev.date),
        title: ev.title,
        chips: ev.chips,
        url: ev.url,
        analysedAt: ev.analysedAt,
    }))

    function daysAgo(date: Date | string | null | undefined): string {
        if (!date) return ''
        const d = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000)
        if (d === 0) return 'today'
        if (d === 1) return '1d ago'
        return `${d}d ago`
    }

    return (
        <div className="min-h-screen bg-slate-100">
            {/* ── Top nav bar ───────────────────────────────────────────── */}
            <div className="bg-white border-b border-slate-200 px-6 py-3">
                <Link href="/" className="inline-flex items-center text-slate-500 hover:text-slate-800 text-sm transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-1.5" />
                    Dashboard
                </Link>
            </div>

            <div className="px-6 py-5 space-y-4">

                {/* ── Header card ───────────────────────────────────────── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Title bar */}
                    <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4 border-b border-slate-100">
                        <div>
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{stock.name}</h1>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-bold text-slate-800">
                                        {latest ? `₹${latest.close_price.toFixed(2)}` : '—'}
                                    </span>
                                    {dailyChange != null && (
                                        <span className={`inline-flex items-center gap-1 text-sm font-semibold px-2 py-0.5 rounded-full ${
                                            isUp ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                                        }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${isUp ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                            {isUp ? '+' : ''}{dailyChange.toFixed(2)}%
                                        </span>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                                {latest ? new Date(latest.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · close price' : ''}
                            </p>
                            {/* NSE / BSE badges + tags — all on one row */}
                            <div className="flex flex-wrap items-center gap-2 mt-2.5">
                                <span className="text-xs text-slate-500 border border-slate-200 px-2 py-0.5 rounded shrink-0">
                                    NSE: <span className="font-semibold text-slate-700">{stock.nse_symbol}</span>
                                </span>
                                {stock.bse_symbol && (
                                    <span className="text-xs text-slate-500 border border-slate-200 px-2 py-0.5 rounded shrink-0">
                                        BSE: <span className="font-semibold text-slate-700">{stock.bse_symbol}</span>
                                    </span>
                                )}
                                <StockTags symbol={sym} initialTags={tags} inline={true} />
                            </div>
                        </div>
                        {/* Sync button */}
                        <div className="shrink-0 pt-1">
                            <SyncButton symbol={sym} />
                        </div>
                    </div>

                    {/* Metrics + description */}
                    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                        {/* Col 1: price metrics */}
                        <div className="px-6 py-4">
                            <MetricRow label="Market Cap"     value={fmtCr(stock.market_cap)} />
                            <MetricRow label="Current Price"  value={latest ? `₹${latest.close_price.toFixed(2)}` : '—'} />
                            <MetricRow
                                label="52W High / Low"
                                value={w52High && w52Low
                                    ? `₹${fmtNum(w52High, 2)} (${daysAgo(w52HighEntry?.date)})  /  ₹${fmtNum(w52Low, 2)} (${daysAgo(w52LowEntry?.date)})`
                                    : '—'}
                            />
                            <MetricRow
                                label="All Time High"
                                value={ath ? `₹${fmtNum(ath, 2)} (${daysAgo(athEntry?.date)})` : '—'}
                            />
                        </div>
                        {/* Col 2: sector classification */}
                        <div className="px-6 py-4">
                            <StockMeta
                                symbol={sym}
                                initial={{
                                    sector:     stock.sector     ?? null,
                                    subsector1: stock.subsector1 ?? null,
                                    subsector2: stock.subsector2 ?? null,
                                    subsector3: stock.subsector3 ?? null,
                                }}
                            />
                        </div>
                        {/* Col 3: scores + about */}
                        <div className="px-6 py-4 flex flex-col gap-3">
                            {/* Score cards row */}
                            <div className="grid grid-cols-3 gap-2">
                                {perf?.momentum_score != null && (
                                    <div className={`flex flex-col items-center px-2 py-2.5 rounded-lg border text-center ${
                                        perf.momentum_score >= 2
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                            : perf.momentum_score >= 1
                                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                                : 'bg-slate-50 border-slate-200 text-slate-500'
                                    }`}>
                                        <TrendingUp className="w-3.5 h-3.5 mb-1 opacity-70" />
                                        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 leading-none mb-1">Momentum</p>
                                        <p className="text-lg font-bold leading-none">{perf.momentum_score.toFixed(2)}</p>
                                    </div>
                                )}
                                {perf?.simple_momentum_score != null && (
                                    <div className={`flex flex-col items-center px-2 py-2.5 rounded-lg border text-center ${
                                        perf.simple_momentum_score >= 2
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                            : perf.simple_momentum_score >= 1
                                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                                : 'bg-slate-50 border-slate-200 text-slate-500'
                                    }`}>
                                        <TrendingUp className="w-3.5 h-3.5 mb-1 opacity-70" />
                                        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 leading-none mb-1">Simple Mom.</p>
                                        <p className="text-lg font-bold leading-none">{perf.simple_momentum_score.toFixed(2)}</p>
                                    </div>
                                )}
                                {perf?.stage2_rs_rank != null && (
                                    <div className={`flex flex-col items-center px-2 py-2.5 rounded-lg border text-center ${
                                        perf.stage2_rs_rank >= 80
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                            : perf.stage2_rs_rank >= 50
                                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                                : 'bg-slate-50 border-slate-200 text-slate-500'
                                    }`}>
                                        <TrendingUp className="w-3.5 h-3.5 mb-1 opacity-70" />
                                        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 leading-none mb-1">Rel. Strength</p>
                                        <p className="text-lg font-bold leading-none">{perf.stage2_rs_rank.toFixed(1)}</p>
                                    </div>
                                )}
                            </div>
                            <StockAbout symbol={sym} initialAbout={stock.long_business_summary ?? null} />
                        </div>
                    </div>

                    {/* Performance strip — full width grid */}
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 grid grid-cols-7 gap-2">
                        <PerfTab label="1W"  value={perf?.change_1w} />
                        <PerfTab label="1M"  value={perf?.change_1m} />
                        <PerfTab label="3M"  value={perf?.change_3m} />
                        <PerfTab label="6M"  value={perf?.change_6m} />
                        <PerfTab label="1Y"  value={perf?.change_1y} />
                        <PerfTab label="3Y"  value={perf?.change_3y} />
                        <PerfTab label="5Y"  value={perf?.change_5y} />
                    </div>
                </div>

                {/* ── Timeline (includes research notes) ───────────────── */}
                <TimelineTable symbol={sym} events={serializedEvents} initialNotes={notes} />

                {/* ── Chart card ────────────────────────────────────────── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5">
                    <StockChart data={chartData} />
                </div>

                {/* ── Stage 2 Screening Criteria ───────────────────────── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Stage 2 Screening Criteria</p>
                        <div className="flex items-center gap-2">
                            {naCount > 0 && (
                                <span className="text-[10px] text-slate-400 font-medium">
                                    {naCount} N/A (insufficient history)
                                </span>
                            )}
                            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                                passCount === eligible
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : passCount >= eligible * 0.6
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-red-50 text-red-600 border-red-200'
                            }`}>
                                {passCount}/{eligible} pass
                            </span>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {stage2Conditions.map((c) => (
                            <div key={c.label} className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 border ${
                                c.result === 'pass'
                                    ? 'bg-emerald-50 border-emerald-100'
                                    : c.result === 'fail'
                                        ? 'bg-red-50 border-red-100'
                                        : 'bg-slate-50 border-slate-100'
                            }`}>
                                <span className={`mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                    c.result === 'pass'
                                        ? 'bg-emerald-500 text-white'
                                        : c.result === 'fail'
                                            ? 'bg-red-400 text-white'
                                            : 'bg-slate-300 text-white'
                                }`}>
                                    {c.result === 'pass' ? '✓' : c.result === 'fail' ? '✗' : '—'}
                                </span>
                                <div className="min-w-0">
                                    <p className={`text-xs font-semibold leading-tight ${
                                        c.result === 'pass' ? 'text-emerald-800'
                                        : c.result === 'fail' ? 'text-red-700'
                                        : 'text-slate-400'
                                    }`}>{c.label}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{c.detail}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Quarterly Results ─────────────────────────────────── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quarterly Results</p>
                        <span className="text-xs text-slate-400">Values in ₹ Cr</span>
                    </div>
                    {quarters.length === 0 ? (
                        <p className="text-sm text-slate-400 italic py-4">
                            No data yet — click <strong className="text-slate-600 font-semibold">Sync Now</strong> to fetch from Screener.in.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-slate-200">
                                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Quarter</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Sales</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-300">QoQ</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-300">YoY</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">EBITDA</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-300">QoQ</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-300">YoY</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Net Profit</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-300">QoQ</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-300">YoY</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">EPS</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-300">QoQ</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-300">YoY</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">OPM%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {quarters.map((q, i) => {
                                        const prev4 = quarters[i + 4]
                                        const prev1 = quarters[i + 1]
                                        const isLatest = i === 0
                                        return (
                                            <tr
                                                key={`${q.quarter}-${q.year}`}
                                                className={`border-b border-slate-100 transition-colors ${
                                                    isLatest
                                                        ? 'bg-blue-50 hover:bg-blue-100/70'
                                                        : 'hover:bg-slate-50'
                                                }`}
                                            >
                                                <td className={`px-3 py-3 whitespace-nowrap ${isLatest ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                                                    {isLatest && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 mb-0.5 align-middle" />}
                                                    {q.quarter}
                                                </td>
                                                <td className={`px-3 py-3 text-right tabular-nums ${isLatest ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{fmtNum(q.revenue)}</td>
                                                <GrowthCell value={pct(q.revenue, prev1?.revenue)} />
                                                <GrowthCell value={pct(q.revenue, prev4?.revenue)} />
                                                <td className={`px-3 py-3 text-right tabular-nums ${isLatest ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{fmtNum(q.ebitda)}</td>
                                                <GrowthCell value={pct(q.ebitda, prev1?.ebitda)} />
                                                <GrowthCell value={pct(q.ebitda, prev4?.ebitda)} />
                                                <td className={`px-3 py-3 text-right tabular-nums ${isLatest ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{fmtNum(q.net_profit)}</td>
                                                <GrowthCell value={pct(q.net_profit, prev1?.net_profit)} />
                                                <GrowthCell value={pct(q.net_profit, prev4?.net_profit)} />
                                                <td className={`px-3 py-3 text-right tabular-nums ${isLatest ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{fmtNum(q.eps, 2)}</td>
                                                <GrowthCell value={pct(q.eps, prev1?.eps)} />
                                                <GrowthCell value={pct(q.eps, prev4?.eps)} />
                                                <td className={`px-3 py-3 text-right tabular-nums text-slate-500 ${isLatest ? 'font-bold' : ''}`}>
                                                    {q.opm_percent != null ? `${q.opm_percent.toFixed(1)}%` : '—'}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ── Shareholding Pattern ──────────────────────────────── */}
                {shareholding.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Shareholding Pattern</p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-slate-200">
                                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Quarter</th>
                                        {[
                                            { key: 'promoter', label: 'Promoters' },
                                            { key: 'fii',      label: 'FIIs' },
                                            { key: 'dii',      label: 'DIIs' },
                                            { key: 'public',   label: 'Public' },
                                        ].map(({ key, label }) => (
                                            <th key={key} className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                                                {label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {shareholding.map((s, i) => {
                                        const isLatest = i === 0
                                        const ChgBadge = ({ val }: { val: number | null }) => {
                                            if (val == null || val === 0) return null
                                            const pos = val > 0
                                            return (
                                                <span className={`ml-1 text-[10px] font-semibold ${pos ? 'text-emerald-600' : 'text-red-500'}`}>
                                                    {pos ? '▲' : '▼'}{Math.abs(val).toFixed(2)}
                                                </span>
                                            )
                                        }
                                        return (
                                            <tr key={`${s.quarter}-${s.year}`}
                                                className={`border-b border-slate-100 transition-colors ${isLatest ? 'bg-blue-50 hover:bg-blue-100/70' : 'hover:bg-slate-50'}`}>
                                                <td className={`px-3 py-2.5 whitespace-nowrap text-sm ${isLatest ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                                                    {isLatest && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 mb-0.5 align-middle" />}
                                                    {s.quarter}
                                                </td>
                                                {([
                                                    { val: s.promoter, chg: s.promoter_chg },
                                                    { val: s.fii,      chg: s.fii_chg },
                                                    { val: s.dii,      chg: s.dii_chg },
                                                    { val: s.public,   chg: s.public_chg },
                                                ] as { val: number | null; chg: number | null }[]).map(({ val, chg }, ci) => (
                                                    <td key={ci} className={`px-3 py-2.5 text-right tabular-nums ${isLatest ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                                                        {val != null ? `${val.toFixed(2)}%` : '—'}
                                                        <ChgBadge val={chg} />
                                                    </td>
                                                ))}
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── Two-column: News + Strategies ─────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Live News */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Latest News</p>
                            <span className="text-[10px] text-slate-300">via Google News</span>
                        </div>
                        {liveNews.length > 0 ? (
                            <div className="divide-y divide-slate-100">
                                {liveNews.map((item, i) => (
                                    <div key={i} className="py-3 first:pt-0 last:pb-0">
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="min-w-0">
                                                <h3 className="text-sm font-medium text-slate-800 leading-snug mb-0.5">
                                                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">
                                                        {item.title}
                                                    </a>
                                                </h3>
                                                {item.source && (
                                                    <p className="text-xs text-slate-400">{item.source}</p>
                                                )}
                                            </div>
                                            {item.pubDate && (
                                                <span className="text-xs text-slate-300 whitespace-nowrap shrink-0 pt-0.5">
                                                    {new Date(item.pubDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400 italic">No recent news found.</p>
                        )}
                    </div>

                    {/* Strategy history stacked */}
                    <div className="space-y-4">
                        {/* ATH */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">ATH Strategy</p>
                            {athTrades.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead className="text-slate-400 border-b border-slate-100">
                                            <tr>
                                                <th className="pb-2 text-left font-medium">Entry</th>
                                                <th className="pb-2 text-right font-medium">Price</th>
                                                <th className="pb-2 text-right font-medium">Exit</th>
                                                <th className="pb-2 text-right font-medium">Price</th>
                                                <th className="pb-2 text-right font-medium">PnL</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {athTrades.map((t: any, i: number) => (
                                                <tr key={i} className="hover:bg-slate-50">
                                                    <td className="py-2 text-slate-500">{t.entry_date}</td>
                                                    <td className="py-2 text-right font-medium text-slate-700">₹{t.entry_price}</td>
                                                    <td className="py-2 text-right text-slate-500">{t.exit_date || '—'}</td>
                                                    <td className="py-2 text-right font-medium text-slate-700">{t.exit_price ? `₹${t.exit_price}` : '—'}</td>
                                                    <td className={`py-2 text-right font-bold ${t.pnl_pct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {t.pnl_pct >= 0 ? '+' : ''}{Number(t.pnl_pct).toFixed(2)}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400 italic">No trades in ATH Strategy.</p>
                            )}
                        </div>

                        {/* Simple Momentum */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Simple Momentum</p>
                            {momentumTrades.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead className="text-slate-400 border-b border-slate-100">
                                            <tr>
                                                <th className="pb-2 text-left font-medium">Month</th>
                                                <th className="pb-2 text-right font-medium">Score</th>
                                                <th className="pb-2 text-right font-medium">Return</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {momentumTrades.map((t: any, i: number) => (
                                                <tr key={i} className="hover:bg-slate-50">
                                                    <td className="py-2 text-slate-500">{t.month}</td>
                                                    <td className="py-2 text-right font-medium text-slate-700">{t.score.toFixed(2)}</td>
                                                    <td className={`py-2 text-right font-bold ${t.return >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {t.return >= 0 ? '+' : ''}{t.return.toFixed(2)}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400 italic">Not selected in Simple Momentum.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
