import type { TestCategory } from './index'

export const dataBrokers: TestCategory = {
  id: 'data-brokers',
  name: 'Brokerzy danych / DMP',
  tests: [
    { name: 'Oracle Data Cloud', url: 'https://tags.bluekai.com/site/0' },
    { name: 'Lotame DMP', url: 'https://tags.crwdcntrl.net/lt/c/0/sync.min.js' },
    { name: 'Salesforce DMP', url: 'https://cdn.krxd.net/controltag/0.js' },
    { name: 'Neustar', url: 'https://aa.agkn.com/adscores/g.js' },
    { name: 'Eyeota', url: 'https://ps.eyeota.net/pixel' },
    { name: 'Exelate (Nielsen)', url: 'https://loadm.exelator.com/load/' },
    { name: 'AddThis Data', url: 'https://m.addthisedge.com/live/boost/0' },
    { name: 'Acxiom', url: 'https://ds.rlcdn.com/rlpixelid/0' },
    { name: 'Demandbase', url: 'https://tag.demandbase.com/0.min.js' },
    { name: '6sense', url: 'https://j.6sc.co/6si.min.js' },
    { name: 'Clearbit', url: 'https://tag.clearbitscripts.com/v1/0/tags.js' },
    { name: 'ZoomInfo', url: 'https://ws.zoominfo.com/pixel/0' },
    { name: 'Bombora DMP', url: 'https://ml314.com/tag.aspx' },
    { name: 'Treasure Data', url: 'https://cdn.treasuredata.com/sdk/2.5/td.min.js' },
    { name: 'IntentIQ', url: 'https://cdn.intentiq.com/intentiq/loader.js' },
    { name: 'Permutive', url: 'https://cdn.permutive.com/0-web.js' },
    { name: 'Weborama', url: 'https://cstatic.weborama.fr/js/advertiserv2/adperf_launch.js' },
    { name: 'Nielsen DAR', url: 'https://secure-dcr.imrworldwide.com/cgi-bin/gn' },
  ],
}
