import { NextRequest } from 'next/server'
import { db, intelligenceItems } from '@/lib/db'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json() as { action?: string; relatedContentId?: string }

  const update: Partial<typeof intelligenceItems.$inferInsert> = {}
  if (body.action) update.action = body.action as typeof intelligenceItems.$inferInsert['action']
  if (body.relatedContentId) update.relatedContentId = body.relatedContentId

  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const [item] = await db
    .update(intelligenceItems)
    .set(update)
    .where(eq(intelligenceItems.id, id))
    .returning()

  if (!item) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json(item)
}
