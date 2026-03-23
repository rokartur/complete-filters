import type { TestCategory } from './index'

export const urlShorteners: TestCategory = {
  id: 'url-shorteners',
  name: 'Skracacze linków / monetizacja',
  tests: [
    { name: 'adf.ly', url: 'https://adf.ly/js/entry.js' },
    { name: 'exe.io', url: 'https://exe.io/js/full-page-script.js' },
    { name: 'linkvertise', url: 'https://linkvertise.com/cdn/publisher.js' },
    { name: 'ouo.io', url: 'https://ouo.io/' },
  ],
}
