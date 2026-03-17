import type { TestCategory } from './index'

export const cosmeticFilters: TestCategory = {
  id: 'cosmetic-filters',
  name: 'Filtry kosmetyczne (ukrywanie elementów)',
  tests: [
    { name: 'Klasa .ad', baitClass: 'ad' },
    { name: 'Klasa .ads', baitClass: 'ads' },
    { name: 'Klasa .adsbox', baitClass: 'adsbox' },
    { name: 'Klasa .ad-banner', baitClass: 'ad-banner' },
    { name: 'Klasa .ad-placeholder', baitClass: 'ad-placeholder' },
    { name: 'Klasa .ad-wrapper', baitClass: 'ad-wrapper' },
    { name: 'Klasa .adUnit', baitClass: 'adUnit' },
    { name: 'Klasa .textAd', baitClass: 'textAd' },
    { name: 'Klasa .banner-ad', baitClass: 'banner-ad' },
    { name: 'Klasa .pub_300x250', baitClass: 'pub_300x250' },
    { name: 'Klasa .sponsoredAd', baitClass: 'sponsoredAd' },
    { name: 'Klasa .ad-leaderboard', baitClass: 'ad-leaderboard' },
    { name: 'ID #ad_box', baitId: 'ad_box' },
    { name: 'ID #ads-banner', baitId: 'ads-banner' },
    { name: 'ID #google_ads', baitId: 'google_ads' },
    { name: 'ID #ad-container', baitId: 'ad-container' },
  ],
}
