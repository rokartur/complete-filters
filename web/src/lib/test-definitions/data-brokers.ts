import type { TestCategory } from './index'

export const dataBrokers: TestCategory = {
  id: 'data-brokers',
  name: 'Brokerzy danych / DMP',
  tests: [
    { name: 'Lotame DMP', url: 'https://tags.crwdcntrl.net/lt/c/0/sync.min.js' },
    { name: 'Neustar', url: 'https://aa.agkn.com/adscores/g.js' },
    { name: 'Eyeota', url: 'https://ps.eyeota.net/pixel' },
    { name: 'Exelate (Nielsen)', url: 'https://loadm.exelator.com/load/' },
    { name: 'Demandbase', url: 'https://tag.demandbase.com/0.min.js' },
    { name: '6sense', url: 'https://j.6sc.co/6si.min.js' },
    { name: 'Clearbit', url: 'https://tag.clearbitscripts.com/v1/0/tags.js' },
    { name: 'ZoomInfo', url: 'https://ws.zoominfo.com/pixel/0' },
    { name: 'Bombora DMP', url: 'https://ml314.com/tag.aspx' },
    { name: 'Treasure Data', url: 'https://cdn.treasuredata.com/sdk/2.5/td.min.js' },
    { name: 'Permutive', url: 'https://cdn.permutive.com/0-web.js' },
    { name: 'Weborama', url: 'https://cstatic.weborama.fr/js/advertiserv2/adperf_launch.js' },
    { name: 'Nielsen DAR', url: 'https://secure-dcr.imrworldwide.com/cgi-bin/gn' },
  ],
}
