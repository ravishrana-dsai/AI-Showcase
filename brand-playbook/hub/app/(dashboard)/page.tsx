import { db, contentItems, intelligenceItems } from '@/lib/db'
import { eq, desc, count } from 'drizzle-orm'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { ArrowRight, Sparkles, Rss, ClipboardCheck, TrendingUp } from 'lucide-react'

async function getStats() {
  try {
    const [queueCount, publishedCount, intelligenceCount, recentContent, topIntelligence] = await Promise.all([
      db.select({ count: count() }).from(contentItems).where(eq(contentItems.status, 'pending_review')),
      db.select({ count: count() }).from(contentItems).where(eq(contentItems.status, 'published')),
      db.select({ count: count() }).from(intelligenceItems),
      db.select().from(contentItems).orderBy(desc(contentItems.createdAt)).limit(6),
      db.select().from(intelligenceItems).orderBy(desc(intelligenceItems.relevanceScore)).limit(3),
    ])
    return {
      queue: queueCount[0]?.count ?? 0,
      published: publishedCount[0]?.count ?? 0,
      intelligence: intelligenceCount[0]?.count ?? 0,
      recent: recentContent,
      topSignals: topIntelligence,
    }
  } catch {
    return { queue: 0, published: 0, intelligence: 0, recent: [], topSignals: [] }
  }
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  blog: 'Blog',
  linkedin_post: 'LinkedIn',
  linkedin_article: 'Article',
  reddit_post: 'Reddit',
  reddit_comment: 'Reddit reply',
  newsletter: 'Newsletter',
  press_release: 'Press release',
}

export default async function DashboardPage() {
  const stats = await getStats()

  return (
    <div>
      <Header
        title="Command Centre"
        description="[Company] Brand Hub"
      />

      <div className="p-8 space-y-10">
        {/* Status strip — compact, not hero metrics */}
        <div className="flex items-center gap-8 pb-8 border-b border-border">
          <Link href="/queue" className="group flex items-baseline gap-3 hover:opacity-80 transition-opacity">
            <span className="text-4xl font-bold tabular-nums text-[var(--brand)]" style={{ fontFamily: 'var(--font-display)' }}>{stats.queue}</span>
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">pending review</span>
          </Link>
          <div className="w-px h-8 bg-border" />
          <Link href="/queue?status=published" className="group flex items-baseline gap-3 hover:opacity-80 transition-opacity">
            <span className="text-4xl font-bold tabular-nums text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{stats.published}</span>
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">published</span>
          </Link>
          <div className="w-px h-8 bg-border" />
          <Link href="/intelligence" className="group flex items-baseline gap-3 hover:opacity-80 transition-opacity">
            <span className="text-4xl font-bold tabular-nums text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{stats.intelligence}</span>
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">signals tracked</span>
          </Link>

          <div className="ml-auto">
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-medium">Brand Bible active</p>
            <p className="text-xs text-foreground mt-0.5">All agents briefed on [Company] voice</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-8">
          {/* Recent content — editorial list */}
          <div className="col-span-2 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recent content</h2>
              <Link href="/queue">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1 h-7 hover:text-foreground">
                  All <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>

            {stats.recent.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-border rounded-lg">
                <Sparkles className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">Nothing written yet</p>
                <p className="text-xs text-muted-foreground mb-4">Head to the Studio. Brief the agents. Content streams in real time.</p>
                <Link href="/studio">
                  <Button size="sm" className="bg-[var(--brand)] text-[var(--brand-foreground)] hover:opacity-90 gap-2 font-semibold">
                    <Sparkles className="w-3.5 h-3.5" />
                    Open Studio
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-0 divide-y divide-border">
                {stats.recent.map((item) => (
                  <Link key={item.id} href="/queue" className="flex items-center gap-4 py-3.5 hover:bg-secondary/40 -mx-3 px-3 rounded-md transition-colors group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-[var(--brand)] transition-colors">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {CONTENT_TYPE_LABELS[item.contentType] ?? item.contentType}
                        <span className="mx-1.5 text-border">·</span>
                        {new Date(item.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Right column: actions + top signals */}
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Actions</h2>
              <Link href="/studio" className="flex items-center gap-3 bg-[var(--brand-muted)] border border-[var(--brand-border)] rounded-lg px-4 py-3 hover:opacity-90 transition-opacity group">
                <Sparkles className="w-4 h-4 text-[var(--brand)] shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Write content</p>
                  <p className="text-xs text-muted-foreground">Blog, LinkedIn, Reddit, more</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto group-hover:text-[var(--brand)] transition-colors" />
              </Link>
              <Link href="/intelligence" className="flex items-center gap-3 bg-secondary rounded-lg px-4 py-3 hover:bg-secondary/70 transition-colors group">
                <Rss className="w-4 h-4 text-[var(--brand-info)] shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Intelligence feed</p>
                  <p className="text-xs text-muted-foreground">Reddit + news signals</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto group-hover:text-foreground transition-colors" />
              </Link>
              {stats.queue > 0 && (
                <Link href="/queue" className="flex items-center gap-3 bg-secondary rounded-lg px-4 py-3 hover:bg-secondary/70 transition-colors group">
                  <ClipboardCheck className="w-4 h-4 text-[var(--brand-warning)] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Review queue</p>
                    <p className="text-xs text-muted-foreground">{stats.queue} {stats.queue === 1 ? 'item' : 'items'} pending</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto group-hover:text-foreground transition-colors" />
                </Link>
              )}
            </div>

            {stats.topSignals.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Top signals</h2>
                <div className="space-y-2">
                  {stats.topSignals.map((signal) => (
                    <a key={signal.id} href={signal.url} target="_blank" rel="noopener noreferrer" className="block bg-secondary rounded-lg px-3 py-2.5 hover:bg-secondary/70 transition-colors group">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-3 h-3 text-[var(--brand)] shrink-0" />
                        <span className="text-[10px] font-semibold text-[var(--brand)]">{signal.relevanceScore}%</span>
                        <span className="text-[10px] text-muted-foreground truncate">{signal.source === 'reddit' ? `r/${signal.subreddit}` : 'News'}</span>
                      </div>
                      <p className="text-xs text-foreground line-clamp-2 group-hover:text-[var(--brand)] transition-colors">{signal.title}</p>
                    </a>
                  ))}
                </div>
                <Link href="/intelligence">
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1 h-7 w-full hover:text-foreground">
                    Full feed <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
