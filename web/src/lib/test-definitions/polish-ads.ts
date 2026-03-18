import type { TestCategory } from './index'

export const polishAds: TestCategory = {
  id: 'polish-ads',
  name: 'Polskie sieci reklamowe',
  tests: [
    { name: 'WP Ads (Wirtualna Polska)', url: 'https://std.wpcdn.pl/wpjslib/wpjslib-inline.js' },
    { name: 'Gemius', url: 'https://gapl.hit.gemius.pl/gplayer.js' },
    { name: 'SALESmanago', url: 'https://app2.salesmanago.pl/static/sm.js' },
    { name: 'Allegro Analytics', url: 'https://analytics.allegro.pl/collector' },
    { name: 'Adrino', url: 'https://adrino.pl/adx/request' },
    { name: 'adocean', url: 'https://myao.adocean.pl/files/js/ado.js' },
    { name: 'Onet Ads (csr)', url: 'https://csr.onet.pl/csr-006/csr.js' },
    { name: 'Interia Ads', url: 'https://ad.interia.pl/' },
    { name: 'GetResponse', url: 'https://app.getresponse.com/view_webform.js' },
    { name: 'edrone', url: 'https://d.edrone.me/api/init' },
    { name: 'user.com', url: 'https://widget.user.com/widget.js' },
    { name: 'SAREhub', url: 'https://data.sarehub.com/' },
    { name: 'Synerise', url: 'https://web.snrbox.com/sdk.min.js' },
    { name: 'Cux.io', url: 'https://cux.io/cux-tracker.js' },
  ],
}
