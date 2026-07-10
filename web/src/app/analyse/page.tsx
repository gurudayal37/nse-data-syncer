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
  'defence', 'drone', 'anti_drone', 'cctv', 'cloud', 'ev', 'renewable', 'export', 'capex',
  'order_book', 'precision_engineering', 'best', 'top', 'leader', 'highest',
  'sentiment',
] as const
type Keyword = typeof ALLOWED_KEYWORDS[number]

const KEYWORD_LABELS: Record<Keyword, string> = {
  data_centre:   'Data Centre',
  ai:            'AI',
  semiconductor: 'Semiconductor',
  aerospace:     'Aerospace',
  defence:       'Defence',
  drone:         'Drone',
  anti_drone:    'Anti Drone',
  cctv:          'CCTV / Camera',
  cloud:         'Cloud',
  ev:            'EV',
  renewable:     'Renewable',
  export:        'Export',
  capex:         'Capex',
  order_book:    'Order Book',
  precision_engineering: 'Precision Engineering',
  best:          'Best',
  top:           'Top',
  leader:        'Leader',
  highest:       'Highest',
  sentiment:     'Sentiment',
}

type SortField = 'mentions' | 'change_1w' | 'change_1m' | 'change_3m' | 'change_6m'
type SortOrder = 'asc' | 'desc'

interface Row {
  symbol:           string
  company_name:     string
  mentions:         number
  positive_hits:    number | null
  negative_hits:    number | null
  change_1w:        number | null
  change_1m:        number | null
  change_3m:        number | null
  change_6m:        number | null
  market_cap:       number | null
  presentation_url: string | null
}

async function fetchRows(keyword: Keyword, sort: SortField, order: SortOrder): Promise<Row[]> {
  if (keyword === 'sentiment') {
    return prisma.$queryRawUnsafe<Row[]>(`
      SELECT
        pka.symbol,
        pka.company_name,
        pka.sentiment_score AS mentions,
        pka.positive_hits,
        pka.negative_hits,
        sp.change_1w,
        sp.change_1m,
        sp.change_3m,
        sp.change_6m,
        s.market_cap,
        pka.presentation_url
      FROM presentation_keyword_analysis pka
      JOIN stocks s ON s.nse_symbol = pka.symbol
      LEFT JOIN stock_performance sp ON sp.stock_id = s.id
      WHERE pka.has_presentation = TRUE
      ORDER BY ${sort === 'mentions' ? 'mentions' : `sp.${sort}`} ${order} NULLS LAST,
               pka.sentiment_score DESC
    `)
  }

  return prisma.$queryRawUnsafe<Row[]>(`
    SELECT
      pka.symbol,
      pka.company_name,
      pka."${keyword}"   AS mentions,
      NULL::int AS positive_hits,
      NULL::int AS negative_hits,
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
}

interface PageProps {
  searchParams: Promise<{ keyword?: string; sort?: string; order?: string }>
}

const SORT_COLS_BASE: { field: SortField; label: string }[] = [
  { field: 'change_1w',  label: '1W'       },
  { field: 'change_1m',  label: '1M'       },
  { field: 'change_3m',  label: '3M'       },
  { field: 'change_6m',  label: '6M'       },
]

export default async function AnalysePage({ searchParams }: PageProps) {
  const params  = await searchParams
  const keyword = (ALLOWED_KEYWORDS.includes(params.keyword as Keyword)
    ? params.keyword : 'data_centre') as Keyword
  const sort    = (['mentions','change_1w','change_1m','change_3m','change_6m'].includes(params.sort ?? '')
    ? params.sort : 'mentions') as SortField
  const order   = params.order === 'asc' ? 'asc' : 'desc'

  const rows = await fetchRows(keyword, sort, order)
  const isSentiment = keyword === 'sentiment'
  const SORT_COLS = [
    { field: 'mentions' as SortField, label: isSentiment ? 'Sentiment' : 'Mentions' },
    ...SORT_COLS_BASE,
  ]

  const SortIcon = ({ col }: { col: SortField }) => {
    if (sort !== col) return <span className="ml-1 text-slate-400">↕</span>
    return order === 'asc'
      ? <span className="ml-1 text-blue-600">↑</span>
      : <span className="ml-1 text-blue-600">↓</span>
  }

  const SortHeader = ({ col, label }: { col: SortField; label: string }) => {
    const nextOrder = sort === col && order === 'desc' ? 'asc' : 'desc'
    return (
      <th className="px-4 py-3 text-right">
        <Link
          href={`/analyse?keyword=${keyword}&sort=${col}&order=${nextOrder}`}
          className="inline-flex items-center justify-end hover:text-blue-600 whitespace-nowrap"
        >
          {label}<SortIcon col={col} />
        </Link>
      </th>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="px-6 py-6">

        {/* Header */}
        <header className="mb-5 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Keyword Analysis</h1>
            <p className="text-slate-500 text-sm mt-1">
              {isSentiment
                ? <>{rows.length} companies ranked by <span className="font-semibold text-slate-700">management commentary sentiment</span> (positive − negative phrase density per 1000 words) in Q4 FY26 investor presentations</>
                : <>{rows.length} companies mentioning <span className="font-semibold text-slate-700">{KEYWORD_LABELS[keyword]}</span> in Q4 FY26 investor presentations</>}
            </p>
          </div>
        </header>

        {/* Keyword tabs */}
        <div className="bg-white shadow-sm rounded-xl border border-slate-200 px-5 py-4 mb-5">
          <Suspense>
            <KeywordTabs active={keyword} />
          </Suspense>
        </div>

        {/* Table */}
        <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 w-8 text-slate-400">#</th>
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3 text-right">Mkt Cap</th>
                  {SORT_COLS.map(({ field, label }) => (
                    <SortHeader key={field} col={field} label={label} />
                  ))}
                  <th className="px-4 py-3 text-center">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, i) => (
                  <tr key={row.symbol} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-300 text-xs">{i + 1}</td>

                    <td className="px-4 py-3 font-semibold">
                      <Link href={`/stock/${row.symbol}`} className="text-blue-600 hover:underline">
                        {row.symbol}
                      </Link>
                    </td>

                    <td className="px-4 py-3 text-slate-500 truncate max-w-[220px]" title={row.company_name}>
                      {row.company_name}
                    </td>

                    <td className="px-4 py-3 text-right text-slate-500">
                      {row.market_cap
                        ? `₹${Math.round(Number(row.market_cap) / 10_000_000).toLocaleString('en-IN')} Cr`
                        : '—'}
                    </td>

                    <td className="px-4 py-3 text-right font-bold">
                      {isSentiment ? (
                        <>
                          <span className={Number(row.mentions) >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                            {Number(row.mentions) >= 0 ? '+' : ''}{Number(row.mentions).toFixed(2)}
                          </span>
                          <span className="block text-[11px] font-normal text-slate-400">
                            +{row.positive_hits ?? 0} / -{row.negative_hits ?? 0}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-800">{Number(row.mentions)}</span>
                      )}
                    </td>

                    {(['change_1w','change_1m','change_3m','change_6m'] as const).map(f => (
                      <td key={f} className="px-4 py-3 text-right">
                        <PercentageChange value={row[f] != null ? Number(row[f]) : null} />
                      </td>
                    ))}

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
