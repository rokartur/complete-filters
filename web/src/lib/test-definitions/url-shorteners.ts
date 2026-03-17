import type { TestCategory } from './index'

export const urlShorteners: TestCategory = {
  id: 'url-shorteners',
  name: 'Skracacze linków / monetizacja',
  tests: [
    { name: 'adf.ly', url: 'https://adf.ly/js/entry.js' },
    { name: 'shorte.st', url: 'https://shorte.st/js/packed.js' },
    { name: 'ouo.io', url: 'https://ouo.io/ck.php' },
    { name: 'linkvertise', url: 'https://linkvertise.com/cdn/publisher.js' },
  ],
}
