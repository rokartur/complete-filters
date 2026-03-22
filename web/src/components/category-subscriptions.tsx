import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  FILTER_SUBSCRIPTION_CATEGORIES,
  getFilterSubscriptionUrl,
} from '@/lib/filter-subscriptions'
import { SITE_COPY, getAbpSubscriptionUrl } from '@/lib/site-content'
import { Check, ChevronDown, Copy, ExternalLink } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Clipboard helper (module-scoped, never re-created)                */
/* ------------------------------------------------------------------ */

async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard unavailable')
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'

  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!copied) {
    throw new Error('Copy failed')
  }
}

/* ------------------------------------------------------------------ */
/*  Static data (computed once at module load — never causes renders) */
/* ------------------------------------------------------------------ */

const COPY_FEEDBACK_MS = 2200

const categories = FILTER_SUBSCRIPTION_CATEGORIES.map((category) => {
  const subscriptionUrl = getFilterSubscriptionUrl(category.fileName)
  return {
    ...category,
    subscriptionUrl,
    abpSubscriptionUrl: getAbpSubscriptionUrl(
      subscriptionUrl,
      `Complete Filters — ${category.title}`,
    ),
  }
})

const allCategoryLinks = categories
  .map((c) => c.subscriptionUrl)
  .join('\n')

/** Pre-computed style objects so we never allocate in render. */
const CARD_DELAY_EXPANDED = categories.map(
  (_, i) => ({ transitionDelay: `${i * 30}ms` }) as const,
)
const CARD_DELAY_COLLAPSED = { transitionDelay: '0ms' } as const

/* ------------------------------------------------------------------ */
/*  CategoryCard — memoised, only re-renders when its own props change */
/* ------------------------------------------------------------------ */

interface CategoryCardProps {
  id: string
  index: number
  fileName: string
  title: string
  description: string
  subscriptionUrl: string
  abpSubscriptionUrl: string
  animateIn: boolean
  isExpanded: boolean
}

const CategoryCard = memo(function CategoryCard({
  index,
  fileName,
  title,
  description,
  subscriptionUrl,
  abpSubscriptionUrl,
  animateIn,
  isExpanded,
}: CategoryCardProps) {
  return (
    <article
      className={`category-card flex h-full flex-col border border-border bg-card p-4 transition-[opacity,transform] duration-500 ease-out sm:p-5 hover:bg-muted/20 ${
        animateIn ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
      style={isExpanded ? CARD_DELAY_EXPANDED[index] : CARD_DELAY_COLLAPSED}
    >
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-mono font-medium uppercase tracking-[0.24em] text-muted-foreground">
            {fileName}
          </p>
          <h3 className="mt-1 font-display text-lg font-bold uppercase tracking-wide text-foreground">
            {title}
          </h3>
        </div>
        <span className="border border-border bg-muted/40 px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>

      <p className="mb-4 flex-1 text-xs font-mono leading-relaxed text-muted-foreground">
        {description}
      </p>

      <div className="mt-auto space-y-2">
        <div className="overflow-hidden border border-border bg-muted/20 px-2 py-1.5 text-[10px] font-mono text-muted-foreground">
          <span className="block truncate">{subscriptionUrl}</span>
        </div>

        <Button
          asChild
          className="btn-press w-full font-mono text-xs uppercase tracking-widest"
        >
          <a href={abpSubscriptionUrl}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {SITE_COPY.categorySection.subscribe}
          </a>
        </Button>

        <Button
          asChild
          variant="outline"
          className="btn-press w-full font-mono text-xs uppercase tracking-widest"
        >
          <a
            href={subscriptionUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            {SITE_COPY.categorySection.openDirect}
          </a>
        </Button>
      </div>
    </article>
  )
})

/* ------------------------------------------------------------------ */
/*  CopyToolbar — isolated so copy-status changes don't touch cards   */
/* ------------------------------------------------------------------ */

const CopyToolbar = memo(function CopyToolbar() {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleCopy = useCallback(async () => {
    try {
      await copyTextToClipboard(allCategoryLinks)
      setCopyStatus('copied')
    } catch (err) {
      if (__DEV__) console.error('Clipboard copy failed:', err)
      setCopyStatus('error')
    }

    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopyStatus('idle'), COPY_FEEDBACK_MS)
  }, [])

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  const label =
    copyStatus === 'copied'
      ? SITE_COPY.categorySection.copyAllCopied
      : copyStatus === 'error'
        ? SITE_COPY.categorySection.copyAllFailed
        : SITE_COPY.categorySection.copyAll

  return (
    <div className="mb-6 flex flex-col gap-3 border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-3xl text-[10px] font-mono leading-relaxed text-muted-foreground sm:text-xs">
        {SITE_COPY.categorySection.note}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="btn-press w-full font-mono text-[11px] uppercase tracking-widest sm:w-auto"
          onClick={handleCopy}
        >
          {copyStatus === 'copied' ? (
            <Check className="mr-2 h-4 w-4" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          {label}
        </Button>
        <span aria-live="polite" className="sr-only">
          {copyStatus !== 'idle' ? label : ''}
        </span>
      </div>
    </div>
  )
})

/* ------------------------------------------------------------------ */
/*  __DEV__ compile-time flag (tree-shaken in production builds)      */
/* ------------------------------------------------------------------ */

const __DEV__ = import.meta.env.DEV

/* ------------------------------------------------------------------ */
/*  CategorySubscriptions — main expandable section                   */
/* ------------------------------------------------------------------ */

interface CategorySubscriptionsProps {
  isExpanded: boolean
  onToggle: () => void
}

export const CategorySubscriptions = memo(function CategorySubscriptions({
  isExpanded,
  onToggle,
}: CategorySubscriptionsProps) {
  const [hasBeenExpanded, setHasBeenExpanded] = useState(false)

  useEffect(() => {
    if (isExpanded && !hasBeenExpanded) {
      setHasBeenExpanded(true)
    }
  }, [isExpanded, hasBeenExpanded])

  const animateIn = isExpanded && hasBeenExpanded

  return (
    <div className="border-t border-border">
      {/* Toggle bar */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls="category-subscriptions-panel"
        className="group flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/20 sm:px-6 sm:py-4 md:px-8"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground transition-colors group-hover:text-foreground">
            {SITE_COPY.categorySection.title}
          </span>
          <span className="border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
            {categories.length}
          </span>
        </div>
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/*
        Content is ALWAYS in the DOM so adblockers detect abp:subscribe links.
        Visibility is controlled with CSS grid-rows (0fr ↔ 1fr).
      */}
      <div
        id="category-subscriptions-panel"
        role="region"
        className={`grid transition-[grid-template-rows] duration-500 ease-out ${
          isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border bg-background px-4 py-6 sm:px-6 md:px-8">
            <CopyToolbar />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category, index) => (
                <CategoryCard
                  key={category.id}
                  id={category.id}
                  index={index}
                  fileName={category.fileName}
                  title={category.title}
                  description={category.description}
                  subscriptionUrl={category.subscriptionUrl}
                  abpSubscriptionUrl={category.abpSubscriptionUrl}
                  animateIn={animateIn}
                  isExpanded={isExpanded}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
