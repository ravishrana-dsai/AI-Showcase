'use client'

import { useEffect, useState } from 'react'
import { Loader2, Save, AlertCircle, CheckCircle, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { getApiUrl } from '@/lib/api'

type ContextInput = {
  id: string
  key: string
  label: string
  value: string
  category: string
}

const CATEGORY_LABELS: Record<string, string> = {
  brand: 'Brand',
  product: 'Product',
  audience: 'Audience',
  competitive: 'Competitive',
}

const CATEGORY_COLORS: Record<string, string> = {
  brand: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  product: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  audience: 'text-green-400 border-green-500/30 bg-green-500/10',
  competitive: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
}

export default function ContextPage() {
  const [inputs, setInputs] = useState<ContextInput[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(getApiUrl('/api/context'))      .then((r) => r.json())
      .then((data) => {
        setInputs(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load context. Make sure your database is connected.')
        setLoading(false)
      })
  }, [])

  function updateValue(key: string, value: string) {
    setInputs((prev) => prev.map((i) => (i.key === key ? { ...i, value } : i)))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(getApiUrl('/api/context'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: inputs }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Failed to save context')
    } finally {
      setSaving(false)
    }
  }

  const grouped = inputs.reduce<Record<string, ContextInput[]>>((acc, input) => {
    if (!acc[input.category]) acc[input.category] = []
    acc[input.category].push(input)
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-white/30 text-sm font-mono">00</span>
              <h1 className="text-white font-bold text-xl">Context Input</h1>
              <StatusBadge status="HUMAN SEEDS" />
            </div>
            <p className="text-white/50 text-sm">
              Brand context and positioning inputs. All 10 agents read from this shared brain.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saved && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle className="w-4 h-4" />
                Saved
              </div>
            )}
            <Button
              onClick={handleSave}
              disabled={saving || loading}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Save Context</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="max-w-2xl mx-auto">
            <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 font-medium mb-1">Database not connected</p>
                <p className="text-red-400/70 text-sm">{error}</p>
                <p className="text-white/40 text-xs mt-2">
                  Set <code className="bg-white/10 px-1 rounded">DATABASE_URL</code> in{' '}
                  <code className="bg-white/10 px-1 rounded">.env</code> and run{' '}
                  <code className="bg-white/10 px-1 rounded">npm run db:migrate && npm run db:seed</code>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl space-y-8">
            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex gap-3">
              <Database className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
              <p className="text-orange-300/80 text-sm">
                All {inputs.length} context fields below are read by every agent tab when generating content.
                Keep this up to date as [Company] evolves.
              </p>
            </div>

            {Object.entries(grouped).map(([category, categoryInputs]) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-4">
                  <span
                    className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded border ${CATEGORY_COLORS[category]}`}
                  >
                    {CATEGORY_LABELS[category] ?? category}
                  </span>
                  <span className="text-white/20 text-xs">{categoryInputs.length} fields</span>
                </div>

                <div className="space-y-4">
                  {categoryInputs.map((input) => (
                    <div key={input.key} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-white/70 text-sm font-medium">
                          {input.label}
                        </label>
                        <span className="text-white/20 text-[10px] font-mono">{input.key}</span>
                      </div>
                      <Textarea
                        value={input.value}
                        onChange={(e) => updateValue(input.key, e.target.value)}
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm resize-none focus:border-orange-500/50 focus:ring-0 min-h-[80px]"
                        rows={input.value.split('\n').length + 1}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
