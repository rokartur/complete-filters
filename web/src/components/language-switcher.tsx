import { Languages } from 'lucide-react'
import { type Language, useI18n } from '@/lib/i18n'

const options: Language[] = ['pl', 'en']

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n()

  return (
    <div className="inline-flex max-w-full flex-wrap items-stretch border border-border bg-card font-mono">
      <span className="inline-flex items-center gap-2 border-r border-border bg-muted/50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground h-full flex-shrink-0">
        <Languages className="h-3.5 w-3.5" />
      </span>

      <div className="flex items-center">
        {options.map((option) => {
          const active = option === language
          const label = option === 'pl' ? t.switcher.pl : t.switcher.en

          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              aria-label={label}
              className={`min-w-10 px-3 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-colors duration-200 border-r border-border last:border-r-0 ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              onClick={() => setLanguage(option)}
            >
              {option.toUpperCase()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
