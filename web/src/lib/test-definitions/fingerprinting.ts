import type { TestCategory } from './index'

export const fingerprinting: TestCategory = {
  id: 'fingerprinting',
  name: 'Fingerprinting i śledzenie zaawansowane',
  tests: [
    { name: 'FingerprintJS', url: 'https://cdn.jsdelivr.net/npm/@fingerprintjs/fingerprintjs@3/dist/fp.min.js' },
    { name: 'ID5', url: 'https://cdn.id5-sync.com/api/1.0/id5-api.js' },
    { name: 'LiveRamp', url: 'https://launch.ats.rlcdn.com/ats.min.js' },
    { name: 'Tapad', url: 'https://pixel.tapad.com/idsync/ex/receive/check?partner_id=example' },
    { name: 'Session Replay (LogRocket)', url: 'https://cdn.lr-in-prod.com/LogRocket.min.js' },
    { name: 'Session Replay (Smartlook)', url: 'https://web-sdk.smartlook.com/recorder.js' },
    { name: 'WebTrends', url: 'https://s.webtrends.com/js/webtrends.min.js' },
    { name: 'Bombora', url: 'https://tag.brandcdn.com/autoscript/bomboracom_rxm2psmjr3dw80co/Bombora.js' },
    { name: 'MediaMath', url: 'https://pixel.mathtag.com/event/js' },
    { name: 'Zeotap', url: 'https://content.zeotap.com/sdk/idp.min.js' },
    { name: 'HUMAN (PerimeterX)', url: 'https://client.perimeterx.net/0/main.min.js' },
    { name: 'Akamai Bot Manager', url: 'https://d.akamaihd.net/sor/bot-manager/0.js' },
    { name: 'ThreatMetrix', url: 'https://h.online-metrix.net/fp/tags.js' },
    { name: 'Telesign', url: 'https://cdn.telesign.com/sdk/verify.js' },
    { name: 'Iovation', url: 'https://mpsnare.iesnare.com/snare.js' },
    { name: 'Arkose Labs', url: 'https://client-api.arkoselabs.com/v2/0/api.js' },
  ],
}
