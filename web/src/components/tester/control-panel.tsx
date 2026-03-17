import type { FilterType } from '@/hooks/use-adblocker-tester'
import { Button } from '@/components/ui/button'
import { Play, RotateCcw, Loader2 } from 'lucide-react'

interface ControlPanelProps {
  isRunning: boolean
  filter: FilterType
  onStart: () => void
  onReset: () => void
  onFilterChange: (filter: FilterType) => void
}

const filterOptions: Array<{ value: FilterType; label: string }> = [
  { value: 'all', label: 'Wszystkie' },
  { value: 'blocked', label: 'Zablokowane' },
  { value: 'not-blocked', label: 'Niezablokowane' },
  { value: 'pending', label: 'Oczekujące' },
]

export function ControlPanel({
  isRunning,
  filter,
  onStart,
  onReset,
  onFilterChange,
}: ControlPanelProps) {
  return (
    <div className="space-y-5 px-6 py-7 border-b border-border bg-card/20">
      {/* Action buttons */}
      <div className="flex flex-wrap justify-center gap-3">
        <Button
          onClick={onStart}
          disabled={isRunning}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold font-display tracking-wide shadow-lg shadow-primary/20 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 px-6"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testowanie...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Uruchom testy
            </>
          )}
        </Button>

        <Button variant="outline" onClick={onReset} disabled={isRunning} className="bg-card/50 backdrop-blur-sm border-border/80 hover:border-primary/20 transition-all duration-200 hover:-translate-y-0.5">
          <RotateCcw className="mr-2 h-4 w-4" />
          Resetuj
        </Button>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap justify-center gap-2">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
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
