import { testNetworkResource } from './detection-engine'

/**
 * Control probes — URLs that no filter list blocks, run before the real test.
 *
 * Every detection method ultimately reads "the request did not complete", and a
 * dead network produces that for every URL. Without controls, running the
 * tester offline or behind a captive portal scores a perfect A+, because every
 * failed request looks exactly like a successful block.
 *
 * The controls answer two different questions:
 * - the same-origin control: does the probe pipeline itself report a resource
 *   as blocked even though the page demonstrably just loaded it?
 * - the third-party controls: does ordinary cross-origin traffic work at all?
 *
 * A single third-party control failing is not enough to raise a flag — CDNs
 * have bad days, and one false alarm teaches users to ignore the warning.
 */

export type ReliabilityLevel = 'ok' | 'degraded' | 'offline'

export interface EnvironmentCheck {
  level: ReliabilityLevel
  /** Control URLs that did not come back clean, for the UI to name. */
  failed: string[]
}

/**
 * Stable, versioned, CORS-friendly assets on infrastructure that filter lists
 * do not target. Pinned paths so they cannot rot into 404s.
 */
const THIRD_PARTY_CONTROLS = [
  'https://cdn.jsdelivr.net/npm/normalize.css@8.0.1/normalize.css',
  'https://upload.wikimedia.org/wikipedia/commons/8/80/Wikipedia-logo-v2.svg',
] as const

function sameOriginControl(): string {
  return new URL('favicon.svg', document.baseURI).href
}

export async function checkEnvironment(): Promise<EnvironmentCheck> {
  if (navigator.onLine === false) {
    return { level: 'offline', failed: [] }
  }

  const control = sameOriginControl()
  const [ownOrigin, ...thirdParty] = await Promise.all(
    [control, ...THIRD_PARTY_CONTROLS].map(async (url) => ({
      url,
      status: await testNetworkResource(url),
    }))
  )

  const failed = [ownOrigin, ...thirdParty]
    .filter(({ status }) => status !== 'not-blocked')
    .map(({ url }) => url)

  // The page loaded from this origin, so "blocked" here means the pipeline is
  // misreading a resource that certainly resolves.
  const pipelineBroken = ownOrigin.status === 'blocked'
  const networkBroken = thirdParty.every(({ status }) => status !== 'not-blocked')

  return {
    level: pipelineBroken || networkBroken ? 'degraded' : 'ok',
    failed,
  }
}
