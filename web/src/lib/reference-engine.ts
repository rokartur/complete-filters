/**
 * Reference Filter Engine — powered by @ghostery/adblocker
 *
 * TWO engines work together:
 *
 * 1. PREBUILT engine (EasyList + EasyPrivacy) — loaded from @ghostery/adblocker
 *    prebuilt filters. Provides baseline hints for standard rules.
 *
 * 2. COMPLETE engine (all complete-filters) — loaded from the project's own
 *    filter/*.txt files on GitHub. Provides full coverage including $domain=
 *    restricted rules, cookies/consent filters, regional rules, etc.
 *
 * The engines provide **hints** to the detection engine:
 *
 * 1. If a URL has a `$redirect` rule (e.g. `$redirect=noopjs`):
 *    → Detection engine retries redirect checks with longer delays because
 *      Performance API entries may not be available immediately.
 *
 * 2. If a URL has a type-specific rule (`$script`, `$image`):
 *    → Detection engine gives higher weight to the element-based method
 *      (preload/img) over fetch, since fetch sends as `xmlhttprequest`.
 *
 * 3. If a URL is matched by a $domain= restricted rule that only applies on
 *    specific websites (not the tester's own domain):
 *    → Detection engine trusts the reference verdict because network-based
 *      detection cannot trigger $domain= rules from the tester's domain.
 *
 * 4. The matched filter rule string is exposed for UI display, helping
 *    users understand which rules cover each test.
 *
 * Both engines load asynchronously and are non-blocking. If they fail to load
 * (network error, etc.), detection works exactly as before — no hints.
 *
 * MULTI-CONTEXT MATCHING: For $domain= rules, the URL is tested from multiple
 * simulated source domains (the URL's own origin + representative popular sites)
 * to catch rules that only apply on specific websites.
 */

import { FiltersEngine, Request } from '@ghostery/adblocker'
import {
  FILTER_SUBSCRIPTION_CATEGORIES,
  getFilterSubscriptionUrl,
} from '@/lib/filter-subscriptions'

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
  /**
   * Whether the matching rule has a $domain= restriction that does NOT include
   * the tester's own domain. These rules only fire when the request originates
   * from specific websites (e.g. ||tracker.com^$domain=kicker.de|onet.pl).
   *
   * Network-based detection CANNOT trigger these rules from the tester's page.
   * When true, the detection engine trusts the reference engine verdict —
   * analogous to hasDocumentRule handling.
   */
  domainRestricted: boolean
  /** The raw filter rule string (e.g. "||ads.example.com^$script") */
  filterRule?: string
  /** The redirect resource name (e.g. "noopjs", "1x1.gif") */
  redirectName?: string
}

const EMPTY_HINT: FilterHint = {
  shouldBlock: false,
  hasRedirect: false,
  hasDocumentRule: false,
  domainRestricted: false,
}

function isDocumentUrl(url: string): boolean {
  if (/\.js($|\?|&|#)/i.test(url)) return false
  if (/\.(gif|png|jpe?g|webp|svg|ico|bmp)($|\?|&|#)/i.test(url)) return false

  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname || '/'

    // Only explicit page extensions are documents — root domains and
    // trailing-slash paths are tracker endpoints, not navigable pages.
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
 * Complete-filters engine — loaded from the project's filter/*.txt files,
 * but with aggressive pre-filtering to keep only $domain= restricted rules.
 *
 * WHY PRE-FILTER: The complete filter set is 232MB / 9M lines. Parsing all
 * of that with @ghostery/adblocker would consume 5+ GB of RAM. However, the
 * only rules that network detection CANNOT catch are $domain= restricted ones
 * (they only fire from specific source websites, not the tester's domain).
 *
 * Simple rules like ||domain.com^ are already detected by fetch/img/preload.
 * $redirect rules are caught by Performance API timing detection.
 * $third-party rules work because the tester's requests ARE third-party.
 *
 * So we fetch each file, filter to lines containing "domain=" (~8.5K rules
 * from all 14 files), and parse only those. This uses <1 MB of memory vs 5+ GB.
 */
let completeEngine: FiltersEngine | null = null
let completeLoadPromise: Promise<void> | null = null

/**
 * Fetch a filter list and extract only lines containing $domain= rules.
 *
 * Keeps:
 * - Block rules with domain= (e.g. ||tracker.com^$domain=kicker.de)
 * - Exception rules with domain= (e.g. @@||tracker.com^$domain=kicker.de)
 *
 * Strips: comments, cosmetic rules, simple domain blocks, empty lines.
 * This reduces ~65 MB of text to ~500 KB of $domain= rules.
 *
 * Uses streaming (ReadableStream) to process large files without loading
 * the entire file into memory at once. Each chunk is decoded and filtered
 * incrementally — only matching lines are accumulated.
 */
async function fetchDomainRestrictedRules(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok || !response.body) return ''

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const kept: string[] = []
  let partial = '' // Leftover from previous chunk (incomplete line)

  try {
    for (;;) {
      const { done, value } = await reader.read()
      const chunk = partial + decoder.decode(value ?? new Uint8Array(), { stream: !done })
      const lines = chunk.split('\n')

      // Last element might be incomplete — save for next iteration
      partial = done ? '' : (lines.pop() ?? '')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Fast path: skip empty lines and comments
        if (line.length === 0 || line[0] === '!') continue
        // Skip cosmetic rules (##, #@#, #$#, #%#, #+js)
        if (line.includes('##') || line.includes('#@#') || line.includes('#$#') || line.includes('#%#')) continue
        // Keep only lines with domain= modifier
        if (line.includes('domain=')) {
          kept.push(line)
        }
      }

      if (done) break
    }
  } catch {
    // Stream read error — release the reader and return what we have so far
    reader.releaseLock()
  }

  return kept.join('\n')
}

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
 * Initialize the complete-filters engine by loading filter/*.txt files from
 * the project's GitHub repository, keeping ONLY $domain= restricted rules.
 *
 * Catches rules like: ||consentmanager.net^$domain=kicker.de|onet.pl|...
 *
 * Memory footprint: ~1 MB (vs 5+ GB if all rules were parsed).
 * Download: ~67 MB across 10 files → pre-filtered to ~8.5K rules (~500 KB).
 *
 * Massive domain blocklists are SKIPPED to save bandwidth:
 * - hagezi.txt  (69 MB, 13 $domain= rules → not worth downloading)
 * - malware.txt (53 MB, 32 $domain= rules → not worth downloading)
 * - privacy.txt (33 MB, 568 $domain= rules → marginal, but too heavy)
 * - mixed.txt   (9.2 MB, 0 $domain= rules → nothing to extract)
 *
 * Safe to call multiple times — subsequent calls return the same promise.
 */
const SKIPPED_CATEGORIES = new Set(['hagezi', 'malware', 'privacy', 'mixed'])

export function initCompleteFiltersEngine(): Promise<void> {
  if (completeEngine) return Promise.resolve()
  if (completeLoadPromise) return completeLoadPromise

  completeLoadPromise = (async () => {
    try {
      const categories = FILTER_SUBSCRIPTION_CATEGORIES.filter(
        (cat) => !SKIPPED_CATEGORIES.has(cat.id)
      )
      const urls = categories.map((cat) =>
        getFilterSubscriptionUrl(cat.fileName)
      )

      // Fetch all files in parallel and pre-filter to $domain= rules only.
      // Each file is downloaded, filtered in-memory, then the raw text is
      // released to GC — only the small filtered strings survive.
      const ruleChunks = await Promise.all(
        urls.map((url) =>
          fetchDomainRestrictedRules(url).catch(() => '')
        )
      )

      const combinedRules = ruleChunks.filter(Boolean).join('\n')

      if (combinedRules.length > 0) {
        completeEngine = FiltersEngine.parse(combinedRules)
      }
    } catch (err) {
      console.warn(
        '[reference-engine] Failed to load complete-filters:',
        err
      )
      // Non-critical — prebuilt engine still provides basic hints
    }
  })()

  return completeLoadPromise
}

/**
 * Whether the reference engine has been loaded and is ready to provide hints.
 */
export function isReferenceReady(): boolean {
  return engine !== null
}

/**
 * Whether the complete-filters engine has been loaded and is ready.
 */
export function isCompleteEngineReady(): boolean {
  return completeEngine !== null
}

// ---------------------------------------------------------------------------
// Multi-context source URLs for $domain= matching
// ---------------------------------------------------------------------------

/**
 * Representative source domains for simulating real-world browsing contexts.
 *
 * When a filter rule has a $domain= restriction (e.g. ||tracker.com^$domain=kicker.de),
 * it only fires when the request originates from one of the listed domains.
 * The tester runs on its own domain, so these rules never trigger during
 * network-based detection.
 *
 * To catch these rules, we simulate matching from popular websites that
 * commonly appear in $domain= lists across the filter files.
 * These represent the top Polish, German, and international sites that
 * frequently appear in the complete-filters $domain= restrictions.
 */
const REPRESENTATIVE_SOURCE_URLS = [
  'https://www.onet.pl',
  'https://www.wp.pl',
  'https://www.allegro.pl',
  'https://www.kicker.de',
  'https://www.bild.de',
  'https://www.nzz.ch',
  'https://www.google.com',
  'https://www.youtube.com',
  'https://www.reddit.com',
  'https://www.facebook.com',
]

// ---------------------------------------------------------------------------
// Per-engine matching helper
// ---------------------------------------------------------------------------

/**
 * Match a URL against a single engine using a specific sourceUrl.
 * Checks multiple request types (document, script, image, stylesheet, xhr)
 * and returns the first match found.
 */
function matchUrlInEngine(
  eng: FiltersEngine,
  url: string,
  sourceUrl: string
): FilterHint {
  // Document URLs: check main_frame / sub_frame first
  if (isDocumentUrl(url)) {
    try {
      const mainFrameResult = eng.match(
        Request.fromRawDetails({ type: 'main_frame', url, sourceUrl })
      )
      if (mainFrameResult.match || mainFrameResult.redirect) {
        let isDocumentOnly = false
        try {
          const scriptCheck = eng.match(
            Request.fromRawDetails({ type: 'script', url, sourceUrl })
          )
          const xhrCheck = eng.match(
            Request.fromRawDetails({ type: 'xmlhttprequest', url, sourceUrl })
          )
          isDocumentOnly = !scriptCheck.match && !xhrCheck.match
        } catch {
          /* ignore */
        }

        return {
          shouldBlock: true,
          hasRedirect: !!mainFrameResult.redirect,
          hasDocumentRule: isDocumentOnly,
          domainRestricted: false,
          filterRule: mainFrameResult.filter?.toString(),
          redirectName: mainFrameResult.redirect?.contentType,
        }
      }
    } catch {
      /* ignore */
    }

    try {
      const subFrameResult = eng.match(
        Request.fromRawDetails({ type: 'sub_frame', url, sourceUrl })
      )
      if (subFrameResult.match || subFrameResult.redirect) {
        return {
          shouldBlock: true,
          hasRedirect: !!subFrameResult.redirect,
          hasDocumentRule: false,
          domainRestricted: false,
          filterRule: subFrameResult.filter?.toString(),
          redirectName: subFrameResult.redirect?.contentType,
        }
      }
    } catch {
      /* ignore */
    }
  }

  // 1. Check as script request (most $redirect rules target scripts)
  try {
    const scriptResult = eng.match(
      Request.fromRawDetails({ type: 'script', url, sourceUrl })
    )
    if (scriptResult.match || scriptResult.redirect) {
      return {
        shouldBlock: true,
        hasRedirect: !!scriptResult.redirect,
        hasDocumentRule: false,
        domainRestricted: false,
        filterRule: scriptResult.filter?.toString(),
        redirectName: scriptResult.redirect?.contentType,
      }
    }
  } catch {
    /* ignore parse errors */
  }

  // 2. Check as image request
  try {
    const imageResult = eng.match(
      Request.fromRawDetails({ type: 'image', url, sourceUrl })
    )
    if (imageResult.match || imageResult.redirect) {
      return {
        shouldBlock: true,
        hasRedirect: !!imageResult.redirect,
        hasDocumentRule: false,
        domainRestricted: false,
        filterRule: imageResult.filter?.toString(),
        redirectName: imageResult.redirect?.contentType,
      }
    }
  } catch {
    /* ignore */
  }

  // 3. Check as stylesheet request (catches $stylesheet rules)
  try {
    const stylesheetResult = eng.match(
      Request.fromRawDetails({ type: 'stylesheet', url, sourceUrl })
    )
    if (stylesheetResult.match || stylesheetResult.redirect) {
      return {
        shouldBlock: true,
        hasRedirect: !!stylesheetResult.redirect,
        hasDocumentRule: false,
        domainRestricted: false,
        filterRule: stylesheetResult.filter?.toString(),
        redirectName: stylesheetResult.redirect?.contentType,
      }
    }
  } catch {
    /* ignore */
  }

  // 4. Check as generic xmlhttprequest (catches ||domain.com^)
  try {
    const genericResult = eng.match(
      Request.fromRawDetails({ type: 'xmlhttprequest', url, sourceUrl })
    )
    if (genericResult.match) {
      return {
        shouldBlock: true,
        hasRedirect: !!genericResult.redirect,
        hasDocumentRule: false,
        domainRestricted: false,
        filterRule: genericResult.filter?.toString(),
        redirectName: genericResult.redirect?.contentType,
      }
    }
  } catch {
    /* ignore */
  }

  return EMPTY_HINT
}

// ---------------------------------------------------------------------------
// URL matching — public API
// ---------------------------------------------------------------------------

/**
 * Query the reference engines for a filter hint on the given URL.
 *
 * Matching strategy (stops at first match):
 *
 * 1. PREBUILT engine (EasyList + EasyPrivacy) with tester's sourceUrl
 *    → Catches standard rules without domain restrictions.
 *
 * 2. COMPLETE engine with tester's sourceUrl
 *    → Catches complete-filters rules matching from the tester's domain
 *      (unrestricted rules + $third-party rules).
 *
 * 3. COMPLETE engine with URL's own origin as sourceUrl
 *    → Catches $domain= rules where the tracker's own domain is in the list.
 *      Example: ||consentmanager.net^$domain=...|consentmanager.net|...
 *      This is very common — many rules include the tracker's own domain.
 *      Result is flagged as domainRestricted: true.
 *
 * 4. COMPLETE engine with representative popular domains
 *    → Catches $domain= rules targeting common websites.
 *      Example: ||tracker.com^$domain=kicker.de|onet.pl
 *      Result is flagged as domainRestricted: true.
 *
 * When domainRestricted is true, the detection engine trusts the reference
 * verdict instead of relying on network detection (which can't trigger
 * $domain= rules from the tester's domain).
 */
export function getFilterHint(url: string): FilterHint {
  const sourceUrl = globalThis.location?.href ?? 'https://example.com'

  // --- Phase 1: Prebuilt engine (EasyList + EasyPrivacy) ---
  if (engine) {
    const prebuiltHint = matchUrlInEngine(engine, url, sourceUrl)
    if (prebuiltHint.shouldBlock) return prebuiltHint
  }

  // --- Phase 2: Complete-filters engine ---
  if (completeEngine) {
    // 2a. Check from tester's own domain (catches unrestricted + $third-party rules)
    const completeHint = matchUrlInEngine(completeEngine, url, sourceUrl)
    if (completeHint.shouldBlock) return completeHint

    // 2b. Check from URL's own origin (catches $domain= with self-reference)
    // Many $domain= rules include the tracker's own domain in the list.
    try {
      const urlOrigin = new URL(url).origin
      if (urlOrigin !== new URL(sourceUrl).origin) {
        const ownDomainHint = matchUrlInEngine(completeEngine, url, urlOrigin)
        if (ownDomainHint.shouldBlock) {
          return { ...ownDomainHint, domainRestricted: true }
        }
      }
    } catch {
      /* ignore invalid URLs */
    }

    // 2c. Check from representative popular domains
    // Catches $domain= rules for common websites (Polish, German, international)
    for (const repSourceUrl of REPRESENTATIVE_SOURCE_URLS) {
      try {
        const repHint = matchUrlInEngine(completeEngine, url, repSourceUrl)
        if (repHint.shouldBlock) {
          return { ...repHint, domainRestricted: true }
        }
      } catch {
        /* ignore */
      }
    }
  }

  return EMPTY_HINT
}
