export const LANGUAGE = 'en' as const

export type MethodTag = 'cosmetic' | 'script' | 'image' | 'document' | 'network'

export const REPO_URL = 'https://github.com/rokartur/complete-filters'
export const FILTER_CATEGORIES_URL =
  'https://github.com/rokartur/complete-filters/tree/main/filter'
export const SITE_URL = 'https://rokartur.github.io/complete-filters/'

const CATEGORY_LABELS: Record<string, string> = {
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
}

type GradeLabelKey =
  | 'excellent'
  | 'veryGood'
  | 'good'
  | 'average'
  | 'weak'
  | 'none'

interface SiteCopy {
  meta: {
    title: string
    description: string
    keywords: string
    locale: string
    socialTitle: string
    socialDescription: string
  }
  banner: {
    title: string
    description: string
    addButton: string
    hideButton: string
    githubButton: string
  }
  categorySection: {
    title: string
    description: string
    note: string
    copyAll: string
    copyAllCopied: string
    copyAllFailed: string
    subscribe: string
    openDirect: string
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

export const SITE_COPY: SiteCopy = {
  meta: {
    title: 'Complete Filters Tester — ad blocker test for uBlock Origin, AdGuard, and Brave',
    description:
      'Check how well your blocker stops ads, trackers, malware, popups, anti-adblock scripts, and other unwanted web requests. Complete Filters Tester works with uBlock Origin, AdGuard, Brave, and similar blockers.',
    keywords:
      'ad blocker tester, uBlock Origin test, AdGuard test, Brave Shields test, ad blocking checker, tracker test, malware blocking test, privacy test, filter list tester, Complete Filters',
    locale: 'en_US',
    socialTitle: 'Complete Filters Tester — test your ad blocker',
    socialDescription:
      'Measure ad, tracker, popup, malware, and anti-adblock blocking in uBlock Origin, AdGuard, Brave, and similar tools across general and regional web threats.',
  },
  banner: {
    title: 'Complete Filters',
    description: 'A categorized filter set that removes ads, tracking, malware, and other annoying elements from websites.',
    addButton: 'Browse categories',
    hideButton: 'Hide categories',
    githubButton: 'GitHub',
  },
  categorySection: {
    title: 'Filter categories',
    description: 'Pick a category and subscribe to its filter list.',
    note: 'If your blocker does not open the subscription prompt automatically, use the raw GitHub URL below and add it manually in Custom filters.',
    copyAll: 'Copy all links',
    copyAllCopied: 'Copied all links',
    copyAllFailed: 'Copy failed',
    subscribe: 'Subscribe',
    openDirect: 'Open direct URL',
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
      document: 'document',
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
      'The tester uses preload, img, a hidden iframe, and fetch to simulate different request types. Page-like URLs are checked as documents, but results can still differ from manually opening a link when a filter only targets top-level navigation.',
  },
  seo: {
    title: 'How does Complete Filters Tester work?',
    intro:
      'This tool helps you verify whether your ad blocker really blocks ads, trackers, popups, anti-adblock scripts, malware, and other problematic requests. It is designed for broad real-world coverage across general, regional, and high-risk web traffic.',
    featureTitle: 'What does this tester check?',
    features: [
      {
        title: 'Ads and sponsored elements',
        description: 'It validates Google Ads, ad networks, sponsored widgets, affiliate placements, and cosmetic filtering that hides ad-like elements from the page.',
      },
      {
        title: 'Trackers and analytics',
        description: 'It checks analytics scripts, tracking pixels, fingerprinting, retargeting, telemetry endpoints, and other privacy-invasive requests.',
      },
      {
        title: 'Threats and annoying scripts',
        description: 'It tests popups, push notifications, anti-adblock scripts, suspicious domains, malicious infrastructure, and selected malware or phishing vectors.',
      },
    ],
    whyTitle: 'Why should you test your filters?',
    whyPoints: [
      'You can quickly see whether uBlock Origin, AdGuard, Brave, or another blocker is configured effectively.',
      'You can compare the real-world impact of different filter lists, category subscriptions, and privacy setups.',
      'You can verify whether trackers, ads, risky domains, and nuisance scripts still slip through your protection.',
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
        question: 'Does the tester only work with Complete Filters?',
        answer:
          'No. You can also use it with other filter lists, built-in browser blockers such as Brave Shields, and DNS-level blocking solutions.',
      },
      {
        question: 'Why are some resources shown as not blocked?',
        answer:
          'Possible reasons include missing rules for that domain, rules that only match a specific request type (for example document vs script vs image), or a less aggressive privacy setup. This matters especially for top-level pages and links opened directly in a tab.',
      },
      {
        question: 'Can the tester detect DNS-level blocking?',
        answer:
          'Yes. It combines Fetch API, preload, image loading, and the Performance API to identify several browser-level and DNS-level blocking patterns.',
      },
    ],
    ctaTitle: 'Want a better score?',
    ctaDescription:
      'Browse the available Complete Filters categories, then run the test again after choosing the setup that fits your protection level.',
    ctaPrimary: 'Browse categories',
    ctaSecondary: 'View repository',
  },
}

export function applyStaticLanguage() {
  document.documentElement.lang = LANGUAGE
  document.documentElement.setAttribute('data-language', LANGUAGE)
}

export function getCategoryLabel(categoryId: string, fallback: string) {
  return CATEGORY_LABELS[categoryId] ?? fallback
}

export function getMethodTagLabel(tag: MethodTag) {
  return SITE_COPY.tester.methodTags[tag]
}

export function getAbpSubscriptionUrl(location: string, title: string) {
  return `abp:subscribe?location=${location}&title=${encodeURIComponent(title)}`
}

export function getTestLabel(name: string): string {
  const exactTranslations: Record<string, string> = {
    'Tracking i analityka': 'Tracking and analytics',
    'Fingerprinting i śledzenie zaawansowane': 'Fingerprinting and advanced tracking',
    'Newsletter popupy i marketing': 'Newsletter popups and marketing',
    'Popupy, popundery i przekierowania': 'Popups, popunders, and redirects',
    'Śledzenie afiliacyjne': 'Affiliate tracking',
    'Reklamy wideo': 'Video ads',
    'Śledzenie e-mail': 'Email tracking',
    'Trackery społecznościowe': 'Social media trackers',
    'Powiadomienia push': 'Push notifications',
    'Sieci reklamowe': 'Ad networks',
    'Banery cookie / Consent': 'Cookie banners / consent',
    'Onet Reklama': 'Onet Ads',
    'WP Reklama': 'WP Ads',
  }

  if (exactTranslations[name]) return exactTranslations[name]
  if (name.startsWith('Klasa ')) return name.replace(/^Klasa /, 'Class ')
  if (name.startsWith('Polskie ')) return name.replace(/^Polskie /, 'Polish ')
  return name
}