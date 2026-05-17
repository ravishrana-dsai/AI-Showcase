'use client'

import { useState } from 'react'
import { AgentWorkspace } from '@/components/shared/AgentWorkspace'

const PRESETS = [
  {
    label: 'Brand Manifesto',
    prompt: 'Write a [Company] brand manifesto. 200-300 words. Lead with why padel and pickleball matter, then why data changes the game, then the [Company] promise. End with a rallying statement. Bold, human, intelligent tone.',
  },
  {
    label: 'Taglines (10 variations)',
    prompt: 'Generate 10 tagline options for [Company]. Mix short punchy options (3-5 words) with longer brand lines (8-12 words). Angles: Player Rating rating system, data-driven play, the feeling of improvement, community, padel + pickleball. No em dashes.',
  },
  {
    label: 'Brand Voice & Tone',
    prompt: 'Define [Company]\'s brand voice and tone guide. Cover: personality adjectives (5), what we sound like vs. what we never sound like, 3 voice principles with examples, tone variations by channel (social, email, in-app, B2B pitch). Include do/don\'t examples.',
  },
  {
    label: 'Competitive Positioning',
    prompt: 'Write [Company]\'s competitive positioning vs. PlaSight, SwingVision, Wingfield, and PlayTomic. For each: their positioning, our differentiated angle, one-line reframe. End with our core positioning statement and why we win.',
  },
  {
    label: 'Elevator Pitch',
    prompt: 'Write 3 versions of the [Company] elevator pitch: (1) 30-second investor pitch, (2) 60-second player pitch, (3) 30-second court partner pitch. Each should lead with the problem, introduce Player Rating as the solution, and close with a hook.',
  },
  {
    label: 'Mission & Vision',
    prompt: 'Write [Company]\'s mission statement (what we do today) and vision statement (what we\'re building toward). Each should be 1-2 sentences, bold, and specific enough to be actionable. Include 3 supporting brand values with one-line definitions.',
  },
]

function PresetButtons({ onSelect }: { onSelect: (text: string) => void }) {
  const [active, setActive] = useState<string | null>(null)

  return (
    <div className="mb-2">
      <span className="text-white/40 text-xs font-semibold uppercase tracking-wider">Quick Presets</span>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              const next = active === p.label ? null : p.label
              setActive(next)
              onSelect(next ? p.prompt : '')
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              active === p.label
                ? 'bg-orange-500/20 border-orange-500/30 text-orange-400'
                : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:border-white/20'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function BrandIdentityPage() {
  const [prefill, setPrefill] = useState('')

  return (
    <AgentWorkspace
      tabNumber="01"
      tabName="Brand Identity Studio"
      status="HUMAN SEEDS"
      description="Voice engine, tagline generator, brand bible sections, and positioning copy. Foundation for all tabs."
      inputLabel="What do you need?"
      inputPlaceholder={prefill || 'Select a preset above, or describe what you need.\n\ne.g. Generate 5 tagline options for [Company]\'s Q2 launch. Focus on the Player Rating angle and player empowerment across padel and pickleball.'}
      agentId="brand-identity"
      extraFields={<PresetButtons onSelect={setPrefill} />}
    />
  )
}
