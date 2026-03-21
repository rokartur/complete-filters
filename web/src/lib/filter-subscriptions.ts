export interface FilterSubscriptionCategory {
  id: string
  fileName: `${string}.txt`
  title: string
  description: string
}

export const FILTER_RAW_BASE_URL =
  'https://media.githubusercontent.com/media/rokartur/complete-filters/refs/heads/main/filter'

export const FILTER_SUBSCRIPTION_CATEGORIES: FilterSubscriptionCategory[] = [
  {
    id: 'ads',
    fileName: 'ads.txt',
    title: 'Ads',
    description: 'General advertising domains and ad delivery systems.',
  },
  {
    id: 'annoyances',
    fileName: 'annoyances.txt',
    title: 'Annoyances',
    description: 'Popups, overlays, newsletter nags, fake urgency, and other annoyances.',
  },
  {
    id: 'anti-adblock',
    fileName: 'anti-adblock.txt',
    title: 'Anti-adblock',
    description: 'Anti-adblock scripts and related countermeasures.',
  },
  {
    id: 'compatibility',
    fileName: 'compatibility.txt',
    title: 'Compatibility',
    description: 'Compatibility fixes and exceptions that reduce site breakage.',
  },
  {
    id: 'content',
    fileName: 'content.txt',
    title: 'Low-value content',
    description: 'Content clutter, sponsored sections, placeholders, and other low-value page junk.',
  },
  {
    id: 'cookies',
    fileName: 'cookies.txt',
    title: 'Cookies / consent',
    description: 'Cookie banners and consent frameworks.',
  },
  {
    id: 'malware',
    fileName: 'malware.txt',
    title: 'Malware',
    description: 'Malware, phishing, scam, and other high-risk domains.',
  },
  {
    id: 'mixed',
    fileName: 'mixed.txt',
    title: 'Mixed',
    description: 'Rules that do not fit neatly into a single narrow category.',
  },
  {
    id: 'mobile',
    fileName: 'mobile.txt',
    title: 'Mobile',
    description: 'Mobile-specific nuisances and clutter from the mobile web.',
  },
  {
    id: 'privacy',
    fileName: 'privacy.txt',
    title: 'Privacy',
    description: 'Tracking, analytics, fingerprinting, and privacy-invasive requests.',
  },
  {
    id: 'regional',
    fileName: 'regional.txt',
    title: 'Regional',
    description: 'Poland-focused and other region-specific rules.',
  },
  {
    id: 'social',
    fileName: 'social.txt',
    title: 'Social',
    description: 'Social widgets, embedded platforms, and social media tracking.',
  },
  {
    id: 'video',
    fileName: 'video.txt',
    title: 'Video',
    description: 'Video ads and video-platform nuisances.',
  },
]

export function getFilterSubscriptionUrl(fileName: FilterSubscriptionCategory['fileName']) {
  return `${FILTER_RAW_BASE_URL}/${fileName}`
}