import { useAdBlockTester } from '@/hooks/use-adblocker-tester'
import { StatsBar } from './stats-bar'
import { GradeBadge } from './grade-badge'
import { ControlPanel } from './control-panel'
import { TestCategoryList } from './test-category'
import { Footer } from '@/components/footer'
import { Progress } from '@/components/ui/progress'
import { Crosshair } from 'lucide-react'

export function TesterPage() {
  const tester = useAdBlockTester()

  return (
    <div>
      {/* Tester Header — dramatic hero section */}
      <div className="relative px-6 py-14 text-center border-b border-border overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-card via-card/80 to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="relative">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 text-primary/60 ring-1 ring-primary/15 mb-6">
            <Crosshair className="h-5 w-5" />
          </div>
          <h2 className="font-display text-4xl font-extrabold tracking-tight md:text-5xl text-foreground">
            Tester Blokowania
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm text-muted-foreground leading-relaxed">
            Kompleksowy test działania filtrów. Sprawdza czy domeny reklam, trackingowe,
            malware oraz inne wektory zagrożeń są poprawnie blokowane.
          </p>
        </div>
      </div>

      {/* Grade */}
      {tester.grade && <GradeBadge grade={tester.grade} />}

      {/* Stats */}
      <StatsBar stats={tester.stats} />

      {/* Progress */}
      <div className="border-b border-border bg-background px-4 py-4">
        <div className="mx-auto max-w-5xl">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Postęp testu</span>
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
      <div className="w-full px-4 pb-8 pt-2">
        <TestCategoryList
          categories={tester.categories}
          results={tester.results}
          filter={tester.filter}
          getCategoryStats={tester.getCategoryStats}
        />
      </div>

      {/* Footer */}
      <Footer />
    </div>
  )
}
