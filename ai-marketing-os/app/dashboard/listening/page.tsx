'use client'

import { useState } from 'react'
import { AgentWorkspace } from '@/components/shared/AgentWorkspace'

const REPORT_TYPES = [
  { label: 'Monday Brand Brief', prompt: 'Generate this week\'s Monday brand brief for [Company]. Community pulse, trending topics in padel and pickleball, competitor moves, and the top opportunity to act on this week. Format for a 15-minute leadership review.' },
  { label: 'Competitor Analysis', prompt: 'Deep competitor analysis: What are PlaSight ($80M+), SwingVision ($40M+), Wingfield ($25M+), and PlayTomic doing this week? Any new features, partnerships, or marketing moves? How should [Company] respond?' },
  { label: 'Trending Topics', prompt: 'What are the top 5 trending topics in the padel and pickleball community right now? Score each for opportunity (1-10) and suggest how [Company] can ride each trend.' },
  { label: 'Content Opportunity Scan', prompt: 'Scan for content opportunities: What content gaps exist in the padel/pickleball space that [Company] can own? What questions are players asking that no one is answering? What formats are getting the most engagement?' },
  { label: 'Sentiment Check', prompt: 'Community sentiment analysis for [Company]: What are players saying about Player Rating, the app, tournaments, and the overall experience? Positive/neutral/negative breakdown with specific examples.' },
]

function ReportTypeSelector({ onSelect }: { onSelect: (text: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div className="mb-2">
      <span className="text-white/40 text-xs font-semibold uppercase tracking-wider">Intelligence Reports</span>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {REPORT_TYPES.map((r) => (
          <button
            key={r.label}
            onClick={() => {
              const next = selected === r.label ? null : r.label
              setSelected(next)
              onSelect(next ? r.prompt : '')
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              selected === r.label
                ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:border-white/20'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ListeningPage() {
  const [prefill, setPrefill] = useState('')

  return (
    <AgentWorkspace
      tabNumber="04"
      tabName="Listening & Intelligence"
      status="ALWAYS-ON"
      description="Community pulse, trending topics, competitor tracker, opportunity queue. Monday brand brief."
      inputLabel="What to monitor or analyse"
      inputPlaceholder={prefill || 'Select a report type above, or type your own query.\n\ne.g. What are padel and pickleball players talking about this week? Any competitor moves worth noting?'}
      agentId="listening"
      extraFields={<ReportTypeSelector onSelect={setPrefill} />}
    />
  )
}
