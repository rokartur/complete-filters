/**
 * Reference Filter Engine — powered by @ghostery/adblocker
 *
 * Loads EasyList + EasyPrivacy (prebuilt) and provides a "second opinion"
 * for every test URL: does a standard filter rule exist that should block it?
 *
 * This is NOT used to override browser detection results. Instead it provides
 * **hints** to the detection engine so it can optimize its strategy:
 *
 * 1. If a URL has a `$redirect` rule (e.g. `$redirect=noopjs`):
 *    → Detection engine retries redirect checks with longer delays because
 *      Performance API entries may not be available immediately.
 *
 * 2. If a URL has a type-specific rule (`$script`, `$image`):
 *    → Detection engine gives higher weight to the element-based method
 *      (preload/img) over fetch, since fetch sends as `xmlhttprequest`.
 *
 * 3. The matched filter rule string is exposed for UI display, helping
 *    users understand which rules cover each test.
 *
 * The engine loads asynchronously and is non-blocking. If it fails to load
 * (network error, etc.), detection works exactly as before — no hints.
 */

import { FiltersEngine, Request } from '@ghostery/adblocker'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterHint {
  /** Whether standard filter lists contain a rule matching this URL */
  shouldBlock: boolean
  /** Whether the matching rule is a $redirect (noopjs, 1x1.gif, etc.) */
  hasRedirect: boolean
  /**
   * Whether the matching rule targets the document/main_frame type.
   * $document rules block top-level navigation but NOT sub-resource requests
   * (fetch, img, script, etc.), making them undetectable from within a page.
   * When true, the detection engine trusts the reference engine verdict.
   */
  hasDocumentRule: boolean
  /** The raw filter rule string (e.g. "||ads.example.com^$script") */
  filterRule?: string
  /** The redirect resource name (e.g. "noopjs", "1x1.gif") */
  redirectName?: string
}

const EMPTY_HINT: FilterHint = {
  shouldBlock: false,
  hasRedirect: false,
  hasDocumentRule: false,
}

function isDocumentUrl(url: string): boolean {
  if (/\.js($|\?|&|#)/i.test(url)) return false
  if (/\.(gif|png|jpe?g|webp|svg|ico|bmp)($|\?|&|#)/i.test(url)) return false

  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname || '/'

    if (pathname === '/' || pathname === '') return true
    if (pathname.endsWith('/')) return true

    return /\.(html?|xhtml|php|asp|aspx|jsp|jspx|cfm|cgi)($|\?|#)/i.test(
      pathname
    )
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Engine lifecycle
// ---------------------------------------------------------------------------

let engine: FiltersEngine | null = null
let loadPromise: Promise<void> | null = null

/**
 * Initialize the reference engine by loading prebuilt EasyList + EasyPrivacy.
 * Safe to call multiple times — subsequent calls return the same promise.
 */
export function initReferenceEngine(): Promise<void> {
  if (engine) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    try {
      engine = await FiltersEngine.fromPrebuiltAdsAndTracking(fetch)
    } catch (err) {
      console.warn('[reference-engine] Failed to load prebuilt filters:', err)
      // Non-critical — detection works without hints
    }
  })()

  return loadPromise
}

/**
 * Whether the reference engine has been loaded and is ready to provide hints.
 */
export function isReferenceReady(): boolean {
  return engine !== null
}

// ---------------------------------------------------------------------------
// URL matching
// ---------------------------------------------------------------------------

/**
 * Query the reference engine for a filter hint on the given URL.
 *
 * Checks the URL against standard lists as several request types:
 *   1. `main_frame` / `sub_frame` — catches document/subdocument rules
 *   2. `script`                  — catches $script rules and $redirect=noopjs
 *   3. `image`                   — catches $image rules and $redirect=1x1.gif
 *   4. generic                   — catches domain-level rules (||domain.com^)
 *
 * Returns the FIRST match found (script > image > generic), because
 * type-specific rules with $redirect are the hardest to detect and
 * benefit most from hinting.
 */
export function getFilterHint(url: string): FilterHint {
  if (!engine) return EMPTY_HINT

  const sourceUrl = globalThis.location?.href ?? 'https://example.com'

  if (isDocumentUrl(url)) {
    try {
      const mainFrameResult = engine.match(
        Request.fromRawDetails({ type: 'main_frame', url, sourceUrl })
      )
      if (mainFrameResult.match || mainFrameResult.redirect) {
        // Check if this is a document-only rule by testing if non-document
        // types are also blocked. If only main_frame matches but script/image
        // don't, it's a $document-specific rule.
        let isDocumentOnly = false
        try {
          const scriptCheck = engine.match(
            Request.fromRawDetails({ type: 'script', url, sourceUrl })
          )
          const xhrCheck = engine.match(
            Request.fromRawDetails({ type: 'xmlhttprequest', url, sourceUrl })
          )
          isDocumentOnly = !scriptCheck.match && !xhrCheck.match
        } catch { /* ignore */ }

        return {
          shouldBlock: true,
          hasRedirect: !!mainFrameResult.redirect,
          hasDocumentRule: isDocumentOnly,
          filterRule: mainFrameResult.filter?.toString(),
          redirectName: mainFrameResult.redirect?.contentType,
        }
      }
    } catch { /* ignore */ }

    try {
      const subFrameResult = engine.match(
        Request.fromRawDetails({ type: 'sub_frame', url, sourceUrl })
      )
      if (subFrameResult.match || subFrameResult.redirect) {
        return {
          shouldBlock: true,
          hasRedirect: !!subFrameResult.redirect,
          hasDocumentRule: false,
          filterRule: subFrameResult.filter?.toString(),
          redirectName: subFrameResult.redirect?.contentType,
        }
      }
    } catch { /* ignore */ }
  }

  // 1. Check as script request (most $redirect rules target scripts)
  try {
    const scriptResult = engine.match(
      Request.fromRawDetails({ type: 'script', url, sourceUrl })
    )
    if (scriptResult.match || scriptResult.redirect) {
      return {
        shouldBlock: true,
        hasRedirect: !!scriptResult.redirect,
        hasDocumentRule: false,
        filterRule: scriptResult.filter?.toString(),
        redirectName: scriptResult.redirect?.contentType,
      }
    }
  } catch { /* ignore parse errors */ }

  // 2. Check as image request
  try {
    const imageResult = engine.match(
      Request.fromRawDetails({ type: 'image', url, sourceUrl })
    )
    if (imageResult.match || imageResult.redirect) {
      return {
        shouldBlock: true,
        hasRedirect: !!imageResult.redirect,
        hasDocumentRule: false,
        filterRule: imageResult.filter?.toString(),
        redirectName: imageResult.redirect?.contentType,
      }
    }
  } catch { /* ignore */ }

  // 3. Check as stylesheet request (catches $stylesheet rules)
  try {
    const stylesheetResult = engine.match(
      Request.fromRawDetails({ type: 'stylesheet', url, sourceUrl })
    )
    if (stylesheetResult.match || stylesheetResult.redirect) {
      return {
        shouldBlock: true,
        hasRedirect: !!stylesheetResult.redirect,
        hasDocumentRule: false,
        filterRule: stylesheetResult.filter?.toString(),
        redirectName: stylesheetResult.redirect?.contentType,
      }
    }
  } catch { /* ignore */ }

  // 4. Check as generic xmlhttprequest (catches ||domain.com^)
  try {
    const genericResult = engine.match(
      Request.fromRawDetails({ type: 'xmlhttprequest', url, sourceUrl })
    )
    if (genericResult.match) {
      return {
        shouldBlock: true,
        hasRedirect: !!genericResult.redirect,
        hasDocumentRule: false,
        filterRule: genericResult.filter?.toString(),
        redirectName: genericResult.redirect?.contentType,
      }
    }
  } catch { /* ignore */ }

  return EMPTY_HINT
}
