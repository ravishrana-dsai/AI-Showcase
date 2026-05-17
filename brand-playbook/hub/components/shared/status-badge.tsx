import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-secondary text-muted-foreground',
  pending_review: 'bg-amber-950/50 text-amber-400 border-amber-800',
  approved: 'bg-emerald-950/50 text-emerald-400 border-emerald-800',
  scheduled: 'bg-blue-950/50 text-blue-400 border-blue-800',
  published: 'bg-[var(--brand-muted)] text-[var(--brand)] border-[var(--brand-border)]',
  rejected: 'bg-red-950/50 text-red-400 border-red-800',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
  rejected: 'Rejected',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] font-medium border', STATUS_STYLES[status] ?? 'bg-secondary text-muted-foreground')}
    >
      {STATUS_LABELS[status] ?? status}
    </Badge>
  )
}
