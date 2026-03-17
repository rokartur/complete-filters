import type { TestCategory } from './index'

export const videoAds: TestCategory = {
  id: 'video-ads',
  name: 'Reklamy wideo',
  tests: [
    { name: 'Google IMA (Video)', url: 'https://imasdk.googleapis.com/js/sdkloader/ima3.js' },
    { name: 'SpotX', url: 'https://search.spotxchange.com/js/spotx.v3.js' },
    { name: 'Connatix', url: 'https://cds.connatix.com/connatix.player.js' },
    { name: 'AdColony', url: 'https://static.adcolony.com/adc.js' },
    { name: 'Unity Ads', url: 'https://unityads.unity3d.com/show' },
    { name: 'Vungle', url: 'https://api.vungle.com/api/v5/new' },
    { name: 'FreeWheel', url: 'https://mssl.fwmrm.net/p/release/latest-JS/adm/prd/AdManager.js' },
    { name: 'Wistia', url: 'https://fast.wistia.com/assets/external/E-v1.js' },
    { name: 'Vidyard', url: 'https://play.vidyard.com/embed/v4.js' },
    { name: 'VAST (video ads)', url: 'https://pubads.g.doubleclick.net/gampad/ads?iu=/0/video' },
    { name: 'Teads (video)', url: 'https://cdn.teads.tv/media/format.js' },
  ],
}
