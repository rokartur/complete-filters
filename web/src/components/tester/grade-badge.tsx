import type { GradeInfo } from '@/hooks/use-adblocker-tester'

interface GradeBadgeProps {
  grade: GradeInfo
}

export function GradeBadge({ grade }: GradeBadgeProps) {
  return (
    <div className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold tracking-[0.22em] uppercase text-muted-foreground">
            Ocena ochrony
          </div>
          <h3 className="text-2xl font-display font-bold text-foreground">
            {grade.label}
          </h3>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Na podstawie zakończonych testów filtr zablokował {grade.pct}% sprawdzanych
            elementów.
          </p>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4">
          <div
            className={`inline-flex h-16 w-16 items-center justify-center rounded-xl border text-3xl font-display font-extrabold ${grade.colorClass}`}
          >
            {grade.grade}
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Wynik końcowy</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {grade.pct}%
            </div>
            <div className="text-xs text-muted-foreground">skuteczności blokowania</div>
          </div>
        </div>
      </div>
    </div>
  )
}
