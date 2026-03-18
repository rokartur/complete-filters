import type { MethodTag } from '@/lib/i18n'

export type NetworkTestStatus = 'blocked' | 'not-blocked' | 'inconclusive'

/**
 * Ad Blocker Detection Engine v3
 *
 * Detects whether URLs/elements are blocked by:
 * - Browser-based ad blockers (uBlock Origin, AdGuard, etc.)
 * - DNS-level blockers (Pi-hole, AdGuard Home, NextDNS, etc.)
 *
 * Architecture:
 *
 * PRIMARY signal — fetch() with mode: 'no-cors'
 *   The authoritative detection method. With no-cors, CORS errors are suppressed:
 *   - fetch RESOLVES (opaque response) → resource is NOT BLOCKED
 *   - fetch THROWS TypeError → request was cancelled → resource is BLOCKED
 *   No Performance API involved — avoids false positives from redirects and
 *   buffer management issues.
 *
 * SECONDARY signal — element-based detection
 *   <link rel="preload"> for .js URLs, <img> for all others.
 *   Uses Performance Resource Timing API ONLY in element error handlers to
 *   distinguish server errors from ad blocker interception:
 *   - Performance entry with real timing → server responded (CORS/404, not blocked)
 *   - Performance entry with responseEnd=0 → DNS-level blocking confirmed
 *   - No Performance entry → INCONCLUSIVE (let fetch make the call)
 *
 * COSMETIC signal — DOM visibility check
 *   Creates bait elements with ad-like class/id and checks if ad blocker hides them.
 *
 * Priority when combining signals: BLOCKED > NOT BLOCKED > INCONCLUSIVE
 */

// Increase buffer for 400+ tests (each may generate 2-3 Performance entries)
try {
  performance.setResourceTimingBufferSize(8000)
} catch {
  // older browsers may not support this
}

const ELEMENT_ERROR_SETTLE_DELAY_MS = 150
const ELEMENT_TIMEOUT_MS = 4000
const NETWORK_TEST_TIMEOUT_MS = 6000
const BAIT_CLEANUP_TIMEOUT_MS = 1500

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
 * Detect blocking via fetch (primary detection method).
 *
 * With `mode: 'no-cors'`, the browser suppresses CORS errors and returns an
 * opaque response (status 0, null body). This means:
 * - If fetch() RESOLVES → the HTTP request reached the server and a response
 *   came back. The resource is NOT BLOCKED.
 * - If fetch() THROWS TypeError → the request was cancelled before reaching
 *   the network. This happens when:
 *   · A browser extension (uBlock Origin, AdGuard) intercepts via webRequest/DNR
 *   · A DNS-level blocker (Pi-hole, AdGuard Home, NextDNS) returns NXDOMAIN
 *   · The DNS resolves to 0.0.0.0 (connection refused)
 *   In all cases, the resource is BLOCKED.
 *
 * We intentionally do NOT consult the Performance Resource Timing API here.
 * Reasons:
 * 1. Many servers redirect (e.g. domain.com/ → www.domain.com/) — the
 *    Performance entry is recorded under the FINAL URL, not the original,
 *    causing false 'not-found' results.
 * 2. When running multiple detection methods in parallel, element-based
 *    methods (img/preload) create their own Performance entries for the
 *    same URL, confusing cross-method lookups.
 * 3. Performance buffer clearing between batches can remove entries
 *    before they are read.
 *
 * For $redirect rules (uBlock redirects to neutered noop.js):
 * - If a generic block rule also exists (||domain.com^), fetch is blocked
 *   because the block rule matches all request types → TypeError → 'blocked'.
 * - If only a type-specific redirect exists (||domain.com/x.js$script,redirect=...),
 *   fetch is not matched (it's xmlhttprequest, not script) → resolves → 'not-blocked'.
 *   This is technically correct: the domain is reachable, only the specific
 *   script type is neutered.
 */
async function detectViaFetch(url: string): Promise<NetworkTestStatus> {
  try {
    await fetch(url, { mode: 'no-cors', cache: 'no-store' })
    return 'not-blocked'
  } catch {
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
      // Preload failed — could be ad blocker, CORS error, or 404.
      // Check Performance API to distinguish, but treat 'not-found' as
      // inconclusive (not 'blocked') because the entry may be missing due
      // to URL redirects, buffer clearing, or timing issues.
      // The fetch method is the authoritative signal for blocking.
      setTimeout(() => {
        const perf = checkPerformanceEntry(url)
        if (perf === 'loaded') {
          // Request reached server (CORS or 404) — NOT blocked
          settle('not-blocked')
        } else if (perf === 'blocked') {
          // Performance entry shows DNS-level blocking (responseEnd=0)
          settle('blocked')
        } else {
          // No entry — ambiguous: could be extension blocking OR redirect
          // OR buffer cleared. Let fetch make the authoritative call.
          settle('inconclusive')
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
      // blocked vs server error / not-an-image.
      // Treat 'not-found' as inconclusive (not 'blocked') because:
      // - For non-image URLs, onerror ALWAYS fires (content isn't valid image data)
      // - The Performance entry may be under a different URL after redirects
      // - Buffer may have been cleared between batches
      // The fetch method is the authoritative signal for blocking.
      setTimeout(() => {
        const perf = checkPerformanceEntry(url)
        if (perf === 'loaded') {
          // Server responded (just not with a valid image) — NOT blocked
          settle('not-blocked')
        } else if (perf === 'blocked') {
          // Performance entry shows DNS-level blocking (responseEnd=0)
          settle('blocked')
        } else {
          // No entry — ambiguous. Let fetch make the authoritative call.
          settle('inconclusive')
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

    let settled = false
    let cleanupTimeoutId: number | undefined

    const finish = (blocked: boolean) => {
      if (settled) return
      settled = true
      if (cleanupTimeoutId !== undefined) {
        window.clearTimeout(cleanupTimeoutId)
      }
      try {
        bait.remove()
      } catch {
        /* already removed */
      }
      resolve(blocked)
    }

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
          (style.position === 'absolute' &&
            style.clip === 'rect(0px, 0px, 0px, 0px)') ||
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
        finish(true)
        return
      }

      checkIndex++
      if (checkIndex < checkTimes.length) {
        setTimeout(runCheck, checkTimes[checkIndex] - checkTimes[checkIndex - 1])
      } else {
        // All checks passed — not blocked
        finish(false)
      }
    }

    cleanupTimeoutId = window.setTimeout(() => {
      finish(checkBlocked())
    }, checkTimes[checkTimes.length - 1] + BAIT_CLEANUP_TIMEOUT_MS)

    setTimeout(runCheck, checkTimes[0])
  })
}

/**
 * Core network test: detects if a URL is blocked by the ad blocker.
 *
 * Strategy: run fetch + element-based detection simultaneously.
 *
 * fetch() is the PRIMARY and AUTHORITATIVE signal:
 * - TypeError → request was cancelled by ad blocker → BLOCKED
 * - Opaque response → server responded → NOT BLOCKED
 *
 * Element-based detection is a SECONDARY signal for edge cases:
 * - Confirms DNS-level blocking via Performance API (responseEnd=0)
 * - May catch type-specific rules ($script, $image)
 * - Returns 'inconclusive' when Performance entry is missing (common for
 *   redirects, buffer clearing, or timing issues)
 *
 * Priority order for combining results:
 * 1. If ANY method clearly detects blocking → BLOCKED (immediate)
 * 2. Else if ANY method clearly shows the resource loaded → NOT BLOCKED
 * 3. Else → INCONCLUSIVE (all methods ambiguous or timed out)
 *
 * Method combinations:
 * - .js URLs:   fetch + <link rel="preload" as="script">
 * - All others: fetch + <img>
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

    // Method 2: Element-based detection (always — provides a second signal)
    // - .js URLs:  <link rel="preload" as="script"> catches $script rules
    // - All others: <img> element — for non-image URLs onerror always fires,
    //   but the Performance API check inside onerror distinguishes "server
    //   responded (not an image)" from "request was blocked before dispatch".
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
