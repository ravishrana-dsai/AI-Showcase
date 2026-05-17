'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Loader2, Sparkles, CheckCircle, Copy, Check, History, Pencil, X, Download } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from './StatusBadge'
import { CostBadge } from './CostBadge'
import { OutputHistory } from './OutputHistory'
import { AgentStatus } from '@/lib/types'
import type { GenerateResult } from '@/lib/ai'

type Props = {
  tabNumber: string
  tabName: string
  status: AgentStatus
  description: string
  inputLabel: string
  inputPlaceholder: string
  agentId: string
  extraFields?: React.ReactNode
}

export function AgentWorkspace({
  tabNumber,
  tabName,
  status,
  description,
  inputLabel,
  inputPlaceholder,
  agentId,
  extraFields,
}: Props) {
  const [prompt, setPrompt]         = useState('')
  const [loading, setLoading]       = useState(false)
  const [result, setResult]         = useState<(GenerateResult & { outputId?: string; saved?: boolean }) | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [copied, setCopied]         = useState(false)
  const [approving, setApproving]   = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [historyKey, setHistoryKey] = useState(0)
  const [editing, setEditing]       = useState(false)
  const [editedContent, setEditedContent] = useState('')

  async function handleGenerate() {
    if (!prompt.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    setEditing(false)

    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Generation failed')
      }

      const data = await res.json()
      setResult(data)
      setEditedContent(data.content)
      setHistoryKey((k) => k + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function handleStartEdit() {
    setEditedContent(result?.content ?? '')
    setEditing(true)
  }

  function handleCancelEdit() {
    setEditing(false)
    setEditedContent(result?.content ?? '')
  }

  function handleSaveEdit() {
    setResult((prev) => prev ? { ...prev, content: editedContent } : null)
    setEditing(false)
  }

  async function handleApprove() {
    if (!result) return
    setApproving(true)
    try {
      await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputId: result.outputId }),
      })
      setResult((prev) => (prev ? { ...prev, saved: true } : null))
    } finally {
      setApproving(false)
    }
  }

  async function handleCopy() {
    if (!result?.content) return
    await navigator.clipboard.writeText(result.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleExport() {
    if (!result?.content) return
    const blob = new Blob([result.content], { type: 'text/markdown' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${agentId}-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const displayContent = editing ? editedContent : (result?.content ?? '')

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/[0.06] gradient-header">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-orange-500/50 text-sm font-mono font-bold">{tabNumber}</span>
              <h1 className="text-white font-bold text-xl tracking-tight">{tabName}</h1>
              <StatusBadge status={status} />
            </div>
            <p className="text-white/45 text-sm">{description}</p>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 text-sm font-medium transition-colors"
          >
            <History className="w-4 h-4 mr-1.5" />
            History
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Input */}
        <div className="space-y-3">
          <label className="text-white/60 text-sm font-medium">{inputLabel}</label>
          {extraFields}
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={inputPlaceholder}
            className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 min-h-[120px] max-h-[200px] resize-none focus:border-orange-500/40 focus:ring-0 rounded-xl transition-colors"
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="btn-glow inline-flex items-center px-5 py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" />Generate</>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 glass rounded-xl border-red-500/20 text-red-400 text-sm animate-slide-up">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-3 animate-slide-up">
            {/* Output header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-white/50 text-sm font-medium">Output</span>
                {editing && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-medium">
                    Editing
                  </span>
                )}
              </div>
              <CostBadge
                model={result.model}
                inputTokens={result.inputTokens}
                outputTokens={result.outputTokens}
                costUsd={result.costUsd}
              />
            </div>

            {/* Output content: edit mode or read mode */}
            {editing ? (
              <div className="space-y-2">
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="bg-white/[0.03] border-orange-500/30 text-white/90 min-h-[300px] resize-y focus:border-orange-500/60 focus:ring-0 rounded-xl transition-colors text-sm leading-relaxed font-mono"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="btn-glow inline-flex items-center px-4 py-2 rounded-lg text-white text-sm font-medium"
                  >
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                    Done editing
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 text-sm font-medium transition-colors"
                  >
                    <X className="w-3.5 h-3.5 mr-1.5" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="glass rounded-xl p-5 border-white/[0.06]">
                <div className="markdown-output text-sm leading-relaxed">
                  <ReactMarkdown>{displayContent}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Action row */}
            {!editing && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.06] text-sm font-medium transition-colors"
                >
                  {copied ? (
                    <><Check className="w-3.5 h-3.5 mr-1.5 text-green-400" />Copied</>
                  ) : (
                    <><Copy className="w-3.5 h-3.5 mr-1.5" />Copy</>
                  )}
                </button>
                <button
                  onClick={handleExport}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.06] text-sm font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />Export .md
                </button>

                {!result.saved && (
                  <button
                    onClick={handleStartEdit}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-orange-400 hover:border-orange-500/30 hover:bg-orange-500/5 text-sm font-medium transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                    Edit
                  </button>
                )}

                <button
                  onClick={handleApprove}
                  disabled={approving || result.saved}
                  className={
                    result.saved
                      ? 'inline-flex items-center px-4 py-2 rounded-lg bg-green-600/80 text-white text-sm font-medium cursor-default'
                      : 'btn-glow inline-flex items-center px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50'
                  }
                >
                  {result.saved ? (
                    <><CheckCircle className="w-3.5 h-3.5 mr-1.5" />Approved</>
                  ) : approving ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Approving...</>
                  ) : (
                    <><CheckCircle className="w-3.5 h-3.5 mr-1.5" />Approve & Save</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Output History */}
        {showHistory && (
          <div className="animate-slide-up">
            <OutputHistory agentId={agentId} refreshKey={historyKey} />
          </div>
        )}
      </div>
    </div>
  )
}
