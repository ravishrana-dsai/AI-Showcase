'use client'

import { useEffect, useState } from 'react'
import { Brain, Zap, RefreshCw, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCost } from '@/lib/format'
import { getApiUrl } from '@/lib/api'

type BrainActivity = {
  agentTab: string
  model: string
  costUsd: number
  createdAt: string
  inputTokens: number
  outputTokens: number
}

type BrainInsight = {
  id: string
  sourceAgentTab: string
  insightType: string
  category: string
  summary: string
  detail: string | null
  routedTo: string | null
  createdAt: string
}

type InsightCounts = Record<string, number>

type TableCounts = {
  brandBibles: number
  audienceIntel: number
  perfHistory: number
  relMemory: number
}

const TAB_LABELS: Record<string, string> = {
  context: 'Context',
  'brand-identity': 'Brand Identity',
  'social-content': 'Social Content',
  'campaign-builder': 'Campaign',
  listening: 'Listening',
  'influencer-crm': 'Influencer CRM',
  'seo-gso-content': 'SEO & GSO',
  'email-whatsapp': 'Email/WhatsApp',
  'tournament-engine': 'Tournament',
  'court-partner': 'Court Partner',
  analytics: 'Analytics',
  'brain-extraction': 'Brain',
}

const INSIGHT_COLORS: Record<string, string> = {
  brand_voice:          'border-orange-400 bg-orange-500/10 text-orange-300',
  audience_segment:     'border-blue-400   bg-blue-500/10   text-blue-300',
  content_performance:  'border-green-400  bg-green-500/10  text-green-300',
  competitive_intel:    'border-purple-400 bg-purple-500/10 text-purple-300',
  general_learning:     'border-white/20   bg-white/5       text-white/50',
}

const INSIGHT_LABELS: Record<string, string> = {
  brand_voice:         'Voice',
  audience_segment:    'Audience',
  content_performance: 'Performance',
  competitive_intel:   'Competitive',
  general_learning:    'General',
}

const TYPE_KEYS = [
  'brand_voice',
  'audience_segment',
  'content_performance',
  'competitive_intel',
  'general_learning',
] as const

function InsightCard({ insight }: { insight: BrainInsight }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetail = !!insight.detail

  return (
    <div
      className={cn(
        'rounded-lg border-l-2 bg-white/[0.03] border border-white/[0.06] transition-colors',
        INSIGHT_COLORS[insight.insightType]?.split(' ')[0] ?? 'border-l-white/20',
        hasDetail && 'cursor-pointer hover:bg-white/[0.05]'
      )}
      onClick={() => hasDetail && setExpanded((v) => !v)}
    >
      <div className="p-2.5">
        <div className="flex items-center justify-between mb-1 gap-1">
          <span className="text-white/60 text-[10px] font-medium truncate">
            {TAB_LABELS[insight.sourceAgentTab] ?? insight.sourceAgentTab}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <span
              className={cn(
                'text-[9px] px-1.5 py-0.5 rounded-full border font-medium',
                INSIGHT_COLORS[insight.insightType]
              )}
            >
              {INSIGHT_LABELS[insight.insightType]}
            </span>
            {hasDetail && (
              expanded
                ? <ChevronUp className="w-3 h-3 text-white/30" />
                : <ChevronDown className="w-3 h-3 text-white/30" />
            )}
          </div>
        </div>
        <p className={cn('text-white/50 text-[10px] leading-relaxed', !expanded && 'line-clamp-2')}>
          {insight.summary}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-white/20 text-[9px]">
            {new Date(insight.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {insight.routedTo && (
            <span className="text-green-400/60 text-[9px]">
              → {insight.routedTo.replace('_', ' ')}
            </span>
          )}
        </div>
      </div>
      {expanded && insight.detail && (
        <div className="px-2.5 pb-2.5 border-t border-white/[0.06] mt-0">
          <p className="text-white/40 text-[10px] leading-relaxed pt-2 whitespace-pre-wrap">
            {insight.detail}
          </p>
        </div>
      )}
    </div>
  )
}

export function BrainPanel() {
  const [activities, setActivities]       = useState<BrainActivity[]>([])
  const [insights, setInsights]           = useState<BrainInsight[]>([])
  const [counts, setCounts]               = useState<InsightCounts>({})
  const [tableCounts, setTableCounts]     = useState<TableCounts | null>(null)
  const [loading, setLoading]             = useState(false)
  const [showActivity, setShowActivity]   = useState(false)

  async function fetchAll() {
    setLoading(true)
    try {
      const [activityRes, insightsRes] = await Promise.all([
        fetch(getApiUrl('/api/brain')),
        fetch(getApiUrl('/api/brain/insights')),
      ])
      if (activityRes.ok)  setActivities(await activityRes.json())
      if (insightsRes.ok) {
        const data = await insightsRes.json()
        setInsights(data.insights  ?? [])
        setCounts(data.counts      ?? {})
        setTableCounts(data.tableCounts ?? null)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 30000)
    return () => clearInterval(interval)
  }, [])

  const totalLearnings = counts.total ?? 0

  return (
    <aside className="w-64 shrink-0 bg-[#0A0F1E] border-l border-white/10 flex flex-col h-screen sticky top-0 overflow-y-auto">

      {/* Header */}
      <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-orange-400" />
          <span className="text-white font-semibold text-sm">Shared Brain</span>
        </div>
        <button
          onClick={fetchAll}
          className="text-white/30 hover:text-white/70 transition-colors"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Brain Stats */}
      <div className="px-3 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white/30 text-[10px] uppercase tracking-widest font-semibold">
            Learned
          </span>
          <div className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-orange-400" />
            <span className="text-orange-400 font-bold text-sm">{totalLearnings}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {TYPE_KEYS.map((type) => {
            const count = counts[type] ?? 0
            return (
              <span
                key={type}
                className={cn(
                  'text-[9px] px-1.5 py-0.5 rounded-full border font-medium',
                  INSIGHT_COLORS[type],
                  count === 0 && 'opacity-30'
                )}
              >
                {INSIGHT_LABELS[type]} {count > 0 && `· ${count}`}
              </span>
            )
          })}
        </div>
      </div>

      {/* Recent Learnings */}
      <div className="px-3 py-3 flex-1">
        <div className="text-white/30 text-[10px] uppercase tracking-widest font-semibold px-1 mb-2">
          Recent Learnings
        </div>

        {insights.length === 0 ? (
          <div className="text-center py-6">
            <Brain className="w-7 h-7 text-white/10 mx-auto mb-2" />
            <p className="text-white/30 text-xs">No learnings yet</p>
            <p className="text-white/20 text-[10px] mt-1">
              Approve an output to teach the brain
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        )}
      </div>

      {/* Brain Inputs with live counts */}
      <div className="px-3 py-3 border-t border-white/10 shrink-0">
        <div className="text-white/30 text-[10px] uppercase tracking-widest font-semibold px-1 mb-2">
          Brain Inputs
        </div>
        <div className="space-y-1.5">
          {[
            { label: 'Brand Bible',    count: tableCounts?.brandBibles  ?? 0 },
            { label: 'Perf History',   count: tableCounts?.perfHistory  ?? 0 },
            { label: 'Audience Intel', count: tableCounts?.audienceIntel ?? 0 },
            { label: 'Rel. Memory',    count: tableCounts?.relMemory    ?? 0 },
          ].map(({ label, count }) => (
            <div
              key={label}
              className="flex items-center justify-between px-2 py-1.5 bg-white/5 rounded border border-white/10"
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    count > 0 ? 'bg-green-400' : 'bg-white/20'
                  )}
                />
                <span className="text-white/50 text-[11px]">{label}</span>
              </div>
              {count > 0 && (
                <span className="text-white/30 text-[10px]">{count}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity (collapsed by default) */}
      <div className="px-3 py-2 border-t border-white/10 shrink-0">
        <button
          onClick={() => setShowActivity((v) => !v)}
          className="flex items-center justify-between w-full text-white/30 hover:text-white/60 transition-colors"
        >
          <span className="text-[10px] uppercase tracking-widest font-semibold">
            API Activity
          </span>
          {showActivity
            ? <ChevronUp className="w-3 h-3" />
            : <ChevronDown className="w-3 h-3" />}
        </button>

        {showActivity && (
          <div className="mt-2 space-y-2">
            {activities.length === 0 ? (
              <p className="text-white/20 text-[10px] text-center py-2">No activity yet</p>
            ) : (
              activities.map((activity, i) => (
                <div
                  key={i}
                  className="bg-white/5 rounded-lg p-2.5 border border-white/10"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white/80 text-xs font-medium truncate">
                      {TAB_LABELS[activity.agentTab] ?? activity.agentTab}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded font-medium',
                        activity.model === 'claude-sonnet-4-6'
                          ? 'bg-orange-500/20 text-orange-400'
                          : activity.model === 'claude-haiku-4-5'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-blue-500/20 text-blue-400'
                      )}
                    >
                      {activity.model === 'claude-sonnet-4-6'
                        ? 'Sonnet'
                        : activity.model === 'claude-haiku-4-5'
                        ? 'Haiku'
                        : 'Gemini'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-white/40">
                    <Zap className="w-2.5 h-2.5" />
                    <span>{activity.inputTokens + activity.outputTokens} tokens</span>
                    <span className="text-orange-400 font-medium">
                      {formatCost(activity.costUsd)}
                    </span>
                  </div>
                  <div className="text-[10px] text-white/25 mt-1">
                    {new Date(activity.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
