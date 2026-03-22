import { memo } from 'react'
import { CopyFilterListButton } from '@/components/copy-filter-list-button'
import { FILTER_SUBSCRIPTION_CATEGORIES } from '@/lib/filter-subscriptions'
import { SITE_COPY } from '@/lib/site-content'

export const CategorySubscriptions = memo(function CategorySubscriptions() {
  return (
    <section
      aria-labelledby="category-subscriptions-title"
      className="border-t border-border bg-background px-4 py-3 sm:px-6 md:px-8"
    >
      <div className="flex flex-col gap-3 border border-border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h2
              id="category-subscriptions-title"
              className="text-xs font-mono font-bold uppercase tracking-widest text-foreground"
            >
              {SITE_COPY.categorySection.title}
            </h2>
            <span className="w-fit border border-border bg-background px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
              {FILTER_SUBSCRIPTION_CATEGORIES.length}
            </span>
          </div>

          <p className="mt-2 max-w-3xl text-[10px] font-mono leading-relaxed text-muted-foreground sm:text-xs">
            {SITE_COPY.categorySection.note}
          </p>
        </div>

        <CopyFilterListButton
          idleLabel={SITE_COPY.banner.copyButton}
          variant="outline"
          className="btn-press w-full shrink-0 font-mono text-[11px] uppercase tracking-widest sm:w-auto"
        />
      </div>
    </section>
  )
})
