import { NextRequest } from 'next/server'
import { db, contentSchedule, contentItems } from '@/lib/db'
import { eq, gte } from 'drizzle-orm'
import type { ContentScheduleItem } from '@/lib/db/schema'

export const runtime = 'nodejs'

type Platform = ContentScheduleItem['platform']

export async function GET() {
  const upcoming = await db
    .select({
      schedule: contentSchedule,
      content: contentItems,
    })
    .from(contentSchedule)
    .innerJoin(contentItems, eq(contentSchedule.contentId, contentItems.id))
    .where(gte(contentSchedule.scheduledAt, new Date()))
    .orderBy(contentSchedule.scheduledAt)

  return Response.json(upcoming)
}

export async function POST(req: NextRequest) {
  const { contentId, platform, scheduledAt } = await req.json() as {
    contentId: string
    platform: Platform
    scheduledAt: string
  }

  if (!contentId || !platform || !scheduledAt) {
    return Response.json({ error: 'contentId, platform, scheduledAt required' }, { status: 400 })
  }

  await db
    .update(contentItems)
    .set({ status: 'scheduled', scheduledAt: new Date(scheduledAt), updatedAt: new Date() })
    .where(eq(contentItems.id, contentId))

  const [schedule] = await db
    .insert(contentSchedule)
    .values({ contentId, platform, scheduledAt: new Date(scheduledAt) })
    .returning()

  return Response.json(schedule, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string }
  await db.delete(contentSchedule).where(eq(contentSchedule.id, id))
  return new Response(null, { status: 204 })
}
