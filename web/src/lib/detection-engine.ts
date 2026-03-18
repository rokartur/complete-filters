import type { MethodTag } from '@/lib/i18n'
import type { FilterHint } from '@/lib/reference-engine'

export type NetworkTestStatus = 'blocked' | 'not-blocked'

/**
 * Ad Blocker Detection Engine v3
 *
 * Detects whether URLs/elements are blocked by:
 * - Browser-based ad blockers (uBlock Origin, AdGuard, etc.)
 * - DNS-level blockers (Pi-hole, AdGuard Home, NextDNS, etc.)
 * - $redirect / $redirect-rule neutering (uBlock redirects to noop scripts)
 *
 * Architecture:
 *
 * PRIMARY signal — fetch() with mode: 'no-cors'
 *   Catches generic block rules (||domain.com^) that match all request types.
 *   - fetch RESOLVES → resource is reachable (may still be neutered via redirect)
 *   - fetch THROWS TypeError → request cancelled → resource is BLOCKED
 *
 * SECONDARY signal — element-based detection with redirect awareness
 *   <link rel="preload" as="script"> for .js URLs, <img> for all others.
 *   Catches type-specific rules ($script, $image) AND detects $redirect neutering:
 *   - onload + Performance entry missing or duration < 10ms → REDIRECT detected → BLOCKED
 *   - onload + Performance entry with normal duration → genuinely loaded → NOT BLOCKED
 *   - onerror + Performance 'loaded' → server error, not blocked
 *   - onerror + Performance 'blocked' (responseEnd=0) → DNS blocking
 *   - onerror + Performance 'not-found' → NOT BLOCKED (fetch is authoritative)
 *
 * COSMETIC signal — DOM visibility check
 *   Creates bait elements with ad-like class/id and checks if ad blocker hides them.
 *
 * Priority when combining signals: BLOCKED > NOT BLOCKED
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
const REDIRECT_DURATION_THRESHOLD_MS = 10
const REDIRECT_CHECK_DELAY_MS = 50

/**
 * Retry delays for redirect detection when the reference engine hints that
 * a $redirect rule exists. Performance API entries may not be written
 * immediately — especially on slower devices or when the buffer was recently
 * cleared between batches. These retries give the browser extra time.
 */
const REDIRECT_RETRY_DELAYS_MS = [100, 250, 500]

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
 * Check if a resource was likely redirected by an ad blocker to a local
 * neutered version (e.g. via $redirect=noopjs, $redirect=1x1-transparent.gif).
 *
 * Ad blockers like uBlock Origin use $redirect rules to transparently replace
 * blocked resources with harmless local versions:
 *   ||googlesyndication.com/adsbygoogle.js$script,redirect=noopjs
 *   ||ads.example.com/pixel.gif$image,redirect=1x1.gif
 *
 * These redirects are invisible to standard load events (onload fires normally).
 * We detect them via Performance Resource Timing:
 *
 * - MV2 (Firefox + webRequest): The Performance entry is recorded under the
 *   extension URL (moz-extension://...), not the original URL.
 *   → getEntriesByName(originalUrl) returns nothing → redirect detected.
 *
 * - MV3 (Chrome + DNR): The Performance entry may exist for the original URL
 *   but with near-zero duration (resource loaded from extension memory).
 *   → entry.duration < 10ms → redirect detected.
 *
 * Normal cross-origin network requests ALWAYS take ≥20ms (DNS + TCP + TLS + HTTP
 * round-trip). Extension-local resources load in 0-3ms with zero network I/O.
 * A threshold of 10ms safely distinguishes redirects from real network responses.
 */
function isLikelyRedirected(url: string): boolean {
  try {
    const entries = performance.getEntriesByType(
      'resource'
    ) as PerformanceResourceTiming[]

    const matching = entries.filter(
      (e) =>
        e.name === url ||
        e.name === url.replace(/\/$/, '') ||
        e.name === url + '/'
    )

    if (matching.length === 0) {
      // No Performance entry for original URL — ad blocker redirected to
      // extension-internal URL. Common in MV2/Firefox where the entry is
      // recorded under moz-extension:// instead of the original URL.
      return true
    }

    // Check if ANY matching entry has suspiciously short duration.
    // Extension-local redirects have duration 0-3ms; real network responses
    // take ≥20ms even with connection reuse (HTTP round-trip overhead).
    return matching.some(
      (e) => e.duration >= 0 && e.duration < REDIRECT_DURATION_THRESHOLD_MS
    )
  } catch {
    return false // Can't determine — assume not redirected
  }
}

/**
 * Detect blocking via fetch (primary detection method).
 *
 * With `mode: 'no-cors'`, the browser suppresses CORS errors and returns an
 * opaque response (status 0, null body). This means:
 * - If fetch() RESOLVES → the HTTP request reached the server and a response
 *   came back. The resource is REACHABLE (but may still be neutered by a
 *   type-specific $redirect rule — detected by the element method).
 * - If fetch() THROWS TypeError → the request was cancelled before reaching
 *   the network. This happens when:
 *   · A browser extension intercepts via generic block rule (||domain.com^)
 *   · A DNS-level blocker returns NXDOMAIN or 0.0.0.0
 *   In all cases, the resource is BLOCKED.
 *
 * IMPORTANT: fetch sends request type 'xmlhttprequest', NOT 'script' or 'image'.
 * Type-specific rules like `$script,redirect=noopjs` do NOT match fetch.
 * The element-based methods (preload/img) handle these via redirect detection.
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
 *
 * When hintHasRedirect is true, the redirect check uses retries with longer
 * delays to catch Performance API entries that haven't been written yet.
 */
function detectViaPreload(
  url: string,
  hintHasRedirect = false
): Promise<NetworkTestStatus> {
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
      // Preload succeeded — but might be a neutered $redirect resource.
      // Ad blockers (uBlock Origin, AdGuard) can redirect $script requests
      // to local noop scripts: ||domain.com/ad.js$script,redirect=noopjs
      // The redirect is transparent — onload fires as if the real resource loaded.
      //
      // Since $redirect rules are type-specific ($script), our fetch() method
      // (which sends type 'xmlhttprequest') is NOT matched and succeeds.
      // Only the preload (type 'script') triggers the redirect.
      //
      // Detect by checking if the Performance entry is missing (MV2/Firefox:
      // entry under extension URL) or has near-zero duration (MV3/Chrome:
      // loaded from extension memory without network roundtrip).
      //
      // When hintHasRedirect is true, use retry logic for more reliable detection.
      setTimeout(async () => {
        const redirected = await isLikelyRedirectedWithRetry(url, hintHasRedirect)
        settle(redirected ? 'blocked' : 'not-blocked')
      }, REDIRECT_CHECK_DELAY_MS)
    }

    link.onerror = () => {
      // Preload failed — could be ad blocker, CORS error, or 404.
      // Check Performance API to distinguish. If ambiguous, report not-blocked
      // because fetch is the authoritative signal for blocking.
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
          // OR buffer cleared. Report not-blocked; fetch is authoritative.
          settle('not-blocked')
        }
      }, ELEMENT_ERROR_SETTLE_DELAY_MS)
    }

    document.head.appendChild(link)

    // Timeout for preload — if nothing responds, assume not blocked
    timeoutId = window.setTimeout(() => {
      settle('not-blocked')
    }, ELEMENT_TIMEOUT_MS)
  })
}

/**
 * Detect blocking via <img> element (matches $image rules).
 *
 * When hintHasRedirect is true, the redirect check uses retries with longer
 * delays to catch Performance API entries that haven't been written yet.
 */
function detectViaImage(
  url: string,
  hintHasRedirect = false
): Promise<NetworkTestStatus> {
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
      // Image loaded — but might be a neutered $redirect resource.
      // Ad blockers can redirect $image requests to local noop images
      // (1x1 transparent pixel) via $image,redirect=1x1.gif rules.
      // Detect via Performance API: missing entry or near-zero duration.
      // When hintHasRedirect is true, use retry logic for reliability.
      setTimeout(async () => {
        const redirected = await isLikelyRedirectedWithRetry(url, hintHasRedirect)
        settle(redirected ? 'blocked' : 'not-blocked')
      }, REDIRECT_CHECK_DELAY_MS)
    }

    img.onerror = () => {
      // Image failed — check Performance API to distinguish
      // blocked vs server error / not-an-image.
      // If ambiguous, report not-blocked — fetch is the authoritative signal.
      setTimeout(() => {
        const perf = checkPerformanceEntry(url)
        if (perf === 'loaded') {
          // Server responded (just not with a valid image) — NOT blocked
          settle('not-blocked')
        } else if (perf === 'blocked') {
          // Performance entry shows DNS-level blocking (responseEnd=0)
          settle('blocked')
        } else {
          // No entry — ambiguous. Report not-blocked; fetch is authoritative.
          settle('not-blocked')
        }
      }, ELEMENT_ERROR_SETTLE_DELAY_MS)
    }

    img.src = url

    // Timeout for image — if nothing responds, assume not blocked
    timeoutId = window.setTimeout(() => settle('not-blocked'), ELEMENT_TIMEOUT_MS)
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
 * Enhanced redirect detection with retries.
 *
 * When the reference engine confirms a $redirect rule exists for a URL,
 * we KNOW the ad blocker should redirect it. But Performance API entries
 * may not be written instantly — especially after buffer clears between
 * test batches. This function retries the check at increasing intervals.
 *
 * Without a hint, falls back to a single check (standard behavior).
 */
async function isLikelyRedirectedWithRetry(
  url: string,
  hintHasRedirect: boolean
): Promise<boolean> {
  // First check — immediate
  if (isLikelyRedirected(url)) return true

  // If no hint says redirect expected, don't retry
  if (!hintHasRedirect) return false

  // Retry with increasing delays — the hint gives us confidence
  // that a redirect SHOULD exist, so it's worth waiting longer.
  for (const delay of REDIRECT_RETRY_DELAYS_MS) {
    await new Promise((r) => setTimeout(r, delay))
    if (isLikelyRedirected(url)) return true
  }

  // Even after retries, no redirect detected. This can happen when:
  // - The user's ad blocker doesn't have the same rules as the reference
  // - The Performance buffer was completely flushed
  // - The ad blocker version uses a different mechanism
  return false
}

/**
 * Core network test: detects if a URL is blocked by the ad blocker.
 *
 * Strategy: run fetch + element-based detection in parallel, combine results.
 *
 * fetch() catches generic block rules (||domain.com^) that block ALL types.
 *
 * Element methods catch TYPE-SPECIFIC rules and $redirect neutering:
 * - <link preload as="script"> for .js URLs — detects $script,redirect=noopjs
 *   by checking Performance API for missing entries or near-zero duration.
 * - <img> for other URLs — detects $image,redirect and confirms DNS blocking.
 *
 * Priority order for combining results:
 * 1. If ANY method clearly detects blocking → BLOCKED (immediate)
 * 2. Otherwise → NOT BLOCKED
 *
 * There is no "inconclusive" state — if blocking cannot be proven,
 * the resource is reported as not-blocked.
 *
 * When a FilterHint is provided (from @ghostery/adblocker reference engine):
 * - If hint.hasRedirect is true, redirect detection retries multiple times
 *   with longer delays to catch slow Performance API writes.
 * - If hint.shouldBlock is true but all methods say not-blocked, an extra
 *   redirect check is attempted as a final fallback.
 *
 * Example: adsbygoogle.js with $script,redirect=noopjs:
 * - fetch: succeeds (not a $script request) → 'not-blocked'
 * - preload: onload fires but redirect detected → 'blocked'
 * - Combined: 'blocked' wins ✅
 */
export function testNetworkResource(
  url: string,
  hint?: FilterHint
): Promise<NetworkTestStatus> {
  return new Promise((resolve) => {
    let settled = false
    let completed = 0
    const hintHasRedirect = hint?.hasRedirect ?? false
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
    //
    // When the reference engine hints that a $redirect rule exists, pass
    // hintHasRedirect so the redirect check retries with longer delays.
    if (isScriptUrl(url)) {
      detections.push(detectViaPreload(url, hintHasRedirect))
    } else {
      detections.push(detectViaImage(url, hintHasRedirect))
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

          if (completed === detections.length) {
            // All methods returned not-blocked.
            // If the reference engine says a $redirect rule exists, the ad
            // blocker SHOULD have redirected the resource. Do one final
            // redirect check — the entry may have been written late.
            if (hintHasRedirect) {
              isLikelyRedirectedWithRetry(url, true).then((redirected) => {
                finish(redirected ? 'blocked' : 'not-blocked')
              })
            } else {
              finish('not-blocked')
            }
          }
        })
        .catch(() => {
          if (settled) return
          completed += 1
          if (completed === detections.length) {
            finish('not-blocked')
          }
        })
    })

    // Safety timeout — if nothing responds in time, assume not blocked.
    window.setTimeout(() => {
      finish('not-blocked')
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
