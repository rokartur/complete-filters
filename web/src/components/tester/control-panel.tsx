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
    { value: 'inconclusive', label: t.tester.filterInconclusive },
    { value: 'pending', label: t.tester.filterPending },
  ]

  return (
    <div className="space-y-4 border-b border-border bg-card/20 px-4 py-5 sm:space-y-5 sm:px-6 sm:py-7">
      {/* Action buttons */}
      <div className="flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
        <Button
          onClick={onStart}
          disabled={isRunning}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold font-display tracking-wide shadow-lg shadow-primary/20 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 px-6 sm:w-auto"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t.tester.testing}
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              {t.tester.runTests}
            </>
          )}
        </Button>

        <Button variant="outline" onClick={onReset} disabled={isRunning} className="w-full bg-card/50 backdrop-blur-sm border-border/80 hover:border-primary/20 transition-all duration-200 hover:-translate-y-0.5 sm:w-auto">
          <RotateCcw className="mr-2 h-4 w-4" />
          {t.tester.reset}
        </Button>
      </div>

      {/* Filter pills */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            className={`px-3 py-2 sm:px-4 sm:py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
              filter === opt.value
                ? 'bg-foreground text-background shadow-md shadow-foreground/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent hover:border-border/50'
            }`}
            onClick={() => onFilterChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
