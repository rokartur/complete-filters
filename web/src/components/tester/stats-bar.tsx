import type { TestStats } from '@/hooks/use-adblocker-tester'
import { useI18n } from '@/lib/i18n'
import { AlertTriangle, Clock3, ListChecks, ShieldCheck, ShieldX } from 'lucide-react'

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
      key: 'inconclusive' as const,
      label: t.tester.stats.inconclusive,
      colorClass: 'text-orange-300',
      bgClass: 'from-orange-500/10 to-orange-500/5',
      borderClass: 'border-orange-500/10 hover:border-orange-500/25',
      icon: AlertTriangle,
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
    <div className="grid grid-cols-2 gap-2 border-b border-border bg-background p-3 sm:grid-cols-3 sm:gap-3 sm:p-5 xl:grid-cols-5">
      {statItems.map((item) => {
        const Icon = item.icon

        return (
        <div 
          key={item.key} 
          className={`relative group rounded-xl bg-linear-to-b ${item.bgClass} border ${item.borderClass} p-3 text-center transition-all duration-300 hover:scale-[1.02] sm:p-5`}
        >
          <div className="mb-2 flex justify-center sm:mb-3">
            <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${item.colorClass} opacity-50`} />
          </div>
          <div className={`text-3xl font-bold tabular-nums tracking-tight font-display sm:text-4xl ${item.colorClass}`}>
            {stats[item.key]}
          </div>
          <div className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:mt-2 sm:text-[10px]">
            {item.label}
          </div>
        </div>
      )})}
    </div>
  )
}
