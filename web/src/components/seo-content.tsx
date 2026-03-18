import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { REPO_URL, SUBSCRIBE_URL, useI18n } from '@/lib/i18n'
import { ExternalLink, Github, ShieldCheck, Radar, TriangleAlert } from 'lucide-react'

const featureIcons = [ShieldCheck, Radar, TriangleAlert]

export function SeoContent() {
  const { t } = useI18n()

  return (
    <section
      aria-labelledby="seo-content-title"
      className="border-t border-border bg-card px-4 py-8 md:px-6 md:py-12 font-sans"
    >
      <div className="mx-auto max-w-[1336px] space-y-12">
        <div className="max-w-3xl space-y-4">
          <h2 id="seo-content-title" className="font-display text-3xl font-bold tracking-tight text-foreground md:text-5xl uppercase">
            {t.seo.title}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground md:text-base font-mono">
            {t.seo.intro}
          </p>
        </div>

        <section aria-labelledby="features-title" className="space-y-6">
          <h3 id="features-title" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono">
            [ {t.seo.featureTitle} ]
          </h3>
          <div className="grid gap-0 md:grid-cols-3 border border-border">
            {t.seo.features.map((feature, index) => {
              const Icon = featureIcons[index] ?? ShieldCheck
              return (
                <article
                  key={feature.title}
                  className={`bg-background p-6 md:p-8 transition-colors hover:bg-muted/30 ${index !== 2 ? 'border-b md:border-b-0 md:border-r border-border' : ''}`}
                >
                  <div className="mb-6 inline-flex h-12 w-12 items-center justify-center border border-primary bg-primary/5 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h4 className="font-display text-xl font-bold text-foreground uppercase tracking-wider">{feature.title}</h4>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground font-mono">{feature.description}</p>
                </article>
              )
            })}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="border border-border bg-background p-6 md:p-8">
            <h3 className="font-display text-xl font-bold text-foreground uppercase tracking-wider">{t.seo.whyTitle}</h3>
            <ul className="mt-6 space-y-4 text-xs font-mono leading-relaxed text-muted-foreground">
              {t.seo.whyPoints.map((point) => (
                <li key={point} className="flex gap-4 items-start">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-primary" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="border border-border bg-background p-6 md:p-8 flex flex-col">
            <h3 className="font-display text-xl font-bold text-foreground uppercase tracking-wider">{t.seo.supportedTitle}</h3>
            <p className="mt-4 text-xs font-mono leading-relaxed text-muted-foreground flex-1">
              {t.seo.supportedDescription}
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {t.seo.supportedBlockers.map((blocker) => (
                <span
                  key={blocker}
                  className="border border-border bg-muted/30 px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold text-foreground font-mono transition-colors hover:bg-foreground hover:text-background cursor-default"
                >
                  {blocker}
                </span>
              ))}
            </div>
          </section>
        </div>

        <section aria-labelledby="faq-title" className="space-y-6">
          <div>
            <h3 id="faq-title" className="font-display text-2xl font-bold text-foreground uppercase tracking-wider">
              {t.seo.faqTitle}
            </h3>
            <p className="mt-2 text-xs font-mono leading-relaxed text-muted-foreground">{t.seo.faqIntro}</p>
          </div>

          <Accordion type="multiple" defaultValue={[]} className="space-y-0 border border-border bg-background">
            {t.seo.faq.map((item, index) => (
              <AccordionItem
                key={item.question}
                value={`faq-${index}`}
                className="border-b border-border last:border-b-0 px-6 py-2 transition-colors hover:bg-muted/20"
              >
                <AccordionTrigger className="py-4 text-sm font-bold text-foreground uppercase tracking-wide hover:no-underline font-display">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="pb-6 pt-2 text-xs font-mono leading-relaxed text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="border border-primary bg-primary/5 p-6 md:p-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
             <Radar className="w-64 h-64 text-primary" />
          </div>
          <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between z-10">
            <div className="max-w-2xl">
              <h3 className="text-3xl font-display font-black uppercase tracking-tight text-foreground">{t.seo.ctaTitle}</h3>
              <p className="mt-4 text-xs font-mono leading-relaxed text-muted-foreground max-w-lg">
                {t.seo.ctaDescription}
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row shrink-0">
              <Button asChild className="rounded-none font-mono uppercase tracking-widest text-xs px-8 py-6 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                <a href={SUBSCRIBE_URL}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t.seo.ctaPrimary}
                </a>
              </Button>
              <Button variant="outline" asChild className="rounded-none font-mono uppercase tracking-widest text-xs px-8 py-6 border-primary/30 hover:border-primary hover:bg-primary/10 transition-colors">
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                  <Github className="mr-2 h-4 w-4" />
                  {t.seo.ctaSecondary}
                </a>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}
