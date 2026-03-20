import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button, type ButtonProps } from '@/components/ui/button'
import {
  FILTER_SUBSCRIPTION_CATEGORIES,
  getFilterSubscriptionUrl,
} from '@/lib/filter-subscriptions'
import { SITE_COPY } from '@/lib/site-content'
import { ExternalLink, ListFilter, X } from 'lucide-react'

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
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const descriptionId = useId()

  const categories = useMemo(
    () =>
      FILTER_SUBSCRIPTION_CATEGORIES.map((category) => ({
        ...category,
        localizedTitle: category.title,
        localizedDescription: category.description,
        subscriptionUrl: getFilterSubscriptionUrl(category.fileName),
      })),
    [],
  )

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        {triggerIcon ?? <ListFilter className="h-4 w-4" />}
        {triggerLabel}
      </Button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            >
              <div className="flex min-h-full items-center justify-center p-4 sm:p-6 lg:p-8">
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={titleId}
                  aria-describedby={descriptionId}
                  className="w-full max-w-6xl border border-border bg-card shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
                    <div className="max-w-3xl space-y-3">
                      <p className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-muted-foreground">
                        Complete Filters / Subscription
                      </p>
                      <h2 id={titleId} className="font-display text-2xl font-black uppercase tracking-tight text-foreground sm:text-3xl">
                        {SITE_COPY.categoryModal.title}
                      </h2>
                      <p id={descriptionId} className="text-sm font-mono leading-relaxed text-muted-foreground">
                        {SITE_COPY.categoryModal.description}
                      </p>
                      <p className="text-xs font-mono leading-relaxed text-muted-foreground/90">
                        {SITE_COPY.categoryModal.note}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={SITE_COPY.categoryModal.close}
                      className="shrink-0"
                      onClick={() => setOpen(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="max-h-[75vh] overflow-y-auto p-5 sm:p-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {categories.map((category, index) => (
                        <article
                          key={category.id}
                          className="category-card flex h-full flex-col border border-border bg-background p-5"
                        >
                          <div className="mb-4 flex items-start justify-between gap-4">
                            <div>
                              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.24em] text-muted-foreground">
                                {category.fileName}
                              </p>
                              <h3 className="mt-2 font-display text-xl font-bold uppercase tracking-wide text-foreground">
                                {category.localizedTitle}
                              </h3>
                            </div>
                            <span className="border border-border bg-muted/40 px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                          </div>

                          <p className="flex-1 text-xs font-mono leading-relaxed text-muted-foreground">
                            {category.localizedDescription}
                          </p>

                          <div className="mt-5 space-y-3">
                            <div className="overflow-hidden border border-border bg-muted/20 px-3 py-2 text-[10px] font-mono text-muted-foreground">
                              <span className="block truncate">{category.subscriptionUrl}</span>
                            </div>

                            <Button
                              asChild
                              className="btn-press w-full font-mono text-xs uppercase tracking-widest"
                            >
                              <a
                                href={category.subscriptionUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                {SITE_COPY.categoryModal.subscribe}
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