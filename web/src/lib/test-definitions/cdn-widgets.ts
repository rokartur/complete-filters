import type { TestCategory } from './index'

export const cdnWidgets: TestCategory = {
  id: 'cdn-widgets',
  name: 'Widgety CDN i skrypty 3rd party',
  tests: [
    { name: 'WP.com Stats', url: 'https://pixel.wp.com/g.gif' },
    { name: 'Jetpack Stats', url: 'https://stats.wp.com/e-0.js' },
    { name: 'Cloudflare Insights', url: 'https://static.cloudflareinsights.com/beacon.min.js' },
    { name: 'BuySellAds', url: 'https://s3.buysellads.com/ac/bsa.js' },
    { name: 'Carbon Ads', url: 'https://cdn.carbonads.com/carbon.js' },
    { name: 'EthicalAds', url: 'https://media.ethicalads.io/media/client/ethicalads.min.js' },
    { name: 'Yandex Metrica', url: 'https://mc.yandex.ru/metrika/tag.js' },
    { name: 'Baidu Statistics', url: 'https://hm.baidu.com/hm.js' },
  ],
}
