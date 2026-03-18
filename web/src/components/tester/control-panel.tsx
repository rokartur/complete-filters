import type { FilterType } from '@/hooks/use-adblocker-tester'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { Play, RotateCcw, Loader2 } from 'lucide-react'

interface ControlPanelProps {
  isRunning: boolean
  filter: FilterType
  onStart: () => void
  onReset: () => void
  onFilterChange: (filter: FilterType) => void
}

export function ControlPanel({
  isRunning,
  filter,
  onStart,
  onReset,
  onFilterChange,
}: ControlPanelProps) {
  const { t } = useI18n()
  const filterOptions: Array<{ value: FilterType; label: string }> = [
    { value: 'all', label: t.tester.filterAll },
    { value: 'blocked', label: t.tester.filterBlocked },
    { value: 'not-blocked', label: t.tester.filterNotBlocked },
    { value: 'pending', label: t.tester.filterPending },
  ]

  return (
    <div className="border-b border-border bg-card font-mono">
      <div className="flex flex-col sm:flex-row justify-between items-stretch">
        <div className="flex flex-1 border-b sm:border-b-0 sm:border-r border-border">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              className={`flex-1 px-3 py-4 text-[10px] md:text-xs font-semibold uppercase tracking-widest transition-colors duration-200 cursor-pointer border-r border-border last:border-r-0 ${
                filter === opt.value
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
              onClick={() => onFilterChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex shrink-0">
          <Button
            onClick={onStart}
            disabled={isRunning}
            className="rounded-none border-0 border-l border-border hover:bg-primary hover:text-primary-foreground bg-primary/10 text-primary font-mono font-bold uppercase tracking-widest px-8 md:px-12 h-auto py-4 sm:py-0 transition-colors"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.tester.testing}
              </>
            ) : (
              <>
                <Play className="mr-3 h-4 w-4" />
                {t.tester.runTests}
              </>
            )}
          </Button>

          <Button 
            variant="ghost" 
            onClick={onReset} 
            disabled={isRunning} 
            className="rounded-none border-0 border-l border-border hover:bg-destructive hover:text-destructive-foreground font-mono font-bold uppercase tracking-widest px-6 h-auto py-4 sm:py-0 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
