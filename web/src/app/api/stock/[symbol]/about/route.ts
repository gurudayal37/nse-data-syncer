import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// PUT /api/stock/[symbol]/about — update long_business_summary
export async function PUT(req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params
  const { about } = await req.json()
  if (typeof about !== 'string') return NextResponse.json({ error: 'about required' }, { status: 400 })

  const stock = await prisma.stocks.findFirst({ where: { nse_symbol: symbol.toUpperCase() } })
  if (!stock) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })

  await prisma.stocks.update({
    where: { id: stock.id },
    data: { long_business_summary: about.trim() || null },
  })

  return NextResponse.json({ ok: true })
}
