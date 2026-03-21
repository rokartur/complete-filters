import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button, type ButtonProps } from '@/components/ui/button'
import {
  FILTER_SUBSCRIPTION_CATEGORIES,
  getFilterSubscriptionUrl,
} from '@/lib/filter-subscriptions'
import {
  SITE_COPY,
  getAbpSubscriptionUrl,
} from '@/lib/site-content'
import { Check, Copy, ExternalLink, ListFilter, X } from 'lucide-react'

async function copyTextToClipboard(text: string) {
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

interface CategorySubscriptionsModalProps {
  triggerLabel: string
  triggerClassName?: string
  triggerVariant?: ButtonProps['variant']
  triggerSize?: ButtonProps['size']
  triggerIcon?: ReactNode
}

export function CategorySubscriptionsModal({
  triggerLabel,
  triggerClassName,
  triggerVariant = 'default',
  triggerSize = 'default',
  triggerIcon,
}: CategorySubscriptionsModalProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [copyAllStatus, setCopyAllStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const titleId = useId()
  const descriptionId = useId()
  const animationDurationMs = 260

  const categories = useMemo(
    () =>
      FILTER_SUBSCRIPTION_CATEGORIES.map((category) => ({
        ...category,
        localizedTitle: category.title,
        localizedDescription: category.description,
        subscriptionUrl: getFilterSubscriptionUrl(category.fileName),
        abpSubscriptionUrl: getAbpSubscriptionUrl(
          getFilterSubscriptionUrl(category.fileName),
          `Complete Filters — ${category.title}`,
        ),
      })),
    [],
  )

  const allCategoryLinks = useMemo(
    () => categories.map((category) => category.subscriptionUrl).join('\n'),
    [categories],
  )

  const openModal = () => {
    setIsMounted(true)
  }

  const closeModal = () => {
    setIsVisible(false)
  }

  const handleCopyAllCategoryLinks = async () => {
    try {
      await copyTextToClipboard(allCategoryLinks)
      setCopyAllStatus('copied')
    } catch {
      setCopyAllStatus('error')
    }
  }

  const handleAbpSubscriptionClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    subscriptionUrl: string,
  ) => {
    event.preventDefault()
    window.location.assign(subscriptionUrl)
  }

  useEffect(() => {
    if (!isMounted) return

    const frame = window.requestAnimationFrame(() => {
      setIsVisible(true)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [isMounted])

  useEffect(() => {
    if (!isMounted || isVisible) return

    const timeout = window.setTimeout(() => {
      setIsMounted(false)
    }, animationDurationMs)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [animationDurationMs, isMounted, isVisible])

  useEffect(() => {
    if (copyAllStatus === 'idle') return

    const timeout = window.setTimeout(() => {
      setCopyAllStatus('idle')
    }, 2200)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [copyAllStatus])

  useEffect(() => {
    if (!isMounted) return

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal()
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMounted])

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        className={triggerClassName}
        onClick={openModal}
      >
        {triggerIcon ?? <ListFilter className="h-4 w-4" />}
        {triggerLabel}
      </Button>

      {isMounted && typeof document !== 'undefined'
        ? createPortal(
            <div
              className={`modal-overlay fixed inset-0 z-50 bg-background/85 backdrop-blur-sm transition-opacity duration-300 ease-out ${
                isVisible ? 'opacity-100' : 'opacity-0'
              }`}
              onClick={closeModal}
            >
              <div className="flex min-h-full items-center justify-center p-4 sm:p-6 lg:p-8">
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={titleId}
                  aria-describedby={descriptionId}
                  className={`modal-panel flex max-h-[90vh] w-full max-w-6xl flex-col border border-border bg-card shadow-2xl transition-[opacity,transform] duration-300 ease-out ${
                    isVisible
                      ? 'translate-y-0 scale-100 opacity-100'
                      : 'translate-y-4 scale-[0.98] opacity-0'
                  }`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className={`flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3 transition-[opacity,transform] duration-300 ease-out sm:px-6 sm:py-4 ${
                    isVisible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
                  }`}>
                    <div className="space-y-1">
                      <h2 id={titleId} className="font-display text-lg font-bold uppercase tracking-tight text-foreground sm:text-xl">
                        {SITE_COPY.categoryModal.title}
                      </h2>
                      <p id={descriptionId} className="text-xs font-mono text-muted-foreground/90">
                        {SITE_COPY.categoryModal.description}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={SITE_COPY.categoryModal.close}
                      className="shrink-0"
                      onClick={closeModal}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    <div
                      className={`mb-6 flex flex-col gap-3 border border-border bg-muted/20 p-4 transition-[opacity,transform] duration-300 ease-out sm:flex-row sm:items-center sm:justify-between ${
                        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                      }`}
                      style={{ transitionDelay: isVisible ? '50ms' : '0ms' }}
                    >
                      <p className="max-w-3xl text-[10px] font-mono leading-relaxed text-muted-foreground sm:text-xs">
                        {SITE_COPY.categoryModal.note}
                      </p>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="btn-press w-full font-mono text-[11px] uppercase tracking-widest sm:w-auto"
                          onClick={handleCopyAllCategoryLinks}
                        >
                          {copyAllStatus === 'copied' ? (
                            <Check className="mr-2 h-4 w-4" />
                          ) : (
                            <Copy className="mr-2 h-4 w-4" />
                          )}
                          {copyAllStatus === 'copied'
                            ? SITE_COPY.categoryModal.copyAllCopied
                            : copyAllStatus === 'error'
                              ? SITE_COPY.categoryModal.copyAllFailed
                              : SITE_COPY.categoryModal.copyAll}
                        </Button>
                        <span aria-live="polite" className="sr-only">
                          {copyAllStatus === 'copied'
                            ? SITE_COPY.categoryModal.copyAllCopied
                            : copyAllStatus === 'error'
                              ? SITE_COPY.categoryModal.copyAllFailed
                              : ''}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {categories.map((category, index) => (
                        <article
                          key={category.id}
                          className={`category-card flex h-full flex-col border border-border bg-background p-4 transition-[opacity,transform,border-color] duration-300 ease-out sm:p-5 ${
                            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                          }`}
                          style={{ transitionDelay: isVisible ? `${75 + index * 15}ms` : '0ms' }}
                        >
                          <div className="mb-3 flex items-start justify-between gap-4">
                            <div>
                              <p className="text-[10px] font-mono font-medium uppercase tracking-[0.24em] text-muted-foreground">
                                {category.fileName}
                              </p>
                              <h3 className="mt-1 font-display text-lg font-bold uppercase tracking-wide text-foreground">
                                {category.localizedTitle}
                              </h3>
                            </div>
                            <span className="border border-border bg-muted/40 px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                          </div>

                          <p className="mb-4 flex-1 text-xs font-mono leading-relaxed text-muted-foreground">
                            {category.localizedDescription}
                          </p>

                          <div className="mt-auto space-y-2">
                            <div className="overflow-hidden border border-border bg-muted/20 px-2 py-1.5 text-[10px] font-mono text-muted-foreground">
                              <span className="block truncate">{category.subscriptionUrl}</span>
                            </div>

                            <Button
                              asChild
                              className="btn-press w-full font-mono text-xs uppercase tracking-widest"
                            >
                              <a
                                href={category.abpSubscriptionUrl}
                                onClick={(event) =>
                                  handleAbpSubscriptionClick(event, category.abpSubscriptionUrl)
                                }
                              >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                {SITE_COPY.categoryModal.subscribe}
                              </a>
                            </Button>

                            <Button
                              asChild
                              variant="outline"
                              className="btn-press w-full font-mono text-xs uppercase tracking-widest"
                            >
                              <a
                                href={category.subscriptionUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                {SITE_COPY.categoryModal.openDirect}
                              </a>
                            </Button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}