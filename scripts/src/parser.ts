import type { FetchResult, ParsedLine, LineKind } from "./types.ts"
import { getPublicSuffix } from "tldts"
import {
	FORMAT_HEADER_RE,
	META_PREFIXES,
	OPTION_ALIASES,
	KNOWN_OPTION_NAMES,
	HOSTS_RE,
	HOSTS_SKIP,
} from "./constants.ts"
import { logWarning } from "./utils.ts"

// ── Cosmetic / scriptlet detection ─────────────────────────────────────────

const SCRIPTLET_MARKER = "##+js("
const HTML_FILTER_MARKER = "##^"
const BADFILTER_RE = /\$.*\bbadfilter\b/i
const COSMETIC_SEP_RE = /(?:^|[^\\])(?:##\^|#@?\??#)/
const HOSTNAME_CANDIDATE_RE = /^[a-z0-9.-]+$/i

function isCosmetic(line: string): boolean {
	if (line.includes(SCRIPTLET_MARKER)) return true
	if (line.includes(HTML_FILTER_MARKER)) return true
	return COSMETIC_SEP_RE.test(line)
}

function extractRuleHostnameCandidate(line: string): string | null {
	if (isCosmetic(line)) return null

	const body = line.startsWith("@@") ? line.slice(2) : line
	if (!body || body.startsWith("/")) return null

	// Bare host/domain-like entries from host/domain blocklists.
	if (HOSTNAME_CANDIDATE_RE.test(body)) {
		const host = body.toLowerCase().replace(/^\.+|\.+$/g, "")
		return host || null
	}

	if (!body.startsWith("||")) return null

	const remainder = body.slice(2)
	let end = remainder.length
	for (const sep of ["^", "/", "*", "?", "$", ":", "|"]) {
		const idx = remainder.indexOf(sep)
		if (idx !== -1 && idx < end) end = idx
	}

	const host = remainder.slice(0, end).toLowerCase().replace(/^\.+|\.+$/g, "")
	return host || null
}

function isPublicSuffixRule(line: string): boolean {
	const host = extractRuleHostnameCandidate(line)
	if (!host || !HOSTNAME_CANDIDATE_RE.test(host)) return false

	const publicSuffix = getPublicSuffix(host)
	return publicSuffix !== null && host === publicSuffix
}

// ── Option normalization ───────────────────────────────────────────────────

export function normalizeOptions(optionsStr: string): string {
	const parts: string[] = []
	for (let opt of optionsStr.split(",")) {
		opt = opt.trim()
		if (!opt) continue
		const negated = opt.startsWith("~")
		if (negated) opt = opt.slice(1)
		let name = opt
		let value = ""
		const eqIdx = opt.indexOf("=")
		if (eqIdx !== -1) {
			name = opt.slice(0, eqIdx)
			value = opt.slice(eqIdx + 1)
		}
		const nameLower = OPTION_ALIASES[name.toLowerCase()] ?? name.toLowerCase()
		let rebuilt = `${negated ? "~" : ""}${nameLower}`
		if (value) rebuilt += `=${value}`
		parts.push(rebuilt)
	}
	parts.sort((a, b) => {
		const ka = a.replace(/^~/, "").split("=")[0]!
		const kb = b.replace(/^~/, "").split("=")[0]!
		return ka.localeCompare(kb)
	})
	return parts.join(",")
}

// ── Split network rule into pattern + options ──────────────────────────────

export function splitNetworkRule(line: string): [string, string | null] {
	if (isCosmetic(line)) return [line, null]

	const body = line.startsWith("@@") ? line.slice(2) : line

	// Regex pattern: /pattern/options
	if (body.startsWith("/")) {
		let idx = 1
		while (idx < body.length) {
			if (body[idx] === "/" && body[idx - 1] !== "\\") {
				const rest = body.slice(idx + 1)
				if (rest.startsWith("$")) {
					const prefix = line.slice(0, line.length - rest.length)
					return [prefix, rest.slice(1)]
				}
				return [line, null]
			}
			idx++
		}
		return [line, null]
	}

	const dollar = line.lastIndexOf("$")
	if (dollar <= 0) return [line, null]

	const candidate = line.slice(dollar + 1)
	if (!candidate) return [line, null]

	// Check if this looks like options (has comma/equals, or first part is a known option)
	const firstPart = candidate.split(",")[0]!.toLowerCase().replace(/^~/, "")
	if (candidate.includes(",") || candidate.includes("=") || KNOWN_OPTION_NAMES.has(firstPart)) {
		return [line.slice(0, dollar), candidate]
	}

	return [line, null]
}

// ── Deduplication key generation ───────────────────────────────────────────

let badfilterCounter = 0

export function makeDedupKey(line: string): string {
	const stripped = line.trimEnd()

	// badfilter rules are always unique
	if (BADFILTER_RE.test(stripped)) {
		return `__badfilter__${badfilterCounter++}__`
	}

	if (isCosmetic(stripped)) return stripped

	const [pattern, options] = splitNetworkRule(stripped)
	if (options === null) return stripped

	return `${pattern}$${normalizeOptions(options)}`
}

// ── Metadata header stripping ──────────────────────────────────────────────

function shouldStripMeta(line: string): boolean {
	if (FORMAT_HEADER_RE.test(line)) return true
	for (const prefix of META_PREFIXES) {
		if (line.startsWith(prefix)) return true
	}
	return false
}

// ── Hosts line conversion ──────────────────────────────────────────────────

function convertHostsLine(line: string): string | null {
	const m = HOSTS_RE.exec(line)
	if (!m || !m[1]) return null
	const domain = m[1].toLowerCase().replace(/^\.+|\.+$/g, "")
	if (HOSTS_SKIP.has(domain) || !domain) return null
	return `||${domain}^`
}

// ── Source parser ──────────────────────────────────────────────────────────

export function parseSource(result: FetchResult): ParsedLine[] {
	if (result.content === null) return []

	const lines: ParsedLine[] = []
	const condStack: string[] = []
	let hostsConverted = 0

	for (const rawLine of result.content.split("\n")) {
		const line = rawLine.trimEnd()

		if (!line) {
			lines.push({ text: "", condStack: [...condStack], kind: "blank" })
			continue
		}

		if (FORMAT_HEADER_RE.test(line)) {
			lines.push({ text: line, condStack: [...condStack], kind: "header" })
			continue
		}

		if (line.startsWith("!#")) {
			const directiveLower = line.toLowerCase()

			// Skip !#include
			if (directiveLower.startsWith("!#include")) continue

			if (directiveLower.startsWith("!#if ") || directiveLower.startsWith("!#if\t")) {
				const condition = line.slice(5).trim()
				condStack.push(condition)
				lines.push({ text: line, condStack: [...condStack], kind: "directive" })
				continue
			}

			if (directiveLower.startsWith("!#endif")) {
				lines.push({ text: line, condStack: [...condStack], kind: "directive" })
				if (condStack.length > 0) {
					condStack.pop()
				} else {
					logWarning(`  unmatched !#endif in ${result.url}`)
				}
				continue
			}

			lines.push({ text: line, condStack: [...condStack], kind: "directive" })
			continue
		}

		if (line.startsWith("!") && shouldStripMeta(line)) {
			lines.push({ text: line, condStack: [...condStack], kind: "meta" })
			continue
		}

		if (line.startsWith("!")) {
			lines.push({ text: line, condStack: [...condStack], kind: "comment" })
			continue
		}

		// Hosts format handling
		if (result.isHosts) {
			if (line.startsWith("#")) {
				lines.push({ text: `! ${line.slice(1).trim()}`, condStack: [...condStack], kind: "comment" })
				continue
			}
			const converted = convertHostsLine(line)
			if (converted) {
				if (isPublicSuffixRule(converted)) continue
				hostsConverted++
				lines.push({ text: converted, condStack: [...condStack], kind: "rule" })
				continue
			}
			if (line.trim()) continue
			lines.push({ text: "", condStack: [...condStack], kind: "blank" })
			continue
		}

		if (isPublicSuffixRule(line)) continue

		lines.push({ text: line, condStack: [...condStack], kind: "rule" })
	}

	if (condStack.length > 0) {
		logWarning(`  ${condStack.length} unclosed !#if block(s) in ${result.url}`)
	}

	return lines
}
