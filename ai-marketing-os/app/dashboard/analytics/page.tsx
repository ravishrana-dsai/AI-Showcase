'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Loader2, Sparkles, Copy, Check, History, TrendingUp, Users,
  Trophy, Building2, CheckCircle, Download, BarChart2,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { CostBadge } from '@/components/shared/CostBadge'
import { OutputHistory } from '@/components/shared/OutputHistory'
import type { GenerateResult } from '@/lib/ai'
import { getApiUrl } from '@/lib/api'

interface KpiState {
  dprPlayers: string; courtsLive: string; matchesWeek: string; newsletterSubs: string
  igImpressions: string; igEngagements: string; igFollowers: string
  nlOpenRate: string; nlClickRate: string
  tournAttendees: string; newDprProfiles: string; newCourts: string
}

const DEFAULTS: KpiState = {
  dprPlayers: '547', courtsLive: '9', matchesWeek: '', newsletterSubs: '',
  igImpressions: '', igEngagements: '', igFollowers: '',
  nlOpenRate: '', nlClickRate: '', tournAttendees: '', newDprProfiles: '', newCourts: '',
}

const KPI_FIELDS: { field: keyof KpiState; key: string; label: string }[] = [
  { field: 'dprPlayers',     key: 'kpi_dpr_players',     label: 'Player Rating Players' },
  { field: 'courtsLive',     key: 'kpi_courts_live',      label: 'Courts Live' },
  { field: 'matchesWeek',    key: 'kpi_matches_week',     label: 'Matches This Week' },
  { field: 'newsletterSubs', key: 'kpi_newsletter_subs',  label: 'Newsletter Subscribers' },
  { field: 'igImpressions',  key: 'kpi_ig_impressions',   label: 'Instagram Impressions' },
  { field: 'igEngagements',  key: 'kpi_ig_engagements',   label: 'Instagram Engagements' },
  { field: 'igFollowers',    key: 'kpi_ig_followers',     label: 'Instagram New Followers' },
  { field: 'nlOpenRate',     key: 'kpi_nl_open_rate',     label: 'Newsletter Open Rate' },
  { field: 'nlClickRate',    key: 'kpi_nl_click_rate',    label: 'Newsletter Click Rate' },
  { field: 'tournAttendees', key: 'kpi_tourn_attendees',  label: 'Tournament Attendees' },
  { field: 'newDprProfiles', key: 'kpi_new_dpr_profiles', label: 'New Player Rating Profiles' },
  { field: 'newCourts',      key: 'kpi_new_courts',       label: 'New Courts Onboarded' },
]

const KEY_TO_FIELD = Object.fromEntries(KPI_FIELDS.map((f) => [f.key, f.field])) as Record<string, keyof KpiState>

async function persistKpi(field: keyof KpiState, value: string) {
  const entry = KPI_FIELDS.find((f) => f.field === field)
  if (!entry) return
  fetch(getApiUrl('/api/context'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates: [{ key: entry.key, value, label: entry.label, category: 'analytics_kpi' }] }),
  }).catch(() => {})
}

interface PastOutput { id: string; inputPrompt: string; createdAt: string }
interface TrendPoint { date: string; dprPlayers?: number; courtsLive?: number; matches?: number }

function parseKpisFromPrompt(prompt: string, date: string): TrendPoint {
  const num = (re: RegExp) => { const m = prompt.match(re); return m ? parseInt(m[1]) : undefined }
  return {
    date: new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    dprPlayers: num(/Total Player Rating Players:\s*(\d+)/),
    courtsLive:  num(/Courts Live:\s*(\d+)/),
    matches:     num(/Matches This Week:\s*(\d+)/),
  }
}

export default function AnalyticsPage() {
  const [kpis, setKpis]         = useState<KpiState>(DEFAULTS)
  const [view, setView]         = useState<'input' | 'trends'>('input')
  const [trendData, setTrendData] = useState<TrendPoint[]>([])

  useEffect(() => {
    fetch(getApiUrl('/api/context'))      .then((r) => r.json())
      .then((inputs: { key: string; value: string }[]) => {
        const saved: Partial<KpiState> = {}
        for (const input of inputs) {
          const field = KEY_TO_FIELD[input.key]
          if (field) saved[field] = input.value
        }
        if (Object.keys(saved).length > 0) setKpis((p) => ({ ...p, ...saved }))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (view !== 'trends') return
    fetch(getApiUrl('/api/agents/analytics?limit=20'))      .then((r) => r.json())
      .then((outputs: PastOutput[]) => {
        const points = outputs
          .filter((o) => o.inputPrompt && !o.inputPrompt.startsWith('[AUTO]'))
          .map((o) => parseKpisFromPrompt(o.inputPrompt, o.createdAt))
          .filter((p) => p.dprPlayers || p.courtsLive)
          .reverse()
        setTrendData(points)
      })
      .catch(() => {})
  }, [view])

  function updateKpi(field: keyof KpiState, value: string) {
    setKpis((p) => ({ ...p, [field]: value }))
  }

  const { dprPlayers, courtsLive, matchesWeek, newsletterSubs,
    igImpressions, igEngagements, igFollowers,
    nlOpenRate, nlClickRate, tournAttendees, newDprProfiles, newCourts } = kpis

  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<(GenerateResult & { outputId?: string; saved?: boolean }) | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [copied, setCopied]       = useState(false)
  const [approving, setApproving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [historyKey, setHistoryKey]   = useState(0)

  function buildPrompt(): string {
    const lines = ["This week's metrics for [Company]:"]
    if (dprPlayers) lines.push(`Total Player Rating Players: ${dprPlayers}`)
    if (courtsLive) lines.push(`Courts Live: ${courtsLive}`)
    if (matchesWeek) lines.push(`Matches This Week: ${matchesWeek}`)
    if (newsletterSubs) lines.push(`Newsletter Subscribers: ${newsletterSubs}`)
    if (igImpressions || igEngagements || igFollowers) {
      lines.push(`Instagram: ${igImpressions ? igImpressions + ' impressions' : ''}${igEngagements ? ', ' + igEngagements + ' engagements' : ''}${igFollowers ? ', +' + igFollowers + ' new followers' : ''}`)
    }
    if (nlOpenRate || nlClickRate) {
      lines.push(`Newsletter: ${nlOpenRate ? nlOpenRate + '% open rate' : ''}${nlClickRate ? ', ' + nlClickRate + '% click rate' : ''}`)
    }
    if (tournAttendees || newDprProfiles) {
      lines.push(`Tournament: ${tournAttendees ? tournAttendees + ' attendees' : ''}${newDprProfiles ? ', ' + newDprProfiles + ' new Player Rating profiles' : ''}`)
    }
    if (newCourts) lines.push(`New courts onboarded this week: ${newCourts}`)
    lines.push('\nGenerate the Monday brand brief.')
    return lines.join('\n')
  }

  async function handleGenerate() {
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch(getApiUrl('/api/agents/analytics'), {
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

  async function handleApprove() {
    if (!result?.outputId) return
    setApproving(true)
    try {
      await fetch(getApiUrl('/api/agents/analytics'), {
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
    a.href = url; a.download = `analytics-brief-${new Date().toISOString().slice(0, 10)}.md`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-white/[0.06] gradient-header">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-orange-500/50 text-sm font-mono font-bold">10</span>
              <h1 className="text-white font-bold text-xl tracking-tight">Analytics & Brand Health</h1>
              <StatusBadge status="AUTO" />
            </div>
            <p className="text-white/45 text-sm">Content performance, share of voice, sentiment score. Monday brand brief.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-white/10 overflow-hidden">
              <button
                onClick={() => setView('input')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'input' ? 'bg-orange-500/20 text-orange-400' : 'text-white/40 hover:text-white/70'}`}
              >
                Input
              </button>
              <button
                onClick={() => setView('trends')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${view === 'trends' ? 'bg-orange-500/20 text-orange-400' : 'text-white/40 hover:text-white/70'}`}
              >
                <BarChart2 className="w-3 h-3" />Trends
              </button>
            </div>
            <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-1.5 text-white/30 hover:text-white/70 text-sm transition-colors">
              <History className="w-4 h-4" /> History
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {view === 'trends' ? (
          <div className="space-y-6">
            {trendData.length === 0 ? (
              <div className="glass rounded-xl p-8 text-center">
                <BarChart2 className="w-8 h-8 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">No trend data yet.</p>
                <p className="text-white/25 text-xs mt-1">Generate a few weekly briefs to see trends here.</p>
              </div>
            ) : (
              <>
                <div className="glass rounded-xl p-5">
                  <h3 className="text-white/60 text-sm font-semibold mb-4">Player Rating Players & Courts Over Time</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                        labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }} />
                      <Line type="monotone" dataKey="dprPlayers" name="Player Rating Players" stroke="#f97316" strokeWidth={2} dot={{ r: 3, fill: '#f97316' }} />
                      <Line type="monotone" dataKey="courtsLive" name="Courts Live" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3, fill: '#60a5fa' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {trendData.some((p) => p.matches) && (
                  <div className="glass rounded-xl p-5">
                    <h3 className="text-white/60 text-sm font-semibold mb-4">Matches Per Week</h3>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                        <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} labelStyle={{ color: 'rgba(255,255,255,0.6)' }} />
                        <Line type="monotone" dataKey="matches" name="Matches" stroke="#4ade80" strokeWidth={2} dot={{ r: 3, fill: '#4ade80' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-3">
              {[
                { field: 'dprPlayers' as const,     icon: <Users className="w-3.5 h-3.5 text-orange-400" />,  label: 'Player Rating Players',       color: 'border-orange-500/10', placeholder: '0' },
                { field: 'courtsLive' as const,     icon: <Building2 className="w-3.5 h-3.5 text-blue-400" />, label: 'Courts Live',       color: 'border-blue-500/10',   placeholder: '0' },
                { field: 'matchesWeek' as const,    icon: <Trophy className="w-3.5 h-3.5 text-green-400" />,   label: 'Matches This Week', color: 'border-green-500/10',  placeholder: '0' },
                { field: 'newsletterSubs' as const, icon: <TrendingUp className="w-3.5 h-3.5 text-purple-400" />, label: 'Newsletter Subs', color: 'border-purple-500/10', placeholder: '0' },
              ].map(({ field, icon, label, color, placeholder }) => (
                <div key={field} className={`glass rounded-xl p-4 ${color}`}>
                  <div className="flex items-center gap-2 text-white/40 text-xs mb-2">{icon} {label}</div>
                  <Input
                    value={kpis[field]}
                    onChange={(e) => updateKpi(field, e.target.value)}
                    onBlur={(e) => persistKpi(field, e.target.value)}
                    placeholder={placeholder}
                    className="bg-transparent border-none text-white font-bold text-2xl p-0 h-auto focus:ring-0 placeholder:text-white/15"
                  />
                </div>
              ))}
            </div>

            <div className="glass rounded-xl p-5">
              <h3 className="text-white/60 text-sm font-semibold mb-4">Weekly Metrics Entry</h3>
              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                <div>
                  <span className="text-orange-400/70 text-xs font-semibold uppercase tracking-wider">Instagram</span>
                  <div className="mt-2 space-y-2">
                    <div><Label className="text-white/40 text-xs">Impressions</Label><Input value={igImpressions} onChange={(e) => updateKpi('igImpressions', e.target.value)} onBlur={(e) => persistKpi('igImpressions', e.target.value)} placeholder="e.g. 2400" className="bg-white/[0.03] border-white/[0.06] text-white text-sm rounded-lg h-8 mt-0.5" /></div>
                    <div><Label className="text-white/40 text-xs">Engagements</Label><Input value={igEngagements} onChange={(e) => updateKpi('igEngagements', e.target.value)} onBlur={(e) => persistKpi('igEngagements', e.target.value)} placeholder="e.g. 180" className="bg-white/[0.03] border-white/[0.06] text-white text-sm rounded-lg h-8 mt-0.5" /></div>
                    <div><Label className="text-white/40 text-xs">New Followers</Label><Input value={igFollowers} onChange={(e) => updateKpi('igFollowers', e.target.value)} onBlur={(e) => persistKpi('igFollowers', e.target.value)} placeholder="e.g. 45" className="bg-white/[0.03] border-white/[0.06] text-white text-sm rounded-lg h-8 mt-0.5" /></div>
                  </div>
                </div>
                <div>
                  <span className="text-blue-400/70 text-xs font-semibold uppercase tracking-wider">Newsletter</span>
                  <div className="mt-2 space-y-2">
                    <div><Label className="text-white/40 text-xs">Open Rate %</Label><Input value={nlOpenRate} onChange={(e) => updateKpi('nlOpenRate', e.target.value)} onBlur={(e) => persistKpi('nlOpenRate', e.target.value)} placeholder="e.g. 41" className="bg-white/[0.03] border-white/[0.06] text-white text-sm rounded-lg h-8 mt-0.5" /></div>
                    <div><Label className="text-white/40 text-xs">Click Rate %</Label><Input value={nlClickRate} onChange={(e) => updateKpi('nlClickRate', e.target.value)} onBlur={(e) => persistKpi('nlClickRate', e.target.value)} placeholder="e.g. 8" className="bg-white/[0.03] border-white/[0.06] text-white text-sm rounded-lg h-8 mt-0.5" /></div>
                  </div>
                </div>
                <div>
                  <span className="text-green-400/70 text-xs font-semibold uppercase tracking-wider">Events & Courts</span>
                  <div className="mt-2 space-y-2">
                    <div><Label className="text-white/40 text-xs">Tournament Attendees</Label><Input value={tournAttendees} onChange={(e) => updateKpi('tournAttendees', e.target.value)} onBlur={(e) => persistKpi('tournAttendees', e.target.value)} placeholder="e.g. 38" className="bg-white/[0.03] border-white/[0.06] text-white text-sm rounded-lg h-8 mt-0.5" /></div>
                    <div><Label className="text-white/40 text-xs">New Player Rating Profiles</Label><Input value={newDprProfiles} onChange={(e) => updateKpi('newDprProfiles', e.target.value)} onBlur={(e) => persistKpi('newDprProfiles', e.target.value)} placeholder="e.g. 12" className="bg-white/[0.03] border-white/[0.06] text-white text-sm rounded-lg h-8 mt-0.5" /></div>
                    <div><Label className="text-white/40 text-xs">New Courts Onboarded</Label><Input value={newCourts} onChange={(e) => updateKpi('newCourts', e.target.value)} onBlur={(e) => persistKpi('newCourts', e.target.value)} placeholder="e.g. 1" className="bg-white/[0.03] border-white/[0.06] text-white text-sm rounded-lg h-8 mt-0.5" /></div>
                  </div>
                </div>
              </div>
            </div>

            <button onClick={handleGenerate} disabled={loading} className="btn-glow inline-flex items-center px-5 py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="w-4 h-4 mr-2" />Generate Monday Brand Brief</>}
            </button>

            {error && <div className="p-4 glass rounded-xl border-red-500/20 text-red-400 text-sm animate-slide-up">{error}</div>}

            {result && (
              <div className="space-y-3 animate-slide-up">
                <div className="flex items-center justify-between">
                  <span className="text-white/50 text-sm font-medium">Monday Brand Brief</span>
                  <CostBadge model={result.model} inputTokens={result.inputTokens} outputTokens={result.outputTokens} costUsd={result.costUsd} />
                </div>
                <div className="glass rounded-xl p-5 border-white/[0.06]">
                  <div className="markdown-output text-sm leading-relaxed"><ReactMarkdown>{result.content}</ReactMarkdown></div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={async () => { await navigator.clipboard.writeText(result.content); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="inline-flex items-center px-3 py-1.5 rounded-md text-xs text-white/50 hover:text-white hover:bg-white/[0.06] border border-white/10 transition-colors">
                    {copied ? <><Check className="w-3 h-3 mr-1.5 text-green-400" />Copied</> : <><Copy className="w-3 h-3 mr-1.5" />Copy</>}
                  </button>
                  <button onClick={handleExport} className="inline-flex items-center px-3 py-1.5 rounded-md text-xs text-white/50 hover:text-white hover:bg-white/[0.06] border border-white/10 transition-colors">
                    <Download className="w-3 h-3 mr-1.5" />Export .md
                  </button>
                  {result.saved ? (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-md text-xs text-green-400 bg-green-600/20 border border-green-500/20 font-medium">
                      <CheckCircle className="w-3 h-3 mr-1.5" />Approved
                    </span>
                  ) : (
                    <button onClick={handleApprove} disabled={approving || !result.outputId} className="btn-glow inline-flex items-center px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50">
                      {approving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Approving...</> : <><CheckCircle className="w-3.5 h-3.5 mr-1.5" />Approve & Save</>}
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {showHistory && <div className="animate-slide-up"><OutputHistory agentId="analytics" refreshKey={historyKey} /></div>}
      </div>
    </div>
  )
}
