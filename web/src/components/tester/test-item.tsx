import type { TestStatus } from '@/hooks/use-adblocker-tester'
import { SITE_COPY, getMethodTagLabel, getTestLabel } from '@/lib/site-content'
import type { TestDefinition } from '@/lib/test-definitions'
import { getMethodTag } from '@/lib/detection-engine'
import { Check, X, Minus, LoaderCircle } from 'lucide-react'

interface TestItemProps {
  test: TestDefinition
  status: TestStatus
}

const STATUS_STYLES = {
  blocked: {
    icon: Check,
    iconClass: 'h-3.5 w-3.5',
    box: 'border-emerald-500 bg-emerald-500/10 text-emerald-400',
    badge: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
    label: SITE_COPY.tester.status.blocked,
  },
  'not-blocked': {
    icon: X,
    iconClass: 'h-3.5 w-3.5',
    box: 'border-red-500 bg-red-500/10 text-red-400',
    badge: 'border-red-500/30 bg-red-500/5 text-red-400',
    label: SITE_COPY.tester.status.notBlocked,
  },
  inconclusive: {
    icon: Minus,
    iconClass: 'h-3.5 w-3.5',
    box: 'border-zinc-600 bg-zinc-600/10 text-zinc-400',
    badge: 'border-zinc-600/30 bg-zinc-600/5 text-zinc-400',
    label: SITE_COPY.tester.status.inconclusive,
  },
  pending: {
    icon: LoaderCircle,
    iconClass: 'h-3 w-3 animate-spin',
    box: 'border-amber-500 bg-amber-500/10 text-amber-400',
    badge: 'border-amber-500/30 bg-amber-500/5 text-amber-400',
    label: SITE_COPY.tester.status.pending,
  },
} as const satisfies Record<TestStatus, unknown>

export function TestItem({ test, status }: TestItemProps) {
  const method = getMethodTag(test)
  const style = STATUS_STYLES[status]
  const StatusIcon = style.icon
  const displayUrl = test.url ?? (test.baitClass ? `.${test.baitClass}` : `#${test.baitId}`)

  return (
    <div className="group flex flex-col gap-2 px-3 py-2.5 text-sm hover:bg-muted/20 sm:flex-row sm:items-center sm:px-4">
      <div className="flex w-full min-w-0 flex-1 gap-3 sm:items-center">
        {/* Status icon */}
        <div
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border sm:mt-0 ${style.box}`}
        >
          <StatusIcon className={style.iconClass} />
        </div>

        {/* Test info */}
        <div className="flex min-w-0 flex-1 flex-col gap-1 font-mono leading-none">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground group-hover:text-primary">
              {getTestLabel(test.name)}
            </span>
            <span className="shrink-0 border border-border bg-muted px-1.5 py-0.5 text-[8px] uppercase tracking-[0.18em] text-muted-foreground">
              {getMethodTagLabel(method)}
            </span>
          </div>
          <div className="truncate text-[9px] leading-tight text-muted-foreground/60 group-hover:text-muted-foreground">
            {displayUrl}
          </div>
        </div>
      </div>

      {/* Result badge */}
      <span
        className={`self-start shrink-0 border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] sm:self-center font-mono ${style.badge}`}
      >
        {style.label}
      </span>
    </div>
  )
}
