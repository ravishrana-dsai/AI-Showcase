import { NextRequest } from 'next/server'
import { fetchAllNewsFeeds } from '@/lib/intelligence/news'
import { scoreAndSummariseItem } from '@/lib/agents/researcher'
import { db } from '@/lib/db'
import { intelligenceItems, monitoredSources } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET() {
  const items = await fetchAllNewsFeeds()
  return Response.json(items)
}

export async function POST(req: NextRequest) {
  const { action } = await req.json() as { action: 'refresh' }

  if (action !== 'refresh') {
    return Response.json({ error: 'Unknown action' }, { status: 400 })
  }

  const rssSources = await db
    .select()
    .from(monitoredSources)
    .where(and(
      eq(monitoredSources.active, true),
    ))

  const customFeeds = rssSources
    .filter((s) => s.type === 'rss')
    .map((s) => s.value)

  const newsItems = await fetchAllNewsFeeds(customFeeds)
  const newItems: typeof intelligenceItems.$inferInsert[] = []

  for (const item of newsItems.slice(0, 20)) {
    const scored = await scoreAndSummariseItem({
      title: item.title,
      url: item.url,
      body: item.description,
      source: 'news',
    })

    if (scored.relevanceScore >= 40) {
      newItems.push({
        source: 'news',
        title: item.title,
        url: item.url,
        summary: scored.summary,
        body: item.description,
        relevanceScore: scored.relevanceScore,
        subreddit: null,
        author: item.source,
        publishedAt: item.publishedAt,
      })
    }
  }

  if (newItems.length > 0) {
    await db.insert(intelligenceItems).values(newItems).onConflictDoNothing()
  }

  return Response.json({ processed: newItems.length })
}
