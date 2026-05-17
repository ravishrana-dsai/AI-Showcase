'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, MessageSquare, FileText, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { IntelligenceItem } from '@/lib/db/schema'

interface FeedCardProps {
  item: IntelligenceItem
  onAction?: (id: string, action: IntelligenceItem['action']) => void
}

function relevanceLabel(score: number | null): { label: string; style: string; bar: string } {
  if (!score) return { label: 'unscored', style: 'text-muted-foreground', bar: 'bg-border' }
  if (score >= 80) return { label: `${score}% match`, style: 'text-[var(--brand)] font-semibold', bar: 'bg-[var(--brand)]' }
  if (score >= 60) return { label: `${score}% match`, style: 'text-[var(--brand-warning)]', bar: 'bg-[var(--brand-warning)]' }
  return { label: `${score}% match`, style: 'text-muted-foreground', bar: 'bg-border' }
}

export function FeedCard({ item, onAction }: FeedCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [generating, setGenerating] = useState(false)

  const score = item.relevanceScore
  const isActioned = item.action != null && item.action !== 'ignored'
  const isHighSignal = (score ?? 0) >= 80
  const isMediumSignal = (score ?? 0) >= 60 && (score ?? 0) < 80
  const rel = relevanceLabel(score)

  async function handleGenerateResponse(type: 'reddit_comment' | 'linkedin_post' | 'blog') {
    setGenerating(true)
    try {
      const res = await fetch('/api/agents/write-and-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: {
            type,
            topic: item.title,
            targetAudience: 'general',
            keyPoints: item.summary ? [item.summary] : [],
          },
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json() as { title: string }
      toast.success('Draft created', { description: `"${data.title}" is in the Queue` })
      onAction?.(item.id, 'inspired_post')
    } catch {
      toast.error('Failed to generate response')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className={cn(
      'relative bg-card border rounded-lg p-4 space-y-3 transition-all duration-200',
      isHighSignal && !isActioned && 'border-[var(--brand-border)] bg-[var(--brand-muted)]',
      isMediumSignal && !isActioned && 'border-border',
      !isHighSignal && !isMediumSignal && 'border-border opacity-75',
      isActioned && 'opacity-40'
    )}>
      {/* Relevance bar — top edge accent */}
      {score != null && !isActioned && (
        <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-lg overflow-hidden">
          <div className={cn('h-full transition-all', rel.bar)} style={{ width: `${score}%` }} />
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
              {item.source === 'reddit' ? `r/${item.subreddit ?? 'reddit'}` : item.author ?? 'News'}
            </Badge>
            {score != null && (
              <span className={cn('text-[10px]', rel.style)}>
                {rel.label}
              </span>
            )}
            {item.source === 'reddit' && item.upvotes != null && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-2.5 h-2.5" />
                {item.upvotes}
              </span>
            )}
          </div>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'text-sm font-medium line-clamp-2 transition-colors hover:text-[var(--brand)]',
              isHighSignal && !isActioned ? 'text-foreground' : 'text-foreground/80'
            )}
          >
            {item.title}
          </a>
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {item.summary && (
        <p className="text-xs text-muted-foreground leading-relaxed">{item.summary}</p>
      )}

      {item.body && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Less' : 'More detail'}
          </button>
          {expanded && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed border-t border-border pt-2">
              {item.body.substring(0, 400)}
              {item.body.length > 400 && '...'}
            </p>
          )}
        </div>
      )}

      {!isActioned && (
        <div className="flex items-center gap-2 pt-1 border-t border-border flex-wrap">
          <Button
            variant="ghost" size="sm"
            className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => handleGenerateResponse('reddit_comment')}
            disabled={generating}
          >
            <MessageSquare className="w-3 h-3" />
            Write reply
          </Button>
          <Button
            variant="ghost" size="sm"
            className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => handleGenerateResponse('linkedin_post')}
            disabled={generating}
          >
            <FileText className="w-3 h-3" />
            LinkedIn post
          </Button>
          <Button
            variant="ghost" size="sm"
            className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => handleGenerateResponse('blog')}
            disabled={generating}
          >
            <FileText className="w-3 h-3" />
            Blog post
          </Button>
          {generating && <span className="text-[10px] text-muted-foreground ml-auto">Generating...</span>}
        </div>
      )}

      {isActioned && (
        <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">
          {item.action === 'inspired_post' ? 'Draft created' : item.action === 'responded' ? 'Responded' : 'Ignored'}
        </p>
      )}
    </div>
  )
}
