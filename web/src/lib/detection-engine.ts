import type { MethodTag } from '@/lib/site-content'
import type { FilterHint } from '@/lib/reference-engine'

export type NetworkTestStatus = 'blocked' | 'not-blocked'

/**
 * Ad Blocker Detection Engine v5
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
 *   - onload + img.naturalWidth ≤ 2 (noop 1x1.gif) → REDIRECT detected → BLOCKED
 *   - onerror + Performance 'loaded' → server error, not blocked
 *   - onerror + Performance 'blocked' (responseEnd=0) → DNS blocking
 *   - onerror + Performance 'not-found' → CORS disambiguation via secondary fetch
 *
 * TERTIARY signal — navigator.sendBeacon()
 *   Catches $ping/beacon rules with instant synchronous result.
 *
 * COSMETIC signal — DOM visibility check
 *   Creates bait elements with ad-like class/id and checks if ad blocker hides them.
 *   Dual strategy: MutationObserver (instant) + polling (fallback for CSS injection).
 *
 * CORS DISAMBIGUATION — when element onerror fires with no Performance entry,
 *   a secondary mode:'cors' fetch distinguishes CORS failures from ad blocker blocks.
 *
 * PERFORMANCE BUFFER PROTECTION — Safari caps buffer at ~150 entries.
 *   On buffer overflow, entries are backed up to an in-memory Map before
 *   the browser clears them. Redirect detection checks both live entries
 *   and the backup map.
 *
 * ABORT CONTROLLER — each URL gets a shared AbortController. When ANY method
 *   detects blocking, abort() cancels all remaining in-flight fetch requests
 *   and triggers early DOM element cleanup via abort event listeners.
 *
 * EARLY EXIT — when 3+ independent methods agree "not-blocked" AND no
 *   reference engine hint suggests blocking, resolve immediately without
 *   waiting for remaining methods to time out.
 *
 * ABORT CONTROLLER — each URL gets a shared AbortController. When ANY method
 *   detects blocking, abort() cancels all remaining in-flight fetch requests
 *   and triggers early DOM element cleanup via abort event listeners.
 *
 * EARLY EXIT — when 3+ independent methods agree "not-blocked" AND no
 *   reference engine hint suggests blocking, resolve immediately without
 *   waiting for remaining methods to time out.
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

/**
 * Backup map for Performance entries that survive buffer overflow.
 *
 * Safari caps the Performance buffer at ~150 entries (ignoring our
 * setResourceTimingBufferSize call). When it fills, all entries are flushed.
 * We listen to the `resourcetimingbufferfull` event and copy entries to
 * this map BEFORE the browser clears them. The redirect-detection code
 * checks this map as a fallback when live entries are missing.
 *
 * Key: URL → Value: { duration, responseEnd }
 */
const perfEntryBackup = new Map<
  string,
  { duration: number; responseEnd: number }
>()

try {
  performance.addEventListener('resourcetimingbufferfull', () => {
    const entries = performance.getEntriesByType(
      'resource'
    ) as PerformanceResourceTiming[]
    for (const entry of entries) {
      // Only store the FIRST occurrence per URL (earliest = most relevant)
      if (!perfEntryBackup.has(entry.name)) {
        perfEntryBackup.set(entry.name, {
          duration: entry.duration,
          responseEnd: entry.responseEnd,
        })
      }
    }
    // Let the browser clear the buffer — we have our backup
  })
} catch {
  // older browsers may not support addEventListener on performance
}

/**
 * Clear the backup map. Called from the hook when starting a fresh test run.
 */
export function clearPerfEntryBackup(): void {
  perfEntryBackup.clear()
}

const ELEMENT_ERROR_SETTLE_DELAY_MS = 200
const ELEMENT_TIMEOUT_MS = 5000
const FRAME_SETTLE_DELAY_MS = 300
const FRAME_ABOUT_BLANK_RETRY_DELAY_MS = 400
const FRAME_TIMEOUT_MS = 8000
const NETWORK_TEST_TIMEOUT_MS = 12000
const BAIT_CLEANUP_TIMEOUT_MS = 2000
const REDIRECT_DURATION_THRESHOLD_MS = 10
const REDIRECT_CHECK_DELAY_MS = 50

/**
 * Retry delays for redirect detection when the reference engine hints that
 * a $redirect rule exists. Performance API entries may not be written
 * immediately — especially on slower devices or when the buffer was recently
 * cleared between batches. These retries give the browser extra time.
 */
const REDIRECT_RETRY_DELAYS_MS = [80, 200, 500]

/**
 * Shorter retry sequence used when no hint is available but we still want
 * to be thorough. The user has 6M+ filters — many $redirect rules exist
 * that the reference engine (EasyList/EasyPrivacy only) doesn't know about.
 */
const REDIRECT_RETRY_NO_HINT_MS = [80, 200]

/**
 * Disambiguate CORS failures from ad blocker blocks.
 *
 * When an element's onerror fires and Performance API has no entry, it is
 * ambiguous: could be ad blocker intercepting before the request, or the
 * browser rejecting a CORS preflight.
 *
 * Strategy: send a `mode: 'cors'` fetch (which respects CORS headers).
 * - If the CORS fetch returns a Response (status > 0) or throws a TypeError
 *   OTHER than network error → the server is reachable, it's a CORS issue.
 * - If the CORS fetch throws a TypeError → same as no-cors → likely blocked.
 *
 * Since ad blockers intercept before the network layer, a blocked URL will
 * throw TypeError on BOTH no-cors and cors mode. But a CORS-restricted
 * server will return an opaque error (TypeError on no-cors, but the cors
 * fetch itself may also fail with TypeError due to CORS policy). However,
 * the key insight is: if we get an AbortError or the response has a status,
 * the server IS reachable.
 *
 * We use a short timeout to avoid waiting too long for genuinely blocked URLs.
 */
async function isReachableDespiteCors(url: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 2000)
    const response = await fetch(url, {
      mode: 'cors',
      cache: 'no-store',
      signal: controller.signal,
    })
    window.clearTimeout(timeout)
    // Got a response (even if blocked by CORS, status may be 0 for opaque)
    // If status > 0, server definitively reachable
    return response.status > 0 || response.type === 'cors'
  } catch (err) {
    // AbortError = our timeout → inconclusive (assume blocked)
    if (err instanceof DOMException && err.name === 'AbortError') return false
    // TypeError = network error — still ambiguous.
    // Try one more signal: a no-cors HEAD request (lighter than GET).
    try {
      const res = await fetch(url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' })
      // If HEAD succeeds, the server is reachable (CORS was the issue)
      void res
      return true
    } catch {
      return false
    }
  }
}

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
    const urlVariants = [url, url.replace(/\/$/, ''), url + '/']
    const entry = entries.find((e) => urlVariants.includes(e.name))

    if (!entry) {
      // Fallback: check the backup map (survives Safari buffer overflow)
      const backup = urlVariants.reduce<
        { duration: number; responseEnd: number } | undefined
      >((found, variant) => found ?? perfEntryBackup.get(variant), undefined)

      if (backup) {
        if (backup.responseEnd === 0) return 'blocked'
        return 'loaded'
      }

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

    const urlVariants = [url, url.replace(/\/$/, ''), url + '/']
    const matching = entries.filter((e) => urlVariants.includes(e.name))

    if (matching.length === 0) {
      // No live entry — check the backup map (Safari buffer overflow)
      const backup = urlVariants.reduce<
        { duration: number; responseEnd: number } | undefined
      >((found, variant) => found ?? perfEntryBackup.get(variant), undefined)

      if (backup) {
        // We have a backup entry — check its duration
        return backup.duration >= 0 && backup.duration < REDIRECT_DURATION_THRESHOLD_MS
      }

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
async function detectViaFetch(
  url: string,
  signal?: AbortSignal
): Promise<NetworkTestStatus> {
  if (signal?.aborted) return 'blocked'
  try {
    await fetch(url, { mode: 'no-cors', cache: 'no-store', signal })
    return 'not-blocked'
  } catch (err) {
    // AbortError means the parent cancelled us (another method detected block)
    if (err instanceof DOMException && err.name === 'AbortError') return 'blocked'
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
  hintHasRedirect = false,
  signal?: AbortSignal
): Promise<NetworkTestStatus> {
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve('blocked'); return }
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'script'
    link.href = url
    let timeoutId: number | undefined
    let resolved = false

    const settle = (status: NetworkTestStatus) => {
      if (resolved) return
      resolved = true
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

    // Listen for external abort (another method detected blocking first)
    signal?.addEventListener('abort', () => settle('blocked'), { once: true })

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
      setTimeout(async () => {
        const perf = checkPerformanceEntry(url)
        if (perf === 'loaded') {
          // Request reached server (CORS or 404) — NOT blocked
          settle('not-blocked')
        } else if (perf === 'blocked') {
          // Performance entry shows DNS-level blocking (responseEnd=0)
          settle('blocked')
        } else {
          // No entry + element error — usually ad blocker interception.
          // But could also be a CORS failure that prevented tracking.
          // Disambiguate with a secondary fetch check.
          const reachable = await isReachableDespiteCors(url)
          settle(reachable ? 'not-blocked' : 'blocked')
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
  hintHasRedirect = false,
  signal?: AbortSignal
): Promise<NetworkTestStatus> {
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve('blocked'); return }
    const script = document.createElement('script')
    script.type = 'text/javascript'
    let timeoutId: number | undefined
    let resolved = false

    const settle = (status: NetworkTestStatus) => {
      if (resolved) return
      resolved = true
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

    // Listen for external abort (another method detected blocking first)
    signal?.addEventListener('abort', () => settle('blocked'), { once: true })

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
      setTimeout(async () => {
        const perf = checkPerformanceEntry(url)
        if (perf === 'loaded') {
          // Server responded but script failed (CORS, syntax) — NOT blocked
          settle('not-blocked')
        } else if (perf === 'blocked') {
          // Performance entry shows DNS-level blocking (responseEnd=0)
          settle('blocked')
        } else {
          // No entry + script error — disambiguate CORS from ad blocker.
          const reachable = await isReachableDespiteCors(url)
          settle(reachable ? 'not-blocked' : 'blocked')
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
 * Noop redirect images are tiny (1x1 pixel). Real tracking pixels/images are
 * typically larger or at least varied in size. When an <img> onload fires,
 * checking naturalWidth/naturalHeight provides a Performance-API-independent
 * signal that works even when the buffer is full (Safari).
 */
const NOOP_IMAGE_MAX_DIMENSION = 2

/**
 * Detect blocking via <img> element (matches $image rules).
 *
 * When hintHasRedirect is true, the redirect check uses retries with longer
 * delays to catch Performance API entries that haven't been written yet.
 *
 * Additionally checks img.naturalWidth / img.naturalHeight after onload:
 * if the loaded image is exactly 1×1 pixels (noop 1x1.gif redirect), that's
 * an independent redirect signal that doesn't depend on Performance API at all.
 */
function detectViaImage(
  url: string,
  hintHasRedirect = false,
  signal?: AbortSignal
): Promise<NetworkTestStatus> {
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve('blocked'); return }
    const img = new Image()
    let timeoutId: number | undefined
    let resolved = false

    const settle = (status: NetworkTestStatus) => {
      if (resolved) return
      resolved = true
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
      img.onload = null
      img.onerror = null
      // Cancel any pending network request to avoid wasted bandwidth
      img.src = ''
      resolve(status)
    }

    // Listen for external abort (another method detected blocking first)
    signal?.addEventListener('abort', () => settle('blocked'), { once: true })

    img.onload = () => {
      // Image loaded — but might be a neutered $redirect resource.
      // Ad blockers can redirect $image requests to local noop images
      // (1x1 transparent pixel) via $image,redirect=1x1.gif rules.
      //
      // Two independent signals:
      // 1. Performance API: missing entry or near-zero duration
      // 2. Image dimensions: naturalWidth/Height ≤ 2 (noop 1x1.gif)
      //    This works even when Performance buffer is full (Safari).
      //
      // When hintHasRedirect is true, use retry logic for reliability.

      // Signal 2: Check image dimensions (independent of Performance API)
      if (
        img.naturalWidth > 0 &&
        img.naturalWidth <= NOOP_IMAGE_MAX_DIMENSION &&
        img.naturalHeight > 0 &&
        img.naturalHeight <= NOOP_IMAGE_MAX_DIMENSION
      ) {
        // Tiny image loaded — very likely a noop redirect.
        // Verify with Performance API: if entry is also suspicious, it's a redirect.
        // If no Performance entry exists at all, it's definitely a redirect (MV2).
        setTimeout(async () => {
          const perf = checkPerformanceEntry(url)
          if (perf === 'not-found' || perf === 'blocked') {
            settle('blocked')
          } else {
            // Performance says loaded — check timing too
            const redirected = await isLikelyRedirectedWithRetry(url, hintHasRedirect)
            settle(redirected ? 'blocked' : 'not-blocked')
          }
        }, REDIRECT_CHECK_DELAY_MS)
        return
      }

      // Signal 1: Standard redirect detection via Performance API
      setTimeout(async () => {
        const redirected = await isLikelyRedirectedWithRetry(url, hintHasRedirect)
        settle(redirected ? 'blocked' : 'not-blocked')
      }, REDIRECT_CHECK_DELAY_MS)
    }

    img.onerror = () => {
      // Image failed — check Performance API to distinguish
      // blocked vs server error / not-an-image.
      setTimeout(async () => {
        const perf = checkPerformanceEntry(url)
        if (perf === 'loaded') {
          // Server responded (just not with a valid image) — NOT blocked
          settle('not-blocked')
        } else if (perf === 'blocked') {
          // Performance entry shows DNS-level blocking (responseEnd=0)
          settle('blocked')
        } else {
          // No entry + element error — disambiguate CORS from ad blocker.
          const reachable = await isReachableDespiteCors(url)
          settle(reachable ? 'not-blocked' : 'blocked')
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
function detectViaFrame(url: string, signal?: AbortSignal): Promise<NetworkTestStatus> {
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve('blocked'); return }
    const frame = document.createElement('iframe')
    let timeoutId: number | undefined
    let resolved = false

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
      if (resolved) return
      resolved = true
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
      cleanup()
      resolve(status)
    }

    // Listen for external abort (another method detected blocking first)
    signal?.addEventListener('abort', () => settle('blocked'), { once: true })

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
  hintHasRedirect = false,
  signal?: AbortSignal
): Promise<NetworkTestStatus> {
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve('blocked'); return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    // media="print" prevents accidental layout changes if CSS loads
    link.media = 'print'
    let timeoutId: number | undefined
    let resolved = false

    const settle = (status: NetworkTestStatus) => {
      if (resolved) return
      resolved = true
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

    // Listen for external abort (another method detected blocking first)
    signal?.addEventListener('abort', () => settle('blocked'), { once: true })

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
      setTimeout(async () => {
        const perf = checkPerformanceEntry(url)
        if (perf === 'loaded') {
          // Server responded (just not with valid CSS) — NOT blocked
          settle('not-blocked')
        } else if (perf === 'blocked') {
          // Performance entry shows DNS-level blocking (responseEnd=0)
          settle('blocked')
        } else {
          // No entry — disambiguate CORS from ad blocker interception.
          const reachable = await isReachableDespiteCors(url)
          settle(reachable ? 'not-blocked' : 'blocked')
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
 *
 * Uses a dual detection strategy:
 * 1. MutationObserver — instantly detects attribute/style/removal changes
 * 2. Polling — fallback for ad blockers that bypass MutationObserver or
 *    apply CSS rules without triggering mutations (e.g. stylesheet injection)
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
    const observers: MutationObserver[] = []

    const finish = (blocked: boolean) => {
      if (settled) return
      settled = true
      if (cleanupTimeoutId !== undefined) {
        window.clearTimeout(cleanupTimeoutId)
      }
      // Disconnect all MutationObservers
      observers.forEach((obs) => {
        try { obs.disconnect() } catch { /* ignore */ }
      })
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
          // Classic clip rect hiding
          (style.position === 'absolute' &&
            style.clip === 'rect(0px, 0px, 0px, 0px)') ||
          // Modern clip-path hiding
          style.clipPath === 'inset(100%)' ||
          // Size-based hiding
          style.height === '0px' ||
          style.maxHeight === '0px' ||
          el.offsetHeight === 0 ||
          el.offsetWidth === 0 ||
          el.getBoundingClientRect().height === 0 ||
          // Layout tree removal
          (!el.offsetParent &&
            style.position !== 'fixed' &&
            style.position !== 'absolute') ||
          // Modern CSS hiding methods
          style.contentVisibility === 'hidden' ||
          // Transform-based hiding
          style.transform === 'scale(0)' ||
          style.transform === 'scale(0, 0)' ||
          // Filter-based opacity hiding
          style.filter === 'opacity(0)' ||
          // Overflow + zero-size hiding
          (style.overflow === 'hidden' &&
            (style.width === '0px' || style.height === '0px'))
        )
      } catch {
        return true // if we can't read it, it's been removed/blocked
      }
    }

    const checkAnyBlocked = (): boolean => {
      return baits.some((b) => checkElementBlocked(b))
    }

    // --- Strategy 1: MutationObserver (instant detection) ---
    // Watches for attribute changes (style, class) and child list changes
    // (element removal) on each bait. When a mutation is detected, immediately
    // check if the element is hidden. This catches ad blockers that modify
    // the DOM directly (e.g. setting style="display:none !important").
    try {
      for (const bait of baits) {
        const observer = new MutationObserver(() => {
          if (settled) return
          if (checkAnyBlocked()) {
            finish(true)
          }
        })
        observer.observe(bait, {
          attributes: true,
          attributeFilter: ['style', 'class', 'hidden'],
          childList: true,
        })
        observers.push(observer)
      }

      // Also observe document.body for child removal (element removed entirely)
      const bodyObserver = new MutationObserver((mutations) => {
        if (settled) return
        for (const mutation of mutations) {
          for (const removed of mutation.removedNodes) {
            if (baits.includes(removed as HTMLElement)) {
              finish(true)
              return
            }
          }
        }
      })
      bodyObserver.observe(document.body, { childList: true })
      observers.push(bodyObserver)
    } catch {
      // MutationObserver not available — rely on polling only
    }

    // --- Strategy 2: Polling (fallback for stylesheet-injected CSS rules) ---
    // Ad blockers that inject CSS stylesheets (##.ad-class) don't trigger
    // MutationObserver because no DOM attribute changes — only computed style.
    // Polling catches these by re-reading getComputedStyle at intervals.
    const checkTimes = [30, 80, 150, 300, 500, 800, 1200, 2000, 3000]
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

/**
 * Detect blocking via navigator.sendBeacon().
 *
 * sendBeacon() is designed for analytics/tracking beacons and returns a
 * boolean: true if the beacon was successfully queued, false if rejected.
 * Ad blockers that intercept beacon requests will cause sendBeacon to
 * return false or throw, providing an additional synchronous signal.
 *
 * This catches $ping filter rules and generic domain blocks that also
 * match the beacon request type. It's lightweight (no response parsing)
 * and provides an instant synchronous result.
 *
 * NOTE: sendBeacon sends with type "ping/beacon", which is a different
 * request type than fetch (xmlhttprequest) — catching rules that
 * specifically target beacon requests.
 */
function detectViaSendBeacon(url: string): Promise<NetworkTestStatus> {
  return new Promise((resolve) => {
    try {
      if (!navigator.sendBeacon) {
        // sendBeacon not available — can't determine
        resolve('not-blocked')
        return
      }
      // sendBeacon returns true if the browser successfully queued the beacon.
      // If the ad blocker intercepts, it returns false (or throws).
      const queued = navigator.sendBeacon(url)
      resolve(queued ? 'not-blocked' : 'blocked')
    } catch {
      // Exception during sendBeacon — likely blocked by ad blocker
      resolve('blocked')
    }
  })
}

/**
 * Minimum "not-blocked" votes needed to resolve early when there is no
 * reference engine hint. With 4-5 detection methods running, if 3 independent
 * methods (fetch, element, stylesheet/beacon) all agree the URL is reachable,
 * the remaining methods won't change the verdict. This avoids waiting 5-10s
 * for the slowest method to time out.
 *
 * When the reference engine hints that a URL should be blocked (hintShouldBlock
 * or hintHasRedirect), we still wait for ALL methods — conservative path.
 */
const EARLY_NOT_BLOCKED_THRESHOLD = 3

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
    let notBlockedCount = 0
    const hintHasRedirect = hint?.hasRedirect ?? false
    const hintShouldBlock = hint?.shouldBlock ?? false

    // Shared AbortController — when any method detects blocking,
    // abort() cancels remaining in-flight fetch requests and triggers
    // early cleanup of DOM elements via abort event listeners.
    const controller = new AbortController()
    const { signal } = controller

    const finish = (status: NetworkTestStatus) => {
      if (settled) return
      settled = true
      // Cancel all remaining in-flight detection methods
      controller.abort()
      resolve(status)
    }

    // Collect detection promises — up to 5 methods for maximum coverage.
    const detections: Promise<NetworkTestStatus>[] = []

    // Method 1: Fetch-based detection (always — catches generic rules)
    detections.push(detectViaFetch(url, signal))

    // Method 2: Primary element-based detection (type-specific signal)
    if (isScriptUrl(url)) {
      detections.push(detectViaPreload(url, hintHasRedirect, signal))
    } else if (isDocumentUrl(url)) {
      detections.push(detectViaFrame(url, signal))
    } else {
      detections.push(detectViaImage(url, hintHasRedirect, signal))
    }

    // Method 3: Direct script element for .js URLs, stylesheet for others.
    if (isScriptUrl(url)) {
      detections.push(detectViaScript(url, hintHasRedirect, signal))
    } else if (isDocumentUrl(url)) {
      detections.push(detectViaImage(url, hintHasRedirect, signal))
    } else {
      detections.push(detectViaStylesheet(url, hintHasRedirect, signal))
    }

    // Method 4: Supplementary cross-type detection
    if (isScriptUrl(url) || isDocumentUrl(url)) {
      detections.push(detectViaStylesheet(url, hintHasRedirect, signal))
    } else {
      detections.push(detectViaImage(url, hintHasRedirect, signal))
    }

    // Method 5: sendBeacon (instant synchronous signal, skipped for documents)
    if (!isDocumentUrl(url)) {
      detections.push(detectViaSendBeacon(url))
    }

    const totalDetections = detections.length

    // Whether early "not-blocked" exit is allowed.
    // Only when the reference engine has NO indication the URL should be blocked.
    const allowEarlyNotBlocked = !hintShouldBlock && !hintHasRedirect

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

          notBlockedCount += 1

          // --- Early "not-blocked" exit (Phase 4) ---
          // If 3+ independent methods say not-blocked AND no hint suggests
          // the URL should be blocked, resolve immediately. Waiting for the
          // remaining 1-2 methods (which may take 5-10s to time out) is
          // not worth the time — 3 independent signals are sufficient.
          if (allowEarlyNotBlocked && notBlockedCount >= EARLY_NOT_BLOCKED_THRESHOLD) {
            finish('not-blocked')
            return
          }

          if (completed === totalDetections) {
            // All methods returned not-blocked.
            if (hintHasRedirect || hintShouldBlock) {
              // Reference engine says this URL should be blocked or redirected.
              // Do one final aggressive redirect check — some ad blockers may
              // have redirected without standard signals being caught.
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
          if (completed === totalDetections) {
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
