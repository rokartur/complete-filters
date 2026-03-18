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
      {/* Tester Header — dramatic hero section */}
      <div className="relative overflow-hidden border-b border-border px-4 py-10 text-center sm:px-6 sm:py-14">
        <div className="absolute inset-0 bg-linear-to-b from-card via-card/80 to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="relative">
          <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary/60 ring-1 ring-primary/15 sm:mb-6 sm:h-12 sm:w-12">
            <Crosshair className="h-5 w-5" />
          </div>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            {t.tester.title}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            {t.tester.description}
          </p>
        </div>
      </div>

      {/* Grade */}
      {tester.grade && <GradeBadge grade={tester.grade} />}

      {/* Stats */}
      <StatsBar stats={tester.stats} />

      {/* Progress */}
      <div className="border-b border-border bg-background px-4 py-4 sm:px-5">
        <div className="mx-auto max-w-5xl">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>{t.tester.progress}</span>
            <span className="tabular-nums text-foreground">{Math.round(tester.progress)}%</span>
          </div>
          <Progress
            value={tester.progress}
            className="h-2.5 bg-muted/70"
            indicatorClassName="from-primary via-primary to-orange-400"
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
      <div className="w-full px-3 pb-6 pt-2 sm:px-4 sm:pb-8">
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
