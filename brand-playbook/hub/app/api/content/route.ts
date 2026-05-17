import { NextRequest } from 'next/server'
import { db, contentItems } from '@/lib/db'
import { desc, eq, and } from 'drizzle-orm'
import type { NewContentItem, ContentItem } from '@/lib/db/schema'

export const runtime = 'nodejs'

type ContentStatus = ContentItem['status']
type ContentType = ContentItem['contentType']

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') as ContentStatus | null
  const type = searchParams.get('type') as ContentType | null
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100)

  const conditions = []
  if (status) conditions.push(eq(contentItems.status, status))
  if (type) conditions.push(eq(contentItems.contentType, type))

  const items = await db
    .select()
    .from(contentItems)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(contentItems.createdAt))
    .limit(limit)

  return Response.json(items)
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<NewContentItem>

  if (!body.title || !body.content || !body.contentType) {
    return Response.json({ error: 'title, content, contentType required' }, { status: 400 })
  }

  const [item] = await db
    .insert(contentItems)
    .values({
      title: body.title,
      content: body.content,
      contentType: body.contentType,
      status: body.status ?? 'pending_review',
      brief: body.brief,
      targetAudience: body.targetAudience,
      brandScore: body.brandScore,
      brandFeedback: body.brandFeedback,
      seoKeywords: body.seoKeywords,
      metaDescription: body.metaDescription,
    })
    .returning()

  return Response.json(item, { status: 201 })
}
