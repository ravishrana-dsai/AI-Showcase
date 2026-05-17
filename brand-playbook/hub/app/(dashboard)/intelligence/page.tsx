'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { FeedCard } from '@/components/intelligence/feed-card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, RefreshCw, Rss } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { IntelligenceItem } from '@/lib/db/schema'

const FILTERS = ['all', 'reddit', 'news', 'high_relevance'] as const
type Filter = typeof FILTERS[number]

export default function IntelligencePage() {
  const [items, setItems] = useState<IntelligenceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const handleAction = useCallback(async (id: string, action: IntelligenceItem['action']) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, action } : i))
    try {
      await fetch(`/api/intelligence/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
    } catch {
      // non-critical — local state already updated
    }
  }, [])

  const loadIntelligenceItems = useCallback(async () => {
    setLoading(true)
    try {
      const [redditRes, newsRes] = await Promise.all([
        fetch('/api/intelligence/reddit?limit=20'),
        fetch('/api/intelligence/news'),
      ])
      const [reddit, news] = await Promise.all([
        redditRes.json(),
        newsRes.json(),
      ]) as [IntelligenceItem[], IntelligenceItem[]]
      const combined = [...(Array.isArray(reddit) ? reddit : []), ...(Array.isArray(news) ? news : [])]
      setItems(combined as IntelligenceItem[])
    } catch {
      toast.error('Failed to load feed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadIntelligenceItems() }, [loadIntelligenceItems])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await Promise.all([
        fetch('/api/intelligence/reddit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh' }) }),
        fetch('/api/intelligence/news', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh' }) }),
      ])
      toast.success('Feed refreshed')
      await loadIntelligenceItems()
    } catch {
      toast.error('Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  const filtered = items.filter((item) => {
    const i = item as Record<string, unknown>
    const matchesFilter =
      filter === 'all' ||
      (filter === 'reddit' && i.source === 'reddit') ||
      (filter === 'news' && i.source === 'news') ||
      (filter === 'high_relevance' && Number(i.relevanceScore ?? 0) >= 75)
    const matchesSearch = !search || (i.title as string ?? '').toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  return (
    <div>
      <Header
        title="Intelligence Feed"
        description="Reddit threads and news worth engaging with. One click to write a response."
        action={
          <Button size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-2">
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            Refresh all
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search threads..."
              className="pl-9 bg-secondary border-border h-8 text-sm"
            />
          </div>
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                  filter === f
                    ? 'bg-[var(--brand)] text-[var(--brand-foreground)]'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                )}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>
          <Badge variant="outline" className="text-muted-foreground border-border ml-auto">
            {filtered.length} items
          </Badge>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 bg-card border border-border rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg">
            <Rss className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            {filter === 'all' || filter === 'high_relevance' ? (
              <>
                <p className="text-sm font-medium text-foreground mb-1">No signals yet</p>
                <p className="text-xs text-muted-foreground mb-4">Refresh the feed to pull the latest Reddit threads and news across your monitored sources.</p>
                <Button size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-2 bg-[var(--brand)] text-[var(--brand-foreground)] hover:opacity-90">
                  <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
                  Refresh now
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground mb-1">No {filter} items</p>
                <p className="text-xs text-muted-foreground">Try a different filter or refresh the feed.</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((item) => (
              <FeedCard
                key={(item as Record<string, unknown>).id as string ?? item.url}
                item={item}
                onAction={handleAction}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
