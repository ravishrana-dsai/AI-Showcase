import { Zap } from 'lucide-react'
import { formatCost } from '@/lib/format'

type Props = {
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export function CostBadge({ model, inputTokens, outputTokens, costUsd }: Props) {
  const isClaude = model === 'claude-sonnet-4-6'
  return (
    <div className="inline-flex items-center gap-3 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 text-xs">
      <span
        className={
          isClaude
            ? 'text-orange-400 font-semibold'
            : 'text-blue-400 font-semibold'
        }
      >
        {isClaude ? 'Claude' : 'Gemini'}
      </span>
      <span className="text-white/40">
        {inputTokens.toLocaleString()} in / {outputTokens.toLocaleString()} out
      </span>
      <span className="flex items-center gap-1 text-orange-300 font-medium">
        <Zap className="w-3 h-3" />
        {formatCost(costUsd)}
      </span>
    </div>
  )
}
