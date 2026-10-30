import prisma from '@/lib/prisma'

// An ETF is hidden once it has no price on any of the last N trading days.
// Trading days are the distinct dates present in etf_daily_prices, so weekends
// and NSE holidays don't count against anyone.
export const ETF_STALE_AFTER_TRADING_DAYS = 3

/**
 * IDs of active ETFs that have a price on at least one of the last
 * ETF_STALE_AFTER_TRADING_DAYS trading days.
 *
 * Second line of defence behind sync_etf_daily.py's deactivation of symbols
 * that vanish from Dhan's master: catches renamed/delisted/suspended ETFs that
 * are still marked active but have stopped getting data, so their frozen
 * returns never get ranked alongside live funds.
 */
export async function getFreshEtfIds(): Promise<number[]> {
    const rows = await prisma.$queryRaw<{ etf_id: number }[]>`
        WITH recent_days AS (
            SELECT DISTINCT date FROM etf_daily_prices
            WHERE date >= (SELECT MAX(date) FROM etf_daily_prices) - INTERVAL '30 days'
            ORDER BY date DESC
            LIMIT ${ETF_STALE_AFTER_TRADING_DAYS}
        )
        SELECT DISTINCT p.etf_id
        FROM etf_daily_prices p
        JOIN etfs e ON e.id = p.etf_id
        WHERE e.is_active = 1
          AND p.date >= (SELECT MIN(date) FROM recent_days)
    `
    return rows.map((r) => r.etf_id)
}
