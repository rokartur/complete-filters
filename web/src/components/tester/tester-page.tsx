import { useAdBlockTester } from '@/hooks/use-adblocker-tester'
import { StatsBar } from './stats-bar'
import { GradeBadge } from './grade-badge'
import { ControlPanel } from './control-panel'
import { TestCategoryList } from './test-category'
import { Footer } from '@/components/footer'
import { Progress } from '@/components/ui/progress'
import { SeoContent } from '@/components/seo-content'
import { SITE_COPY } from '@/lib/site-content'
import { Crosshair } from 'lucide-react'

export function TesterPage() {
  const tester = useAdBlockTester()

  return (
    <div>
      {/* Tester Header — industrial tracking panel */}
      <div className="animate-section-in relative border-b border-border bg-card px-4 py-8 sm:px-6 md:px-10" style={{ '--section-delay': 0 } as React.CSSProperties}>
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          <div className="shrink-0 flex h-16 w-16 items-center justify-center border border-primary bg-primary/5 text-primary">
            <Crosshair className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <div className="mb-2 inline-block border border-border bg-muted px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Module: Adblock Audit
            </div>
            <h2 className="font-display text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl lg:text-6xl">
              {SITE_COPY.tester.title}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground font-mono">
              {SITE_COPY.tester.description}
            </p>
          </div>
        </div>
      </div>

      {/* Grade */}
      {tester.grade && <GradeBadge grade={tester.grade} />}

      {/* Stats */}
      <div className="animate-section-in" style={{ '--section-delay': 80 } as React.CSSProperties}>
        <StatsBar stats={tester.stats} isRunning={tester.isRunning} />
      </div>

      {/* Progress */}
      <div className="animate-section-in border-b border-border bg-card px-4 py-6 sm:px-6 md:px-8" style={{ '--section-delay': 160 } as React.CSSProperties}>
        <div className="mx-auto w-full">
          <div className="mb-3 flex items-center justify-between text-[11px] font-mono font-medium uppercase tracking-wider text-muted-foreground">
            <span>{SITE_COPY.tester.progress}</span>
            <span className="tabular-nums text-foreground">[{Math.round(tester.progress)}%]</span>
          </div>
          <div className={tester.isRunning ? 'progress-scanline' : ''}>
            <Progress
              value={tester.progress}
              className="h-1 bg-muted rounded-none"
              indicatorClassName="bg-primary rounded-none transition-all duration-300"
            />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="animate-section-in" style={{ '--section-delay': 240 } as React.CSSProperties}>
        <ControlPanel
          isRunning={tester.isRunning}
          filter={tester.filter}
          onStart={tester.startTests}
          onReset={tester.resetTests}
          onFilterChange={tester.setFilter}
        />
      </div>

      {/* Test Categories */}
      <div className="animate-section-in w-full bg-background px-4 py-8 sm:px-6 md:px-8" style={{ '--section-delay': 320 } as React.CSSProperties}>
        <TestCategoryList
          categories={tester.categories}
          results={tester.results}
          filter={tester.filter}
          getCategoryStats={tester.getCategoryStats}
        />
      </div>

      <SeoContent />

      {/* Footer */}
      <Footer />
    </div>
  )
}
