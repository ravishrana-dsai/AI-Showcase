'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Loader2, Sparkles, CheckCircle, Copy, Check, History,
  Pencil, X, Download, ChevronLeft, ChevronRight, Calendar,
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { CostBadge } from '@/components/shared/CostBadge'
import { OutputHistory } from '@/components/shared/OutputHistory'
import type { GenerateResult } from '@/lib/ai'
import { getApiUrl } from '@/lib/api'

// ── Pillar / platform selectors ───────────────────────────────────────────────

const PILLARS = [
  { label: 'Player Rating Education',   prompt: 'Content pillar: Player Rating Education. Explain what Player Rating is, how it works, the 3 pillars (TECH, TACT, PHY), and why it matters.' },
  { label: 'Player Stories',  prompt: 'Content pillar: Player Stories. A real player journey with Player Rating: their starting rating, how they improved, what insights changed their game.' },
  { label: 'Tournament',      prompt: 'Content pillar: Tournament Coverage. Hype post for an upcoming tournament, highlighting Player Rating leaderboards and live tracking.' },
  { label: 'Tips & Technique',prompt: 'Content pillar: Padel/Pickleball Tips. A practical technique tip backed by Player Rating data insights.' },
  { label: 'Data Insights',   prompt: 'Content pillar: Data Insights. Share an interesting stat from [Company] match data (rally patterns, shot distribution, movement heatmaps).' },
  { label: 'Community',       prompt: 'Content pillar: Community & Culture. Celebrate the padel/pickleball community, highlight player milestones, or share a culture moment.' },
  { label: 'Court Spotlights',prompt: 'Content pillar: Court Partner Spotlight. Feature a partner court and what [Company] brings to their players.' },
]

const PLATFORMS = [
  { label: 'Instagram',    prompt: 'Format for Instagram: 150-220 char caption, hook first line, 5 hashtags.' },
  { label: 'LinkedIn',     prompt: 'Format for LinkedIn: 200-350 chars, professional but human, no hashtag spam.' },
  { label: 'TikTok/Reels', prompt: 'Format for TikTok/Reels: Script format with Hook (3 sec), Content (20-40 sec), CTA (3 sec).' },
  { label: 'Twitter/X',    prompt: 'Format for Twitter/X: Under 280 chars, sharp, data-led.' },
  { label: 'All Platforms', prompt: 'Format for all platforms: Instagram, LinkedIn, TikTok/Reels, and Twitter/X. Adapt the content for each.' },
]

function QuickSelectors({ onSelect }: { onSelect: (text: string) => void }) {
  const [pillar, setPillar]     = useState<string | null>(null)
  const [platform, setPlatform] = useState<string | null>(null)

  function handleClick(type: 'pillar' | 'platform', item: { label: string; prompt: string }) {
    let np = pillar, npl = platform
    if (type === 'pillar')   { np  = pillar   === item.label ? null : item.label; setPillar(np) }
    else                     { npl = platform === item.label ? null : item.label; setPlatform(npl) }
    const parts = []
    const pi  = PILLARS.find((p) => p.label === (type === 'pillar'   ? np  : pillar))
    const pli = PLATFORMS.find((p) => p.label === (type === 'platform' ? npl : platform))
    if (pi)  parts.push(pi.prompt)
    if (pli) parts.push(pli.prompt)
    onSelect(parts.join('\n\n'))
  }

  return (
    <div className="space-y-3 mb-2">
      <div>
        <span className="text-white/40 text-xs font-semibold uppercase tracking-wider">Content Pillar</span>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {PILLARS.map((p) => (
            <button key={p.label} onClick={() => handleClick('pillar', p)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${pillar === p.label ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:border-white/20'}`}>{p.label}</button>
          ))}
        </div>
      </div>
      <div>
        <span className="text-white/40 text-xs font-semibold uppercase tracking-wider">Platform</span>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {PLATFORMS.map((p) => (
            <button key={p.label} onClick={() => handleClick('platform', p)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${platform === p.label ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:border-white/20'}`}>{p.label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Calendar ──────────────────────────────────────────────────────────────────

interface PastOutput {
  id: string
  inputPrompt: string
  outputContent: string
  createdAt: string
}

function toDateKey(iso: string) {
  return iso.slice(0, 10)
}

function CalendarView() {
  const [outputs, setOutputs]       = useState<PastOutput[]>([])
  const [loading, setLoading]       = useState(true)
  const [month, setMonth]           = useState(new Date())
  const [selected, setSelected]     = useState<string | null>(null)

  useEffect(() => {
    fetch(getApiUrl('/api/agents/social-content?limit=50'))      .then((r) => r.json())
      .then((data) => { setOutputs(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const byDate = outputs.reduce<Record<string, PastOutput[]>>((acc, o) => {
    const key = toDateKey(o.createdAt)
    return { ...acc, [key]: [...(acc[key] ?? []), o] }
  }, {})

  const year  = month.getFullYear()
  const mon   = month.getMonth()
  const first = new Date(year, mon, 1).getDay()
  const days  = new Date(year, mon + 1, 0).getDate()
  const cells = Array.from({ length: first + days }, (_, i) => (i < first ? null : i - first + 1))
  while (cells.length % 7 !== 0) cells.push(null)

  const monthLabel = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const selectedOutputs = selected ? (byDate[selected] ?? []) : []

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => setMonth(new Date(year, mon - 1, 1))} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-white/70 text-sm font-semibold">{monthLabel}</span>
        <button onClick={() => setMonth(new Date(year, mon + 1, 1))} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Grid */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-white/[0.06]">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-2 text-center text-white/30 text-[10px] font-semibold uppercase tracking-wider">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (!day) return <div key={i} className="h-14 border-b border-r border-white/[0.04] last:border-r-0" />
            const key   = `${year}-${String(mon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const count = byDate[key]?.length ?? 0
            const isToday = key === toDateKey(new Date().toISOString())
            const isSel   = key === selected
            return (
              <button
                key={i}
                onClick={() => setSelected(isSel ? null : key)}
                className={`h-14 border-b border-r border-white/[0.04] last:border-r-0 flex flex-col items-center justify-center gap-1 transition-colors ${
                  isSel   ? 'bg-orange-500/10' :
                  count   ? 'hover:bg-white/[0.04]' :
                            'hover:bg-white/[0.02]'
                }`}
              >
                <span className={`text-xs font-medium ${isToday ? 'text-orange-400' : 'text-white/50'}`}>{day}</span>
                {count > 0 && (
                  <div className="flex gap-0.5">
                    {Array.from({ length: Math.min(count, 3) }).map((_, di) => (
                      <div key={di} className="w-1 h-1 rounded-full bg-orange-400" />
                    ))}
                    {count > 3 && <span className="text-[8px] text-orange-400/70">+{count - 3}</span>}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day output */}
      {selected && selectedOutputs.length > 0 && (
        <div className="space-y-3 animate-slide-up">
          <div className="flex items-center justify-between">
            <span className="text-white/50 text-sm font-medium">
              {new Date(selected).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              <span className="text-white/25 ml-2">({selectedOutputs.length} post{selectedOutputs.length > 1 ? 's' : ''})</span>
            </span>
            <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white/60 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          {selectedOutputs.map((o) => (
            <div key={o.id} className="glass rounded-xl p-4 border-white/[0.06]">
              {o.inputPrompt && (
                <p className="text-white/30 text-xs mb-3 pb-3 border-b border-white/[0.06] truncate">{o.inputPrompt}</p>
              )}
              <div className="markdown-output text-sm leading-relaxed">
                <ReactMarkdown>{o.outputContent}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <Loader2 className="w-5 h-5 text-white/30 animate-spin mx-auto" />
        </div>
      )}

      {!loading && Object.keys(byDate).length === 0 && (
        <div className="glass rounded-xl p-8 text-center">
          <Calendar className="w-8 h-8 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 text-sm">No posts generated yet.</p>
          <p className="text-white/25 text-xs mt-1">Switch to Generate to create your first post.</p>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SocialContentPage() {
  const [view, setView]           = useState<'generate' | 'calendar'>('generate')
  const [prefill, setPrefill]     = useState('')
  const [prompt, setPrompt]       = useState('')
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<(GenerateResult & { outputId?: string; saved?: boolean }) | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [copied, setCopied]       = useState(false)
  const [approving, setApproving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [historyKey, setHistoryKey]   = useState(0)
  const [editing, setEditing]         = useState(false)
  const [editedContent, setEditedContent] = useState('')

  // Sync prefill into prompt when user picks a quick selector
  useEffect(() => { if (prefill) setPrompt(prefill) }, [prefill])

  async function handleGenerate() {
    if (!prompt.trim()) return
    setLoading(true); setError(null); setResult(null); setEditing(false)
    try {
      const res = await fetch(getApiUrl('/api/agents/social-content'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Generation failed')
      const data = await res.json()
      setResult(data); setEditedContent(data.content); setHistoryKey((k) => k + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove() {
    if (!result) return
    setApproving(true)
    try {
      await fetch(getApiUrl('/api/agents/social-content'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputId: result.outputId }),
      })
      setResult((p) => p ? { ...p, saved: true } : null)
    } finally {
      setApproving(false)
    }
  }

  function handleExport() {
    if (!result?.content) return
    const blob = new Blob([result.content], { type: 'text/markdown' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `social-content-${new Date().toISOString().slice(0, 10)}.md`
    a.click(); URL.revokeObjectURL(url)
  }

  const displayContent = editing ? editedContent : (result?.content ?? '')

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-white/[0.06] gradient-header">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-orange-500/50 text-sm font-mono font-bold">02</span>
              <h1 className="text-white font-bold text-xl tracking-tight">Social Content Studio</h1>
              <StatusBadge status="AUTO" />
            </div>
            <p className="text-white/45 text-sm">30-day content calendar, post generator, platform formatter across 7 content pillars.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-white/10 overflow-hidden">
              <button
                onClick={() => setView('generate')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'generate' ? 'bg-orange-500/20 text-orange-400' : 'text-white/40 hover:text-white/70'}`}
              >
                Generate
              </button>
              <button
                onClick={() => setView('calendar')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${view === 'calendar' ? 'bg-orange-500/20 text-orange-400' : 'text-white/40 hover:text-white/70'}`}
              >
                <Calendar className="w-3 h-3" />Calendar
              </button>
            </div>
            <button onClick={() => setShowHistory(!showHistory)} className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 text-sm font-medium transition-colors">
              <History className="w-4 h-4 mr-1.5" />History
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {view === 'calendar' ? (
          <CalendarView />
        ) : (
          <>
            <div className="space-y-3">
              <label className="text-white/60 text-sm font-medium">Content brief</label>
              <QuickSelectors onSelect={setPrefill} />
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Select a pillar and platform above, or type your own brief."
                className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 min-h-[120px] max-h-[200px] resize-none focus:border-orange-500/40 focus:ring-0 rounded-xl transition-colors"
              />
              <button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
                className="btn-glow inline-flex items-center px-5 py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none"
              >
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="w-4 h-4 mr-2" />Generate</>}
              </button>
            </div>

            {error && <div className="p-4 glass rounded-xl border-red-500/20 text-red-400 text-sm animate-slide-up">{error}</div>}

            {result && (
              <div className="space-y-3 animate-slide-up">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 text-sm font-medium">Output</span>
                    {editing && <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-medium">Editing</span>}
                  </div>
                  <CostBadge model={result.model} inputTokens={result.inputTokens} outputTokens={result.outputTokens} costUsd={result.costUsd} />
                </div>

                {editing ? (
                  <div className="space-y-2">
                    <Textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)} className="bg-white/[0.03] border-orange-500/30 text-white/90 min-h-[300px] resize-y focus:border-orange-500/60 focus:ring-0 rounded-xl transition-colors text-sm leading-relaxed font-mono" />
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setResult((p) => p ? { ...p, content: editedContent } : null); setEditing(false) }} className="btn-glow inline-flex items-center px-4 py-2 rounded-lg text-white text-sm font-medium"><Check className="w-3.5 h-3.5 mr-1.5" />Done editing</button>
                      <button onClick={() => { setEditing(false); setEditedContent(result?.content ?? '') }} className="inline-flex items-center px-3 py-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 text-sm font-medium transition-colors"><X className="w-3.5 h-3.5 mr-1.5" />Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="glass rounded-xl p-5 border-white/[0.06]">
                    <div className="markdown-output text-sm leading-relaxed"><ReactMarkdown>{displayContent}</ReactMarkdown></div>
                  </div>
                )}

                {!editing && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={async () => { await navigator.clipboard.writeText(result.content); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="inline-flex items-center px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.06] text-sm font-medium transition-colors">
                      {copied ? <><Check className="w-3.5 h-3.5 mr-1.5 text-green-400" />Copied</> : <><Copy className="w-3.5 h-3.5 mr-1.5" />Copy</>}
                    </button>
                    <button onClick={handleExport} className="inline-flex items-center px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.06] text-sm font-medium transition-colors">
                      <Download className="w-3.5 h-3.5 mr-1.5" />Export .md
                    </button>
                    {!result.saved && (
                      <button onClick={() => { setEditedContent(result.content); setEditing(true) }} className="inline-flex items-center px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-orange-400 hover:border-orange-500/30 hover:bg-orange-500/5 text-sm font-medium transition-colors">
                        <Pencil className="w-3.5 h-3.5 mr-1.5" />Edit
                      </button>
                    )}
                    <button
                      onClick={handleApprove}
                      disabled={approving || result.saved}
                      className={result.saved
                        ? 'inline-flex items-center px-4 py-2 rounded-lg bg-green-600/80 text-white text-sm font-medium cursor-default'
                        : 'btn-glow inline-flex items-center px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50'}
                    >
                      {result.saved ? <><CheckCircle className="w-3.5 h-3.5 mr-1.5" />Approved</> : approving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Approving...</> : <><CheckCircle className="w-3.5 h-3.5 mr-1.5" />Approve & Save</>}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {showHistory && <div className="animate-slide-up"><OutputHistory agentId="social-content" refreshKey={historyKey} /></div>}
      </div>
    </div>
  )
}
