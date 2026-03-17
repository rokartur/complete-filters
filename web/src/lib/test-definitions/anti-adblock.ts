import type { TestCategory } from './index'

export const antiAdblock: TestCategory = {
  id: 'anti-adblock',
  name: 'Skrypty anti-adblock',
  tests: [
    { name: 'BlockAdBlock', url: 'https://cdn.blockadblock.com/blockadblock.js' },
    { name: 'FuckAdBlock', url: 'https://cdnjs.cloudflare.com/ajax/libs/fuckadblock/3.2.1/fuckadblock.min.js' },
    { name: 'Admiral (anti-adb)', url: 'https://v.getadmiral.com/v1/script/0.js' },
    { name: 'PageFair', url: 'https://asset.pagefair.com/measures.js' },
    { name: 'Sourcepoint', url: 'https://gdpr-tcfv2.sp-prod.net/wrapperMessagingWithoutDetection.js' },
    { name: 'Blockthrough', url: 'https://btloader.com/tag?o=0&upapi=true' },
    { name: 'Ad Recover', url: 'https://files.adrecover.com/adrcvr.js' },
    { name: 'Uponit', url: 'https://uponit.com/front.js' },
  ],
}
