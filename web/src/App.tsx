import { SubscribeBanner } from '@/components/subscribe-banner'
import { TesterPage } from '@/components/tester/tester-page'
import { useSeo } from '@/hooks/use-seo'

export default function App() {
  useSeo()

  return (
    <div className="relative min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary-foreground bg-noise font-sans">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-none focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:text-foreground focus:ring-1 focus:ring-primary"
      >
        Skip to tester
      </a>

      <div className="relative mx-auto w-full max-w-[1336px] px-0 py-0 sm:px-4 sm:py-6 md:py-8 lg:py-12">
        <div className="w-full overflow-hidden border border-border bg-card">
          <header className="border-b border-border">
            <SubscribeBanner />
          </header>
          <main id="main-content">
            <TesterPage />
          </main>
        </div>
      </div>
    </div>
  )
}
