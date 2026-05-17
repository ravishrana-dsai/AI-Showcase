'use client'

import { useState } from 'react'
import { AgentWorkspace } from '@/components/shared/AgentWorkspace'

const QUICK_ACTIONS = [
  { label: 'The Padel Intel (weekly newsletter)', prompt: 'Write this week\'s edition of The Padel Intel newsletter. Include: top Player Rating movers this week, a match insight from recent data, a technique tip backed by [Company] analytics, and a community highlight. Keep it engaging and data-rich.' },
  { label: 'Tournament announcement', prompt: 'Write a tournament announcement email for an upcoming [Company] tournament. Include: event details, Player Rating tracking highlight, sign-up CTA, and what players will get (their official Player Rating, match analysis, highlights).' },
  { label: 'New feature broadcast', prompt: 'Write a product update email announcing a new [Company] feature. Tie it back to the Player Rating ecosystem and how it helps players improve. Include 3 subject line variants.' },
  { label: 'Player onboarding (3 emails)', prompt: 'Write a 3-email onboarding sequence for new [Company] players who just got their first Player Rating. Email 1: Welcome + what your Player Rating means. Email 2: How to improve your Player Rating (tips from data). Email 3: Invite to next tournament.' },
  { label: 'Re-engagement campaign', prompt: 'Write a re-engagement email for players who haven\'t played in 30+ days. Remind them of their Player Rating, show what they\'re missing, and give a clear reason to come back.' },
  { label: 'WhatsApp quick update', prompt: 'Write 5 WhatsApp broadcast messages (each under 150 chars) for: tournament reminder, weekly Player Rating update, quick tip, new feature alert, and community milestone.' },
]

function QuickActions({ onSelect }: { onSelect: (text: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div className="mb-2">
      <span className="text-white/40 text-xs font-semibold uppercase tracking-wider">Quick Actions</span>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => {
              const next = selected === action.label ? null : action.label
              setSelected(next)
              onSelect(next ? action.prompt : '')
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              selected === action.label
                ? 'bg-orange-500/20 border-orange-500/30 text-orange-400'
                : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:border-white/20'
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function EmailWhatsAppPage() {
  const [prefill, setPrefill] = useState('')

  return (
    <AgentWorkspace
      tabNumber="07"
      tabName="Email & WhatsApp Studio"
      status="AUTO"
      description="Segmented broadcasts, The Padel Intel newsletter engine, subject line variants."
      inputLabel="Email or WhatsApp brief"
      inputPlaceholder={prefill || 'Select a quick action above, or write your own brief.\n\ne.g. Write a WhatsApp broadcast for tournament results, or draft the next Padel Intel newsletter.'}
      agentId="email-whatsapp"
      extraFields={<QuickActions onSelect={setPrefill} />}
    />
  )
}
