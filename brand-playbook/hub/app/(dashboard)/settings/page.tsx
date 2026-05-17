'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { MonitoredSource } from '@/lib/db/schema'

export default function SettingsPage() {
  const [sources, setSources] = useState<MonitoredSource[]>([])
  const [loading, setLoading] = useState(true)
  const [newType, setNewType] = useState<'subreddit' | 'rss' | 'news_keyword'>('subreddit')
  const [newValue, setNewValue] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding] = useState(false)

  const loadSources = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sources')
      const data = await res.json() as MonitoredSource[]
      setSources(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Failed to load sources')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSources() }, [loadSources])

  async function handleToggle(id: string, active: boolean) {
    await fetch('/api/sources', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active }),
    })
    setSources((prev) => prev.map((s) => s.id === id ? { ...s, active } : s))
  }

  async function handleDelete(id: string) {
    await fetch('/api/sources', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setSources((prev) => prev.filter((s) => s.id !== id))
    toast.success('Source removed')
  }

  async function handleAdd() {
    if (!newValue.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: newType, value: newValue.trim(), label: newLabel.trim() || newValue.trim() }),
      })
      const source = await res.json() as MonitoredSource
      setSources((prev) => [...prev, source])
      setNewValue('')
      setNewLabel('')
      toast.success('Source added')
    } catch {
      toast.error('Failed to add source')
    } finally {
      setAdding(false)
    }
  }

  const subreddits = sources.filter((s) => s.type === 'subreddit')
  const rssSources = sources.filter((s) => s.type === 'rss')
  const keywords = sources.filter((s) => s.type === 'news_keyword')

  function SourceGroup({ title, items }: { title: string; items: MonitoredSource[] }) {
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">None configured.</p>
        ) : (
          <div className="space-y-1.5">
            {items.map((source) => (
              <div key={source.id} className="flex items-center gap-3 bg-secondary rounded-lg px-3 py-2.5">
                <Switch
                  checked={source.active}
                  onCheckedChange={(v) => handleToggle(source.id, v)}
                  className="data-[state=checked]:bg-[var(--brand)]"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{source.label ?? source.value}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{source.value}</p>
                </div>
                {source.lastFetchedAt && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(source.lastFetchedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-7 h-7 p-0 text-muted-foreground hover:text-red-400 shrink-0"
                  onClick={() => handleDelete(source.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <Header title="Settings" description="Configure monitored sources, integrations, and preferences." />

      <div className="p-6 max-w-2xl space-y-8">
        <section className="bg-card border border-border rounded-lg p-5 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Intelligence Sources</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Subreddits, RSS feeds, and keywords to monitor. These power the Intelligence Feed.
            </p>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 bg-secondary rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-5">
              <SourceGroup title="Subreddits" items={subreddits} />
              <SourceGroup title="RSS Feeds" items={rssSources} />
              <SourceGroup title="News Keywords" items={keywords} />
            </div>
          )}

          <div className="pt-3 border-t border-border space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Add source</h3>
            <div className="grid grid-cols-3 gap-2">
              <Select value={newType} onValueChange={(v) => setNewType(v as typeof newType)}>
                <SelectTrigger className="bg-secondary border-border text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="subreddit">Subreddit</SelectItem>
                  <SelectItem value="rss">RSS Feed</SelectItem>
                  <SelectItem value="news_keyword">News Keyword</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder={newType === 'subreddit' ? 'padel' : newType === 'rss' ? 'https://...' : 'padel AI'}
                className="bg-secondary border-border text-sm h-9"
              />
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Label (optional)"
                className="bg-secondary border-border text-sm h-9"
              />
            </div>
            <Button size="sm" onClick={handleAdd} disabled={adding || !newValue.trim()} className="gap-2 bg-[var(--brand)] text-[var(--brand-foreground)] hover:opacity-90">
              <Plus className="w-3.5 h-3.5" />
              Add source
            </Button>
          </div>
        </section>

        <section className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Publishing Integrations</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Manual copy/paste publishing is available now. OAuth integrations coming in the next phase.
            </p>
          </div>
          <div className="space-y-2.5">
            {['LinkedIn', 'Blog / CMS', 'Reddit', 'Newsletter / Email'].map((platform) => (
              <div key={platform} className="flex items-center justify-between bg-secondary rounded-lg px-3 py-2.5">
                <span className="text-sm text-foreground">{platform}</span>
                <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
                  Copy/paste
                </Badge>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-card border border-border rounded-lg p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">AI Configuration</h2>
            <p className="text-xs text-muted-foreground mt-1">Primary: Claude claude-sonnet-4-6. Fallback: Gemini 2.0 Flash.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-secondary rounded-lg p-3">
              <p className="text-muted-foreground">Primary model</p>
              <p className="text-foreground font-medium mt-1">claude-sonnet-4-6</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Brand Bible prompt-cached</p>
            </div>
            <div className="bg-secondary rounded-lg p-3">
              <p className="text-muted-foreground">Fallback model</p>
              <p className="text-foreground font-medium mt-1">Gemini 2.0 Flash</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Auto-switches on error</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
