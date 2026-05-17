import { NextRequest } from 'next/server'
import { fetchSubredditPosts, searchReddit } from '@/lib/intelligence/reddit'
import { scoreAndSummariseItem } from '@/lib/agents/researcher'
import { db } from '@/lib/db'
import { intelligenceItems, monitoredSources } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const subreddit = searchParams.get('subreddit')
  const query = searchParams.get('q')
  const limit = Math.min(Number(searchParams.get('limit') ?? 10), 25)

  try {
    const posts = query
      ? await searchReddit(query, subreddit ?? undefined, limit)
      : subreddit
        ? await fetchSubredditPosts(subreddit, limit)
        : []

    return Response.json(posts)
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { action } = await req.json() as { action: 'refresh' }

  if (action !== 'refresh') {
    return Response.json({ error: 'Unknown action' }, { status: 400 })
  }

  const sources = await db
    .select()
    .from(monitoredSources)
    .where(and(eq(monitoredSources.type, 'subreddit'), eq(monitoredSources.active, true)))

  const newItems: typeof intelligenceItems.$inferInsert[] = []

  for (const source of sources) {
    const posts = await fetchSubredditPosts(source.value, 10)

    for (const post of posts.slice(0, 5)) {
      const scored = await scoreAndSummariseItem({
        title: post.title,
        url: post.permalink,
        body: post.selftext,
        source: 'reddit',
      })

      if (scored.relevanceScore >= 40) {
        newItems.push({
          source: 'reddit',
          title: post.title,
          url: post.permalink,
          summary: scored.summary,
          body: post.selftext,
          relevanceScore: scored.relevanceScore,
          subreddit: post.subreddit,
          author: post.author,
          upvotes: post.score,
          commentCount: post.numComments,
          publishedAt: new Date(post.createdUtc * 1000),
        })
      }
    }
  }

  if (newItems.length > 0) {
    await db.insert(intelligenceItems).values(newItems).onConflictDoNothing()
  }

  await db
    .update(monitoredSources)
    .set({ lastFetchedAt: new Date() })
    .where(and(eq(monitoredSources.type, 'subreddit'), eq(monitoredSources.active, true)))

  return Response.json({ processed: newItems.length })
}
