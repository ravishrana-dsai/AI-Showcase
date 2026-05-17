import { db, monitoredSources } from './index'

const defaultSources = [
  { type: 'subreddit' as const, value: 'padel', label: 'r/padel' },
  { type: 'subreddit' as const, value: 'pickleball', label: 'r/pickleball' },
  { type: 'subreddit' as const, value: 'tennis', label: 'r/tennis' },
  { type: 'subreddit' as const, value: 'sportsanalytics', label: 'r/sportsanalytics' },
  { type: 'subreddit' as const, value: 'MachineLearning', label: 'r/MachineLearning' },
  { type: 'news_keyword' as const, value: 'padel AI analytics', label: 'Padel AI' },
  { type: 'news_keyword' as const, value: 'pickleball technology', label: 'Pickleball Tech' },
  { type: 'news_keyword' as const, value: 'sports performance AI', label: 'Sports AI' },
  { type: 'news_keyword' as const, value: 'padel rating system', label: 'Padel Ratings' },
  { type: 'rss' as const, value: 'https://news.google.com/rss/search?q=padel+sport&hl=en', label: 'Google News: Padel' },
  { type: 'rss' as const, value: 'https://news.google.com/rss/search?q=pickleball&hl=en', label: 'Google News: Pickleball' },
]

async function seed() {
  console.log('Seeding default monitored sources...')
  await db.insert(monitoredSources).values(defaultSources).onConflictDoNothing()
  console.log('Seed complete')
  process.exit(0)
}

seed().catch(console.error)
