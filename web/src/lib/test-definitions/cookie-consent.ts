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
    { name: 'Termly Policy Embed', url: 'https://app.termly.io/embed-policy.min.js' },
    { name: 'Termly Consent Embed', url: 'https://app.termly.io/embed.min.js' },
    { name: 'Consentmanager', url: 'https://cdn.consentmanager.net/delivery/autoblocking/0.js' },
    { name: 'Iubenda TCF Stub', url: 'https://cdn.iubenda.com/cs/tcf/stub-v2.js' },
    { name: 'Iubenda GPP Stub', url: 'https://cdn.iubenda.com/cs/gpp/stub.js' },
    { name: 'Axeptio', url: 'https://static.axept.io/sdk.js' },
    { name: 'Cookie Script', url: 'https://cdn.cookie-script.com/s/0.js' },
    { name: 'CookieFirst', url: 'https://consent.cookiefirst.com/sites/0/consent.js' },
    { name: 'Transcend', url: 'https://cdn.transcend.io/cm/0/airgap.js' },
    { name: 'Securiti', url: 'https://cdn.securiti.ai/consent/cookie-consent-sdk.js' },
  ],
}
