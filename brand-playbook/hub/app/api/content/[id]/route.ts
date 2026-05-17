import { NextRequest } from 'next/server'
import { db, contentItems } from '@/lib/db'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [item] = await db.select().from(contentItems).where(eq(contentItems.id, id))
  if (!item) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(item)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const [updated] = await db
    .update(contentItems)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(contentItems.id, id))
    .returning()

  if (!updated) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.delete(contentItems).where(eq(contentItems.id, id))
  return new Response(null, { status: 204 })
}
