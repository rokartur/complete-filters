import { REPO_URL, SITE_COPY } from '@/lib/site-content'

export function Footer() {
  return (
    <footer className="border-t border-border bg-card px-4 py-3 sm:px-6 md:px-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] font-mono text-muted-foreground/60 leading-relaxed uppercase tracking-wide max-w-3xl">
          {SITE_COPY.footer.note}
        </p>
        <a
          href={REPO_URL}
          className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground shrink-0"
          target="_blank"
          rel="noopener noreferrer"
        >
          [{SITE_COPY.footer.github}]
        </a>
      </div>
    </footer>
  )
}
