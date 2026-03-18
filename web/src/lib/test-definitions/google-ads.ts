import type { TestCategory } from './index'

export const googleAds: TestCategory = {
  id: 'google-ads',
  name: 'Google Ads / AdSense / AdMob',
  tests: [
    { name: 'Google AdSense', url: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js' },
    { name: 'Google Ads', url: 'https://www.googleadservices.com/pagead/conversion.js' },
    { name: 'DoubleClick GPT', url: 'https://securepubads.g.doubleclick.net/tag/js/gpt.js' },
    { name: 'DoubleClick Ad', url: 'https://ad.doubleclick.net/ddm/activity/' },
    { name: 'Google Ad Manager', url: 'https://pubads.g.doubleclick.net/gampad/ads' },
    { name: 'Google AdMob', url: 'https://admob-sdk.google.com/adunit' },
    { name: 'Google Partner Ads', url: 'https://www.google.com/adsense/search/async-ads.js' },
    { name: 'pagead2.googleadservices.com', url: 'https://pagead2.googleadservices.com/' },
    { name: 'stats.g.doubleclick.net', url: 'https://stats.g.doubleclick.net/' },
    { name: 'static.doubleclick.net', url: 'https://static.doubleclick.net/' },
    { name: 'm.doubleclick.net', url: 'https://m.doubleclick.net/' },
    { name: 'mediavisor.doubleclick.net', url: 'https://mediavisor.doubleclick.net/' },
  ],
}
