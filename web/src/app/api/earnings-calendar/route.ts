import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

async function getNSECookies(): Promise<string> {
  const res = await fetch('https://www.nseindia.com', {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    cache: 'no-store',
  })
  const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : []
  return setCookies.map((c: string) => c.split(';')[0]).join('; ')
}

function fmtNSEDate(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)

  const [year, mon] = month.split('-').map(Number)
  if (!year || !mon || mon < 1 || mon > 12) {
    return NextResponse.json({ data: [], error: 'Invalid month' }, { status: 400 })
  }

  const from = new Date(year, mon - 1, 1)
  const to = new Date(year, mon, 0)

  try {
    const cookies = await getNSECookies()

    const url = `https://www.nseindia.com/api/corporate-board-meetings?index=equities&from_date=${fmtNSEDate(from)}&to_date=${fmtNSEDate(to)}`

    const res = await fetch(url, {
      headers: {
        'Cookie': cookies,
        'User-Agent': UA,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.nseindia.com/companies-listing/corporate-filings-board-meetings',
        'X-Requested-With': 'XMLHttpRequest',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json({ data: [], error: `NSE returned ${res.status}` }, { status: 200 })
    }

    const raw = await res.json()
    const data = Array.isArray(raw) ? raw : []

    return NextResponse.json(
      { data },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ data: [], error: msg }, { status: 200 })
  }
}
