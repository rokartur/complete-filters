import type { TestCategory } from './index'

export const cryptominers: TestCategory = {
  id: 'cryptominers',
  name: 'Kryptokoparki',
  tests: [
    { name: 'CoinIMP', url: 'https://www.coinimp.com/scripts/min.js' },
    { name: 'BrowserMine', url: 'https://browsermine.com/miner.js' },
    { name: 'Papoto', url: 'https://papoto.com/api/cdn/v2/miner.js' },
    { name: 'MoneroMiner', url: 'https://monerominer.rocks/miner.js' },
    { name: '2Miners', url: 'https://2miners.com/miner.js' },
    { name: 'NitroKod', url: 'https://nitrokod.com/miner.js' },
    { name: 'MineXMR', url: 'https://minexmr.com/miner.js' },
    { name: 'NFWebMiner', url: 'https://nfwebminer.com/miner.js' },
  ],
}
