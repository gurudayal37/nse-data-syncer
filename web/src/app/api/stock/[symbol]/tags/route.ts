import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

async function getStockId(symbol: string): Promise<number | null> {
    const stock = await prisma.stocks.findFirst({
        where: { nse_symbol: symbol },
        select: { id: true },
    })
    return stock?.id ?? null
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ symbol: string }> }
) {
    const { symbol } = await params
    const stockId = await getStockId(decodeURIComponent(symbol))
    if (!stockId) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })

    const rows = await prisma.stock_tags.findMany({
        where: { stock_id: stockId },
        orderBy: { created_at: 'asc' },
    })
    return NextResponse.json({ tags: rows.map((r) => r.tag) })
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ symbol: string }> }
) {
    const { symbol } = await params
    const { tag } = (await req.json()) as { tag?: string }
    if (!tag?.trim()) return NextResponse.json({ error: 'tag is required' }, { status: 400 })

    const stockId = await getStockId(decodeURIComponent(symbol))
    if (!stockId) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })

    await prisma.stock_tags.upsert({
        where: { stock_id_tag: { stock_id: stockId, tag: tag.trim() } },
        create: { stock_id: stockId, tag: tag.trim() },
        update: {},
    })

    const rows = await prisma.stock_tags.findMany({
        where: { stock_id: stockId },
        orderBy: { created_at: 'asc' },
    })
    return NextResponse.json({ tags: rows.map((r) => r.tag) })
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ symbol: string }> }
) {
    const { symbol } = await params
    const { tag } = (await req.json()) as { tag?: string }
    if (!tag) return NextResponse.json({ error: 'tag is required' }, { status: 400 })

    const stockId = await getStockId(decodeURIComponent(symbol))
    if (!stockId) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })

    await prisma.stock_tags.deleteMany({ where: { stock_id: stockId, tag } })

    const rows = await prisma.stock_tags.findMany({
        where: { stock_id: stockId },
        orderBy: { created_at: 'asc' },
    })
    return NextResponse.json({ tags: rows.map((r) => r.tag) })
}
