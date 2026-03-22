import { useAdBlockTester } from '@/hooks/use-adblocker-tester'
import { StatsBar } from './stats-bar'
import { GradeBadge } from './grade-badge'
import { ControlPanel } from './control-panel'
import { TestCategoryList } from './test-category'
import { Footer } from '@/components/footer'
import { Progress } from '@/components/ui/progress'
import { SITE_COPY } from '@/lib/site-content'

export function TesterPage() {
  const tester = useAdBlockTester()

  return (
    <div>
      {/* Tester Header */}
      <div className="border-b border-border bg-card px-4 py-4 sm:px-6 md:px-8">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-lg font-bold uppercase tracking-tight text-foreground sm:text-xl">
            {SITE_COPY.tester.title}
          </h2>
          <p className="text-xs text-muted-foreground font-mono">
            {SITE_COPY.tester.description}
          </p>
        </div>
      </div>

      {/* Grade */}
      {tester.grade && <GradeBadge grade={tester.grade} />}

      {/* Stats */}
      <StatsBar stats={tester.stats} isRunning={tester.isRunning} />

      {/* Progress */}
      <div className="border-b border-border bg-card px-4 py-3 sm:px-6 md:px-8">
        <div className="mb-2 flex items-center justify-between text-[10px] font-mono font-medium uppercase tracking-wider text-muted-foreground">
          <span>{SITE_COPY.tester.progress}</span>
          <span className="tabular-nums text-foreground">[{Math.round(tester.progress)}%]</span>
        </div>
        <div>
          <Progress
            value={tester.progress}
            className="h-1 bg-muted rounded-none"
            indicatorClassName="bg-white rounded-none"
          />
        </div>
      </div>

      {/* Controls */}
      <ControlPanel
        isRunning={tester.isRunning}
        phase={tester.phase}
        testedCount={tester.testedCount}
        totalTests={tester.totalTests}
        filter={tester.filter}
        onStart={tester.startTests}
        onReset={tester.resetTests}
        onFilterChange={tester.setFilter}
      />

      {/* Test Categories */}
      <div className="w-full bg-background px-4 py-4 sm:px-6 md:px-8">
        <TestCategoryList
          categories={tester.categories}
          results={tester.results}
          filter={tester.filter}
          getCategoryStats={tester.getCategoryStats}
        />
      </div>

      <Footer />
    </div>
  )
}
