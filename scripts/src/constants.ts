import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

// ── Paths ──────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export const SCRIPT_DIR = resolve(__dirname, "..")
export const ROOT = resolve(SCRIPT_DIR, "..")

export const CATEGORIES_DIR = resolve(ROOT, "categories")
export const FILTER_DIR = resolve(ROOT, "filter")
export const MANUAL_RULES = [
	resolve(ROOT, "manual-rules", "manual-blocklist.txt"),
	resolve(ROOT, "manual-rules", "manual-allowlist.txt"),
] as const

// ── Network ────────────────────────────────────────────────────────────────

export const UBO_BADLISTS_URL = "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badlists.txt"
export const USER_AGENT = "Mozilla/5.0 (compatible; PolishCompleteFilters/2.0)"
export const DEFAULT_JOBS = 24
export const FETCH_TIMEOUT = 30_000

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

// ── Build defaults ─────────────────────────────────────────────────────────

export const DEFAULT_TITLE = "Complete Filters"
export const DEFAULT_HOMEPAGE = "https://github.com/rokartur/complete-filters"
export const DEFAULT_DESCRIPTION = "Combined filter list from upstream sources for uBlock Origin"
export const DEFAULT_EXPIRES = "6 hours"
