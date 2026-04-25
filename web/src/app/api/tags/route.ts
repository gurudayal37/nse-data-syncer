import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/tags?q=searchterm  — list master tags (optionally filtered)
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q') ?? ''
    const tags = await prisma.tag_master.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })
    return NextResponse.json({ tags })
  } catch (e) {
    console.error('[GET /api/tags]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// POST /api/tags  — add a new tag to master list
export async function POST(req: NextRequest) {
  const { name } = await req.json()
  const trimmed = (name ?? '').trim()
  if (!trimmed) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const tag = await prisma.tag_master.upsert({
    where: { name: trimmed },
    update: {},
    create: { name: trimmed },
    select: { id: true, name: true },
  })
  return NextResponse.json({ tag })
}
