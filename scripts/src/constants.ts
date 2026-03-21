import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import type { Category } from "./types.ts"

// ── Paths ──────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export const SCRIPT_DIR = resolve(__dirname, "..")
export const ROOT = resolve(SCRIPT_DIR, "..")

export const FILTERS_TXT = resolve(ROOT, "filters.txt")
export const NOT_FOUND_TXT = resolve(ROOT, "not-found.txt")
export const CATEGORIES_DIR = resolve(ROOT, "categories")
export const FILTER_DIR = resolve(ROOT, "filter")
export const MANUAL_RULES = [
	resolve(ROOT, "manual-rules", "website-compatibility-allowlist.txt"),
	resolve(ROOT, "manual-rules", "popular-sites-document-allowlist.txt"),
	resolve(ROOT, "manual-rules", "developer-infrastructure-allowlist.txt"),
	resolve(ROOT, "manual-rules", "manual-blocklist.txt"),
] as const

// ── API ────────────────────────────────────────────────────────────────────

export const API_BASE = "https://api.filterlists.com"
export const USER_AGENT = "Mozilla/5.0 (compatible; PolishCompleteFilters/2.0)"

// ── Concurrency & Timeouts ─────────────────────────────────────────────────

export const DEFAULT_JOBS = 24
export const API_TIMEOUT = 30_000
export const FETCH_TIMEOUT = 30_000
export const META_FETCH_BYTES = 65_536

// ── uBlock Origin syntax compatibility ─────────────────────────────────────

export const KNOWN_UBLOCK_COMPATIBLE_SYNTAX_IDS = new Set([1, 2, 3, 4, 6])
export const EXPECTED_UBLOCK_NAME = "uBlock Origin"

export const UBLOCK_COMPATIBLE_SYNTAX_NAMES = new Set([
	"adblock plus",
	"hosts",
	"domains-only",
	"ublock origin static filtering",
	"adguard",
])

// ── Hosts format detection ─────────────────────────────────────────────────

export const HOSTS_RE = /^(?:0\.0\.0\.0|127\.0\.0\.1)\s+(\S+)\s*$/
export const HOSTS_SKIP = new Set([
	"localhost",
	"localhost.localdomain",
	"local",
	"broadcasthost",
	"ip6-localhost",
	"ip6-loopback",
	"ip6-localnet",
	"ip6-mcastprefix",
	"ip6-allnodes",
	"ip6-allrouters",
	"ip6-allhosts",
	"0.0.0.0",
])

// ── Filter format patterns ─────────────────────────────────────────────────

export const FORMAT_HEADER_RE = /^\[(?:Adblock(?:\s*Plus)?|uBlock Origin)[^\]]*\]\s*$/i

export const META_PREFIXES = [
	"! Title:",
	"! Homepage:",
	"! Expires:",
	"! Version:",
	"! Checksum:",
	"! Last modified:",
	"! Last updated:",
	"! Description:",
	"! Licence:",
	"! License:",
	"! TimeUpdated:",
	"! Redirect:",
	"! URL:",
	"! Source:",
] as const

// ── Network rule option aliases ────────────────────────────────────────────

export const OPTION_ALIASES: Record<string, string> = {
	"1p": "first-party",
	"3p": "third-party",
	xhr: "xmlhttprequest",
	css: "stylesheet",
	frame: "subdocument",
	doc: "document",
	queryprune: "removeparam",
	ehide: "elemhide",
	ghide: "generichide",
	shide: "specifichide",
}

export const KNOWN_OPTION_NAMES = new Set([
	"third-party", "3p", "first-party", "1p", "script", "image", "stylesheet",
	"css", "xmlhttprequest", "xhr", "subdocument", "frame", "object",
	"ping", "media", "font", "websocket", "other", "popup", "document",
	"doc", "all", "important", "badfilter", "match-case", "domain",
	"redirect", "redirect-rule", "csp", "removeparam", "queryprune",
	"denyallow", "from", "to", "header", "method", "permissions",
	"rewrite", "urltransform", "replace", "elemhide", "ehide",
	"generichide", "ghide", "specifichide", "shide", "genericblock",
	"mp4", "empty", "inline-script", "inline-font",
])

// ── Categories ─────────────────────────────────────────────────────────────

export const CATEGORIES: readonly Category[] = [
	"ads",
	"annoyances",
	"anti-adblock",
	"compatibility",
	"content",
	"cookies",
	"malware",
	"mobile",
	"mixed",
	"privacy",
	"regional",
	"social",
	"video",
] as const

// ── Build defaults ─────────────────────────────────────────────────────────

export const DEFAULT_TITLE = "Complete Filters"
export const DEFAULT_HOMEPAGE = "https://github.com/rokartur/complete-filters"
export const DEFAULT_DESCRIPTION = "Combined filter list from upstream sources for uBlock Origin"
export const DEFAULT_EXPIRES = "6 hours"

// ── Exact category overrides for specific URLs ─────────────────────────────

export const EXACT_OVERRIDES: Record<string, Category> = {
	"https://hole.cert.pl/domains/v2/domains_adblock.txt": "malware",
	"https://hole.cert.pl/domains/v2/domains_ublock.txt": "malware",
	"https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters-general.txt": "ads",
	"https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/resource-abuse.txt": "malware",
}

// ── Metadata header pattern for categorizer ────────────────────────────────

export const TITLE_RE = /^(?:!|#)\s*(Title|Description|Homepage|Expires|Version|Last modified|Name)\s*:\s*(.*)$/i
export const REGIONAL_PREFIX_RE = /\b[A-Z]{2,4}:\s/
