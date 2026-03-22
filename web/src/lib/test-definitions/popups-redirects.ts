import type { TestCategory } from './index'

export const popupsRedirects: TestCategory = {
  id: 'popups-redirects',
  name: 'Popupy, popundery i przekierowania',
  tests: [
    { name: 'PopAds', url: 'https://c1.popads.net/pop.js' },
    { name: 'PopCash', url: 'https://cdn.popcash.net/pop.js' },
    { name: 'PopMyAds', url: 'https://cdn.popmyads.com/pop.js' },
    { name: 'RevenueHits', url: 'https://ads.revenuehits.com/api/serve.js' },
    { name: 'HilltopAds', url: 'https://ssp.hilltopads.com/?type=popup' },
    { name: 'JuicyAds', url: 'https://js.juicyads.com/jads.js' },
    { name: 'TrafficJunky', url: 'https://cdn.trafficjunky.net/ads/js/v2/tj_loader.js' },
    { name: 'AdCash', url: 'https://www.adcash.com/script/java.php' },
    { name: 'Propeller Push', url: 'https://propu.sh/pfe/current/tag.min.js' },
    { name: 'ExoClick', url: 'https://syndication.exoclick.com/splash.php' },
    { name: 'ExoClick (a)', url: 'https://a.exoclick.com/' },
  ],
}
