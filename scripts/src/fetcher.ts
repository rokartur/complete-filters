import type { FetchResult } from "./types.ts"
import {
	USER_AGENT,
	FETCH_TIMEOUT,
	HOSTS_RE,
	HOSTS_SKIP,
} from "./constants.ts"
import { pooled, log, logError, normalizeUrl } from "./utils.ts"

// ── Hosts format detection ─────────────────────────────────────────────────

export function isHostsFormat(text: string): boolean {
	let total = 0
	let hits = 0
	for (const raw of text.split("\n")) {
		const line = raw.trim()
		if (!line || line.startsWith("#") || line.startsWith("!")) continue
		total++
		if (HOSTS_RE.test(line)) hits++
		if (total >= 200) break
	}
	return total > 0 && hits / total >= 0.6
}

// ── Hosts line conversion ──────────────────────────────────────────────────

export function convertHostsLine(line: string): string | null {
	const m = HOSTS_RE.exec(line)
	if (!m || !m[1]) return null
	const domain = m[1].toLowerCase().replace(/^\.+|\.+$/g, "")
	if (HOSTS_SKIP.has(domain) || !domain) return null
	return `||${domain}^`
}

// ── Single URL content fetch ─────────────────────────────────────────────

export async function fetchContent(url: string): Promise<FetchResult> {
	const normalizedUrl = normalizeUrl(url)
	try {
		const response = await fetch(normalizedUrl, {
			headers: { "User-Agent": USER_AGENT },
			signal: AbortSignal.timeout(FETCH_TIMEOUT),
			redirect: "follow",
		})
		if (!response.ok) {
			return { url: normalizedUrl, content: null, error: `HTTP ${response.status}`, isHosts: false }
		}
		const text = await response.text()
		return { url: normalizedUrl, content: text, error: null, isHosts: isHostsFormat(text) }
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		return { url: normalizedUrl, content: null, error: msg, isHosts: false }
	}
}

// ── Concurrent fetch all ──────────────────────────────────────────────────

export async function fetchAll(urls: string[], concurrency: number): Promise<FetchResult[]> {
	const total = urls.length
	let done = 0

	const results = await pooled(urls, concurrency, async (url) => {
		let result = await fetchContent(url)
		if (result.error) result = await fetchContent(url)
		done++
		if (result.error) {
			logError(`[${done}/${total}] ✗ ${url} — ${result.error}`)
		} else {
			const tag = result.isHosts ? " (hosts)" : ""
			const lines = result.content?.split("\n").length ?? 0
			log(`[${done}/${total}] ✓ ${url}${tag} (${lines} lines)`)
		}
		return result
	})

	return results
}
