import type { TestCategory } from './index'

export const cryptominers: TestCategory = {
  id: 'cryptominers',
  name: 'Kryptokoparki',
  tests: [
    { name: 'CoinHive', url: 'https://coinhive.com/lib/coinhive.min.js' },
    { name: 'CoinHive (alt)', url: 'https://authedmine.com/lib/authedmine.min.js' },
    { name: 'JSECoin', url: 'https://load.jsecoin.com/load/0/load.js' },
    { name: 'WebMinePool', url: 'https://webminepool.com/lib/base.js' },
    { name: 'PPoi', url: 'https://ppoi.org/lib/projectpoi.min.js' },
    { name: 'NoCoin (test)', url: 'https://coin-hive.com/lib/coinhive.min.js' },
    { name: 'MineroAmino', url: 'https://minero.cc/lib/minero.min.js' },
    { name: 'DeepMiner', url: 'https://deepminer.online/miner.min.js' },
  ],
}
