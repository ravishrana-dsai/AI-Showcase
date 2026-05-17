import { XMLParser } from 'fast-xml-parser'

export interface NewsItem {
  title: string
  url: string
  description: string
  source: string
  publishedAt: Date
}

const RSS_FEEDS = [
  { url: 'https://news.google.com/rss/search?q=padel+sport&hl=en&gl=US&ceid=US:en', label: 'Google News: Padel' },
  { url: 'https://news.google.com/rss/search?q=pickleball&hl=en&gl=US&ceid=US:en', label: 'Google News: Pickleball' },
  { url: 'https://news.google.com/rss/search?q=sports+AI+analytics&hl=en&gl=US&ceid=US:en', label: 'Google News: Sports AI' },
  { url: 'https://news.google.com/rss/search?q=padel+rating+skill&hl=en&gl=US&ceid=US:en', label: 'Google News: Padel Rating' },
]

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })

async function fetchRssFeed(feedUrl: string, label: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(feedUrl, {
      headers: { 'User-Agent': '[Company]BrandHub/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []

    const xml = await res.text()
    const data = parser.parse(xml) as Record<string, unknown>

    const channel = (data?.rss as Record<string, unknown>)?.channel as Record<string, unknown>
    if (!channel) return []

    const items = Array.isArray(channel.item) ? channel.item : [channel.item].filter(Boolean)

    return items.slice(0, 10).map((item: Record<string, unknown>) => ({
      title: String(item.title ?? '').replace(/<[^>]+>/g, ''),
      url: String(item.link ?? item.guid ?? ''),
      description: String(item.description ?? '').replace(/<[^>]+>/g, '').substring(0, 300),
      source: label,
      publishedAt: item.pubDate ? new Date(String(item.pubDate)) : new Date(),
    }))
  } catch {
    return []
  }
}

export async function fetchAllNewsFeeds(customFeeds: string[] = []): Promise<NewsItem[]> {
  const allFeeds = [
    ...RSS_FEEDS,
    ...customFeeds.map((url) => ({ url, label: 'Custom RSS' })),
  ]

  const results = await Promise.allSettled(
    allFeeds.map((f) => fetchRssFeed(f.url, f.label))
  )

  return results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
}
