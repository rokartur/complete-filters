import type { TestCategory } from './index'

export const antiAdblock: TestCategory = {
  id: 'anti-adblock',
  name: 'Skrypty anti-adblock',
  tests: [
    { name: 'FuckAdBlock', url: 'https://cdnjs.cloudflare.com/ajax/libs/fuckadblock/3.2.1/fuckadblock.min.js' },
    { name: 'Admiral (anti-adb)', url: 'https://v.getadmiral.com/v1/script/0.js' },
    { name: 'Sourcepoint', url: 'https://gdpr-tcfv2.sp-prod.net/wrapperMessagingWithoutDetection.js' },
    { name: 'Blockthrough', url: 'https://btloader.com/tag?o=0&upapi=true' },
    { name: 'Uponit', url: 'https://uponit.com/front.js' },
    { name: 'Detect AdBlock', url: 'https://www.detectadblock.com/' },
    { name: 'Google Funding Choices', url: 'https://fundingchoicesmessages.google.com/i/pub-0' },
    { name: 'PageFair', url: 'https://asset.pagefair.com/measure.min.js' },
    { name: 'Clean.io', url: 'https://cdn.clean.io/tags/main.js' },
    { name: 'Instart Logic', url: 'https://script.instartlogic.com/' },
    { name: 'Adskeeper Anti-Adblock', url: 'https://jsc.adskeeper.com/site.js' },
  ],
}
