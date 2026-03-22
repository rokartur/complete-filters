import type { TestCategory } from './index'

export const cryptominers: TestCategory = {
  id: 'cryptominers',
  name: 'Kryptokoparki',
  tests: [
    { name: 'CoinHive', url: 'https://coinhive.com/lib/coinhive.min.js' },
    { name: 'Coin-Hive', url: 'https://coin-hive.com/' },
    { name: 'CoinIMP', url: 'https://www.coinimp.com/' },
    { name: 'MoneroMiner', url: 'https://monerominer.rocks/' },
    { name: '2Miners', url: 'https://2miners.com/' },
    { name: 'MinerAlt', url: 'https://mineralt.com/' },
    { name: 'NFWebMiner', url: 'https://nfwebminer.com/miner.js' },
  ],
}
