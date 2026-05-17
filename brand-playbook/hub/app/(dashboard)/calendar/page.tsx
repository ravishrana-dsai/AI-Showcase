'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isToday, isSameDay,
} from 'date-fns'
import type { ContentItem } from '@/lib/db/schema'

interface ScheduledEntry {
  schedule: { id: string; scheduledAt: string; platform: string; status: string }
  content: ContentItem
}

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: 'bg-blue-950/60 border-blue-700 text-blue-300',
  blog: 'bg-purple-950/60 border-purple-700 text-purple-300',
  reddit: 'bg-orange-950/60 border-orange-700 text-orange-300',
  newsletter: 'bg-green-950/60 border-green-700 text-green-300',
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [scheduled, setScheduled] = useState<ScheduledEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/schedule')
      const data = await res.json() as ScheduledEntry[]
      setScheduled(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }),
  })

  function getItemsForDay(day: Date) {
    return scheduled.filter((s) => isSameDay(new Date(s.schedule.scheduledAt), day))
  }

  const selectedItems = selected ? getItemsForDay(selected) : []

  return (
    <div>
      <Header
        title="Content Calendar"
        description="See what's scheduled. Click a day to view details."
      />

      <div className="p-6 flex gap-6">
        <div className="flex-1">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">{format(currentMonth, 'MMMM yyyy')}</h2>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="w-8 h-8 p-0" onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-xs px-2" onClick={() => setCurrentMonth(new Date())}>Today</Button>
                <Button variant="ghost" size="sm" className="w-8 h-8 p-0" onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="text-center text-xs text-muted-foreground py-3 font-medium">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 border-t border-border">
              {days.map((day) => {
                const items = getItemsForDay(day)
                const isCurrentMonth = isSameMonth(day, currentMonth)
                const isSelectedDay = selected && isSameDay(day, selected)
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelected(isSameDay(day, selected ?? new Date(0)) ? null : day)}
                    className={cn(
                      'min-h-[80px] p-2 text-left border-b border-r border-border transition-colors',
                      !isCurrentMonth && 'opacity-30',
                      isToday(day) && 'bg-[var(--brand)]/5',
                      isSelectedDay && 'bg-[var(--brand)]/10',
                      'hover:bg-secondary'
                    )}
                  >
                    <span className={cn(
                      'text-xs font-medium inline-flex w-6 h-6 items-center justify-center rounded-full',
                      isToday(day) ? 'bg-[var(--brand)] text-[var(--brand-foreground)]' : 'text-muted-foreground'
                    )}>
                      {format(day, 'd')}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {items.slice(0, 3).map((s, i) => (
                        <div key={i} className={cn('text-[9px] px-1.5 py-0.5 rounded border truncate', PLATFORM_COLORS[s.schedule.platform] ?? 'bg-secondary border-border text-muted-foreground')}>
                          {s.content.title.substring(0, 20)}
                        </div>
                      ))}
                      {items.length > 3 && <div className="text-[9px] text-muted-foreground">+{items.length - 3} more</div>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="w-72 shrink-0">
          {selected ? (
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {format(selected, 'EEEE, d MMMM')}
              </h3>
              {selectedItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing scheduled this day.</p>
              ) : (
                <div className="space-y-3">
                  {selectedItems.map((s) => (
                    <div key={s.schedule.id} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn('text-[10px] border', PLATFORM_COLORS[s.schedule.platform]?.split(' ')[2] ?? '')}>
                          {s.schedule.platform}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(s.schedule.scheduledAt), 'HH:mm')}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-foreground">{s.content.title}</p>
                      <StatusBadge status={s.schedule.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">Upcoming</h3>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-secondary rounded animate-pulse" />)}
                </div>
              ) : scheduled.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing scheduled. Approve content in the Queue to schedule it.</p>
              ) : (
                <div className="space-y-2.5">
                  {scheduled.slice(0, 8).map((s) => (
                    <div key={s.schedule.id} className="text-xs">
                      <p className="text-muted-foreground">{format(new Date(s.schedule.scheduledAt), 'EEE d MMM')}</p>
                      <p className="text-foreground font-medium truncate">{s.content.title}</p>
                      <Badge variant="outline" className={cn('text-[9px] mt-0.5 border', PLATFORM_COLORS[s.schedule.platform]?.split(' ')[2] ?? '')}>
                        {s.schedule.platform}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
