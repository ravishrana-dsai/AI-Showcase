'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Database,
  Palette,
  Share2,
  Rocket,
  Radio,
  Users,
  Search,
  Mail,
  Trophy,
  Building2,
  BarChart3,
  DollarSign,
  Zap,
} from 'lucide-react'
import { AGENT_TABS, AgentTab } from '@/lib/types'
import { cn } from '@/lib/utils'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Database, Palette, Share2, Rocket, Radio, Users, Search, Mail, Trophy, Building2, BarChart3,
}

function TabItem({ tab, isActive }: { tab: AgentTab; isActive: boolean }) {
  const Icon = iconMap[tab.icon]
  const isAlwaysOn = tab.status === 'ALWAYS-ON'

  return (
    <Link
      href={tab.href}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group relative',
        isActive
          ? 'bg-gradient-to-r from-orange-500/15 to-transparent'
          : 'hover:bg-white/[0.04]'
      )}
    >
      {/* Active indicator bar */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-orange-500 rounded-r-full" />
      )}

      {/* Icon with gradient background */}
      <div
        className={cn(
          'flex items-center justify-center w-7 h-7 rounded-md shrink-0 transition-all duration-200',
          isActive
            ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/20'
            : 'bg-white/[0.06] text-white/50 group-hover:bg-white/[0.1] group-hover:text-white/70'
        )}
      >
        {Icon ? (
          <Icon className="w-3.5 h-3.5" />
        ) : (
          <span className="text-[10px] font-bold">{tab.number}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'text-[13px] font-medium truncate transition-colors duration-200',
            isActive ? 'text-white' : 'text-white/60 group-hover:text-white/85'
          )}
        >
          {tab.name}
        </div>
      </div>

      {/* Status indicators */}
      {isAlwaysOn && (
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse-dot shrink-0" />
      )}

      <span
        className={cn(
          'text-[9px] font-mono shrink-0 transition-colors',
          isActive ? 'text-orange-400/70' : 'text-white/20'
        )}
      >
        {tab.number}
      </span>
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-[300px] shrink-0 bg-[#0A0F1E] border-r border-white/[0.06] flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/25">
            <Zap className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-[15px] leading-tight tracking-tight">
              [Company]
            </div>
            <div className="text-white/35 text-[11px] font-medium">Marketing OS</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">
        <div className="px-2 py-1.5 mb-1">
          <span className="text-white/25 text-[10px] uppercase tracking-[0.15em] font-semibold">
            Agent Tabs
          </span>
        </div>
        {AGENT_TABS.map((tab) => (
          <TabItem key={tab.id} tab={tab} isActive={pathname === tab.href} />
        ))}

        <div className="px-2 pt-4 pb-1.5">
          <span className="text-white/25 text-[10px] uppercase tracking-[0.15em] font-semibold">
            System
          </span>
        </div>
        <Link
          href="/dashboard/cost-dashboard"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group relative',
            pathname === '/dashboard/cost-dashboard'
              ? 'bg-gradient-to-r from-orange-500/15 to-transparent'
              : 'hover:bg-white/[0.04]'
          )}
        >
          {pathname === '/dashboard/cost-dashboard' && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-orange-500 rounded-r-full" />
          )}
          <div
            className={cn(
              'flex items-center justify-center w-7 h-7 rounded-md shrink-0 transition-all',
              pathname === '/dashboard/cost-dashboard'
                ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/20'
                : 'bg-white/[0.06] text-white/50 group-hover:bg-white/[0.1]'
            )}
          >
            <DollarSign className="w-3.5 h-3.5" />
          </div>
          <span
            className={cn(
              'text-[13px] font-medium transition-colors',
              pathname === '/dashboard/cost-dashboard'
                ? 'text-white'
                : 'text-white/60 group-hover:text-white/85'
            )}
          >
            Cost Dashboard
          </span>
        </Link>
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/[0.06]">
        <div className="flex items-center justify-between">
          <span className="text-white/20 text-[10px]">v1.0</span>
          <span className="text-white/20 text-[10px]">[Company]</span>
        </div>
      </div>
    </aside>
  )
}
