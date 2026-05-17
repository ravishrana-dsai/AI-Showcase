'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { StatusBadge } from '@/components/shared/status-badge'
import { CopyButton } from '@/components/shared/copy-button'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Check, X, Eye, CalendarPlus, ExternalLink, Pencil, ClipboardCheck } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ContentItem } from '@/lib/db/schema'

const CONTENT_TYPE_LABELS: Record<string, string> = {
  blog: 'Blog',
  linkedin_post: 'LinkedIn Post',
  linkedin_article: 'LinkedIn Article',
  reddit_post: 'Reddit Post',
  reddit_comment: 'Reddit Comment',
  newsletter: 'Newsletter',
  press_release: 'Press Release',
}

const FILTERS = ['pending_review', 'approved', 'scheduled', 'published', 'rejected', 'draft'] as const

export default function QueuePage() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<ContentItem | null>(null)
  const [filter, setFilter] = useState<string>('pending_review')
  // Schedule modal state
  const [scheduling, setScheduling] = useState<ContentItem | null>(null)
  const [schedPlatform, setSchedPlatform] = useState('linkedin')
  const [schedDate, setSchedDate] = useState('')
  const [savingSched, setSavingSched] = useState(false)
  // Inline edit state
  const [editingContent, setEditingContent] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/content?status=${filter}&limit=50`)
      const data = await res.json() as ContentItem[]
      setItems(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Failed to load queue')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  async function updateStatus(id: string, status: ContentItem['status']) {
    try {
      await fetch(`/api/content/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      toast.success(`Content ${status.replace('_', ' ')}`)
      setItems((prev) => prev.filter((i) => i.id !== id))
      if (preview?.id === id) setPreview(null)
    } catch {
      toast.error('Update failed')
    }
  }

  async function handleSchedule() {
    if (!scheduling || !schedDate) return
    setSavingSched(true)
    try {
      await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: scheduling.id,
          platform: schedPlatform,
          scheduledAt: new Date(schedDate).toISOString(),
        }),
      })
      toast.success('Scheduled', { description: `Added to the ${schedPlatform} calendar` })
      await updateStatus(scheduling.id, 'scheduled')
      setScheduling(null)
    } catch {
      toast.error('Scheduling failed')
    } finally {
      setSavingSched(false)
    }
  }

  function openSchedule(item: ContentItem) {
    setScheduling(item)
    // Default to 9am tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    setSchedDate(tomorrow.toISOString().slice(0, 16))
    setSchedPlatform('linkedin')
  }

  async function saveEdit(id: string) {
    if (editingContent === null) return
    setSavingEdit(true)
    try {
      await fetch(`/api/content/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingContent }),
      })
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, content: editingContent } : i))
      if (preview?.id === id) setPreview((p) => p ? { ...p, content: editingContent } : p)
      toast.success('Edits saved')
      setEditingContent(null)
    } catch {
      toast.error('Save failed')
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <TooltipProvider>
      <div>
        <Header
          title="Approval Queue"
          description="Review AI-generated content. Approve, schedule, or reject."
        />

        <div className="p-6 space-y-4">
          <div className="flex gap-1.5 flex-wrap">
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

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 bg-card border border-border rounded-lg animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border rounded-lg">
              <ClipboardCheck className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              {filter === 'pending_review' ? (
                <>
                  <p className="text-sm font-medium text-foreground mb-1">Queue is clear</p>
                  <p className="text-xs text-muted-foreground">All caught up. Head to the Studio to generate more content, or check the Intelligence feed for new signals.</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No {filter.replace('_', ' ')} content yet.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <StatusBadge status={item.status} />
                      <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                        {CONTENT_TYPE_LABELS[item.contentType] ?? item.contentType}
                      </Badge>
                      {item.brandScore != null && (
                        <span className={cn('text-[10px] font-semibold', item.brandScore >= 80 ? 'text-[var(--brand)]' : item.brandScore >= 60 ? 'text-[var(--brand-warning)]' : 'text-[var(--brand-danger)]')}>
                          Brand: {item.brandScore}/100
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(item.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setPreview(item); setEditingContent(null) }}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Preview</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span><CopyButton text={item.content} label="" className="h-7 w-7 p-0" /></span>
                      </TooltipTrigger>
                      <TooltipContent>Copy content</TooltipContent>
                    </Tooltip>

                    {filter === 'pending_review' && (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 w-7 p-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40"
                              onClick={() => updateStatus(item.id, 'approved')}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Approve</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/40"
                              onClick={() => updateStatus(item.id, 'rejected')}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Reject</TooltipContent>
                        </Tooltip>
                      </>
                    )}

                    {filter === 'approved' && (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 w-7 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-950/40"
                              onClick={() => openSchedule(item)}
                            >
                              <CalendarPlus className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Schedule</TooltipContent>
                        </Tooltip>

                        <Button
                          variant="ghost" size="sm"
                          className="h-7 gap-1.5 text-xs text-blue-400 hover:text-blue-300"
                          onClick={() => updateStatus(item.id, 'published')}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Mark published
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview / edit dialog */}
        <Dialog open={!!preview} onOpenChange={() => { setPreview(null); setEditingContent(null) }}>
          <DialogContent className="max-w-2xl bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">{preview?.title}</DialogTitle>
            </DialogHeader>

            {editingContent !== null ? (
              <textarea
                className="w-full h-96 bg-secondary border border-border rounded-lg p-3 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-[var(--brand)] font-mono"
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
              />
            ) : (
              <ScrollArea className="max-h-[60vh]">
                <div className="prose prose-invert prose-sm max-w-none pr-4
                  prose-headings:text-foreground prose-p:text-foreground/90
                  prose-strong:text-foreground prose-ul:text-foreground/90
                  prose-li:text-foreground/90 prose-code:text-[var(--brand)]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{preview?.content ?? ''}</ReactMarkdown>
                </div>
              </ScrollArea>
            )}

            {preview && (
              <div className="flex gap-2 pt-2 flex-wrap">
                <CopyButton text={editingContent ?? preview.content} label="Copy" />

                {editingContent !== null ? (
                  <>
                    <Button size="sm" onClick={() => saveEdit(preview.id)} disabled={savingEdit} className="bg-[var(--brand)] text-[var(--brand-foreground)] gap-2">
                      {savingEdit ? 'Saving...' : 'Save edits'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditingContent(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditingContent(preview.content)}>
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </Button>
                )}

                {preview.status === 'pending_review' && editingContent === null && (
                  <>
                    <Button size="sm" className="bg-[var(--brand)] text-[var(--brand-foreground)] gap-2" onClick={() => updateStatus(preview.id, 'approved')}>
                      <Check className="w-3.5 h-3.5" />
                      Approve
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2 text-red-400 border-red-800 hover:bg-red-950/40" onClick={() => updateStatus(preview.id, 'rejected')}>
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </Button>
                  </>
                )}

                {preview.status === 'approved' && editingContent === null && (
                  <Button variant="outline" size="sm" className="gap-2 text-blue-400 border-blue-800" onClick={() => openSchedule(preview)}>
                    <CalendarPlus className="w-3.5 h-3.5" />
                    Schedule
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Schedule modal */}
        <Dialog open={!!scheduling} onOpenChange={() => setScheduling(null)}>
          <DialogContent className="max-w-sm bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Schedule content</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground -mt-1 truncate">{scheduling?.title}</p>
            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Platform</label>
                <Select value={schedPlatform} onValueChange={setSchedPlatform}>
                  <SelectTrigger className="bg-secondary border-border h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="blog">Blog</SelectItem>
                    <SelectItem value="reddit">Reddit</SelectItem>
                    <SelectItem value="newsletter">Newsletter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Date and time</label>
                <input
                  type="datetime-local"
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                  className="w-full h-9 bg-secondary border border-border rounded-md px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--brand)] [color-scheme:dark]"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                onClick={handleSchedule}
                disabled={savingSched || !schedDate}
                className="bg-[var(--brand)] text-[var(--brand-foreground)] font-semibold hover:opacity-90 gap-2"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                {savingSched ? 'Scheduling...' : 'Schedule'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setScheduling(null)}>Cancel</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
