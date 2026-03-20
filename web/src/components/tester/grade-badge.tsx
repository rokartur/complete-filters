import type { GradeInfo } from '@/hooks/use-adblocker-tester'
import { SITE_COPY } from '@/lib/site-content'

interface GradeBadgeProps {
  grade: GradeInfo
}

export function GradeBadge({ grade }: GradeBadgeProps) {
  return (
    <div className="animate-fade-in-up border-b border-border bg-card">
      <div className="mx-auto flex flex-col gap-6 px-4 py-8 md:flex-row md:items-start md:justify-between md:px-8 md:py-10">
        <div className="space-y-4 text-left max-w-xl">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${grade.colorClass.replace('text-', 'bg-')}`} />
            <div className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
              {SITE_COPY.tester.gradeTitle}
            </div>
          </div>
          <h3 className="text-3xl font-display font-black uppercase text-foreground sm:text-4xl">
            {SITE_COPY.tester.gradeLabels[grade.labelKey]}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground font-mono">
            {SITE_COPY.tester.gradeSummary(grade.pct)}
          </p>
        </div>

        <div className="flex items-center gap-6 border border-border bg-background p-6 shrink-0 mt-4 md:mt-0 animate-glow-pulse">
          <div
            className={`grade-glow animate-stamp-in flex h-20 w-20 items-center justify-center border border-current text-4xl font-display font-black sm:h-24 sm:w-24 sm:text-5xl ${grade.colorClass}`}
          >
            {grade.grade}
          </div>
          <div className="text-left font-mono">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{SITE_COPY.tester.finalScore}</div>
            <div className="mt-1 text-4xl font-bold tabular-nums text-foreground tracking-tighter">
              {grade.pct}%
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{SITE_COPY.tester.blockingEffectiveness}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
