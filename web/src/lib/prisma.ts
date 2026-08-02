import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function buildUrl(): string {
    const base = process.env.DATABASE_URL ?? ''
    const sep = base.includes('?') ? '&' : '?'
    // Limit to 1 connection per serverless worker; prevents pool exhaustion on
    // RDS when many Vercel functions run concurrently.
    return `${base}${sep}connection_limit=1&pool_timeout=20`
}

const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        datasources: { db: { url: buildUrl() } },
    })

// Cache on globalThis so hot-reloads (dev) and warm Lambda invocations (prod)
// reuse the same instance instead of opening new connections each time.
globalForPrisma.prisma = prisma

export default prisma
