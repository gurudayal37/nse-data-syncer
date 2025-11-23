import { PrismaClient } from '../../node_modules/.prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient()
}

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = global.prisma || new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
})

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma
