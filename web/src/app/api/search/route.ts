import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 1) return NextResponse.json({ results: [] })

  const [stocks, etfs, smeStocks] = await Promise.all([
    prisma.stocks.findMany({
      where: {
        is_active: true,
        OR: [
          { nse_symbol: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { nse_symbol: true, name: true },
      orderBy: { market_cap: 'desc' },
      take: 6,
    }),
    prisma.etfs.findMany({
      where: {
        is_active: 1,
        OR: [
          { symbol: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { symbol: true, name: true },
      take: 4,
    }),
    prisma.sme_stocks.findMany({
      where: {
        is_active: true,
        OR: [
          { symbol: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { symbol: true, name: true },
      take: 4,
    }),
  ])

  const results = [
    ...stocks.map((s) => ({ symbol: s.nse_symbol ?? '', name: s.name, type: 'stock' as const })),
    ...etfs.map((e) => ({ symbol: e.symbol, name: e.name, type: 'etf' as const })),
    ...smeStocks.map((s) => ({ symbol: s.symbol, name: s.name, type: 'sme' as const })),
  ]

  return NextResponse.json({ results })
}
