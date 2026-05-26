import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params
  const body = await req.json()

  const { sector, subsector1, subsector2, subsector3 } = body

  try {
    await prisma.stocks.updateMany({
      where: { nse_symbol: symbol },
      data: {
        sector:     sector     ?? null,
        subsector1: subsector1 ?? null,
        subsector2: subsector2 ?? null,
        subsector3: subsector3 ?? null,
      },
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
