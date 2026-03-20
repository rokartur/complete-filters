import type { TestStatus } from '@/hooks/use-adblocker-tester'
import { SITE_COPY, getMethodTagLabel, getTestLabel } from '@/lib/site-content'
import type { TestDefinition } from '@/lib/test-definitions'
import { getMethodTag } from '@/lib/detection-engine'
import { Check, X, Loader2 } from 'lucide-react'

interface TestItemProps {
  test: TestDefinition
  status: TestStatus
}

export function TestItem({ test, status }: TestItemProps) {
  const method = getMethodTag(test)
  const displayUrl = test.url ?? (test.baitClass ? `.${test.baitClass}` : `#${test.baitId}`)

  return (
    <div className="test-item-enter group flex flex-col gap-2 px-3 py-2.5 text-sm transition-colors duration-150 hover:bg-muted/20 sm:flex-row sm:items-center sm:px-4">
      <div className="flex w-full min-w-0 flex-1 gap-3 sm:items-center">
        {/* Status icon */}
        <div
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border transition-all duration-300 sm:mt-0 ${
            status === 'blocked'
              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
              : status === 'not-blocked'
                ? 'border-red-500 bg-red-500/10 text-red-400'
                : 'border-amber-500 bg-amber-500/10 text-amber-400'
          }`}
        >
          {status === 'blocked' ? (
            <Check className="h-3.5 w-3.5 animate-status-pop" />
          ) : status === 'not-blocked' ? (
            <X className="h-3.5 w-3.5 animate-status-pop" />
          ) : (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
        </div>

        {/* Test info */}
        <div className="flex min-w-0 flex-1 flex-col gap-1 font-mono leading-none">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground transition-colors group-hover:text-primary">
              {getTestLabel(test.name)}
            </span>
            <span className="shrink-0 border border-border bg-muted px-1.5 py-0.5 text-[8px] uppercase tracking-[0.18em] text-muted-foreground transition-colors duration-200">
              {getMethodTagLabel(method)}
            </span>
          </div>
          <div className="truncate text-[9px] leading-tight text-muted-foreground/60 transition-colors group-hover:text-muted-foreground">
            {displayUrl}
          </div>
        </div>
      </div>

      {/* Result badge */}
      <span
        className={`self-start shrink-0 border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] sm:self-center font-mono transition-all duration-300 ${
          status === 'blocked'
            ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
            : status === 'not-blocked'
              ? 'border-red-500/30 bg-red-500/5 text-red-400'
              : 'border-amber-500/30 bg-amber-500/5 text-amber-400'
        }`}
      >
        {status === 'blocked'
          ? SITE_COPY.tester.status.blocked
          : status === 'not-blocked'
            ? SITE_COPY.tester.status.notBlocked
            : SITE_COPY.tester.status.pending}
      </span>
    </div>
  )
}
