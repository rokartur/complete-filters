import { memo } from 'react'
import { CategorySubscriptions } from '@/components/category-subscriptions'
import { Button } from '@/components/ui/button'
import { REPO_URL, SITE_COPY } from '@/lib/site-content'
import { Github, ListFilter } from 'lucide-react'

interface SubscribeBannerProps {
  categoriesOpen: boolean
  onCategoriesToggle: () => void
}

export const SubscribeBanner = memo(function SubscribeBanner({
  categoriesOpen,
  onCategoriesToggle,
}: SubscribeBannerProps) {
  return (
    <div className="animate-fade-in-up relative bg-card">
      <div className="relative px-4 py-6 sm:px-6 md:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end justify-between">
          <div className="flex-1 max-w-2xl">
            <h1 className="font-display text-2xl font-bold uppercase tracking-tight sm:text-4xl text-foreground">
              {SITE_COPY.banner.title}
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground font-mono">
              {SITE_COPY.banner.description}
            </p>
          </div>

          <div className="flex w-full gap-3 sm:w-auto shrink-0 flex-col sm:flex-row">
            <Button
              type="button"
              variant="default"
              className="btn-press w-full sm:w-auto transition-all duration-200 font-mono uppercase tracking-wider text-xs"
              onClick={onCategoriesToggle}
            >
              <ListFilter className="h-4 w-4" />
              {categoriesOpen ? SITE_COPY.banner.hideButton : SITE_COPY.banner.addButton}
            </Button>
            <Button
              variant="outline"
              asChild
              className="btn-press w-full sm:w-auto rounded-none transition-all duration-200 border-border font-mono uppercase tracking-wider text-xs hover:bg-foreground hover:text-background"
            >
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="h-4 w-4 mr-2" />
                {SITE_COPY.banner.githubButton}
              </a>
            </Button>
          </div>
        </div>
      </div>

      <CategorySubscriptions
        isExpanded={categoriesOpen}
        onToggle={onCategoriesToggle}
      />
    </div>
  )
})
