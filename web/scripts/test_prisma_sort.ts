import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
    log: ['query'],
})

async function main() {
    console.log('Testing 5Y sorting with nulls: last...')

    try {
        const stocks = await prisma.stocks.findMany({
            take: 10,
            select: {
                nse_symbol: true,
                stock_performance: {
                    select: {
                        change_5y: true
                    }
                }
            },
            orderBy: {
                stock_performance: {
                    change_5y: { sort: 'desc', nulls: 'last' }
                }
            }
        })

        console.log('Top 10 stocks by 5Y % (DESC):')
        stocks.forEach(s => {
            console.log(`${s.nse_symbol}: ${s.stock_performance?.change_5y}`)
        })

    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
