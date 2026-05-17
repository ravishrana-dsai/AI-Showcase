'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Sparkles, Wand2 } from 'lucide-react'
import type { ContentBrief, ContentType, TargetAudience } from '@/lib/agents/types'

interface BriefFormProps {
  onSubmit: (brief: ContentBrief | { freeform: string }) => void
  isLoading: boolean
}

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: 'blog', label: 'Blog Post' },
  { value: 'linkedin_post', label: 'LinkedIn Post' },
  { value: 'linkedin_article', label: 'LinkedIn Article' },
  { value: 'reddit_post', label: 'Reddit Post' },
  { value: 'reddit_comment', label: 'Reddit Comment' },
  { value: 'newsletter', label: 'Newsletter Section' },
  { value: 'press_release', label: 'Press Release' },
]

const AUDIENCES: { value: TargetAudience; label: string }[] = [
  { value: 'competitive_player', label: 'Competitive Club Player' },
  { value: 'casual_player', label: 'Casual / Social Player' },
  { value: 'tournament_player', label: 'Tournament Player' },
  { value: 'court_operator', label: 'Court Operator' },
  { value: 'investor', label: 'Investor' },
  { value: 'general', label: 'General Audience' },
]

export function BriefForm({ onSubmit, isLoading }: BriefFormProps) {
  const [mode, setMode] = useState<'freeform' | 'structured'>('freeform')
  const [freeform, setFreeform] = useState('')
  const [type, setType] = useState<ContentType>('linkedin_post')
  const [audience, setAudience] = useState<TargetAudience>('competitive_player')
  const [topic, setTopic] = useState('')
  const [keyPoints, setKeyPoints] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'freeform') {
      onSubmit({ freeform })
    } else {
      onSubmit({
        type,
        topic,
        targetAudience: audience,
        keyPoints: keyPoints.split('\n').filter(Boolean),
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex gap-2 p-1 bg-secondary rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setMode('freeform')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'freeform' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Quick brief
        </button>
        <button
          type="button"
          onClick={() => setMode('structured')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'structured' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Structured
        </button>
      </div>

      {mode === 'freeform' ? (
        <div className="space-y-2">
          <Label htmlFor="freeform">What do you want to write?</Label>
          <Textarea
            id="freeform"
            value={freeform}
            onChange={(e) => setFreeform(e.target.value)}
            placeholder="e.g. Write a LinkedIn post about how Player Rating ratings work and why self-assessed ratings are meaningless for competitive players..."
            className="min-h-[140px] bg-secondary border-border resize-none"
            required
          />
          <p className="text-xs text-muted-foreground">
            The Director Agent will parse your brief, pick the right format and audience, then hand it to the Writer.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Content type</Label>
              <Select value={type} onValueChange={(v) => setType(v as ContentType)}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target audience</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as TargetAudience)}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCES.map((a) => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="topic">Topic</Label>
            <Textarea
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Why padel skill ratings based on self-assessment are fundamentally broken"
              className="min-h-[80px] bg-secondary border-border resize-none"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="keypoints">Key points (one per line, optional)</Label>
            <Textarea
              id="keypoints"
              value={keyPoints}
              onChange={(e) => setKeyPoints(e.target.value)}
              placeholder="Self-assessed ratings are optimistic by 2+ levels on average&#10;Player Rating uses 5M+ data points per match&#10;16x more accurate than generic AI tools"
              className="min-h-[100px] bg-secondary border-border resize-none"
            />
          </div>
        </div>
      )}

      <Button
        type="submit"
        disabled={isLoading || (mode === 'freeform' ? !freeform.trim() : !topic.trim())}
        className="w-full bg-[var(--brand)] text-[var(--brand-foreground)] hover:opacity-90 font-semibold"
      >
        {isLoading ? (
          <>
            <Wand2 className="w-4 h-4 mr-2 animate-spin" />
            Writing...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            Generate content
          </>
        )}
      </Button>
    </form>
  )
}
