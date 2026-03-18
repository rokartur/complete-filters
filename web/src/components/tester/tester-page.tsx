import { useAdBlockTester } from '@/hooks/use-adblocker-tester'
import { StatsBar } from './stats-bar'
import { GradeBadge } from './grade-badge'
import { ControlPanel } from './control-panel'
import { TestCategoryList } from './test-category'
import { Footer } from '@/components/footer'
import { Progress } from '@/components/ui/progress'
import { SeoContent } from '@/components/seo-content'
import { useI18n } from '@/lib/i18n'
import { Crosshair } from 'lucide-react'

export function TesterPage() {
  const tester = useAdBlockTester()
  const { t } = useI18n()

  return (
    <div>
      {/* Tester Header — industrial tracking panel */}
      <div className="relative border-b border-border bg-card px-4 py-8 sm:px-6 md:px-10">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          <div className="shrink-0 flex h-16 w-16 items-center justify-center border border-primary bg-primary/5 text-primary">
            <Crosshair className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <div className="mb-2 inline-block border border-border bg-muted px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Module: Adblock Audit
            </div>
            <h2 className="font-display text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl lg:text-6xl">
              {t.tester.title}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground font-mono">
              {t.tester.description}
            </p>
          </div>
        </div>
      </div>

      {/* Grade */}
      {tester.grade && <GradeBadge grade={tester.grade} />}

      {/* Stats */}
      <StatsBar stats={tester.stats} />

      {/* Progress */}
      <div className="border-b border-border bg-card px-4 py-6 sm:px-6 md:px-8">
        <div className="mx-auto w-full">
          <div className="mb-3 flex items-center justify-between text-[11px] font-mono font-medium uppercase tracking-wider text-muted-foreground">
            <span>{t.tester.progress}</span>
            <span className="tabular-nums text-foreground">[{Math.round(tester.progress)}%]</span>
          </div>
          <Progress
            value={tester.progress}
            className="h-1 bg-muted rounded-none"
            indicatorClassName="bg-primary rounded-none transition-all duration-300"
          />
        </div>
      </div>

      {/* Controls */}
      <ControlPanel
        isRunning={tester.isRunning}
        filter={tester.filter}
        onStart={tester.startTests}
        onReset={tester.resetTests}
        onFilterChange={tester.setFilter}
      />

      {/* Test Categories */}
      <div className="w-full bg-background px-4 py-8 sm:px-6 md:px-8">
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
