import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

async function getStock(symbol: string) {
  return prisma.stocks.findFirst({ where: { nse_symbol: symbol.toUpperCase() } })
}

// GET /api/stock/[symbol]/notes
export async function GET(_: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params
  const stock = await getStock(symbol)
  if (!stock) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })

  const notes = await prisma.stock_notes.findMany({
    where: { stock_id: stock.id },
    orderBy: { created_at: 'desc' },
    select: { id: true, note: true, created_at: true },
  })
  return NextResponse.json({ notes })
}

// POST /api/stock/[symbol]/notes  — add a note
export async function POST(req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params
  const { note } = await req.json()
  const trimmed = (note ?? '').trim()
  if (!trimmed) return NextResponse.json({ error: 'note required' }, { status: 400 })

  const stock = await getStock(symbol)
  if (!stock) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })

  const created = await prisma.stock_notes.create({
    data: { stock_id: stock.id, note: trimmed },
    select: { id: true, note: true, created_at: true },
  })
  return NextResponse.json({ note: created })
}

// DELETE /api/stock/[symbol]/notes  — delete by id
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const stock = await getStock(symbol)
  if (!stock) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })

  await prisma.stock_notes.deleteMany({ where: { id: Number(id), stock_id: stock.id } })
  const notes = await prisma.stock_notes.findMany({
    where: { stock_id: stock.id },
    orderBy: { created_at: 'desc' },
    select: { id: true, note: true, created_at: true },
  })
  return NextResponse.json({ notes })
}
