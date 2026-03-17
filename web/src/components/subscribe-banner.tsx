import { Button } from '@/components/ui/button'
import { Shield, ExternalLink, Github } from 'lucide-react'

const SUBSCRIBE_URL =
  'abp:subscribe?location=https%3A%2F%2Fraw.githubusercontent.com%2Frokartur%2Fpolish-complete-filters%2Fmain%2Fpolish-complete-filters.txt&title=Polish%20Complete%20Filters'

export function SubscribeBanner() {
  return (
    <div className="relative border-b border-border overflow-hidden gradient-border-bottom">
      {/* Layered background effects */}
      <div className="absolute inset-0 bg-linear-to-br from-primary/6 via-transparent to-indigo-500/3" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--tw-gradient-stops))] from-primary/8 via-transparent to-transparent" />
      
      <div className="relative px-6 py-8 sm:py-10">
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
          {/* Logo with ambient glow */}
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl animate-pulse-glow" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/25 shadow-lg shadow-primary/10">
              <Shield className="h-8 w-8" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl bg-linear-to-r from-foreground via-foreground to-foreground/50 bg-clip-text text-transparent">
              Polish Complete Filters
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-md">
              Zestaw filtrów usuwających irytujące elementy i reklamy ze stron WWW.
            </p>
          </div>
          
          <div className="flex flex-col gap-3 sm:flex-row sm:shrink-0 w-full sm:w-auto">
            <Button
              asChild
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
            >
              <a href={SUBSCRIBE_URL}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Dodaj do adblocka
              </a>
            </Button>
            <Button variant="outline" asChild className="w-full sm:w-auto font-medium bg-card/50 backdrop-blur-sm border-border/80 hover:border-primary/30 transition-all duration-200 hover:-translate-y-0.5">
              <a
                href="https://github.com/rokartur/polish-complete-filters"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="h-4 w-4 mr-2" />
                GitHub
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
