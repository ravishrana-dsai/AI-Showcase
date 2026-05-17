'use client'

import { useState, useCallback } from 'react'
import { useCompletion } from '@ai-sdk/react'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { BriefForm } from '@/components/studio/brief-form'
import { StreamingOutput } from '@/components/studio/streaming-output'
import { BrandScoreBadge } from '@/components/studio/brand-score-badge'
import { CopyButton } from '@/components/shared/copy-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, RefreshCw, ShieldCheck } from 'lucide-react'
import type { ContentBrief, BrandCheckResult } from '@/lib/agents/types'

export default function StudioPage() {
  const [title, setTitle] = useState('')
  const [contentType, setContentType] = useState('linkedin_post')
  const [brandCheck, setBrandCheck] = useState<BrandCheckResult | null>(null)
  const [checkingBrand, setCheckingBrand] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastBrief, setLastBrief] = useState<ContentBrief | { freeform: string } | null>(null)

  const { completion, isLoading, complete } = useCompletion({
    api: '/api/agents/write',
    onError: (err: Error) => toast.error(`Write failed: ${err.message}`),
  })

  const handleBriefSubmit = useCallback(async (input: ContentBrief | { freeform: string }) => {
    setBrandCheck(null)
    setLastBrief(input)
    if ('freeform' in input) {
      setContentType('linkedin_post')
      await complete('', { body: { freeform: input.freeform } })
    } else {
      setContentType(input.type)
      await complete('', { body: { brief: input } })
    }
  }, [complete])

  async function handleBrandCheck() {
    if (!completion) return
    setCheckingBrand(true)
    try {
      const res = await fetch('/api/agents/brand-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: completion, contentType }),
      })
      const result = await res.json() as BrandCheckResult
      setBrandCheck(result)
    } catch {
      toast.error('Brand check failed')
    } finally {
      setCheckingBrand(false)
    }
  }

  async function handleSave(status: 'draft' | 'pending_review') {
    if (!completion || !title) {
      toast.error('Add a title before saving')
      return
    }
    setSaving(true)
    try {
      await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content: completion,
          contentType,
          status,
          brandScore: brandCheck?.score,
          brandFeedback: brandCheck?.summary,
        }),
      })
      toast.success(status === 'draft' ? 'Saved as draft' : 'Sent to approval queue')
    } catch {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Header
        title="Content Studio"
        description="Brief the agents. Get on-brand content. Copy, approve, publish."
      />

      <div className="flex gap-6 p-6 min-h-0">
        <div className="w-80 shrink-0 space-y-5">
          <div className="bg-card border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold mb-4 text-foreground">Brief</h2>
            <BriefForm onSubmit={handleBriefSubmit} isLoading={isLoading} />
          </div>

          {brandCheck && (
            <BrandScoreBadge result={brandCheck} />
          )}
        </div>

        <div className="flex-1 space-y-4 min-w-0">
          {(completion || isLoading) && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Label htmlFor="title" className="text-xs text-muted-foreground mb-1.5 block">Title / headline</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Add a title..."
                    className="bg-secondary border-border"
                  />
                </div>
              </div>

              <StreamingOutput content={completion} isStreaming={isLoading} />

              {!isLoading && completion && (
                <div className="flex items-center gap-2 flex-wrap">
                  <CopyButton text={completion} label="Copy content" />

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBrandCheck}
                    disabled={checkingBrand}
                    className="gap-2"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {checkingBrand ? 'Checking...' : 'Brand check'}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => lastBrief && handleBriefSubmit(lastBrief)}
                    disabled={!lastBrief}
                    className="gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Regenerate
                  </Button>

                  <div className="flex-1" />

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSave('draft')}
                    disabled={saving}
                  >
                    Save draft
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => handleSave('pending_review')}
                    disabled={saving}
                    className="bg-[var(--brand)] text-[var(--brand-foreground)] hover:opacity-90 font-semibold gap-2"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Send to queue
                  </Button>
                </div>
              )}
            </>
          )}

          {!completion && !isLoading && (
            <div className="flex flex-col items-center justify-center h-80 border border-dashed border-border rounded-lg text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--brand-muted)] flex items-center justify-center mb-4">
                <span className="text-2xl">✦</span>
              </div>
              <p className="text-sm font-medium text-foreground">Write your brief on the left</p>
              <p className="text-xs text-muted-foreground mt-1">Content will stream here in real time</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
