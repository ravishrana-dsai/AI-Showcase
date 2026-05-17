'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Loader2, Sparkles, Copy, Check, Plus, Search, Users, UserPlus, MessageSquare, CheckCircle, History } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { CostBadge } from '@/components/shared/CostBadge'
import { OutputHistory } from '@/components/shared/OutputHistory'
import { cn } from '@/lib/utils'
import type { GenerateResult } from '@/lib/ai'
import { getApiUrl } from '@/lib/api'

type Contact = {
  id: string
  contactName: string
  contactType: string
  platform: string
  followers: number | null
  lastInteraction: string | null
  notes: string | null
  status: string
}

const STATUS_COLORS: Record<string, string> = {
  prospect: 'bg-yellow-500/20 text-yellow-400',
  active: 'bg-green-500/20 text-green-400',
  partner: 'bg-blue-500/20 text-blue-400',
}

const CONTACT_TYPES = ['influencer', 'court_partner', 'media']
const STATUSES = ['prospect', 'active', 'partner']
const PLATFORMS = ['Instagram', 'TikTok', 'LinkedIn', 'Twitter/X', 'YouTube', 'Other']

export default function InfluencerCRMPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showDMGenerator, setShowDMGenerator] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [historyKey, setHistoryKey] = useState(0)

  // Add form state
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('influencer')
  const [newPlatform, setNewPlatform] = useState('')
  const [newFollowers, setNewFollowers] = useState('')
  const [newStatus, setNewStatus] = useState('prospect')
  const [newNotes, setNewNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // DM generator state
  const [dmResult, setDmResult] = useState<(GenerateResult & { outputId?: string }) | null>(null)
  const [dmLoading, setDmLoading] = useState(false)
  const [dmError, setDmError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchContacts()
  }, [])

  async function fetchContacts() {
    setLoading(true)
    try {
      const res = await fetch(getApiUrl('/api/contacts'))
      if (res.ok) setContacts(await res.json())
    } finally {
      setLoading(false)
    }
  }

  async function handleAddContact() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const res = await fetch(getApiUrl('/api/contacts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: newName,
          contactType: newType,
          platform: newPlatform,
          followers: newFollowers ? parseInt(newFollowers) : null,
          status: newStatus,
          notes: newNotes || null,
        }),
      })
      if (res.ok) {
        await fetchContacts()
        setShowAddForm(false)
        setNewName('')
        setNewPlatform('')
        setNewFollowers('')
        setNewNotes('')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerateDM() {
    if (!selectedContact) return
    setDmLoading(true)
    setDmError(null)
    setDmResult(null)

    const prompt = `Name: ${selectedContact.contactName}. Platform: ${selectedContact.platform}. ${selectedContact.followers ? `Followers: ${selectedContact.followers.toLocaleString()}.` : ''} Type: ${selectedContact.contactType}. Status: ${selectedContact.status}. ${selectedContact.notes ? `Notes: ${selectedContact.notes}` : ''}\n\nGenerate a personalised outreach package for this contact.`

    try {
      const res = await fetch(getApiUrl('/api/agents/influencer-crm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Generation failed')
      setDmResult(await res.json())
      setHistoryKey((k) => k + 1)
    } catch (e) {
      setDmError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setDmLoading(false)
    }
  }

  const filtered = contacts.filter((c) => {
    if (searchQuery && !c.contactName.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (filterStatus && c.status !== filterStatus) return false
    return true
  })

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-white/[0.06] gradient-header">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-orange-500/50 text-sm font-mono font-bold">05</span>
              <h1 className="text-white font-bold text-xl tracking-tight">Influencer & Outreach CRM</h1>
              <StatusBadge status="HUMAN APPROVES" />
            </div>
            <p className="text-white/45 text-sm">Relationship DB, personalised DM drafts, co-content planner.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-1.5 text-white/30 hover:text-white/70 text-sm transition-colors">
              <History className="w-4 h-4" /> History
            </button>
            <button onClick={() => { setShowAddForm(true); setSelectedContact(null); setShowDMGenerator(false) }} className="btn-glow inline-flex items-center px-3 py-1.5 rounded-lg text-white text-xs font-medium">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Contact
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Contact List */}
        <div className="w-[340px] shrink-0 border-r border-white/[0.06] flex flex-col">
          <div className="p-3 border-b border-white/[0.06] space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search contacts..." className="pl-9 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 text-sm rounded-lg h-8" />
            </div>
            <div className="flex gap-1">
              <button onClick={() => setFilterStatus(null)} className={`px-2 py-1 rounded text-[10px] font-medium border transition-all ${!filterStatus ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' : 'bg-white/[0.03] border-white/[0.06] text-white/40'}`}>All</button>
              {STATUSES.map((s) => (
                <button key={s} onClick={() => setFilterStatus(filterStatus === s ? null : s)} className={`px-2 py-1 rounded text-[10px] font-medium border transition-all capitalize ${filterStatus === s ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' : 'bg-white/[0.03] border-white/[0.06] text-white/40'}`}>{s}</button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 text-orange-400 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-white/25 text-sm">{contacts.length === 0 ? 'No contacts yet' : 'No matches'}</p>
              </div>
            ) : (
              filtered.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => { setSelectedContact(contact); setShowAddForm(false); setShowDMGenerator(false); setDmResult(null) }}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-white/[0.04] transition-colors',
                    selectedContact?.id === contact.id ? 'bg-orange-500/10' : 'hover:bg-white/[0.03]'
                  )}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-white/80 text-sm font-medium">{contact.contactName}</span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium capitalize', STATUS_COLORS[contact.status] ?? 'bg-white/10 text-white/40')}>{contact.status}</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/30 text-xs">
                    <span>{contact.platform}</span>
                    {contact.followers && <span>{contact.followers.toLocaleString()} followers</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Detail / Add / DM */}
        <div className="flex-1 overflow-y-auto p-6">
          {showAddForm ? (
            <div className="max-w-md space-y-4 animate-slide-up">
              <h2 className="text-white font-semibold text-lg flex items-center gap-2"><UserPlus className="w-5 h-5 text-orange-400" /> Add Contact</h2>
              <div className="space-y-3">
                <div><Label className="text-white/60 text-sm">Name *</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} className="bg-white/[0.03] border-white/[0.08] text-white rounded-lg mt-1" /></div>
                <div><Label className="text-white/60 text-sm">Type</Label><div className="flex gap-1.5 mt-1">{CONTACT_TYPES.map((t) => (<button key={t} onClick={() => setNewType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-all ${newType === t ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' : 'bg-white/[0.03] border-white/[0.08] text-white/50'}`}>{t.replace('_', ' ')}</button>))}</div></div>
                <div><Label className="text-white/60 text-sm">Platform</Label><div className="flex flex-wrap gap-1.5 mt-1">{PLATFORMS.map((p) => (<button key={p} onClick={() => setNewPlatform(p)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${newPlatform === p ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' : 'bg-white/[0.03] border-white/[0.08] text-white/50'}`}>{p}</button>))}</div></div>
                <div><Label className="text-white/60 text-sm">Followers</Label><Input value={newFollowers} onChange={(e) => setNewFollowers(e.target.value)} placeholder="e.g. 28000" className="bg-white/[0.03] border-white/[0.08] text-white rounded-lg mt-1" /></div>
                <div><Label className="text-white/60 text-sm">Status</Label><div className="flex gap-1.5 mt-1">{STATUSES.map((s) => (<button key={s} onClick={() => setNewStatus(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-all ${newStatus === s ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' : 'bg-white/[0.03] border-white/[0.08] text-white/50'}`}>{s}</button>))}</div></div>
                <div><Label className="text-white/60 text-sm">Notes</Label><Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="e.g. Posts padel tips, based in Spain, engaged audience..." className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 rounded-xl mt-1" /></div>
              </div>
              <button onClick={handleAddContact} disabled={saving || !newName.trim()} className="btn-glow inline-flex items-center px-4 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-40">
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Plus className="w-4 h-4 mr-2" />Save Contact</>}
              </button>
            </div>
          ) : selectedContact ? (
            <div className="space-y-5 animate-slide-up">
              <div className="glass rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-white font-semibold text-lg">{selectedContact.contactName}</h2>
                  <span className={cn('text-xs px-2 py-1 rounded font-medium capitalize', STATUS_COLORS[selectedContact.status])}>{selectedContact.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-white/40">Platform:</span> <span className="text-white/80">{selectedContact.platform}</span></div>
                  <div><span className="text-white/40">Followers:</span> <span className="text-white/80">{selectedContact.followers?.toLocaleString() ?? 'N/A'}</span></div>
                  <div><span className="text-white/40">Type:</span> <span className="text-white/80 capitalize">{selectedContact.contactType.replace('_', ' ')}</span></div>
                  <div><span className="text-white/40">Last Contact:</span> <span className="text-white/80">{selectedContact.lastInteraction ? new Date(selectedContact.lastInteraction).toLocaleDateString() : 'Never'}</span></div>
                </div>
                {selectedContact.notes && <p className="text-white/50 text-sm mt-3 border-t border-white/[0.06] pt-3">{selectedContact.notes}</p>}
              </div>

              <button onClick={() => { setShowDMGenerator(true); handleGenerateDM() }} disabled={dmLoading} className="btn-glow inline-flex items-center px-4 py-2 rounded-lg text-white font-medium text-sm">
                {dmLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating DM...</> : <><MessageSquare className="w-4 h-4 mr-2" />Generate Outreach</>}
              </button>

              {dmError && <div className="p-4 glass rounded-xl border-red-500/20 text-red-400 text-sm">{dmError}</div>}

              {dmResult && (
                <div className="space-y-3 animate-slide-up">
                  <div className="flex items-center justify-between">
                    <span className="text-white/50 text-sm font-medium">Outreach Package</span>
                    <CostBadge model={dmResult.model} inputTokens={dmResult.inputTokens} outputTokens={dmResult.outputTokens} costUsd={dmResult.costUsd} />
                  </div>
                  <div className="glass rounded-xl p-5">
                    <div className="markdown-output text-sm leading-relaxed"><ReactMarkdown>{dmResult.content}</ReactMarkdown></div>
                  </div>
                  <button onClick={async () => { await navigator.clipboard.writeText(dmResult.content); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="inline-flex items-center px-3 py-1.5 rounded-md text-xs text-white/50 hover:text-white border border-white/10 transition-colors">
                    {copied ? <><Check className="w-3 h-3 mr-1.5 text-green-400" />Copied</> : <><Copy className="w-3 h-3 mr-1.5" />Copy</>}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Users className="w-12 h-12 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">Select a contact or add a new one</p>
              </div>
            </div>
          )}

          {showHistory && <div className="mt-6 animate-slide-up"><OutputHistory agentId="influencer-crm" refreshKey={historyKey} /></div>}
        </div>
      </div>
    </div>
  )
}
