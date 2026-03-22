import type { TestCategory } from './index'

export const retargeting: TestCategory = {
  id: 'retargeting',
  name: 'Retargeting i remarketing',
  tests: [
    { name: 'Google Remarketing', url: 'https://www.googleadservices.com/pagead/conversion_async.js' },
    { name: 'AdRoll Retargeting', url: 'https://d.adroll.com/pixel/0/0' },
    { name: 'Criteo Retargeting', url: 'https://dis.criteo.com/dis/rtb/appnexus/cookieMatch.aspx' },
    { name: 'RTB House', url: 'https://creativecdn.com/tags' },
    { name: 'Facebook Custom Audiences', url: 'https://www.facebook.com/tr?id=0&ev=PageView' },
  ],
}
