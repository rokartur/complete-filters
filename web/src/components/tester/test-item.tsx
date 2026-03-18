import type { TestStatus } from '@/hooks/use-adblocker-tester'
import { useI18n } from '@/lib/i18n'
import type { TestDefinition } from '@/lib/test-definitions'
import { getMethodTag } from '@/lib/detection-engine'
import { Check, X, Loader2 } from 'lucide-react'

interface TestItemProps {
  test: TestDefinition
  status: TestStatus
}

export function TestItem({ test, status }: TestItemProps) {
  const { t, translateMethodTag, translateTestName } = useI18n()
  const method = getMethodTag(test)
  const displayUrl = test.url ?? (test.baitClass ? `.${test.baitClass}` : `#${test.baitId}`)

  return (
    <div className="group flex flex-col gap-4 px-4 py-4 text-sm hover:bg-muted/30 transition-colors duration-150 sm:flex-row sm:items-start sm:px-6">
      <div className="flex w-full min-w-0 flex-1 gap-4 sm:items-center">
        {/* Status icon */}
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center border transition-colors ${
            status === 'blocked'
              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
              : status === 'not-blocked'
                ? 'border-red-500 bg-red-500/10 text-red-400'
                : 'border-amber-500 bg-amber-500/10 text-amber-400'
          }`}
        >
          {status === 'blocked' ? (
            <Check className="h-4 w-4" />
          ) : status === 'not-blocked' ? (
            <X className="h-4 w-4" />
          ) : (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
        </div>

        {/* Test info */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5 font-mono">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-foreground text-[12px] uppercase tracking-wider group-hover:text-primary transition-colors">
              {translateTestName(test.name)}
            </span>
            <span className="shrink-0 text-[9px] uppercase tracking-widest px-2 py-0.5 border border-border bg-muted text-muted-foreground">
              {translateMethodTag(method)}
            </span>
          </div>
          <div className="truncate text-[10px] text-muted-foreground/60 transition-colors group-hover:text-muted-foreground">
            {displayUrl}
          </div>
        </div>
      </div>

      {/* Result badge */}
      <span
        className={`self-start shrink-0 border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest sm:self-center font-mono ${
          status === 'blocked'
            ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
            : status === 'not-blocked'
              ? 'border-red-500/30 bg-red-500/5 text-red-400'
              : 'border-amber-500/30 bg-amber-500/5 text-amber-400'
        }`}
      >
        {status === 'blocked'
          ? t.tester.status.blocked
          : status === 'not-blocked'
            ? t.tester.status.notBlocked
            : t.tester.status.pending}
      </span>
    </div>
  )
}
