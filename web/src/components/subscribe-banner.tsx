import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/language-switcher'
import { FILTER_CATEGORIES_URL, REPO_URL, useI18n } from '@/lib/i18n'
import { Shield, ExternalLink, Github } from 'lucide-react'

export function SubscribeBanner() {
  const { t } = useI18n()

  return (
    <div className="animate-fade-in-up relative border-b border-border bg-card">
      <div className="relative px-4 py-6 sm:px-6 md:px-8">
        <div className="mb-6 flex justify-between items-center border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
             <div className="flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground">
               <Shield className="h-5 w-5" />
             </div>
             <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">System.Banner</span>
          </div>
          <LanguageSwitcher />
        </div>

        <div className="flex flex-col gap-6 sm:flex-row sm:items-end justify-between">
          <div className="flex-1 max-w-2xl">
            <h1 className="font-display text-2xl font-bold uppercase tracking-tight sm:text-4xl text-foreground">
              {t.banner.title}
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground font-mono">
              {t.banner.description}
            </p>
          </div>

          <div className="flex w-full gap-3 sm:w-auto shrink-0 flex-col sm:flex-row">
            <Button
              asChild
              variant="default"
              className="btn-press w-full sm:w-auto transition-all duration-200 font-mono uppercase tracking-wider text-xs"
            >
              <a href={FILTER_CATEGORIES_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                {t.banner.addButton}
              </a>
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
                {t.banner.githubButton}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
