import type { GradeInfo } from '@/hooks/use-adblocker-tester'
import { SITE_COPY } from '@/lib/site-content'

interface GradeBadgeProps {
  grade: GradeInfo
}

export function GradeBadge({ grade }: GradeBadgeProps) {
  return (
    <div className="border-b border-border bg-card">
      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 md:px-8">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${grade.colorClass.replace('text-', 'bg-')}`} />
            <div className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
              {SITE_COPY.tester.gradeTitle}
            </div>
          </div>
          <h3 className="text-xl font-display font-black uppercase text-foreground sm:text-2xl">
            {SITE_COPY.tester.gradeLabels[grade.labelKey]}
          </h3>
          <p className="text-xs text-muted-foreground font-mono">
            {SITE_COPY.tester.gradeSummary(grade.pct)}
          </p>
        </div>

        <div className="flex items-center gap-4 border border-border bg-background p-4 shrink-0">
          <div
            className={`flex h-14 w-14 items-center justify-center border border-current text-2xl font-display font-black sm:h-16 sm:w-16 sm:text-3xl ${grade.colorClass}`}
          >
            {grade.grade}
          </div>
          <div className="text-left font-mono">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{SITE_COPY.tester.finalScore}</div>
            <div className="text-2xl font-bold tabular-nums text-foreground tracking-tighter">
              {grade.pct}%
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{SITE_COPY.tester.blockingEffectiveness}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
