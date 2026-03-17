import { SubscribeBanner } from '@/components/subscribe-banner'
import { TesterPage } from '@/components/tester/tester-page'

export default function App() {
  return (
    <div className="relative min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary-foreground">
      {/* Ambient background glow orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-primary/3 rounded-full blur-[100px] animate-pulse-glow" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[40%] h-[40%] bg-indigo-500/2 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-4 md:py-10 lg:py-14">
        <div className="w-full bg-card/80 backdrop-blur-sm border border-border/60 md:rounded-2xl overflow-hidden">
          <SubscribeBanner />
          <TesterPage />
        </div>
      </div>
    </div>
  )
}
