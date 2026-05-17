export interface RedditPost {
  id: string
  title: string
  url: string
  selftext: string
  author: string
  score: number
  numComments: number
  subreddit: string
  permalink: string
  createdUtc: number
}

const REDDIT_USER_AGENT = '[Company]BrandHub/1.0 (brand intelligence tool)'
const RATE_LIMIT_MS = 1100

let lastRequestAt = 0

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now()
  const wait = RATE_LIMIT_MS - (now - lastRequestAt)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastRequestAt = Date.now()

  return fetch(url, {
    headers: {
      'User-Agent': REDDIT_USER_AGENT,
      Accept: 'application/json',
    },
  })
}

function parsePost(child: Record<string, unknown>): RedditPost | null {
  const data = child.data as Record<string, unknown>
  if (!data || data.stickied) return null
  return {
    id: String(data.id ?? ''),
    title: String(data.title ?? ''),
    url: String(data.url ?? ''),
    selftext: String(data.selftext ?? '').substring(0, 2000),
    author: String(data.author ?? ''),
    score: Number(data.score ?? 0),
    numComments: Number(data.num_comments ?? 0),
    subreddit: String(data.subreddit ?? ''),
    permalink: `https://www.reddit.com${String(data.permalink ?? '')}`,
    createdUtc: Number(data.created_utc ?? 0),
  }
}

export async function fetchSubredditPosts(subreddit: string, limit = 25): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`
  const res = await rateLimitedFetch(url)
  if (!res.ok) return []

  const json = await res.json() as { data?: { children?: Array<{ data: unknown }> } }
  return (json.data?.children ?? [])
    .map((c) => parsePost(c as Record<string, unknown>))
    .filter((p): p is RedditPost => p !== null)
}

export async function searchReddit(query: string, subreddit?: string, limit = 25): Promise<RedditPost[]> {
  const base = subreddit
    ? `https://www.reddit.com/r/${subreddit}/search.json`
    : 'https://www.reddit.com/search.json'
  const url = `${base}?q=${encodeURIComponent(query)}&sort=relevance&t=week&limit=${limit}${subreddit ? '&restrict_sr=true' : ''}`

  const res = await rateLimitedFetch(url)
  if (!res.ok) return []

  const json = await res.json() as { data?: { children?: Array<{ data: unknown }> } }
  return (json.data?.children ?? [])
    .map((c) => parsePost(c as Record<string, unknown>))
    .filter((p): p is RedditPost => p !== null)
}
