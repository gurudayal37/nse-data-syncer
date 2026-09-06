import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  const rows = await prisma.favorite_stocks.findMany({
    include: { stocks: { select: { nse_symbol: true, name: true } } },
    orderBy: { created_at: 'desc' },
  })
  return NextResponse.json({
    favorites: rows.map((r) => ({ symbol: r.stocks.nse_symbol, name: r.stocks.name })),
  })
}

export async function POST(req: NextRequest) {
  const { symbol } = (await req.json()) as { symbol?: string }
  if (!symbol?.trim()) return NextResponse.json({ error: 'symbol is required' }, { status: 400 })

  const stock = await prisma.stocks.findFirst({
    where: { nse_symbol: symbol.trim().toUpperCase() },
    select: { id: true },
  })
  if (!stock) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })

  await prisma.favorite_stocks.upsert({
    where: { stock_id: stock.id },
    create: { stock_id: stock.id },
    update: {},
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { symbol } = (await req.json()) as { symbol?: string }
  if (!symbol?.trim()) return NextResponse.json({ error: 'symbol is required' }, { status: 400 })

  const stock = await prisma.stocks.findFirst({
    where: { nse_symbol: symbol.trim().toUpperCase() },
    select: { id: true },
  })
  if (!stock) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })

  await prisma.favorite_stocks.deleteMany({ where: { stock_id: stock.id } })

  return NextResponse.json({ ok: true })
}
