'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Clock, ChevronDown, ChevronUp, Copy, Check, CheckCircle, Pencil, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCost } from '@/lib/format'

type Output = {
  id: string
  agentTab: string
  inputPrompt: string
  outputContent: string
  modelUsed: string
  costUsd: number
  approved: boolean
  createdAt: string
}

type Props = {
  agentId: string
  refreshKey?: number
}

export function OutputHistory({ agentId, refreshKey }: Props) {
  const [outputs, setOutputs]       = useState<Output[]>([])
  const [loading, setLoading]       = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId]     = useState<string | null>(null)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editedContent, setEditedContent] = useState<Record<string, string>>({})
  const [approvingId, setApprovingId]     = useState<string | null>(null)
  const [approvedIds, setApprovedIds]     = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    fetch(`/api/agents/${agentId}?limit=20`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Output[]) => {
        setOutputs(data)
        // Pre-seed approved IDs from DB state
        setApprovedIds(new Set(data.filter((o) => o.approved).map((o) => o.id)))
      })
      .catch(() => setOutputs([]))
      .finally(() => setLoading(false))
  }, [agentId, refreshKey])

  async function handleCopy(content: string, id: string) {
    await navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function handleStartEdit(output: Output) {
    setEditingId(output.id)
    setEditedContent((prev) => ({ ...prev, [output.id]: output.outputContent }))
  }

  function handleCancelEdit(id: string) {
    setEditingId(null)
    setEditedContent((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function handleSaveEdit(id: string) {
    setOutputs((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, outputContent: editedContent[id] ?? o.outputContent } : o
      )
    )
    setEditingId(null)
  }

  async function handleApprove(output: Output) {
    setApprovingId(output.id)
    try {
      await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputId: output.id }),
      })
      setApprovedIds((prev) => new Set([...prev, output.id]))
      setOutputs((prev) =>
        prev.map((o) => (o.id === output.id ? { ...o, approved: true } : o))
      )
    } finally {
      setApprovingId(null)
    }
  }

  if (loading) {
    return (
      <div className="glass rounded-xl p-6 text-center">
        <div className="text-white/20 text-sm">Loading history...</div>
      </div>
    )
  }

  if (outputs.length === 0) {
    return (
      <div className="glass rounded-xl p-6 text-center">
        <Clock className="w-6 h-6 text-white/10 mx-auto mb-2" />
        <div className="text-white/25 text-sm">No past outputs yet</div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-3.5 h-3.5 text-white/30" />
        <span className="text-white/40 text-xs font-semibold uppercase tracking-wider">
          Past Outputs ({outputs.length})
        </span>
      </div>

      {outputs.map((output) => {
        const isExpanded  = expandedId === output.id
        const isEditing   = editingId === output.id
        const isApproved  = approvedIds.has(output.id)
        const isApproving = approvingId === output.id
        const isClaude    = output.modelUsed === 'claude-sonnet-4-6'
        const content     = editedContent[output.id] ?? output.outputContent

        return (
          <div key={output.id} className="glass rounded-xl overflow-hidden transition-all">
            {/* Summary row */}
            <button
              onClick={() => {
                if (!isEditing) setExpandedId(isExpanded ? null : output.id)
              }}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0',
                    isClaude
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'bg-blue-500/20 text-blue-400'
                  )}
                >
                  {isClaude ? 'Claude' : 'Gemini'}
                </span>
                {isApproved && (
                  <CheckCircle className="w-3 h-3 text-green-400 shrink-0" />
                )}
                {isEditing && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-medium shrink-0">
                    Editing
                  </span>
                )}
                <span className="text-white/60 text-xs truncate">
                  {output.inputPrompt.slice(0, 80)}{output.inputPrompt.length > 80 ? '...' : ''}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                <span className="text-orange-400/60 text-[10px] font-medium">
                  {formatCost(output.costUsd)}
                </span>
                <span className="text-white/20 text-[10px]">
                  {new Date(output.createdAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                {isExpanded
                  ? <ChevronUp className="w-3.5 h-3.5 text-white/20" />
                  : <ChevronDown className="w-3.5 h-3.5 text-white/20" />}
              </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-white/[0.06] animate-slide-up">
                {isEditing ? (
                  // Edit mode
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={editedContent[output.id] ?? output.outputContent}
                      onChange={(e) =>
                        setEditedContent((prev) => ({ ...prev, [output.id]: e.target.value }))
                      }
                      className="w-full min-h-[300px] resize-y bg-white/[0.03] border border-orange-500/30 text-white/90 rounded-xl p-3 text-sm leading-relaxed font-mono focus:border-orange-500/60 focus:outline-none transition-colors"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSaveEdit(output.id)}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium transition-colors"
                      >
                        <Check className="w-3 h-3 mr-1.5" />
                        Done editing
                      </button>
                      <button
                        onClick={() => handleCancelEdit(output.id)}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/5 text-xs font-medium transition-colors"
                      >
                        <X className="w-3 h-3 mr-1.5" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // Read mode
                  <div className="mt-3 markdown-output text-sm leading-relaxed max-h-[400px] overflow-y-auto">
                    <ReactMarkdown>{content}</ReactMarkdown>
                  </div>
                )}

                {/* Action row */}
                {!isEditing && (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleCopy(content, output.id)}
                      className="inline-flex items-center px-3 py-1.5 rounded-md text-xs text-white/50 hover:text-white hover:bg-white/[0.06] border border-white/10 transition-colors"
                    >
                      {copiedId === output.id ? (
                        <><Check className="w-3 h-3 mr-1.5 text-green-400" />Copied</>
                      ) : (
                        <><Copy className="w-3 h-3 mr-1.5" />Copy</>
                      )}
                    </button>

                    {!isApproved && (
                      <button
                        onClick={() => handleStartEdit(output)}
                        className="inline-flex items-center px-3 py-1.5 rounded-md text-xs text-white/50 hover:text-orange-400 hover:border-orange-500/30 hover:bg-orange-500/5 border border-white/10 transition-colors"
                      >
                        <Pencil className="w-3 h-3 mr-1.5" />
                        Edit
                      </button>
                    )}

                    {isApproved ? (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-md text-xs text-green-400 bg-green-600/20 border border-green-500/20 font-medium">
                        <CheckCircle className="w-3 h-3 mr-1.5" />
                        Approved
                      </span>
                    ) : (
                      <button
                        onClick={() => handleApprove(output)}
                        disabled={isApproving}
                        className="inline-flex items-center px-3 py-1.5 rounded-md text-xs text-white btn-glow font-medium disabled:opacity-50"
                      >
                        {isApproving ? (
                          <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Approving...</>
                        ) : (
                          <><CheckCircle className="w-3 h-3 mr-1.5" />Approve & Save</>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
