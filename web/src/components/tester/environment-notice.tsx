import { WifiOff, TriangleAlert, Info } from 'lucide-react'
import type { EnvironmentCheck } from '@/hooks/use-adblocker-tester'
import { SITE_COPY } from '@/lib/site-content'

interface EnvironmentNoticeProps {
  environment: EnvironmentCheck | null
  inconclusive: number
}

/**
 * Qualifies the grade before the user reads it. Without this, a broken network
 * silently produces a perfect score, since a request that never leaves the
 * browser looks the same whether an extension stopped it or the network did.
 */
export function EnvironmentNotice({
  environment,
  inconclusive,
}: EnvironmentNoticeProps) {
  if (environment?.level === 'offline') {
    return (
      <Notice
        icon={WifiOff}
        tone="border-red-500/30 bg-red-500/5 text-red-400"
        title={SITE_COPY.tester.offlineTitle}
        body={SITE_COPY.tester.offlineDescription}
      />
    )
  }

  if (environment?.level === 'degraded') {
    return (
      <Notice
        icon={TriangleAlert}
        tone="border-amber-500/30 bg-amber-500/5 text-amber-400"
        title={SITE_COPY.tester.degradedTitle}
        body={SITE_COPY.tester.degradedDescription}
        detail={environment.failed}
      />
    )
  }

  if (inconclusive > 0) {
    return (
      <Notice
        icon={Info}
        tone="border-border bg-card text-muted-foreground"
        title={SITE_COPY.tester.stats.inconclusive}
        body={SITE_COPY.tester.inconclusiveNote(inconclusive)}
      />
    )
  }

  return null
}

interface NoticeProps {
  icon: typeof Info
  tone: string
  title: string
  body: string
  detail?: readonly string[]
}

function Notice({ icon: Icon, tone, title, body, detail }: NoticeProps) {
  return (
    <div className={`flex gap-3 border-b px-4 py-3 sm:px-6 md:px-8 ${tone}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]">
          {title}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
        {detail && detail.length > 0 && (
          <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-muted-foreground">
            {detail.map((url) => (
              <li key={url} className="truncate">
                {url}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
