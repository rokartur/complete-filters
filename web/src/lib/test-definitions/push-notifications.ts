import type { TestCategory } from './index'

export const pushNotifications: TestCategory = {
  id: 'push-notifications',
  name: 'Powiadomienia push',
  tests: [
    { name: 'OneSignal', url: 'https://cdn.onesignal.com/sdks/OneSignalSDK.js' },
    { name: 'PushEngage', url: 'https://clientcdn.pushengage.com/sdks/pushengage-web-sdk.js' },
    { name: 'Webpushr', url: 'https://cdn.webpushr.com/sw-server.min.js' },
    { name: 'Subscribers', url: 'https://cdn.subscribers.com/assets/subscribers.js' },
    { name: 'iZooto', url: 'https://cdn.izooto.com/scripts/sdk/izooto.js' },
    { name: 'CleverPush', url: 'https://static.cleverpush.com/channel/loader/0.js' },
    { name: 'VWO Engage', url: 'https://d5phz18u4wuww.cloudfront.net/PushSDK-Latest.js' },
    { name: 'Aimtell', url: 'https://cdn.aimtell.com/trackpush/sdk.js' },
  ],
}
