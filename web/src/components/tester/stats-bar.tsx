import { AnimatedNumber } from '@/components/animated-number'
import type { TestStats } from '@/hooks/use-adblocker-tester'
import { SITE_COPY } from '@/lib/site-content'
import { CircleDashed, Clock3, ListChecks, ShieldCheck, ShieldX } from 'lucide-react'

interface StatsBarProps {
  stats: TestStats
  isRunning?: boolean
}

export function StatsBar({ stats }: StatsBarProps) {
  const statItems = [
    {
      key: 'total' as const,
      label: SITE_COPY.tester.stats.total,
      colorClass: 'text-blue-400',
      bgClass: 'from-blue-500/10 to-blue-500/5',
      borderClass: 'border-blue-500/10 hover:border-blue-500/25',
      icon: ListChecks,
    },
    {
      key: 'blocked' as const,
      label: SITE_COPY.tester.stats.blocked,
      colorClass: 'text-emerald-400',
      bgClass: 'from-emerald-500/10 to-emerald-500/5',
      borderClass: 'border-emerald-500/10 hover:border-emerald-500/25',
      icon: ShieldCheck,
    },
    {
      key: 'notBlocked' as const,
      label: SITE_COPY.tester.stats.notBlocked,
      colorClass: 'text-red-400',
      bgClass: 'from-red-500/10 to-red-500/5',
      borderClass: 'border-red-500/10 hover:border-red-500/25',
      icon: ShieldX,
    },
    {
      key: 'inconclusive' as const,
      label: SITE_COPY.tester.stats.inconclusive,
      colorClass: 'text-zinc-400',
      bgClass: 'from-zinc-500/10 to-zinc-500/5',
      borderClass: 'border-zinc-500/10 hover:border-zinc-500/25',
      icon: CircleDashed,
    },
    {
      key: 'pending' as const,
      label: SITE_COPY.tester.stats.pending,
      colorClass: 'text-amber-400',
      bgClass: 'from-amber-500/10 to-amber-500/5',
      borderClass: 'border-amber-500/10 hover:border-amber-500/25',
      icon: Clock3,
    },
  ]

  return (
    // gap-px over a border-coloured background draws the dividers, so the
    // layout stays correct for any number of stats and any column count.
    <div className="grid grid-cols-2 gap-px border-b border-border bg-border xl:grid-cols-5">
      {statItems.map((item) => {
        const Icon = item.icon
        return (
        <div
          key={item.key}
          className="relative group bg-card p-3 sm:p-4 text-left hover:bg-muted"
        >
          <div className="mb-2 flex items-center gap-2">
            <Icon className={`h-3.5 w-3.5 ${item.colorClass}`} />
            <div className="text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground">
              {item.label}
            </div>
          </div>
          <div className={`stat-value text-2xl font-display font-bold tabular-nums tracking-tight sm:text-3xl ${item.colorClass}`}>
            <AnimatedNumber value={stats[item.key]} />
          </div>
        </div>
      )})}
    </div>
  )
}
