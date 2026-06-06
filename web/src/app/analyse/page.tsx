import Link from 'next/link'
import { Suspense } from 'react'
import prisma from '@/lib/prisma'
import PercentageChange from '@/components/PercentageChange'
import KeywordTabs from './KeywordTabs'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Keyword Analysis',
  description: 'Companies mentioning key themes in Q4 FY26 investor presentations',
}

const ALLOWED_KEYWORDS = [
  'data_centre', 'ai', 'semiconductor', 'aerospace',
  'defence', 'cloud', 'ev', 'renewable', 'export', 'capex',
] as const
type Keyword = typeof ALLOWED_KEYWORDS[number]

const KEYWORD_LABELS: Record<Keyword, string> = {
  data_centre:   'Data Centre',
  ai:            'AI',
  semiconductor: 'Semiconductor',
  aerospace:     'Aerospace',
  defence:       'Defence',
  cloud:         'Cloud',
  ev:            'EV',
  renewable:     'Renewable',
  export:        'Export',
  capex:         'Capex',
}

type SortField = 'mentions' | 'change_1m' | 'change_3m' | 'change_1w' | 'change_6m'
type SortOrder = 'asc' | 'desc'

interface Row {
  symbol:       string
  company_name: string
  mentions:     number
  change_1w:    number | null
  change_1m:    number | null
  change_3m:    number | null
  change_6m:    number | null
  market_cap:   number | null
  presentation_url: string | null
}

async function fetchRows(keyword: Keyword, sort: SortField, order: SortOrder): Promise<Row[]> {
  const rows = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT
      pka.symbol,
      pka.company_name,
      pka."${keyword}" AS mentions,
      sp.change_1w,
      sp.change_1m,
      sp.change_3m,
      sp.change_6m,
      s.market_cap,
      pka.presentation_url
    FROM presentation_keyword_analysis pka
    JOIN stocks s ON s.nse_symbol = pka.symbol
    LEFT JOIN stock_performance sp ON sp.stock_id = s.id
    WHERE pka."${keyword}" > 0
    ORDER BY ${sort === 'mentions' ? 'mentions' : `sp.${sort}`} ${order} NULLS LAST,
             pka."${keyword}" DESC
  `)
  return rows
}

interface PageProps {
  searchParams: Promise<{
    keyword?: string
    sort?: string
    order?: string
  }>
}

function SortLink({
  field, current, order, keyword, label,
}: {
  field: SortField; current: SortField; order: SortOrder; keyword: string; label: string
}) {
  const isActive = field === current
  const nextOrder = isActive && order === 'desc' ? 'asc' : 'desc'
  const arrow = isActive ? (order === 'desc' ? ' ↓' : ' ↑') : ''
  return (
    <Link
      href={`/analyse?keyword=${keyword}&sort=${field}&order=${nextOrder}`}
      className={`hover:text-slate-900 ${isActive ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}
    >
      {label}{arrow}
    </Link>
  )
}

export default async function AnalysePage({ searchParams }: PageProps) {
  const params  = await searchParams
  const keyword = (ALLOWED_KEYWORDS.includes(params.keyword as Keyword)
    ? params.keyword : 'data_centre') as Keyword
  const sort    = (['mentions','change_1m','change_3m','change_1w','change_6m'].includes(params.sort ?? '')
    ? params.sort : 'mentions') as SortField
  const order   = params.order === 'asc' ? 'asc' : 'desc'

  const rows = await fetchRows(keyword, sort, order)

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-600 mb-2 inline-block">← Home</Link>
          <h1 className="text-2xl font-bold text-slate-900">Keyword Analysis</h1>
          <p className="text-sm text-slate-500 mt-1">
            Companies mentioning key themes in Q4 FY26 investor presentations
          </p>
        </div>

        {/* Keyword tabs */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">Select theme</p>
          <Suspense>
            <KeywordTabs active={keyword} />
          </Suspense>
        </div>

        {/* Results */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-900">{KEYWORD_LABELS[keyword]}</span>
              <span className="text-slate-400 text-sm ml-2">— {rows.length} companies</span>
            </div>
            <span className="text-xs text-slate-400">Q4 FY26 investor presentations</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs">
                  <th className="text-left px-4 py-3 text-slate-500 font-medium w-10">#</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Company</th>
                  <th className="text-right px-4 py-3">
                    <SortLink field="mentions" current={sort} order={order} keyword={keyword} label="Mentions" />
                  </th>
                  <th className="text-right px-4 py-3">
                    <SortLink field="change_1w" current={sort} order={order} keyword={keyword} label="1W" />
                  </th>
                  <th className="text-right px-4 py-3">
                    <SortLink field="change_1m" current={sort} order={order} keyword={keyword} label="1M" />
                  </th>
                  <th className="text-right px-4 py-3">
                    <SortLink field="change_3m" current={sort} order={order} keyword={keyword} label="3M" />
                  </th>
                  <th className="text-right px-4 py-3">
                    <SortLink field="change_6m" current={sort} order={order} keyword={keyword} label="6M" />
                  </th>
                  <th className="text-right px-4 py-3 text-slate-500 font-medium">Mkt Cap</th>
                  <th className="text-center px-4 py-3 text-slate-500 font-medium">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((row, i) => (
                  <tr key={row.symbol} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-300 text-xs">{i + 1}</td>
                    <td className="px-4 py-3">
                      <Link href={`/stock/${row.symbol}`} className="hover:text-sky-600 transition-colors">
                        <div className="font-semibold text-slate-800">{row.symbol}</div>
                        <div className="text-xs text-slate-400">{row.company_name}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-slate-900">{Number(row.mentions)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PercentageChange value={row.change_1w != null ? Number(row.change_1w) : null} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PercentageChange value={row.change_1m != null ? Number(row.change_1m) : null} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PercentageChange value={row.change_3m != null ? Number(row.change_3m) : null} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PercentageChange value={row.change_6m != null ? Number(row.change_6m) : null} />
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-500">
                      {row.market_cap
                        ? `₹${(Number(row.market_cap) / 100).toFixed(0)}Cr`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.presentation_url ? (
                        <a
                          href={row.presentation_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-500 hover:text-sky-700 text-xs font-medium"
                        >
                          PDF
                        </a>
                      ) : (
                        <span className="text-slate-200">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              No companies found for this keyword.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
