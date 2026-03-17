import type { TestStatus, FilterType } from '@/hooks/use-adblocker-tester'
import type { TestCategory } from '@/lib/test-definitions'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Bell,
  Bug,
  ChartColumn,
  CircleDollarSign,
  Clapperboard,
  Cookie,
  Drama,
  Flag,
  Link2,
  Mail,
  MonitorPlay,
  Package,
  Pickaxe,
  RadioTower,
  ScanSearch,
  ShieldAlert,
  ShieldBan,
  Tv,
  Users,
  Waypoints,
  type LucideIcon,
} from 'lucide-react'
import { TestItem } from './test-item'

interface TestCategoryListProps {
  categories: TestCategory[]
  results: Record<string, TestStatus>
  filter: FilterType
  getCategoryStats: (categoryId: string) => {
    blocked: number
    notBlocked: number
    pending: number
    total: number
  }
}

const categoryIcons: Record<string, LucideIcon> = {
  'cosmetic-filters': Drama,
  'google-ads': CircleDollarSign,
  'ad-networks': Waypoints,
  'polish-ads': Flag,
  'tracking-analytics': ChartColumn,
  'social-trackers': Users,
  'error-trackers': Bug,
  fingerprinting: ScanSearch,
  'popups-redirects': MonitorPlay,
  cryptominers: Pickaxe,
  'malware-phishing': ShieldAlert,
  telemetry: RadioTower,
  'cookie-consent': Cookie,
  'push-notifications': Bell,
  'video-ads': Clapperboard,
  'url-shorteners': Link2,
  'newsletters-popups': Mail,
  'cdn-widgets': Package,
  'anti-adblock': ShieldBan,
  'native-telemetry': Tv,
  'email-tracking': Mail,
  'affiliate-tracking': CircleDollarSign,
  retargeting: ScanSearch,
  'data-brokers': Package,
}

export function TestCategoryList({
  categories,
  results,
  filter,
  getCategoryStats,
}: TestCategoryListProps) {
  const visibleCategories = categories
    .map((category) => {
      const visibleTests = category.tests
        .map((test, i) => ({
          test,
          index: i,
          status: results[`${category.id}-${i}`] || ('pending' as TestStatus),
        }))
        .filter((item) => filter === 'all' || item.status === filter)

      return {
        category,
        visibleTests,
      }
    })
    .filter(({ visibleTests }) => filter === 'all' || visibleTests.length > 0)

  if (visibleCategories.length === 0) {
    return (
      <div className="w-full rounded-xl border border-border/60 bg-card/70 px-6 py-10 text-center">
        <div className="mx-auto max-w-md">
          <div className="font-display text-xl font-semibold text-foreground">
            Brak wyników dla tego filtra
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Zmień filtr albo uruchom testy ponownie, aby zobaczyć pasujące pozycje.
          </p>
        </div>
      </div>
    )
  }

  return (
    <Accordion type="multiple" defaultValue={[]} className="w-full space-y-3">
      {visibleCategories.map(({ category, visibleTests }) => {
        const catStats = getCategoryStats(category.id)
        const CategoryIcon = categoryIcons[category.id] ?? ChartColumn
        const isCategoryFullyBlocked = catStats.total > 0 && catStats.blocked === catStats.total

        return (
          <AccordionItem
            key={category.id}
            value={category.id}
            className="w-full rounded-xl border border-border/60 bg-card/80 overflow-hidden transition-all duration-200 hover:border-border/80 hover:bg-card"
          >
            <AccordionTrigger className="px-5 py-4 hover:bg-muted/15 hover:no-underline transition-colors">
              <div className="flex flex-1 items-center justify-between pr-4">
                <div className="flex items-center gap-3.5">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 transition-colors ${
                      isCategoryFullyBlocked
                        ? 'bg-linear-to-br from-emerald-500/18 to-emerald-500/8 text-emerald-400 ring-emerald-500/20'
                        : 'bg-linear-to-br from-primary/12 to-primary/5 text-primary/70 ring-primary/10'
                    }`}
                  >
                    <CategoryIcon className="h-4.5 w-4.5" />
                  </span>
                  <div className="flex flex-col items-start">
                    <span className="font-semibold text-sm text-foreground font-display">
                      {category.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {category.tests.length} testów
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-5 text-sm">
                  <span className="flex items-center gap-1.5 font-semibold font-mono text-xs">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                    <span className="text-emerald-400 tabular-nums">{catStats.blocked}</span>
                  </span>
                  <span className="flex items-center gap-1.5 font-semibold font-mono text-xs">
                    <span className="inline-block h-2 w-2 rounded-full bg-red-400 shadow-sm shadow-red-400/50" />
                    <span className="text-red-400 tabular-nums">{catStats.notBlocked}</span>
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="border-t border-border/40 px-0 pb-0">
              <div className="divide-y divide-border/30">
                {visibleTests.map(({ test, index, status }) => (
                  <TestItem
                    key={`${category.id}-${index}`}
                    test={test}
                    status={status}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
