'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Sparkles,
  Rss,
  CalendarDays,
  ClipboardCheck,
  Settings,
  Zap,
} from 'lucide-react'

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/studio', label: 'Studio', icon: Sparkles },
  { href: '/intelligence', label: 'Intelligence', icon: Rss },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/queue', label: 'Queue', icon: ClipboardCheck },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-border bg-card h-screen sticky top-0">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="w-7 h-7 rounded-sm bg-[var(--brand)] flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4 text-[var(--brand-foreground)]" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground leading-none tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>[Company]</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 tracking-widest uppercase">Brand Hub</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-[var(--brand-muted)] text-[var(--brand)] font-medium border border-[var(--brand-border)]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-border">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Know Your Game.
        </p>
      </div>
    </aside>
  )
}
