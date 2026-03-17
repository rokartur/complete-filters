import type { TestCategory } from './index'

export const affiliateTracking: TestCategory = {
  id: 'affiliate-tracking',
  name: 'Śledzenie afiliacyjne',
  tests: [
    { name: 'Commission Junction', url: 'https://www.emjcd.com/tags/c' },
    { name: 'Impact Radius', url: 'https://d.impactradius-event.com/' },
    { name: 'ShareASale', url: 'https://www.shareasale.com/shareasale.js' },
    { name: 'ClickBank', url: 'https://www.clickbank.net/storefront/' },
    { name: 'Awin', url: 'https://www.dwin1.com/0.js' },
    { name: 'Tradedoubler', url: 'https://pi.pardot.com/pd.js' },
    { name: 'Skimlinks', url: 'https://s.skimresources.com/js/0.js' },
    { name: 'VigLink', url: 'https://cdn.viglink.com/api/vglnk.js' },
  ],
}
