import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FILTER_CATEGORIES_URL } from '@/lib/i18n'
import { Shield, ExternalLink, Github } from 'lucide-react'

interface LandingPageProps {
  onNavigateToTester: () => void
}

export function LandingPage({ onNavigateToTester }: LandingPageProps) {
  return (
    <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-4 py-16">
      <Card className="w-full max-w-lg border-border/50 bg-card/80 backdrop-blur">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Shield className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">
            Complete Filters
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Zestaw kategorii filtrów usuwających reklamy, tracking i inne irytujące elementy ze stron WWW.
            Przejdź do gotowych plików kategorii, aby wybrać listy pasujące do swojej konfiguracji.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-4">
          <Button
            asChild
            size="lg"
            className="w-full bg-red-900 hover:bg-red-800 text-white font-semibold text-base"
          >
            <a href={FILTER_CATEGORIES_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              Przeglądaj kategorie
            </a>
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full font-semibold text-base"
            onClick={onNavigateToTester}
          >
            <Shield className="h-4 w-4 mr-1" />
            Tester blokowania reklam
          </Button>

          <Button variant="ghost" size="lg" asChild className="w-full text-muted-foreground">
            <a
              href="https://github.com/rokartur/complete-filters"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="h-4 w-4 mr-1" />
              GitHub
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
