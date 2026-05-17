'use client'

import { useEffect, useState } from 'react'
import { DollarSign, Zap, TrendingUp, Loader2, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { formatCost } from '@/lib/format'
import { getApiUrl } from '@/lib/api'

type CostData = {
  logs: Array<{
    id: string
    agentTab: string
    model: string
    inputTokens: number
    outputTokens: number
    costUsd: number
    createdAt: string
  }>
  totalCost: number
  byTab: Array<{ agentTab: string; _sum: { costUsd: number }; _count: { id: number } }>
  byModel: Array<{
    model: string
    _sum: { costUsd: number; inputTokens: number; outputTokens: number }
    _count: { id: number }
  }>
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
}

const MODEL_COLORS = ['#F97316', '#3B82F6']

export default function CostDashboardPage() {
  const [data, setData] = useState<CostData | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch(getApiUrl('/api/cost'))
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const barData = data?.byTab.map((t) => ({
    name: TAB_LABELS[t.agentTab] ?? t.agentTab,
    cost: Number((t._sum.costUsd ?? 0).toFixed(4)),
    calls: t._count.id,
  })) ?? []

  const pieData = data?.byModel.map((m) => ({
    name: m.model === 'claude-sonnet-4-6' ? 'Claude' : 'Gemini',
    value: Number((m._sum.costUsd ?? 0).toFixed(4)),
  })) ?? []

  const totalCalls = data?.logs.length ?? 0
  const daysInMonth = 30
  const daysElapsed = Math.max(1, new Date().getDate())
  const projectedMonthly = ((data?.totalCost ?? 0) / daysElapsed) * daysInMonth

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <DollarSign className="w-5 h-5 text-orange-400" />
            <h1 className="text-white font-bold text-xl">Cost Dashboard</h1>
          </div>
          <p className="text-white/50 text-sm">API spend tracking across all agent tabs</p>
        </div>
        <button
          onClick={fetchData}
          className="text-white/30 hover:text-white/70 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6 max-w-5xl">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="text-white/40 text-xs mb-1">Total Spend</div>
                <div className="text-white font-bold text-2xl">
                  {formatCost(data?.totalCost ?? 0)}
                </div>
                <div className="text-white/30 text-xs mt-1">all time</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="text-white/40 text-xs mb-1">Total API Calls</div>
                <div className="text-white font-bold text-2xl">{totalCalls}</div>
                <div className="text-white/30 text-xs mt-1">generations</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3 h-3 text-orange-400" />
                  <div className="text-white/40 text-xs">Projected Monthly</div>
                </div>
                <div className="text-orange-400 font-bold text-2xl">
                  {formatCost(projectedMonthly)}
                </div>
                <div className="text-white/30 text-xs mt-1">at current pace</div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="text-white/60 text-sm font-medium mb-4">Spend by Agent Tab</div>
                {barData.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-white/20 text-sm">
                    No data yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={barData} margin={{ left: -20 }}>
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#ffffff50', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#ffffff50', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#0A0F1E',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 8,
                          color: '#fff',
                          fontSize: 12,
                        }}
                        formatter={(val) => [`$${Number(val).toFixed(4)}`, 'Cost']}
                      />
                      <Bar dataKey="cost" fill="#F97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="text-white/60 text-sm font-medium mb-4">Claude vs Gemini</div>
                {pieData.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-white/20 text-sm">
                    No data yet
                  </div>
                ) : (
                  <div className="flex items-center gap-6">
                    <ResponsiveContainer width="60%" height={200}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={MODEL_COLORS[i % MODEL_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: '#0A0F1E',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 8,
                            color: '#fff',
                            fontSize: 12,
                          }}
                          formatter={(val) => [`$${Number(val).toFixed(4)}`, 'Cost']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-3">
                      {pieData.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-sm"
                            style={{ background: MODEL_COLORS[i] }}
                          />
                          <div>
                            <div className="text-white text-sm font-medium">{d.name}</div>
                            <div className="text-white/40 text-xs">{formatCost(d.value)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Log table */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/10">
                <span className="text-white/60 text-sm font-medium">Generation Log</span>
              </div>
              {data?.logs.length === 0 ? (
                <div className="px-5 py-8 text-center text-white/20 text-sm">
                  No generations yet. Start using the agent tabs to see cost data here.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {data?.logs.map((log) => (
                    <div key={log.id} className="px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            log.model === 'claude-sonnet-4-6'
                              ? 'bg-orange-500/20 text-orange-400'
                              : 'bg-blue-500/20 text-blue-400'
                          }`}
                        >
                          {log.model === 'claude-sonnet-4-6' ? 'Claude' : 'Gemini'}
                        </span>
                        <span className="text-white/70 text-sm">
                          {TAB_LABELS[log.agentTab] ?? log.agentTab}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-white/40">
                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {(log.inputTokens + log.outputTokens).toLocaleString()}
                        </span>
                        <span className="text-orange-400 font-medium">
                          {formatCost(log.costUsd)}
                        </span>
                        <span>
                          {new Date(log.createdAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
