'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Copy, Check, Pencil, X, CheckCircle, Loader2, Download } from 'lucide-react'
import { CostBadge } from './CostBadge'
import type { GenerateResult } from '@/lib/ai'

type Result = GenerateResult & { outputId?: string; saved?: boolean }

type Props = {
  result: Result
  agentId: string
  label?: string
  onUpdate?: (updated: Result) => void
}

export function OutputPanel({ result: initialResult, agentId, label = 'Output', onUpdate }: Props) {
  const [result, setResult]               = useState<Result>(initialResult)
  const [editing, setEditing]             = useState(false)
  const [editedContent, setEditedContent] = useState(initialResult.content)
  const [copied, setCopied]               = useState(false)
  const [approving, setApproving]         = useState(false)

  function handleExport() {
    const blob = new Blob([result.content], { type: 'text/markdown' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${agentId}-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  function update(next: Result) {
    setResult(next)
    onUpdate?.(next)
  }

  function handleStartEdit() {
    setEditedContent(result.content)
    setEditing(true)
  }

  function handleCancelEdit() {
    setEditedContent(result.content)
    setEditing(false)
  }

  function handleSaveEdit() {
    update({ ...result, content: editedContent })
    setEditing(false)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(result.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleApprove() {
    if (!result.outputId) return
    setApproving(true)
    try {
      await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputId: result.outputId }),
      })
      update({ ...result, saved: true })
    } finally {
      setApproving(false)
    }
  }

  return (
    <div className="space-y-3 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white/50 text-sm font-medium">{label}</span>
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

      {/* Content */}
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="w-full min-h-[300px] resize-y bg-white/[0.03] border border-orange-500/30 text-white/90 rounded-xl p-4 text-sm leading-relaxed font-mono focus:border-orange-500/60 focus:outline-none transition-colors"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveEdit}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors"
            >
              <Check className="w-3.5 h-3.5 mr-1.5" />
              Done editing
            </button>
            <button
              onClick={handleCancelEdit}
              className="inline-flex items-center px-3 py-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/5 text-sm font-medium transition-colors"
            >
              <X className="w-3.5 h-3.5 mr-1.5" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="glass rounded-xl p-5 border-white/[0.06]">
          <div className="markdown-output text-sm leading-relaxed">
            <ReactMarkdown>{result.content}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Actions */}
      {!editing && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopy}
            className="inline-flex items-center px-3 py-1.5 rounded-md text-xs text-white/50 hover:text-white hover:bg-white/[0.06] border border-white/10 transition-colors"
          >
            {copied
              ? <><Check className="w-3 h-3 mr-1.5 text-green-400" />Copied</>
              : <><Copy className="w-3 h-3 mr-1.5" />Copy</>}
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center px-3 py-1.5 rounded-md text-xs text-white/50 hover:text-white hover:bg-white/[0.06] border border-white/10 transition-colors"
          >
            <Download className="w-3 h-3 mr-1.5" />Export .md
          </button>

          {!result.saved && (
            <button
              onClick={handleStartEdit}
              className="inline-flex items-center px-3 py-1.5 rounded-md text-xs text-white/50 hover:text-orange-400 hover:border-orange-500/30 hover:bg-orange-500/5 border border-white/10 transition-colors"
            >
              <Pencil className="w-3 h-3 mr-1.5" />
              Edit
            </button>
          )}

          {result.saved ? (
            <span className="inline-flex items-center px-3 py-1.5 rounded-md text-xs text-green-400 bg-green-600/20 border border-green-500/20 font-medium">
              <CheckCircle className="w-3 h-3 mr-1.5" />
              Approved
            </span>
          ) : (
            <button
              onClick={handleApprove}
              disabled={approving || !result.outputId}
              className="btn-glow inline-flex items-center px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
            >
              {approving
                ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Approving...</>
                : <><CheckCircle className="w-3.5 h-3.5 mr-1.5" />Approve & Save</>}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
