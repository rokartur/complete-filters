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

// Increase buffer for 400+ tests (each may generate 3-4 Performance entries)
// With thorough mode we no longer clear the buffer between batches,
// so we need space for ALL entries across the entire test run.
try {
  performance.setResourceTimingBufferSize(32000)
} catch {
  // older browsers may not support this
}

const ELEMENT_ERROR_SETTLE_DELAY_MS = 200
const ELEMENT_TIMEOUT_MS = 10000
const FRAME_SETTLE_DELAY_MS = 400
const FRAME_ABOUT_BLANK_RETRY_DELAY_MS = 500
const FRAME_TIMEOUT_MS = 12000
const NETWORK_TEST_TIMEOUT_MS = 20000
const BAIT_CLEANUP_TIMEOUT_MS = 5000
const REDIRECT_DURATION_THRESHOLD_MS = 10
const REDIRECT_CHECK_DELAY_MS = 100

/**
 * Retry delays for redirect detection when the reference engine hints that
 * a $redirect rule exists. Performance API entries may not be written
 * immediately — especially on slower devices or when the buffer was recently
 * cleared between batches. These retries give the browser extra time.
 */
const REDIRECT_RETRY_DELAYS_MS = [100, 250, 500, 1000, 2000]

/**
 * Shorter retry sequence used when no hint is available but we still want
 * to be thorough. The user has 6M+ filters — many $redirect rules exist
 * that the reference engine (EasyList/EasyPrivacy only) doesn't know about.
 */
const REDIRECT_RETRY_NO_HINT_MS = [100, 300]

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
 * IMPORTANT: This function is intentionally VERY conservative. Only URLs with
 * explicit page extensions (.html, .php, .asp, etc.) are treated as documents.
 *
 * Root-domain URLs like https://media.net/ or https://analytics.google.com/
 * are NOT documents — they are tracker/ad endpoints that should be tested via
 * the standard fetch + image + stylesheet triple-detection. Treating them as
 * documents would route them through the unreliable iframe method, which fails
 * due to X-Frame-Options / CSP frame-ancestors on most ad/tracking domains,
 * causing massive false "not-blocked" results.
 */
export function isDocumentUrl(url: string): boolean {
  if (isScriptUrl(url) || isImageUrl(url)) return false

  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname || '/'

    // Only treat URLs with explicit page extensions as document requests.
    // Root domains (/) and trailing-slash paths are NOT documents — they are
    // tracker endpoints that respond to sub-resource requests and need the
    // standard triple-detection (fetch + image + stylesheet).
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
      // Check Performance API to distinguish.
      setTimeout(() => {
        const perf = checkPerformanceEntry(url)
        if (perf === 'loaded') {
          // Request reached server (CORS or 404) — NOT blocked
          settle('not-blocked')
        } else if (perf === 'blocked') {
          // Performance entry shows DNS-level blocking (responseEnd=0)
          settle('blocked')
        } else {
          // No entry + element error — the ad blocker intercepted the
          // request before it could be tracked by Performance API.
          // This is a strong signal of blocking, not ambiguous.
          settle('blocked')
        }
      }, ELEMENT_ERROR_SETTLE_DELAY_MS)
    }

    document.head.appendChild(link)

    // Timeout for preload — if nothing responds after extended wait,
    // the request is likely being held/blocked by the ad blocker.
    timeoutId = window.setTimeout(() => {
      settle('blocked')
    }, ELEMENT_TIMEOUT_MS)
  })
}

/**
 * Detect blocking via <script> element (directly triggers $script type matching).
 *
 * More direct than <link rel="preload" as="script"> — creates an actual script
 * element which triggers the browser's $script resource type, matching rules like:
 *   ||googlesyndication.com/adsbygoogle.js$script,redirect=noopjs
 *
 * The script is appended to the DOM but blocked scripts never execute.
 * If the ad blocker allows it through but redirects to noopjs, the redirect
 * is detected via Performance API (missing entry or near-zero duration).
 *
 * When hintHasRedirect is true, the redirect check uses retries with longer
 * delays to catch Performance API entries that haven't been written yet.
 */
function detectViaScript(
  url: string,
  hintHasRedirect = false
): Promise<NetworkTestStatus> {
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.type = 'text/javascript'
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
        script.remove()
      } catch {
        /* already removed */
      }
    }

    script.onload = () => {
      // Script loaded — but might be a neutered $redirect resource (noopjs).
      // Detect via Performance API: missing entry or near-zero duration.
      setTimeout(async () => {
        const redirected = await isLikelyRedirectedWithRetry(url, hintHasRedirect)
        settle(redirected ? 'blocked' : 'not-blocked')
      }, REDIRECT_CHECK_DELAY_MS)
    }

    script.onerror = () => {
      // Script failed to load — check Performance API to distinguish.
      setTimeout(() => {
        const perf = checkPerformanceEntry(url)
        if (perf === 'loaded') {
          // Server responded but script failed (CORS, syntax) — NOT blocked
          settle('not-blocked')
        } else if (perf === 'blocked') {
          // Performance entry shows DNS-level blocking (responseEnd=0)
          settle('blocked')
        } else {
          // No entry + script error — ad blocker intercepted before dispatch.
          settle('blocked')
        }
      }, ELEMENT_ERROR_SETTLE_DELAY_MS)
    }

    script.src = url
    document.head.appendChild(script)

    // Timeout — if nothing responds after extended wait, likely blocked.
    timeoutId = window.setTimeout(() => {
      settle('blocked')
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
      setTimeout(() => {
        const perf = checkPerformanceEntry(url)
        if (perf === 'loaded') {
          // Server responded (just not with a valid image) — NOT blocked
          settle('not-blocked')
        } else if (perf === 'blocked') {
          // Performance entry shows DNS-level blocking (responseEnd=0)
          settle('blocked')
        } else {
          // No entry + element error — the ad blocker intercepted the
          // request before Performance API could track it.
          // This is a strong signal of blocking.
          settle('blocked')
        }
      }, ELEMENT_ERROR_SETTLE_DELAY_MS)
    }

    img.src = url

    // Timeout for image — if nothing responds after extended wait,
    // the request is likely being held/blocked by the ad blocker.
    timeoutId = window.setTimeout(() => settle('blocked'), ELEMENT_TIMEOUT_MS)
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

    // Timeout for stylesheet — if nothing responds after extended wait,
    // the request is likely being held/blocked by the ad blocker.
    timeoutId = window.setTimeout(() => {
      settle('blocked')
    }, ELEMENT_TIMEOUT_MS)
  })
}

/**
 * Test a bait element (cosmetic filter test).
 * Creates a div with ad-like class/id and checks if the ad blocker hides it.
 *
 * Thorough mode: uses multiple bait elements at different positions, checks
 * at many intervals over 4+ seconds to catch delayed cosmetic filter
 * application with large filter lists (1M+ cosmetic rules).
 *
 * Creates both an off-screen bait AND an in-viewport bait because some
 * ad blockers only process elements visible in the layout tree.
 */
export function testBaitElement(test: {
  baitClass?: string
  baitId?: string
}): Promise<boolean> {
  return new Promise((resolve) => {
    // Create TWO bait elements: one off-screen (traditional) and one
    // technically in-viewport but invisible to the user. Some ad blockers
    // only fire MutationObserver callbacks for elements in the viewport.
    const baits: HTMLElement[] = []

    // Bait 1: off-screen (catches most ad blockers)
    const bait1 = document.createElement('div')
    bait1.innerHTML = '&nbsp;'
    bait1.style.cssText =
      'position:absolute;left:-10000px;top:-10000px;width:300px;height:250px;pointer-events:none;'
    if (test.baitClass) bait1.className = test.baitClass
    if (test.baitId) bait1.id = test.baitId
    bait1.setAttribute('data-ad', 'true')
    bait1.setAttribute('aria-label', 'advertisement')
    baits.push(bait1)

    // Bait 2: in-viewport but effectively invisible (catches ad blockers
    // that only process visible/attached elements)
    const bait2 = document.createElement('div')
    bait2.innerHTML = '&nbsp;'
    bait2.style.cssText =
      'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0.01;z-index:-2147483647;pointer-events:none;overflow:hidden;'
    if (test.baitClass) bait2.className = test.baitClass
    // Don't duplicate the ID — use a data attribute instead
    if (test.baitId) bait2.setAttribute('data-bait-id', test.baitId)
    bait2.setAttribute('data-ad', 'true')
    bait2.setAttribute('data-ad-slot', 'test')
    bait2.setAttribute('data-google-query-id', 'test')
    baits.push(bait2)

    baits.forEach((b) => document.body.appendChild(b))

    let settled = false
    let cleanupTimeoutId: number | undefined

    const finish = (blocked: boolean) => {
      if (settled) return
      settled = true
      if (cleanupTimeoutId !== undefined) {
        window.clearTimeout(cleanupTimeoutId)
      }
      baits.forEach((b) => {
        try { b.remove() } catch { /* already removed */ }
      })
      resolve(blocked)
    }

    const checkElementBlocked = (el: HTMLElement): boolean => {
      try {
        if (!document.body.contains(el)) {
          return true // Element was removed from DOM entirely
        }
        const style = window.getComputedStyle(el)
        return (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.opacity === '0' ||
          (style.position === 'absolute' &&
            style.clip === 'rect(0px, 0px, 0px, 0px)') ||
          style.height === '0px' ||
          style.maxHeight === '0px' ||
          el.offsetHeight === 0 ||
          el.offsetWidth === 0 ||
          el.getBoundingClientRect().height === 0 ||
          (!el.offsetParent &&
            style.position !== 'fixed' &&
            style.position !== 'absolute')
        )
      } catch {
        return true // if we can't read it, it's been removed/blocked
      }
    }

    const checkAnyBlocked = (): boolean => {
      return baits.some((b) => checkElementBlocked(b))
    }

    // Check at many intervals to catch delayed cosmetic filter application.
    // With 1.2M+ cosmetic rules the MutationObserver may fire much later
    // than the typical 50-200ms. We check over 4 seconds total.
    const checkTimes = [50, 100, 200, 400, 700, 1000, 1500, 2000, 3000, 4000]
    let checkIndex = 0

    const runCheck = () => {
      if (checkAnyBlocked()) {
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
      finish(checkAnyBlocked())
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

  if (hintHasRedirect) {
    // Reference engine confirms $redirect rule — use full extended retry.
    for (const delay of REDIRECT_RETRY_DELAYS_MS) {
      await new Promise((r) => setTimeout(r, delay))
      if (isLikelyRedirected(url)) return true
    }
  } else {
    // No hint, but the user may have $redirect rules that the reference
    // engine (EasyList/EasyPrivacy only) doesn't know about. Always do
    // a shorter retry sequence to catch late Performance API writes.
    for (const delay of REDIRECT_RETRY_NO_HINT_MS) {
      await new Promise((r) => setTimeout(r, delay))
      if (isLikelyRedirected(url)) return true
    }
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

    // Collect detection promises — up to 4 methods for maximum coverage.
    // More methods = higher accuracy, even at the cost of speed.
    const detections: Promise<NetworkTestStatus>[] = []

    // Method 1: Fetch-based detection (always — catches generic rules)
    detections.push(detectViaFetch(url))

    // Method 2: Primary element-based detection (type-specific signal)
    // When the reference engine hints that a $redirect rule exists, pass
    // hintHasRedirect so the redirect check retries with longer delays.
    if (isScriptUrl(url)) {
      detections.push(detectViaPreload(url, hintHasRedirect))
    } else if (isDocumentUrl(url)) {
      detections.push(detectViaFrame(url))
    } else {
      detections.push(detectViaImage(url, hintHasRedirect))
    }

    // Method 3: Direct script element for .js URLs (triggers $script type
    // matching more reliably than preload), image for everything else.
    if (isScriptUrl(url)) {
      detections.push(detectViaScript(url, hintHasRedirect))
    } else if (isDocumentUrl(url)) {
      detections.push(detectViaImage(url, hintHasRedirect))
    } else if (isImageUrl(url)) {
      detections.push(detectViaStylesheet(url, hintHasRedirect))
    } else {
      detections.push(detectViaStylesheet(url, hintHasRedirect))
    }

    // Method 4: Supplementary cross-type detection
    // Uses a DIFFERENT resource type to catch generic ||domain.com^ rules
    // that block all types. This maximizes the chance of at least one
    // method detecting the block.
    if (isScriptUrl(url)) {
      detections.push(detectViaStylesheet(url, hintHasRedirect))
    } else if (isDocumentUrl(url)) {
      detections.push(detectViaStylesheet(url, hintHasRedirect))
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
