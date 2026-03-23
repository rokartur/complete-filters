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
    { name: 'googleads.g.doubleclick.net', url: 'https://googleads.g.doubleclick.net/' },
    { name: 'tpc.googlesyndication.com', url: 'https://tpc.googlesyndication.com/' },
    { name: 'ade.googlesyndication.com', url: 'https://ade.googlesyndication.com/' },
    { name: 'adclick.g.doubleclick.net', url: 'https://adclick.g.doubleclick.net/' },
    { name: 'cm.g.doubleclick.net', url: 'https://cm.g.doubleclick.net/' },
    { name: 'bid.g.doubleclick.net', url: 'https://bid.g.doubleclick.net/' },
    { name: 'fls.doubleclick.net', url: 'https://fls.doubleclick.net/' },
  ],
}
