import { NextRequest } from 'next/server'
import { db, monitoredSources } from '@/lib/db'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET() {
  const sources = await db.select().from(monitoredSources).orderBy(monitoredSources.createdAt)
  return Response.json(sources)
}

export async function POST(req: NextRequest) {
  const { type, value, label } = await req.json() as {
    type: 'subreddit' | 'rss' | 'news_keyword'
    value: string
    label?: string
  }

  if (!type || !value) {
    return Response.json({ error: 'type and value required' }, { status: 400 })
  }

  const [source] = await db
    .insert(monitoredSources)
    .values({ type, value, label: label ?? value })
    .returning()

  return Response.json(source, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { id, active } = await req.json() as { id: string; active: boolean }

  const [updated] = await db
    .update(monitoredSources)
    .set({ active })
    .where(eq(monitoredSources.id, id))
    .returning()

  return Response.json(updated)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string }
  await db.delete(monitoredSources).where(eq(monitoredSources.id, id))
  return new Response(null, { status: 204 })
}
