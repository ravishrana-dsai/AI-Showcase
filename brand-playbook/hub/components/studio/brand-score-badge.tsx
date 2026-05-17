import { cn } from '@/lib/utils'
import type { BrandCheckResult } from '@/lib/agents/types'

interface BrandScoreBadgeProps {
  result: BrandCheckResult
  compact?: boolean
}

export function BrandScoreBadge({ result, compact = false }: BrandScoreBadgeProps) {
  const color = result.score >= 80 ? 'brand-score-high' : result.score >= 60 ? 'brand-score-mid' : 'brand-score-low'

  if (compact) {
    return (
      <span className={cn('text-sm font-bold tabular-nums', color)}>
        {result.score}/100
      </span>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Brand score</span>
        <span className={cn('text-2xl font-bold tabular-nums', color)}>{result.score}<span className="text-base font-normal text-muted-foreground">/100</span></span>
      </div>

      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', result.score >= 80 ? 'bg-[var(--brand)]' : result.score >= 60 ? 'bg-[var(--brand-warning)]' : 'bg-[var(--brand-danger)]')}
          style={{ width: `${result.score}%` }}
        />
      </div>

      <p className="text-xs text-muted-foreground">{result.summary}</p>

      {result.issues.length > 0 && (
        <div className="space-y-1.5">
          {result.issues.slice(0, 4).map((issue, i) => (
            <div key={i} className={cn('text-xs px-2.5 py-1.5 rounded border', issue.severity === 'critical' ? 'bg-red-950/40 border-red-800 text-red-300' : 'bg-amber-950/40 border-amber-800 text-amber-300')}>
              <span className="font-medium">{issue.type.replace('_', ' ')}:</span> {issue.suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
