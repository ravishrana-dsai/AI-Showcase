import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('[db] DATABASE_URL not set — database operations will fail')
    return new Proxy({} as PrismaClient, {
      get: (_t, prop) => {
        if (prop === '$connect' || prop === '$disconnect') return () => Promise.resolve()
        return () => Promise.reject(new Error('DATABASE_URL is not set'))
      },
    })
  }
  const adapter = new PrismaPg(databaseUrl)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
