import type { TestStats } from '@/hooks/use-adblocker-tester'
import { useI18n } from '@/lib/i18n'
import { Clock3, ListChecks, ShieldCheck, ShieldX } from 'lucide-react'

interface StatsBarProps {
  stats: TestStats
}

export function StatsBar({ stats }: StatsBarProps) {
  const { t } = useI18n()
  const statItems = [
    {
      key: 'total' as const,
      label: t.tester.stats.total,
      colorClass: 'text-blue-400',
      bgClass: 'from-blue-500/10 to-blue-500/5',
      borderClass: 'border-blue-500/10 hover:border-blue-500/25',
      icon: ListChecks,
    },
    {
      key: 'blocked' as const,
      label: t.tester.stats.blocked,
      colorClass: 'text-emerald-400',
      bgClass: 'from-emerald-500/10 to-emerald-500/5',
      borderClass: 'border-emerald-500/10 hover:border-emerald-500/25',
      icon: ShieldCheck,
    },
    {
      key: 'notBlocked' as const,
      label: t.tester.stats.notBlocked,
      colorClass: 'text-red-400',
      bgClass: 'from-red-500/10 to-red-500/5',
      borderClass: 'border-red-500/10 hover:border-red-500/25',
      icon: ShieldX,
    },
    {
      key: 'pending' as const,
      label: t.tester.stats.pending,
      colorClass: 'text-amber-400',
      bgClass: 'from-amber-500/10 to-amber-500/5',
      borderClass: 'border-amber-500/10 hover:border-amber-500/25',
      icon: Clock3,
    },
  ]

  return (
    <div className="grid grid-cols-2 border-b border-border bg-card sm:grid-cols-2 xl:grid-cols-4">
      {statItems.map((item, index) => {
        const Icon = item.icon
        return (
        <div 
          key={item.key} 
          className={`relative group border-border p-4 sm:p-6 text-left transition-colors duration-200 hover:bg-muted ${index % 2 === 0 ? 'border-r' : ''} ${index < 2 ? 'border-b xl:border-b-0' : ''} xl:border-r`}
        >
          <div className="mb-4 flex items-center gap-2">
            <Icon className={`h-4 w-4 ${item.colorClass}`} />
            <div className="text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground">
              {item.label}
            </div>
          </div>
          <div className={`text-4xl font-display font-bold tabular-nums tracking-tight sm:text-5xl ${item.colorClass}`}>
            {stats[item.key]}
          </div>
        </div>
      )})}
    </div>
  )
}
