import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const LIMIT = 20
const WINDOW_MS = 60_000

export async function GET() {
  try {
    const inputs = await prisma.contextInput.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    })
    return NextResponse.json(inputs)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch context' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const rl = checkRateLimit(`${getClientIp(req)}:context:write`, LIMIT, WINDOW_MS)
  if (!rl.success) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  try {
    const body = await req.json()
    const { updates } = body as {
      updates: Array<{ key: string; value: string; label: string; category: string }>
    }

    const results = await Promise.all(
      updates.map((u) =>
        prisma.contextInput.upsert({
          where: { key: u.key },
          update: { value: u.value, label: u.label },
          create: u,
        })
      )
    )

    return NextResponse.json({ updated: results.length })
  } catch {
    return NextResponse.json({ error: 'Failed to save context' }, { status: 500 })
  }
}
