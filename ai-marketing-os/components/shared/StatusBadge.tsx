import { AgentStatus, STATUS_COLORS } from '@/lib/types'
import { cn } from '@/lib/utils'

export function StatusBadge({ status }: { status: AgentStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border',
        STATUS_COLORS[status]
      )}
    >
      {status}
    </span>
  )
}
