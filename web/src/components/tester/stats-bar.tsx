import type { TestStats } from '@/hooks/use-adblocker-tester'
import { Clock3, ListChecks, ShieldCheck, ShieldX } from 'lucide-react'

interface StatsBarProps {
  stats: TestStats
}

const statItems = [
  {
    key: 'total' as const,
    label: 'Testów',
    colorClass: 'text-blue-400',
    bgClass: 'from-blue-500/10 to-blue-500/5',
    borderClass: 'border-blue-500/10 hover:border-blue-500/25',
    icon: ListChecks,
  },
  {
    key: 'blocked' as const,
    label: 'Zablokowane',
    colorClass: 'text-emerald-400',
    bgClass: 'from-emerald-500/10 to-emerald-500/5',
    borderClass: 'border-emerald-500/10 hover:border-emerald-500/25',
    icon: ShieldCheck,
  },
  {
    key: 'notBlocked' as const,
    label: 'Niezablokowane',
    colorClass: 'text-red-400',
    bgClass: 'from-red-500/10 to-red-500/5',
    borderClass: 'border-red-500/10 hover:border-red-500/25',
    icon: ShieldX,
  },
  {
    key: 'pending' as const,
    label: 'Oczekujące',
    colorClass: 'text-amber-400',
    bgClass: 'from-amber-500/10 to-amber-500/5',
    borderClass: 'border-amber-500/10 hover:border-amber-500/25',
    icon: Clock3,
  },
]

export function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-4 bg-background border-b border-border">
      {statItems.map((item) => {
        const Icon = item.icon

        return (
        <div 
          key={item.key} 
          className={`relative group rounded-xl bg-linear-to-b ${item.bgClass} border ${item.borderClass} p-5 text-center transition-all duration-300 hover:scale-[1.02]`}
        >
          <div className="mb-3 flex justify-center">
            <Icon className={`h-5 w-5 ${item.colorClass} opacity-50`} />
          </div>
          <div className={`text-4xl font-bold tabular-nums tracking-tight font-display ${item.colorClass}`}>
            {stats[item.key]}
          </div>
          <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {item.label}
          </div>
        </div>
      )})}
    </div>
  )
}
