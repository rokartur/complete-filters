import type { MethodTag } from '@/lib/i18n'

export type NetworkTestStatus = 'blocked' | 'not-blocked' | 'inconclusive'

/**
 * Ad Blocker Detection Engine v2
 *
 * Detects whether URLs/elements are blocked by:
 * - Browser-based ad blockers (uBlock Origin, AdGuard, etc.)
 * - DNS-level blockers (Pi-hole, AdGuard Home, NextDNS, etc.)
 * - $redirect / $redirect-rule neutering (uBlock Origin redirects to empty scripts)
 *
 * Detection methods (combined for maximum accuracy):
 * 1. fetch() with mode: 'no-cors' — primary detector; catches generic URL rules,
 *    $third-party, $xmlhttprequest, and most $redirect rules (because generic
 *    block rules like ||domain.com^ block all request types)
 * 2. <link rel="preload" as="script"> — detects $script filter rules
 * 3. <img> element — detects $image filter rules
 * 4. Performance Resource Timing API — disambiguates:
 *    - No entry at all → browser ad blocker intercepted before request
 *    - Entry with responseEnd=0 → DNS-level blocking
 *    - Entry with real timing → NOT blocked (server error / CORS is not blocking)
 * 5. DOM visibility check (cosmetic filters) — detects CSS-based ad hiding
 *
 * Key improvement: uses MULTIPLE detection methods per URL simultaneously.
 * If a method clearly detects blocking → resource is considered BLOCKED.
 * If at least one method clearly loads the resource and none detect blocking,
 * the resource is considered NOT BLOCKED.
 * Otherwise the result is INCONCLUSIVE.
 * This catches $redirect rules where scripts load as neutered versions but
 * fetch is still blocked by the generic ||domain.com^ rule.
 */

// Increase buffer for 400+ tests (each may generate 2-3 Performance entries)
try {
  performance.setResourceTimingBufferSize(8000)
} catch {
  // older browsers may not support this
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const PERFORMANCE_SETTLE_DELAY_MS = 80
const ELEMENT_ERROR_SETTLE_DELAY_MS = 150
const ELEMENT_TIMEOUT_MS = 4000
const NETWORK_TEST_TIMEOUT_MS = 6000

/**
 * Check whether a URL looks like a JavaScript file based on extension.
 */
export function isScriptUrl(url: string): boolean {
  return /\.js($|\?|&|#)/i.test(url)
}

/**
 * Check whether a URL looks like an image/pixel based on extension.
 */
export function isImageUrl(url: string): boolean {
  return /\.(gif|png|jpe?g|webp|svg|ico|bmp)($|\?|&|#)/i.test(url)
}

/**
 * Performance Resource Timing check (v2 — no transferSize dependency).
 *
 * IMPORTANT: `transferSize` is ALWAYS 0 for cross-origin resources without
 * `Timing-Allow-Origin` header (which is virtually every ad/tracking URL).
 * The old code used `transferSize === 0` as a signal, causing false negatives.
 *
 * Instead we rely only on fields available for all entries:
 * - `duration` — time from start to responseEnd (available cross-origin)
 * - `responseEnd` — when the last byte was received (available cross-origin)
 *
 * Returns 'loaded' | 'blocked' | 'not-found'
 */
function checkPerformanceEntry(
  url: string
): 'loaded' | 'blocked' | 'not-found' {
  try {
    const entries = performance.getEntriesByType(
      'resource'
    ) as PerformanceResourceTiming[]

    // Search with exact match and common normalization variants
    const entry = entries.find(
      (e) =>
        e.name === url ||
        e.name === url.replace(/\/$/, '') ||
        e.name === url + '/'
    )

    if (!entry) {
      return 'not-found' // No entry → browser ad blocker intercepted before request
    }

    // Entry exists — check if a real response was received
    if (entry.responseEnd === 0) {
      return 'blocked' // responseEnd = 0 → no response received (DNS block)
    }
    if (entry.responseEnd <= entry.startTime && entry.duration <= 0) {
      return 'blocked' // No duration → request was aborted/blocked
    }

    // Real entry with actual response timing — request went through
    return 'loaded'
  } catch {
    return 'not-found'
  }
}

/**
 * Detect blocking via fetch (matches generic URL rules, $3p, $xmlhttprequest).
 *
 * When an ad blocker blocks a request:
 * - Browser extension (uBlock Origin, etc.): cancels the request → TypeError
 * - DNS-level blocker: DNS resolution fails → TypeError
 *
 * When an ad blocker uses $redirect:
 * - The specific resource type (e.g. $script) is redirected to a neutered version
 * - BUT the generic rule (||domain.com^) blocks ALL other types including fetch
 * - So fetch will STILL fail even when a script preload succeeds via redirect
 *
 * After successful fetch, we verify via Performance API to catch edge cases
 * like DNS-level blocking where the browser still creates a Performance entry.
 */
async function detectViaFetch(url: string): Promise<NetworkTestStatus> {
  try {
    await fetch(url, { mode: 'no-cors', cache: 'no-store' })
    // Fetch resolved (opaque response) — request went through
    // Wait for Performance API to settle, then verify
    await delay(PERFORMANCE_SETTLE_DELAY_MS)
    const perfResult = checkPerformanceEntry(url)
    if (perfResult === 'not-found') {
      // No Performance entry despite fetch success → ad blocker redirected
      // to an extension URL (the entry has the extension URL, not ours)
      return 'blocked'
    }
    if (perfResult === 'blocked') {
      // Performance entry shows DNS-level blocking
      return 'blocked'
    }
    // Real response confirmed
    return 'not-blocked'
  } catch {
    // fetch() with mode:'no-cors' suppresses CORS errors (returns opaque
    // response instead of throwing). So a failure here means the request was
    // genuinely cancelled — by a browser extension, DNS blocker, or network
    // error. For well-known tracking domains this is effectively blocking.
    return 'blocked'
  }
}

/**
 * Detect blocking via <link rel="preload" as="script"> (matches $script rules).
 * Safe: does not execute any code.
 */
function detectViaPreload(url: string): Promise<NetworkTestStatus> {
  return new Promise((resolve) => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'script'
    link.href = url
    let timeoutId: number | undefined

    const settle = (status: NetworkTestStatus) => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
      cleanup()
      resolve(status)
    }

    const cleanup = () => {
      try {
        link.remove()
      } catch {
        /* already removed */
      }
    }

    link.onload = () => {
      // Preload succeeded — but could be a neutered $redirect resource.
      // We don't trust onload alone; the fetch method handles redirect detection.
      settle('not-blocked')
    }

    link.onerror = () => {
      // Preload failed — could be ad blocker or CORS/404.
      // Check Performance API to distinguish.
      setTimeout(() => {
        const perf = checkPerformanceEntry(url)
        if (perf === 'loaded') {
          // Request reached server (CORS or 404) — NOT blocked
          settle('not-blocked')
        } else if (perf === 'blocked') {
          settle('blocked')
        } else {
          // No entry usually means the blocker intercepted before request dispatch.
          settle('blocked')
        }
      }, ELEMENT_ERROR_SETTLE_DELAY_MS)
    }

    document.head.appendChild(link)

    // Timeout for preload
    timeoutId = window.setTimeout(() => {
      settle('inconclusive')
    }, ELEMENT_TIMEOUT_MS)
  })
}

/**
 * Detect blocking via <img> element (matches $image rules).
 */
function detectViaImage(url: string): Promise<NetworkTestStatus> {
  return new Promise((resolve) => {
    const img = new Image()
    let timeoutId: number | undefined

    const settle = (status: NetworkTestStatus) => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
      img.onload = null
      img.onerror = null
      resolve(status)
    }

    img.onload = () => {
      settle('not-blocked') // Image loaded — NOT blocked
    }

    img.onerror = () => {
      // Image failed — check Performance API to distinguish
      // blocked vs server error / not-an-image
      setTimeout(() => {
        const perf = checkPerformanceEntry(url)
        if (perf === 'loaded') {
          // Server responded (just not with a valid image) — NOT blocked
          settle('not-blocked')
        } else if (perf === 'blocked') {
          settle('blocked')
        } else {
          // No entry usually means interception before the request reached network.
          settle('blocked')
        }
      }, ELEMENT_ERROR_SETTLE_DELAY_MS)
    }

    img.src = url

    // Timeout for image
    timeoutId = window.setTimeout(() => settle('inconclusive'), ELEMENT_TIMEOUT_MS)
  })
}

/**
 * Test a bait element (cosmetic filter test).
 * Creates a div with ad-like class/id and checks if the ad blocker hides it.
 *
 * Creates multiple bait elements with different ad-like attributes for better
 * detection. Checks at multiple intervals since cosmetic filters may apply at
 * different times depending on the ad blocker's mutation observer timing.
 */
export function testBaitElement(test: {
  baitClass?: string
  baitId?: string
}): Promise<boolean> {
  return new Promise((resolve) => {
    const bait = document.createElement('div')
    bait.innerHTML = '&nbsp;'
    // Use ad-like dimensions but keep off-screen
    bait.style.cssText =
      'position:absolute;left:-10000px;top:-10000px;width:300px;height:250px;pointer-events:none;'

    if (test.baitClass) bait.className = test.baitClass
    if (test.baitId) bait.id = test.baitId

    // Add ad-like data attributes to improve cosmetic filter matching
    bait.setAttribute('data-ad', 'true')
    bait.setAttribute('aria-label', 'advertisement')

    document.body.appendChild(bait)

    const checkBlocked = (): boolean => {
      try {
        if (!document.body.contains(bait)) {
          return true // Element was removed from DOM entirely
        }
        const style = window.getComputedStyle(bait)
        return (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.opacity === '0' ||
          style.position === 'absolute' && style.clip === 'rect(0px, 0px, 0px, 0px)' ||
          style.height === '0px' ||
          style.maxHeight === '0px' ||
          bait.offsetHeight === 0 ||
          bait.offsetWidth === 0 ||
          bait.getBoundingClientRect().height === 0 ||
          (!bait.offsetParent &&
            style.position !== 'fixed' &&
            style.position !== 'absolute')
        )
      } catch {
        return true // if we can't read it, it's been removed/blocked
      }
    }

    // Check at multiple intervals to catch delayed cosmetic filter application
    // uBlock Origin's DOM observer typically fires within 50-200ms
    const checkTimes = [200, 500, 1000]
    let checkIndex = 0

    const runCheck = () => {
      if (checkBlocked()) {
        try {
          bait.remove()
        } catch {
          /* already removed */
        }
        resolve(true)
        return
      }

      checkIndex++
      if (checkIndex < checkTimes.length) {
        setTimeout(runCheck, checkTimes[checkIndex] - checkTimes[checkIndex - 1])
      } else {
        // All checks passed — not blocked
        try {
          bait.remove()
        } catch {
          /* already removed */
        }
        resolve(false)
      }
    }

    setTimeout(runCheck, checkTimes[0])
  })
}

/**
 * Core network test: detects if a URL is blocked by the ad blocker.
 *
 * Strategy: run MULTIPLE detection methods simultaneously and combine results.
 * Priority order:
 * 1. If any method clearly detects blocking → BLOCKED
 * 2. Else if any method clearly loads the resource → NOT BLOCKED
 * 3. Else → INCONCLUSIVE
 *
 * This multi-method approach catches:
 * - Generic URL-pattern rules (||domain.com^) — caught by ALL methods
 * - Type-specific rules ($script, $image) — caught by respective element tests
 * - $redirect / $redirect-rule neutering — caught by fetch (the generic block
 *   rule still blocks fetch even when the script type is redirected)
 * - DNS-level blocking — caught by Performance API check after fetch fails
 *
 * Method combinations by URL type:
 * - .js URLs:  fetch + <link preload>
 * - Other URLs: fetch + <img>
 */
export function testNetworkResource(url: string): Promise<NetworkTestStatus> {
  return new Promise((resolve) => {
    let settled = false
    let completed = 0
    let sawNotBlocked = false
    const finish = (status: NetworkTestStatus) => {
      if (settled) return
      settled = true
      resolve(status)
    }

    // Collect detection promises
    const detections: Promise<NetworkTestStatus>[] = []

    // Method 1: Fetch-based detection (always — catches generic rules)
    detections.push(detectViaFetch(url))

    // Method 2: Type-specific element-based detection
    if (isScriptUrl(url)) {
      detections.push(detectViaPreload(url))
    } else {
      detections.push(detectViaImage(url))
    }

    // Combine results incrementally so a clear signal can finish early.
    detections.forEach((detection) => {
      detection
        .then((result) => {
          if (settled) return

          completed += 1

          if (result === 'blocked') {
            finish('blocked')
            return
          }

          if (result === 'not-blocked') {
            sawNotBlocked = true
          }

          if (completed === detections.length) {
            finish(sawNotBlocked ? 'not-blocked' : 'inconclusive')
          }
        })
        .catch(() => {
          if (settled) return
          completed += 1
          if (completed === detections.length) {
            finish(sawNotBlocked ? 'not-blocked' : 'inconclusive')
          }
        })
    })

    // Safety timeout — if nothing responds in time, surface an honest unknown.
    window.setTimeout(() => {
      finish(sawNotBlocked ? 'not-blocked' : 'inconclusive')
    }, NETWORK_TEST_TIMEOUT_MS)
  })
}

/**
 * Get the detection method tag for display purposes
 */
export function getMethodTag(test: {
  url?: string
  baitClass?: string
  baitId?: string
}): MethodTag {
  if (test.baitClass || test.baitId) return 'cosmetic'
  if (!test.url) return 'network'
  if (isScriptUrl(test.url)) return 'script'
  if (isImageUrl(test.url)) return 'image'
  return 'network'
}
