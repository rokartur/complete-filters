import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Language = 'pl' | 'en'
export type MethodTag = 'cosmetic' | 'script' | 'image' | 'network'

export const REPO_URL = 'https://github.com/rokartur/polish-complete-filters'
export const SITE_URL = 'https://rokartur.github.io/polish-complete-filters/'
export const SUBSCRIBE_URL =
  'abp:subscribe?location=https%3A%2F%2Fraw.githubusercontent.com%2Frokartur%2Fpolish-complete-filters%2Fmain%2Fpolish-complete-filters.txt&title=Polish%20Complete%20Filters'

const STORAGE_KEY = 'pcf-language'
const SUPPORTED_LANGUAGES: Language[] = ['pl', 'en']

const CATEGORY_TRANSLATIONS: Record<Language, Record<string, string>> = {
  pl: {},
  en: {
    'cosmetic-filters': 'Cosmetic filters (element hiding)',
    'google-ads': 'Google Ads / AdSense / AdMob',
    'ad-networks': 'Ad networks',
    'polish-ads': 'Polish ad networks',
    'tracking-analytics': 'Tracking and analytics',
    'social-trackers': 'Social media trackers',
    'error-trackers': 'Error trackers',
    fingerprinting: 'Fingerprinting and advanced tracking',
    'popups-redirects': 'Popups, popunders, and redirects',
    cryptominers: 'Cryptominers',
    'malware-phishing': 'Malware, phishing, and risky domains',
    telemetry: 'System telemetry',
    'cookie-consent': 'Cookie banners / consent',
    'push-notifications': 'Push notifications',
    'video-ads': 'Video ads',
    'url-shorteners': 'URL shorteners / monetization',
    'newsletters-popups': 'Newsletter popups and marketing',
    'cdn-widgets': 'CDN widgets and 3rd-party scripts',
    'anti-adblock': 'Anti-adblock scripts',
    'native-telemetry': 'Native telemetry (Smart TV, IoT)',
    'email-tracking': 'Email tracking',
    'affiliate-tracking': 'Affiliate tracking',
    retargeting: 'Retargeting and remarketing',
    'data-brokers': 'Data brokers / DMP',
  },
}

type GradeLabelKey =
  | 'excellent'
  | 'veryGood'
  | 'good'
  | 'average'
  | 'weak'
  | 'none'

interface TranslationPack {
  meta: {
    title: string
    description: string
    keywords: string
    locale: string
    socialTitle: string
    socialDescription: string
  }
  switcher: {
    label: string
    pl: string
    en: string
  }
  banner: {
    title: string
    description: string
    addButton: string
    githubButton: string
  }
  tester: {
    title: string
    description: string
    progress: string
    runTests: string
    testing: string
    reset: string
    testModeLabel: string
    quickMode: string
    quickModeDescription: string
    fullMode: string
    fullModeDescription: string
    filterAll: string
    filterBlocked: string
    filterNotBlocked: string
    filterPending: string
    gradeTitle: string
    finalScore: string
    blockingEffectiveness: string
    noResultsTitle: string
    noResultsDescription: string
    testsLabel: string
    stats: {
      total: string
      blocked: string
      notBlocked: string
      pending: string
    }
    status: {
      blocked: string
      notBlocked: string
      pending: string
    }
    methodTags: Record<MethodTag, string>
    gradeLabels: Record<GradeLabelKey, string>
    gradeSummary: (pct: number) => string
    testsCount: (count: number) => string
  }
  footer: {
    github: string
    note: string
  }
  seo: {
    title: string
    intro: string
    featureTitle: string
    features: Array<{
      title: string
      description: string
    }>
    whyTitle: string
    whyPoints: string[]
    supportedTitle: string
    supportedDescription: string
    supportedBlockers: string[]
    faqTitle: string
    faqIntro: string
    faq: Array<{
      question: string
      answer: string
    }>
    ctaTitle: string
    ctaDescription: string
    ctaPrimary: string
    ctaSecondary: string
  }
}

const translations: Record<Language, TranslationPack> = {
  pl: {
    meta: {
      title: 'Polish Complete Filters Tester — test adblocka, uBlock Origin i AdGuard',
      description:
        'Sprawdź skuteczność blokowania reklam, trackerów, malware, popupów i skryptów anti-adblock. Tester Polish Complete Filters działa z uBlock Origin, AdGuard, Brave i innymi adblockami.',
      keywords:
        'tester adblocka, test uBlock Origin, test AdGuard, blokowanie reklam, polish complete filters, filtr reklam, test trackerów, adblock checker, brave shields test',
      locale: 'pl_PL',
      socialTitle: 'Polish Complete Filters Tester — sprawdź swój adblock',
      socialDescription:
        'Przetestuj blokowanie reklam, trackerów, malware i popupów w uBlock Origin, AdGuard, Brave i innych adblockach.',
    },
    switcher: {
      label: 'Język',
      pl: 'Polski',
      en: 'English',
    },
    banner: {
      title: 'Polish Complete Filters',
      description: 'Zestaw filtrów usuwających irytujące elementy, reklamy, tracking i złośliwe skrypty ze stron WWW.',
      addButton: 'Dodaj do adblocka',
      githubButton: 'GitHub',
    },
    tester: {
      title: 'Tester blokowania reklam',
      description:
        'Kompleksowy test działania filtrów. Sprawdza, czy domeny reklamowe, trackingowe, malware, popupy oraz inne wektory zagrożeń są poprawnie blokowane.',
      progress: 'Postęp testu',
      runTests: 'Uruchom testy',
      testing: 'Testowanie...',
      reset: 'Resetuj',
      testModeLabel: 'Zakres testu',
      quickMode: 'Szybki test',
      quickModeDescription: 'Krótki zestaw kontrolny do szybkiej oceny konfiguracji i działania filtrów.',
      fullMode: 'Pełny test',
      fullModeDescription: 'Pełny zestaw kategorii i domen. Wolniejszy, ale dokładniejszy i bardziej reprezentatywny.',
      filterAll: 'Wszystkie',
      filterBlocked: 'Zablokowane',
      filterNotBlocked: 'Niezablokowane',
      filterPending: 'Oczekujące',
      gradeTitle: 'Ocena ochrony',
      finalScore: 'Wynik końcowy',
      blockingEffectiveness: 'skuteczności blokowania',
      noResultsTitle: 'Brak wyników dla tego filtra',
      noResultsDescription: 'Zmień filtr albo uruchom testy ponownie, aby zobaczyć pasujące pozycje.',
      testsLabel: 'testów',
      stats: {
        total: 'Testów',
        blocked: 'Zablokowane',
        notBlocked: 'Niezablokowane',
        pending: 'Oczekujące',
      },
      status: {
        blocked: 'Zablokowane',
        notBlocked: 'Niezablokowane',
        pending: 'Oczekuje',
      },
      methodTags: {
        cosmetic: 'kosmetyczny',
        script: 'skrypt',
        image: 'obraz',
        network: 'sieć',
      },
      gradeLabels: {
        excellent: 'Doskonała ochrona!',
        veryGood: 'Bardzo dobra ochrona',
        good: 'Dobra ochrona',
        average: 'Przeciętna ochrona',
        weak: 'Słaba ochrona',
        none: 'Brak ochrony!',
      },
      gradeSummary: (pct) => `Na podstawie zakończonych testów filtr zablokował ${pct}% sprawdzanych elementów.`,
      testsCount: (count) => `${count} testów`,
    },
    footer: {
      github: 'GitHub',
      note:
        'Tester używa preload, img i fetch do ładowania zasobów z typem pasującym do reguł filtrów. Performance API weryfikuje, czy żądanie dotarło do serwera, czy zostało zablokowane.',
    },
    seo: {
      title: 'Jak działa tester Polish Complete Filters?',
      intro:
        'To narzędzie pozwala szybko sprawdzić, czy Twój adblock faktycznie blokuje reklamy, trackery, popupy, skrypty anti-adblock, malware i inne problematyczne żądania sieciowe. Tester został zaprojektowany z myślą o polskim internecie, ale obejmuje też globalne sieci reklamowe i popularne mechanizmy śledzenia.',
      featureTitle: 'Co sprawdza ten tester?',
      features: [
        {
          title: 'Reklamy i elementy sponsorowane',
          description: 'Weryfikuje blokowanie Google Ads, sieci reklamowych, widgetów sponsorowanych oraz elementów ukrywanych filtrami kosmetycznymi.',
        },
        {
          title: 'Trackery i analitykę',
          description: 'Sprawdza skrypty analityczne, piksele śledzące, fingerprinting, retargeting i popularne systemy telemetryczne.',
        },
        {
          title: 'Zagrożenia i uciążliwe skrypty',
          description: 'Testuje popupy, powiadomienia push, anti-adblock, potencjalnie niebezpieczne domeny oraz wybrane wektory malware i phishingu.',
        },
      ],
      whyTitle: 'Dlaczego warto testować filtry?',
      whyPoints: [
        'Szybko zobaczysz, czy uBlock Origin, AdGuard, Brave albo inny adblock działa zgodnie z oczekiwaniami.',
        'Łatwiej porównasz skuteczność różnych list filtrów i konfiguracji prywatności.',
        'Sprawdzisz, czy system nie przepuszcza trackerów, reklam i ryzykownych domen.',
      ],
      supportedTitle: 'Obsługiwane blokery i konfiguracje',
      supportedDescription:
        'Tester najlepiej sprawdza się z rozszerzeniami i przeglądarkami zgodnymi z regułami Adblock oraz z blokowaniem DNS.',
      supportedBlockers: [
        'uBlock Origin',
        'AdGuard',
        'Adblock Plus',
        'AdBlock',
        'Brave Shields',
        'NextDNS / Pi-hole / AdGuard Home',
      ],
      faqTitle: 'FAQ — najczęstsze pytania',
      faqIntro: 'Poniżej znajdziesz krótkie odpowiedzi dotyczące interpretacji wyników i działania testera.',
      faq: [
        {
          question: 'Czy wynik 100% oznacza pełną ochronę?',
          answer:
            'Nie. Oznacza bardzo dobrą skuteczność w ramach obecnego zestawu testów. Żaden tester nie pokryje wszystkich możliwych skryptów, domen i technik śledzenia spotykanych w sieci.',
        },
        {
          question: 'Czy tester działa tylko z Polish Complete Filters?',
          answer:
            'Nie. Możesz go używać także z innymi listami filtrów oraz wbudowanymi mechanizmami blokowania, np. w Brave czy na poziomie DNS.',
        },
        {
          question: 'Dlaczego niektóre zasoby pokazują się jako niezablokowane?',
          answer:
            'Powody mogą być różne: filtr nie obejmuje danej domeny, dana metoda blokowania działa tylko dla określonego typu zasobu albo używana konfiguracja jest mniej agresywna.',
        },
        {
          question: 'Czy test może wykrywać blokowanie na poziomie DNS?',
          answer:
            'Tak. Tester korzysta m.in. z Fetch API, preload, obrazków i Performance API, dzięki czemu potrafi rozróżnić część przypadków blokowania przeglądarkowego oraz DNS.',
        },
      ],
      ctaTitle: 'Chcesz poprawić wynik?',
      ctaDescription:
        'Dodaj listę Polish Complete Filters do swojego adblocka i uruchom test ponownie, aby sprawdzić skuteczność blokowania po aktualizacji filtrów.',
      ctaPrimary: 'Dodaj listę filtrów',
      ctaSecondary: 'Zobacz repozytorium',
    },
  },
  en: {
    meta: {
      title: 'Polish Complete Filters Tester — ad blocker test for uBlock Origin and AdGuard',
      description:
        'Check how well your blocker stops ads, trackers, malware, popups, and anti-adblock scripts. Polish Complete Filters Tester works with uBlock Origin, AdGuard, Brave, and other blockers.',
      keywords:
        'ad blocker tester, uBlock Origin test, AdGuard test, ad blocking checker, tracker test, Polish Complete Filters, Brave Shields test, malware blocking test',
      locale: 'en_US',
      socialTitle: 'Polish Complete Filters Tester — test your ad blocker',
      socialDescription:
        'Measure ad, tracker, popup, malware, and anti-adblock blocking in uBlock Origin, AdGuard, Brave, and similar tools.',
    },
    switcher: {
      label: 'Language',
      pl: 'Polish',
      en: 'English',
    },
    banner: {
      title: 'Polish Complete Filters',
      description: 'A filter list that removes annoying elements, ads, tracking, and malicious scripts from websites.',
      addButton: 'Add to ad blocker',
      githubButton: 'GitHub',
    },
    tester: {
      title: 'Ad blocking tester',
      description:
        'A comprehensive filter test that checks whether ad, tracking, malware, popup, and other risky domains are blocked correctly.',
      progress: 'Test progress',
      runTests: 'Run tests',
      testing: 'Testing...',
      reset: 'Reset',
      testModeLabel: 'Test scope',
      quickMode: 'Quick test',
      quickModeDescription: 'A shorter control set for a fast configuration and sanity check.',
      fullMode: 'Full test',
      fullModeDescription: 'Complete category coverage with more domains. Slower, but more representative.',
      filterAll: 'All',
      filterBlocked: 'Blocked',
      filterNotBlocked: 'Not blocked',
      filterPending: 'Pending',
      gradeTitle: 'Protection grade',
      finalScore: 'Final score',
      blockingEffectiveness: 'blocking effectiveness',
      noResultsTitle: 'No results for this filter',
      noResultsDescription: 'Change the filter or run the tests again to see matching items.',
      testsLabel: 'tests',
      stats: {
        total: 'Tests',
        blocked: 'Blocked',
        notBlocked: 'Not blocked',
        pending: 'Pending',
      },
      status: {
        blocked: 'Blocked',
        notBlocked: 'Not blocked',
        pending: 'Pending',
      },
      methodTags: {
        cosmetic: 'cosmetic',
        script: 'script',
        image: 'image',
        network: 'network',
      },
      gradeLabels: {
        excellent: 'Excellent protection!',
        veryGood: 'Very strong protection',
        good: 'Good protection',
        average: 'Average protection',
        weak: 'Weak protection',
        none: 'No protection!',
      },
      gradeSummary: (pct) => `Based on completed checks, your filter blocked ${pct}% of tested elements.`,
      testsCount: (count) => `${count} tests`,
    },
    footer: {
      github: 'GitHub',
      note:
        'The tester uses preload, img, and fetch requests to load resources matching common filter rule types. The Performance API helps verify whether a request reached the server or was blocked earlier.',
    },
    seo: {
      title: 'How does Polish Complete Filters Tester work?',
      intro:
        'This tool helps you verify whether your ad blocker really blocks ads, trackers, popups, anti-adblock scripts, malware, and other problematic requests. It is optimized for the Polish web, but it also covers global ad networks and widely used tracking systems.',
      featureTitle: 'What does this tester check?',
      features: [
        {
          title: 'Ads and sponsored elements',
          description: 'It validates Google Ads, ad networks, sponsored widgets, and cosmetic filtering that hides ad-like elements from the page.',
        },
        {
          title: 'Trackers and analytics',
          description: 'It checks analytics scripts, tracking pixels, fingerprinting, retargeting, and common telemetry endpoints.',
        },
        {
          title: 'Threats and annoying scripts',
          description: 'It tests popups, push notifications, anti-adblock scripts, suspicious domains, and selected malware or phishing vectors.',
        },
      ],
      whyTitle: 'Why should you test your filters?',
      whyPoints: [
        'You can quickly see whether uBlock Origin, AdGuard, Brave, or another blocker is configured effectively.',
        'You can compare the real-world impact of different filter lists and privacy setups.',
        'You can verify whether trackers, ads, and risky domains still slip through your protection.',
      ],
      supportedTitle: 'Supported blockers and setups',
      supportedDescription:
        'The tester is most useful with extensions, browsers, and DNS tools that support Adblock-style filtering rules.',
      supportedBlockers: [
        'uBlock Origin',
        'AdGuard',
        'Adblock Plus',
        'AdBlock',
        'Brave Shields',
        'NextDNS / Pi-hole / AdGuard Home',
      ],
      faqTitle: 'FAQ — common questions',
      faqIntro: 'Here are short answers to the most common questions about the tester and its results.',
      faq: [
        {
          question: 'Does a 100% score mean full protection?',
          answer:
            'No. It means excellent performance within this test suite. No single tester can cover every script, domain, and tracking technique used across the web.',
        },
        {
          question: 'Does the tester only work with Polish Complete Filters?',
          answer:
            'No. You can also use it with other filter lists, built-in browser blockers such as Brave Shields, and DNS-level blocking solutions.',
        },
        {
          question: 'Why are some resources shown as not blocked?',
          answer:
            'Possible reasons include missing rules for that domain, rule types that only match specific resource categories, or a less aggressive privacy setup.',
        },
        {
          question: 'Can the tester detect DNS-level blocking?',
          answer:
            'Yes. It combines Fetch API, preload, image loading, and the Performance API to identify several browser-level and DNS-level blocking patterns.',
        },
      ],
      ctaTitle: 'Want a better score?',
      ctaDescription:
        'Add Polish Complete Filters to your blocker and run the test again to measure the improvement after updating your filter setup.',
      ctaPrimary: 'Add filter list',
      ctaSecondary: 'View repository',
    },
  },
}

function normalizeLanguage(value: string | null | undefined): Language | null {
  if (!value) return null
  const normalized = value.toLowerCase().trim()
  const match = SUPPORTED_LANGUAGES.find((lang) => normalized === lang || normalized.startsWith(`${lang}-`))
  return match ?? null
}

function detectBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'pl'

  const candidates = [...(navigator.languages ?? []), navigator.language]
  for (const candidate of candidates) {
    const normalized = normalizeLanguage(candidate)
    if (normalized) return normalized
  }

  return 'en'
}

function getStoredLanguage(): Language | null {
  if (typeof window === 'undefined') return null
  try {
    return normalizeLanguage(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

function getInitialLanguage(): Language {
  return getStoredLanguage() ?? detectBrowserLanguage()
}

function translateTestName(name: string, language: Language): string {
  if (language === 'pl') return name
  if (name.startsWith('Klasa ')) return name.replace(/^Klasa /, 'Class ')
  if (name.startsWith('Polskie ')) return name.replace(/^Polskie /, 'Polish ')
  return name
}

interface I18nContextValue {
  language: Language
  setLanguage: (language: Language) => void
  t: TranslationPack
  translateCategoryName: (categoryId: string, fallback: string) => string
  translateTestName: (name: string) => string
  translateMethodTag: (tag: MethodTag) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage)

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.setAttribute('data-language', language)
    try {
      window.localStorage.setItem(STORAGE_KEY, language)
    } catch {
      // ignore storage write errors
    }
  }, [language])

  useEffect(() => {
    const syncLanguageFromStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return

      const nextLanguage = normalizeLanguage(event.newValue)
      if (nextLanguage) {
        setLanguageState(nextLanguage)
      }
    }

    window.addEventListener('storage', syncLanguageFromStorage)

    return () => {
      window.removeEventListener('storage', syncLanguageFromStorage)
    }
  }, [])

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage: setLanguageState,
      t: translations[language],
      translateCategoryName: (categoryId, fallback) =>
        CATEGORY_TRANSLATIONS[language][categoryId] ?? fallback,
      translateTestName: (name) => translateTestName(name, language),
      translateMethodTag: (tag) => translations[language].tester.methodTags[tag],
    }),
    [language]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within LanguageProvider')
  }
  return context
}
