import type { TestCategory } from './index'

export const errorTrackers: TestCategory = {
  id: 'error-trackers',
  name: 'Error Trackery',
  tests: [
    { name: 'Bugsnag notify', url: 'https://notify.bugsnag.com/' },
    { name: 'Bugsnag sessions', url: 'https://sessions.bugsnag.com/' },
    { name: 'Bugsnag API', url: 'https://api.bugsnag.com/' },
    { name: 'Bugsnag app', url: 'https://app.bugsnag.com/' },
    { name: 'Sentry app', url: 'https://app.getsentry.com/' },
    { name: 'Sentry ingest', url: 'https://o0.ingest.sentry.io/' },
    { name: 'Rollbar', url: 'https://cdnjs.cloudflare.com/ajax/libs/rollbar.js/2.26.0/rollbar.min.js' },
    { name: 'Datadog RUM', url: 'https://www.datadoghq-browser-agent.com/datadog-rum-v4.js' },
    { name: 'Datadog Logs', url: 'https://www.datadoghq-browser-agent.com/datadog-logs-v4.js' },
  ],
}
