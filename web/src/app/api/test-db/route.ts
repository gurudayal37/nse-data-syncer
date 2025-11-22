import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Test basic connection
    const result = await prisma.$queryRaw`SELECT 1 as test`
    
    // Get counts
    const stockCount = await prisma.stocks.count()
    const priceCount = await prisma.daily_prices.count()
    
    // Get a sample stock
    const sampleStock = await prisma.stocks.findFirst({
      select: { id: true, nse_symbol: true, name: true }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful!',
      data: {
        testQuery: result,
        stockCount,
        priceCount,
        sampleStock,
        databaseUrl: process.env.DATABASE_URL ? 'Set ✅' : 'Not set ❌'
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: 'Database connection failed',
      error: error.message,
      errorCode: error.code,
      fullError: error.toString()
    }, { status: 500 })
  }
}

