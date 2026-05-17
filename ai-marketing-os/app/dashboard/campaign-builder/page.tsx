'use client'

import { useState } from 'react'
import { Loader2, Sparkles, History } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { OutputPanel } from '@/components/shared/OutputPanel'
import { OutputHistory } from '@/components/shared/OutputHistory'
import type { GenerateResult } from '@/lib/ai'
import { getApiUrl } from '@/lib/api'

const GOALS = ['Awareness', 'Sign-ups', 'Activation', 'Retention', 'Tournament registrations']
const AUDIENCES = ['All players', 'Active players', 'Tournament players', 'New players', 'Lapsed players', 'Court partners']
const SPORTS = ['Padel', 'Pickleball', 'Both']

export default function CampaignBuilderPage() {
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [audience, setAudience] = useState('')
  const [sport, setSport] = useState('')
  const [budget, setBudget] = useState('')
  const [timeline, setTimeline] = useState('')
  const [keyMessage, setKeyMessage] = useState('')
  const [extra, setExtra] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<(GenerateResult & { outputId?: string; saved?: boolean }) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [historyKey, setHistoryKey] = useState(0)

  function buildPrompt(): string {
    const parts = []
    if (name) parts.push(`Campaign name: ${name}`)
    if (goal) parts.push(`Goal: ${goal}`)
    if (audience) parts.push(`Target audience: ${audience}`)
    if (sport) parts.push(`Sport: ${sport}`)
    if (budget) parts.push(`Budget: ${budget}`)
    if (timeline) parts.push(`Timeline: ${timeline}`)
    if (keyMessage) parts.push(`Key message: ${keyMessage}`)
    if (extra) parts.push(`Additional context: ${extra}`)
    return parts.join('\n')
  }

  async function handleGenerate() {
    const prompt = buildPrompt()
    if (!prompt.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(getApiUrl('/api/agents/campaign-builder'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Generation failed')
      setResult(await res.json())
      setHistoryKey((k) => k + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const isValid = goal || keyMessage || name

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-white/[0.06] gradient-header">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-orange-500/50 text-sm font-mono font-bold">03</span>
              <h1 className="text-white font-bold text-xl tracking-tight">Campaign Builder</h1>
              <StatusBadge status="AUTO" />
            </div>
            <p className="text-white/45 text-sm">Full campaign kits: copy, sequences, ad variants, KPIs. One input, one launch plan.</p>
          </div>
          <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-1.5 text-white/30 hover:text-white/70 text-sm transition-colors">
            <History className="w-4 h-4" /> History
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-white/60 text-sm">Campaign Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Player Rating Launch London" className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/60 text-sm">Goal</Label>
            <div className="flex flex-wrap gap-1.5">
              {GOALS.map((g) => (
                <button key={g} onClick={() => setGoal(goal === g ? '' : g)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${goal === g ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:border-white/20'}`}>{g}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/60 text-sm">Target Audience</Label>
            <div className="flex flex-wrap gap-1.5">
              {AUDIENCES.map((a) => (
                <button key={a} onClick={() => setAudience(audience === a ? '' : a)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${audience === a ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:border-white/20'}`}>{a}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/60 text-sm">Sport</Label>
            <div className="flex gap-1.5">
              {SPORTS.map((s) => (
                <button key={s} onClick={() => setSport(sport === s ? '' : s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${sport === s ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:border-white/20'}`}>{s}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/60 text-sm">Budget</Label>
            <Input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. Organic + $500 paid social" className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/60 text-sm">Timeline</Label>
            <Input value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="e.g. 2 weeks, launching April 15" className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 rounded-lg" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-white/60 text-sm">Key Message</Label>
          <Textarea value={keyMessage} onChange={(e) => setKeyMessage(e.target.value)} placeholder="What is the main message or angle for this campaign?" className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 min-h-[80px] resize-none rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-white/60 text-sm">Additional Context</Label>
          <Textarea value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Any other details: recent wins, seasonal angle, partner involvement..." className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 min-h-[60px] resize-none rounded-xl" />
        </div>

        <button onClick={handleGenerate} disabled={loading || !isValid} className="btn-glow inline-flex items-center px-5 py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none">
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="w-4 h-4 mr-2" />Build Campaign</>}
        </button>

        {error && <div className="p-4 glass rounded-xl border-red-500/20 text-red-400 text-sm animate-slide-up">{error}</div>}

        {result && (
          <OutputPanel
            result={result}
            agentId="campaign-builder"
            label="Campaign Kit"
            onUpdate={setResult}
          />
        )}

        {showHistory && <div className="animate-slide-up"><OutputHistory agentId="campaign-builder" refreshKey={historyKey} /></div>}
      </div>
    </div>
  )
}
