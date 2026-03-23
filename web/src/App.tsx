import { SubscribeBanner } from '@/components/subscribe-banner'
import { TesterPage } from '@/components/tester/tester-page'
import { useSeo } from '@/hooks/use-seo'

export default function App() {
  useSeo()

  return (
    <div className="relative min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary-foreground bg-noise font-sans">
      <div className="relative mx-auto w-full max-w-334 px-0 py-0 sm:px-4 sm:py-4">
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
