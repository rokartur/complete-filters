import type { TestStatus, FilterType } from '@/hooks/use-adblocker-tester'
import type { TestCategory } from '@/lib/test-definitions'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useI18n } from '@/lib/i18n'
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
  const { t, translateCategoryName } = useI18n()
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
      <div className="w-full border border-border bg-card px-6 py-10 text-center">
        <div className="mx-auto max-w-md">
          <div className="font-display font-black uppercase text-2xl text-muted-foreground tracking-widest">
            {t.tester.noResultsTitle}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground uppercase font-mono tracking-widest">
            {t.tester.noResultsDescription}
          </p>
        </div>
      </div>
    )
  }

  return (
    <Accordion type="multiple" defaultValue={[]} className="w-full space-y-4">
      {visibleCategories.map(({ category, visibleTests }) => {
        const catStats = getCategoryStats(category.id)
        const CategoryIcon = categoryIcons[category.id] ?? ChartColumn
        const isCategoryFullyBlocked = catStats.total > 0 && catStats.blocked === catStats.total

        return (
          <AccordionItem
            key={category.id}
            value={category.id}
            className="w-full border border-border bg-card overflow-hidden transition-colors hover:border-foreground/30 rounded-none!"
          >
            <AccordionTrigger className="flex flex-1 justify-between items-center px-4 py-4 hover:bg-muted/50 hover:no-underline transition-colors sm:px-6">
              <div className="flex flex-1 flex-col gap-3 pr-2 sm:flex-row sm:items-center sm:justify-between sm:pr-4">
                <div className="flex min-w-0 items-center gap-4">
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center border border-current transition-colors ${
                      isCategoryFullyBlocked
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-primary/5 text-primary/70'
                    }`}
                  >
                    <CategoryIcon className="h-5 w-5 shrink-0" />
                  </span>
                  <div className="flex min-w-0 flex-col items-start font-mono">
                    <span className="font-bold text-sm text-foreground uppercase tracking-widest">
                      {translateCategoryName(category.id, category.name)}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                      {t.tester.testsCount(category.tests.length)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm font-mono mt-2 sm:mt-0">
                  <span className="flex items-center gap-2 font-bold text-[10px] tracking-widest">
                    <span className="inline-block h-1.5 w-1.5 bg-emerald-400" />
                    <span className="text-emerald-400 tabular-nums">PASS:{catStats.blocked}</span>
                  </span>
                  <span className="flex items-center gap-2 font-bold text-[10px] tracking-widest">
                    <span className="inline-block h-1.5 w-1.5 bg-red-400" />
                    <span className="text-red-400 tabular-nums">FAIL:{catStats.notBlocked}</span>
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="border-t border-border px-0 pb-0 bg-background">
              <div className="divide-y divide-border/50">
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
