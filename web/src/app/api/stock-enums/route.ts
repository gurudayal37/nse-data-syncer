import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const ALLOWED_FIELDS = ['sector', 'subsector1', 'subsector2', 'subsector3'] as const
type Field = typeof ALLOWED_FIELDS[number]

export async function GET(req: NextRequest) {
  const field = req.nextUrl.searchParams.get('field') as Field | null
  const q = req.nextUrl.searchParams.get('q') ?? ''

  if (!field || !ALLOWED_FIELDS.includes(field)) {
    return NextResponse.json({ error: 'Invalid field' }, { status: 400 })
  }

  try {
    const rows = await prisma.stocks.findMany({
      where: {
        [field]: {
          not: null,
          contains: q,
          mode: 'insensitive',
        },
      },
      select: { [field]: true },
      distinct: [field],
      orderBy: { [field]: 'asc' },
      take: 20,
    })

    const values = rows
      .map((r: any) => r[field] as string)
      .filter(Boolean)

    return NextResponse.json({ values })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
