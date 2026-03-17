import type { TestStatus } from '@/hooks/use-adblocker-tester'
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
    <div className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-muted/10 transition-colors duration-150 group">
      {/* Status icon */}
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
          status === 'blocked'
            ? 'bg-emerald-500/10 text-emerald-400'
            : status === 'not-blocked'
              ? 'bg-red-500/10 text-red-400'
              : 'bg-amber-500/10 text-amber-400'
        }`}
      >
        {status === 'blocked' ? (
          <Check className="h-3.5 w-3.5" />
        ) : status === 'not-blocked' ? (
          <X className="h-3.5 w-3.5" />
        ) : (
          <Loader2 className="h-3 w-3 animate-spin" />
        )}
      </div>

      {/* Test info */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground/85 truncate text-[13px] group-hover:text-foreground transition-colors">{test.name}</span>
          <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-muted/50 text-muted-foreground/70 ring-1 ring-border/30">
            {method}
          </span>
        </div>
        <div className="truncate font-mono text-[11px] text-muted-foreground/40">
          {displayUrl}
        </div>
      </div>

      {/* Result badge */}
      <span
        className={`shrink-0 text-[11px] font-semibold py-0.5 px-2.5 rounded-full ${
          status === 'blocked'
            ? 'bg-emerald-500/10 text-emerald-400'
            : status === 'not-blocked'
              ? 'bg-red-500/10 text-red-400'
              : 'bg-amber-500/10 text-amber-400'
        }`}
      >
        {status === 'blocked'
          ? 'Zablokowane'
          : status === 'not-blocked'
            ? 'Niezablokowane'
            : 'Oczekuje'}
      </span>
    </div>
  )
}
