import { memo } from 'react'
import { CopyFilterListButton } from '@/components/copy-filter-list-button'
import { Button } from '@/components/ui/button'
import { FILTER_SUBSCRIPTION_CATEGORIES } from '@/lib/filter-subscriptions'
import { REPO_URL, SITE_COPY } from '@/lib/site-content'
import { Github } from 'lucide-react'

export const SubscribeBanner = memo(function SubscribeBanner() {
    return (
        <div className="relative bg-card px-4 py-2 sm:px-6 md:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="font-display text-base font-bold uppercase tracking-tight sm:text-lg text-foreground whitespace-nowrap">
                    {SITE_COPY.banner.title}
                </h1>

                <div className="flex items-center gap-3 min-w-0">
                    <span className="border border-border bg-background px-2 py-0.5 text-[10px] font-mono font-bold tabular-nums text-muted-foreground">
                        {FILTER_SUBSCRIPTION_CATEGORIES.length}
                    </span>

                    <span className="hidden sm:inline text-xs font-mono text-muted-foreground truncate">
                        {SITE_COPY.banner.description}
                    </span>

                    <div className="flex items-center gap-2 shrink-0">
                        <CopyFilterListButton
                            idleLabel={SITE_COPY.banner.copyButton}
                            variant="outline"
                            size="sm"
                            className="btn-press rounded-none font-mono text-[11px] uppercase tracking-widest"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="btn-press rounded-none border-border font-mono uppercase tracking-widest text-[11px] hover:bg-foreground hover:text-background"
                        >
                            <a
                                href={REPO_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Github className="h-3.5 w-3.5" />
                                {SITE_COPY.banner.githubButton}
                            </a>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
})
