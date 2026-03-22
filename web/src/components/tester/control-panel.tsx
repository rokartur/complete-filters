import type { FilterType, TestPhase } from '@/hooks/use-adblocker-tester'
import { Button } from '@/components/ui/button'
import { SITE_COPY } from '@/lib/site-content'
import { Play, RotateCcw, Loader2 } from 'lucide-react'

interface ControlPanelProps {
  isRunning: boolean
  phase: TestPhase
  testedCount: number
  totalTests: number
  filter: FilterType
  onStart: () => void
  onReset: () => void
  onFilterChange: (filter: FilterType) => void
}

export function ControlPanel({
  isRunning,
  phase,
  testedCount,
  totalTests,
  filter,
  onStart,
  onReset,
  onFilterChange,
}: ControlPanelProps) {
  const filterOptions: Array<{ value: FilterType; label: string }> = [
    { value: 'all', label: SITE_COPY.tester.filterAll },
    { value: 'blocked', label: SITE_COPY.tester.filterBlocked },
    { value: 'not-blocked', label: SITE_COPY.tester.filterNotBlocked },
    { value: 'pending', label: SITE_COPY.tester.filterPending },
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
            className="btn-press rounded-none border-0 border-l border-border hover:bg-primary hover:text-primary-foreground bg-primary/10 text-primary font-mono font-bold uppercase tracking-widest px-8 md:px-12 h-auto py-4 sm:py-0 transition-all duration-200"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {phase === 'retrying'
                  ? SITE_COPY.tester.verifying
                  : `${SITE_COPY.tester.testing} (${testedCount}/${totalTests})`}
              </>
            ) : (
              <>
                <Play className="mr-3 h-4 w-4" />
                {SITE_COPY.tester.runTests}
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            onClick={onReset}
            className="btn-press rounded-none border-0 border-l border-border hover:bg-destructive hover:text-destructive-foreground font-mono font-bold uppercase tracking-widest px-6 h-auto py-4 sm:py-0 transition-all duration-200"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
