export interface TestDefinition {
  name: string
  url?: string
  baitClass?: string
  baitId?: string
}

export interface TestCategory {
  id: string
  name: string
  tests: TestDefinition[]
}

export type TestRunMode = 'quick' | 'full'

import { cosmeticFilters } from './cosmetic-filters'
import { googleAds } from './google-ads'
import { adNetworks } from './ad-networks'
import { polishAds } from './polish-ads'
import { trackingAnalytics } from './tracking-analytics'
import { socialTrackers } from './social-trackers'
import { errorTrackers } from './error-trackers'
import { fingerprinting } from './fingerprinting'
import { popupsRedirects } from './popups-redirects'
import { cryptominers } from './cryptominers'
import { malwarePhishing } from './malware-phishing'
import { telemetry } from './telemetry'
import { cookieConsent } from './cookie-consent'
import { pushNotifications } from './push-notifications'
import { videoAds } from './video-ads'
import { urlShorteners } from './url-shorteners'
import { newslettersPopups } from './newsletters-popups'
import { cdnWidgets } from './cdn-widgets'
import { antiAdblock } from './anti-adblock'
import { nativeTelemetry } from './native-telemetry'
import { emailTracking } from './email-tracking'
import { affiliateTracking } from './affiliate-tracking'
import { retargeting } from './retargeting'
import { dataBrokers } from './data-brokers'

const RAW_TEST_CATEGORIES: TestCategory[] = [
  cosmeticFilters,
  googleAds,
  adNetworks,
  polishAds,
  trackingAnalytics,
  socialTrackers,
  errorTrackers,
  fingerprinting,
  popupsRedirects,
  cryptominers,
  malwarePhishing,
  telemetry,
  cookieConsent,
  pushNotifications,
  videoAds,
  urlShorteners,
  newslettersPopups,
  cdnWidgets,
  antiAdblock,
  nativeTelemetry,
  emailTracking,
  affiliateTracking,
  retargeting,
  dataBrokers,
]

function getTestSignature(test: TestDefinition): string {
  if (test.url) return `url:${test.url}`
  if (test.baitClass) return `class:${test.baitClass}`
  if (test.baitId) return `id:${test.baitId}`
  return `name:${test.name}`
}

function dedupeCategories(categories: TestCategory[]): TestCategory[] {
  const seen = new Set<string>()

  return categories
    .map((category) => ({
      ...category,
      tests: category.tests.filter((test) => {
        const signature = getTestSignature(test)
        if (seen.has(signature)) {
          return false
        }
        seen.add(signature)
        return true
      }),
    }))
    .filter((category) => category.tests.length > 0)
}

export const TEST_CATEGORIES: TestCategory[] = dedupeCategories(RAW_TEST_CATEGORIES)

const QUICK_TEST_LIMIT_PER_CATEGORY = 4

function buildQuickCategories(categories: TestCategory[]): TestCategory[] {
  return categories
    .map((category) => {
      const baitTests = category.tests.filter((test) => test.baitClass || test.baitId)
      const networkTests = category.tests.filter((test) => !test.baitClass && !test.baitId)
      const quickTests = baitTests.length > 0
        ? baitTests
        : networkTests.slice(0, QUICK_TEST_LIMIT_PER_CATEGORY)

      return {
        ...category,
        tests: quickTests,
      }
    })
    .filter((category) => category.tests.length > 0)
}

export const QUICK_TEST_CATEGORIES: TestCategory[] = buildQuickCategories(TEST_CATEGORIES)

export function getTestCategories(mode: TestRunMode): TestCategory[] {
  return mode === 'quick' ? QUICK_TEST_CATEGORIES : TEST_CATEGORIES
}

export function getTotalTestCount(mode: TestRunMode = 'full'): number {
  return getTestCategories(mode).reduce((sum, cat) => sum + cat.tests.length, 0)
}
