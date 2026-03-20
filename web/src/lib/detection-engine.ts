import type { MethodTag } from '@/lib/site-content'
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
const FRAME_SETTLE_DELAY_MS = 250
const FRAME_ABOUT_BLANK_RETRY_DELAY_MS = 300
const FRAME_TIMEOUT_MS = 5000
const NETWORK_TEST_TIMEOUT_MS = 7000
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
 * Check whether a URL likely represents a page/document navigation rather than
 * a script, image, or data endpoint.
 *
 * This is intentionally conservative. We only treat clearly page-like URLs as
 * document requests:
 * - bare origins and root paths (https://example.com/)
 * - trailing-slash paths that look like sections/pages
 * - common HTML/server-side page extensions (.html, .php, .asp, ...)
 *
 * Everything else falls back to generic network probing, because many tracking
 * endpoints also have extensionless paths (e.g. /collect, /visit, /track).
 */
export function isDocumentUrl(url: string): boolean {
  if (isScriptUrl(url) || isImageUrl(url)) return false

  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname || '/'

    if (pathname === '/' || pathname === '') {
      return true
    }

    if (pathname.endsWith('/')) {
      return true
    }

    return /\.(html?|xhtml|php|asp|aspx|jsp|jspx|cfm|cgi)($|\?|#)/i.test(
      pathname
    )
  } catch {
    return false
  }
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
 * Detect blocking for page/document-like URLs using a hidden iframe.
 *
 * This is a best-effort probe for cases where opening a URL directly is
 * blocked, but generic fetch/img requests are still allowed. We keep the logic
 * conservative to avoid false positives from frame restrictions like
 * X-Frame-Options or CSP frame-ancestors:
 *
 * - Performance entry 'loaded'  -> NOT BLOCKED
 * - Performance entry 'blocked' -> BLOCKED
 * - No entry + iframe stayed on about:blank -> likely BLOCKED before dispatch
 * - Everything else -> NOT BLOCKED / ambiguous
 */
function detectViaFrame(url: string): Promise<NetworkTestStatus> {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe')
    let timeoutId: number | undefined

    frame.style.cssText =
      'position:absolute;left:-10000px;top:-10000px;width:1px;height:1px;border:0;opacity:0;pointer-events:none;'
    frame.setAttribute('aria-hidden', 'true')

    const cleanup = () => {
      try {
        frame.remove()
      } catch {
        /* already removed */
      }
    }

    const isStillAboutBlank = (): boolean => {
      try {
        const href = frame.contentWindow?.location?.href
        return !href || href === 'about:blank'
      } catch {
        // SecurityError = frame navigated to a cross-origin URL.
        // Since we already checked Performance API (no entry found for the
        // original URL), this cross-origin navigation is MOST LIKELY an
        // ad blocker redirect to an extension-internal block page (e.g.
        // moz-extension://... or chrome-extension://...) which doesn't
        // create a Performance entry under the original URL.
        //
        // A real server response would normally create a Performance entry.
        // Without one, the evidence points to ad blocker interception.
        return true
      }
    }

    const settle = (status: NetworkTestStatus) => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
      cleanup()
      resolve(status)
    }

    frame.onload = () => {
      setTimeout(() => {
        const perf = checkPerformanceEntry(url)
        if (perf === 'loaded') {
          settle('not-blocked')
          return
        }
        if (perf === 'blocked') {
          settle('blocked')
          return
        }
        // No perf entry on first check — retry after a short delay.
        // Performance entries for iframe navigations can be delayed,
        // especially when the ad blocker redirects to an internal page.
        if (isStillAboutBlank()) {
          settle('blocked')
          return
        }
        setTimeout(() => {
          const perfRetry = checkPerformanceEntry(url)
          if (perfRetry === 'loaded') {
            settle('not-blocked')
            return
          }
          if (perfRetry === 'blocked') {
            settle('blocked')
            return
          }
          settle(isStillAboutBlank() ? 'blocked' : 'not-blocked')
        }, FRAME_ABOUT_BLANK_RETRY_DELAY_MS)
      }, FRAME_SETTLE_DELAY_MS)
    }

    frame.onerror = () => {
      setTimeout(() => {
        const perf = checkPerformanceEntry(url)
        if (perf === 'loaded') {
          settle('not-blocked')
          return
        }
        if (perf === 'blocked') {
          settle('blocked')
          return
        }
        // onerror with no perf entry — likely blocked before dispatch
        settle('blocked')
      }, FRAME_SETTLE_DELAY_MS)
    }

    document.body.appendChild(frame)
    frame.src = url

    timeoutId = window.setTimeout(() => {
      // Timeout: check once more before giving up
      const perf = checkPerformanceEntry(url)
      if (perf === 'loaded') {
        settle('not-blocked')
        return
      }
      if (perf === 'blocked') {
        settle('blocked')
        return
      }
      settle(isStillAboutBlank() ? 'blocked' : 'not-blocked')
    }, FRAME_TIMEOUT_MS)
  })
}

/**
 * Detect blocking via <link rel="stylesheet"> (matches $stylesheet rules).
 *
 * Ad blockers can block stylesheet requests to known ad/tracking domains.
 * Since we point this at non-CSS URLs, the browser will fire onerror for
 * invalid MIME types OR when the request is blocked. The Performance API
 * distinguishes "server responded with non-CSS" (loaded) from "blocked
 * before dispatch" (blocked/not-found).
 *
 * This provides an additional signal: generic rules like ||domain.com^ also
 * match $stylesheet requests, giving us a third independent detection path
 * alongside fetch and img/preload.
 *
 * Uses media="print" to prevent any loaded CSS from affecting page layout.
 */
function detectViaStylesheet(
  url: string,
  hintHasRedirect = false
): Promise<NetworkTestStatus> {
  return new Promise((resolve) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    // media="print" prevents accidental layout changes if CSS loads
    link.media = 'print'
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
      // Stylesheet "loaded" — but might be a neutered $redirect resource.
      // Check via Performance API like other element methods.
      setTimeout(async () => {
        const redirected = await isLikelyRedirectedWithRetry(url, hintHasRedirect)
        settle(redirected ? 'blocked' : 'not-blocked')
      }, REDIRECT_CHECK_DELAY_MS)
    }

    link.onerror = () => {
      // Stylesheet failed — could be ad blocker, CORS, or invalid MIME.
      // Check Performance API to distinguish.
      setTimeout(() => {
        const perf = checkPerformanceEntry(url)
        if (perf === 'loaded') {
          // Server responded (just not with valid CSS) — NOT blocked
          settle('not-blocked')
        } else if (perf === 'blocked') {
          // Performance entry shows DNS-level blocking (responseEnd=0)
          settle('blocked')
        } else {
          // No entry — likely blocked before dispatch (extension cancelled it).
          // Unlike preload/img onerror where we defer to fetch, here we can be
          // slightly more aggressive: stylesheet requests rarely fail silently
          // for any reason OTHER than ad blocker interception.
          settle('blocked')
        }
      }, ELEMENT_ERROR_SETTLE_DELAY_MS)
    }

    document.head.appendChild(link)

    timeoutId = window.setTimeout(() => {
      settle('not-blocked')
    }, ELEMENT_TIMEOUT_MS)
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
 * Strategy: run fetch + TWO element-based detections in parallel, combine.
 *
 * fetch() catches generic block rules (||domain.com^) that block ALL types.
 *
 * Element methods catch TYPE-SPECIFIC rules and $redirect neutering:
 * - <link preload as="script"> for .js URLs — detects $script,redirect=noopjs
 *   by checking Performance API for missing entries or near-zero duration.
 * - hidden <iframe> for document/page URLs — approximates direct navigation.
 * - <img> for pixel/image URLs — detects $image,redirect and DNS blocking.
 * - <link rel="stylesheet"> — detects $stylesheet rules and generic blocks.
 *
 * Running 3 independent methods per URL dramatically improves accuracy:
 * ad blockers may handle different resource types differently, and type-specific
 * rules (e.g. $script but not $xmlhttprequest) only trigger for matching types.
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
 * - If hint.hasDocumentRule is true, the reference engine has matched a
 *   $document / main_frame rule which CANNOT be tested from within a page.
 *   In this case, the reference engine's verdict is used directly, because
 *   $document rules only block top-level navigation (not sub-resources),
 *   making them invisible to fetch/img/preload/iframe probes.
 *
 * Example: adsbygoogle.js with $script,redirect=noopjs:
 * - fetch: succeeds (not a $script request) → 'not-blocked'
 * - preload: onload fires but redirect detected → 'blocked'
 * - image: onerror (not an image) + perf loaded → 'not-blocked'
 * - Combined: 'blocked' wins ✅
 */
export function testNetworkResource(
  url: string,
  hint?: FilterHint
): Promise<NetworkTestStatus> {
  // If the reference engine matched a $document / main_frame rule,
  // the ad blocker blocks this URL when navigated to directly, but there
  // is no reliable way to detect $document blocking from within a page
  // (fetch, img, preload all use sub-resource types that aren't affected).
  // Trust the reference engine for these rules — EasyList/EasyPrivacy
  // $document rules are standard and present in virtually all ad blockers.
  if (hint?.hasDocumentRule) {
    return Promise.resolve('blocked')
  }

  return new Promise((resolve) => {
    let settled = false
    let completed = 0
    const hintHasRedirect = hint?.hasRedirect ?? false
    const hintShouldBlock = hint?.shouldBlock ?? false
    const finish = (status: NetworkTestStatus) => {
      if (settled) return
      settled = true
      resolve(status)
    }

    // Collect detection promises — 3 methods for maximum coverage
    const detections: Promise<NetworkTestStatus>[] = []

    // Method 1: Fetch-based detection (always — catches generic rules)
    detections.push(detectViaFetch(url))

    // Method 2: Primary element-based detection (type-specific signal)
    // - .js URLs:  <link rel="preload" as="script"> catches $script rules
    // - Document URLs: <iframe> catches $subdocument and some $document rules
    // - Image URLs: <img> catches $image rules and $redirect=1x1.gif
    // - Other URLs: <img> for generic blocking signal
    //
    // When the reference engine hints that a $redirect rule exists, pass
    // hintHasRedirect so the redirect check retries with longer delays.
    if (isScriptUrl(url)) {
      detections.push(detectViaPreload(url, hintHasRedirect))
    } else if (isDocumentUrl(url)) {
      detections.push(detectViaFrame(url))
    } else {
      detections.push(detectViaImage(url, hintHasRedirect))
    }

    // Method 3: Supplementary element-based detection (additional signal)
    // A third independent method catches blocking that method 2 might miss:
    // - Script URLs + image: generic ||domain.com^ rules also block images
    // - Document URLs + image: generic rules block all types including images
    // - Image URLs + stylesheet: catches generic rules via a different type
    // - Other URLs + stylesheet: catches $stylesheet and generic rules
    if (isScriptUrl(url)) {
      detections.push(detectViaImage(url, hintHasRedirect))
    } else if (isDocumentUrl(url)) {
      detections.push(detectViaImage(url, hintHasRedirect))
    } else if (isImageUrl(url)) {
      detections.push(detectViaStylesheet(url, hintHasRedirect))
    } else {
      detections.push(detectViaStylesheet(url, hintHasRedirect))
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
            if (hintHasRedirect) {
              // The reference engine says a $redirect rule exists — the ad
              // blocker SHOULD have redirected the resource. Do one final
              // redirect check — the entry may have been written late.
              isLikelyRedirectedWithRetry(url, true).then((redirected) => {
                finish(redirected ? 'blocked' : 'not-blocked')
              })
            } else if (hintShouldBlock) {
              // Reference engine says this URL should be blocked, but all
              // 3 methods say not-blocked. Run one aggressive final redirect
              // check — some ad blockers may have redirected without the
              // standard redirect hint.
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
  if (isDocumentUrl(test.url)) return 'document'
  return 'network'
}
