import type { TestCategory } from './index'

export const cookieConsent: TestCategory = {
  id: 'cookie-consent',
  name: 'Banery cookie / Consent',
  tests: [
    { name: 'CookieBot', url: 'https://consent.cookiebot.com/uc.js' },
    { name: 'OneTrust', url: 'https://cdn.cookielaw.org/scripttemplates/otSDKStub.js' },
    { name: 'Quantcast Choice', url: 'https://quantcast.mgr.consensu.org/choice/0/0/choice.js' },
    { name: 'Didomi', url: 'https://sdk.privacy-center.org/loader.js' },
    { name: 'Osano', url: 'https://cmp.osano.com/0/osano.js' },
    { name: 'Usercentrics', url: 'https://app.usercentrics.eu/browser-ui/latest/loader.js' },
    { name: 'Iubenda', url: 'https://cdn.iubenda.com/cs/iubenda_cs.js' },
    { name: 'TrustArc', url: 'https://consent.trustarc.com/notice' },
    { name: 'Termly', url: 'https://app.termly.io/resource-blocker/0' },
    { name: 'CookieYes', url: 'https://cdn-cookieyes.com/client_data/0/script.js' },
    { name: 'Consentmanager', url: 'https://cdn.consentmanager.net/delivery/autoblocking/0.js' },
    { name: 'Axeptio', url: 'https://static.axept.io/sdk.js' },
  ],
}
