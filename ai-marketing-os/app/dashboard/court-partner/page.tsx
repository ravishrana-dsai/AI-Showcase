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

const SPORTS = ['Padel', 'Pickleball', 'Both']
const STATUSES = ['Prospect', 'In conversation', 'Active', 'Partner']

export default function CourtPartnerPage() {
  const [courtName, setCourtName] = useState('')
  const [location, setLocation] = useState('')
  const [courts, setCourts] = useState('')
  const [sport, setSport] = useState('')
  const [weeklyPlayers, setWeeklyPlayers] = useState('')
  const [currentTech, setCurrentTech] = useState('')
  const [relStatus, setRelStatus] = useState('')
  const [extra, setExtra] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<(GenerateResult & { outputId?: string; saved?: boolean }) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [historyKey, setHistoryKey] = useState(0)

  function buildPrompt(): string {
    const parts = []
    if (courtName) parts.push(`Court name: ${courtName}`)
    if (location) parts.push(`Location: ${location}`)
    if (courts) parts.push(`Number of courts: ${courts}`)
    if (sport) parts.push(`Sport: ${sport}`)
    if (weeklyPlayers) parts.push(`Estimated weekly players: ${weeklyPlayers}`)
    if (currentTech) parts.push(`Current tech platform: ${currentTech}`)
    if (relStatus) parts.push(`Relationship status: ${relStatus}`)
    if (extra) parts.push(`Additional context: ${extra}`)
    parts.push('\nGenerate a full partner package: intel brief, pitch deck content, outreach message, co-brand content, and onboarding sequence.')
    return parts.join('\n')
  }

  async function handleGenerate() {
    if (!courtName.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(getApiUrl('/api/agents/court-partner'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: buildPrompt() }),
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

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-white/[0.06] gradient-header">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-orange-500/50 text-sm font-mono font-bold">09</span>
              <h1 className="text-white font-bold text-xl tracking-tight">Court Partner Studio</h1>
              <StatusBadge status="WEEKLY" />
            </div>
            <p className="text-white/45 text-sm">Intel briefs, pitch deck customiser, co-brand content, onboarding comms.</p>
          </div>
          <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-1.5 text-white/30 hover:text-white/70 text-sm transition-colors">
            <History className="w-4 h-4" /> History
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-white/60 text-sm">Court Name *</Label>
            <Input value={courtName} onChange={(e) => setCourtName(e.target.value)} placeholder="e.g. Padel Point Madrid" className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/60 text-sm">Location / City</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Madrid, Spain" className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/60 text-sm">Number of Courts</Label>
            <Input value={courts} onChange={(e) => setCourts(e.target.value)} placeholder="e.g. 6" className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/60 text-sm">Estimated Weekly Players</Label>
            <Input value={weeklyPlayers} onChange={(e) => setWeeklyPlayers(e.target.value)} placeholder="e.g. 400+" className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 rounded-lg" />
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
            <Label className="text-white/60 text-sm">Relationship Status</Label>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button key={s} onClick={() => setRelStatus(relStatus === s ? '' : s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${relStatus === s ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:border-white/20'}`}>{s}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-white/60 text-sm">Current Tech Platform</Label>
          <Input value={currentTech} onChange={(e) => setCurrentTech(e.target.value)} placeholder="e.g. PlayTomic for bookings" className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-white/60 text-sm">Additional Context</Label>
          <Textarea value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Any other details: who you know there, previous conversations, local market context..." className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 min-h-[60px] resize-none rounded-xl" />
        </div>

        <button onClick={handleGenerate} disabled={loading || !courtName.trim()} className="btn-glow inline-flex items-center px-5 py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none">
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="w-4 h-4 mr-2" />Generate Partner Package</>}
        </button>

        {error && <div className="p-4 glass rounded-xl border-red-500/20 text-red-400 text-sm animate-slide-up">{error}</div>}

        {result && (
          <OutputPanel
            result={result}
            agentId="court-partner"
            label="Partner Package"
            onUpdate={setResult}
          />
        )}

        {showHistory && <div className="animate-slide-up"><OutputHistory agentId="court-partner" refreshKey={historyKey} /></div>}
      </div>
    </div>
  )
}
