import { REPO_URL, useI18n } from '@/lib/i18n'

export function Footer() {
  const { t } = useI18n()

  return (
    <footer className="border-t border-border bg-card">
      <div className="px-4 py-8 sm:px-6 md:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-[10px] sm:text-xs font-mono text-muted-foreground uppercase tracking-widest">
            <span>SYS_RDY // POLISH-FILTERS</span>
          </div>
          <div className="flex items-center gap-6 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            <a
              href={REPO_URL}
              className="hover:text-foreground transition-colors duration-200 border-b border-transparent hover:border-foreground pb-0.5"
              target="_blank"
              rel="noopener noreferrer"
            >
              [{t.footer.github}]
            </a>
          </div>
        </div>
        <div className="mt-8 border-t border-border/50 pt-4">
          <p className="max-w-3xl text-[10px] font-mono text-muted-foreground/60 leading-relaxed uppercase tracking-wide">
            {t.footer.note}
          </p>
        </div>
      </div>
    </footer>
  )
}
