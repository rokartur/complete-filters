import type { FetchResult } from "./types.ts"
import {
	USER_AGENT,
	FETCH_TIMEOUT,
	HOSTS_RE,
	HOSTS_SKIP,
} from "./constants.ts"
import { pooled, log, logError, appendToNotFound } from "./utils.ts"

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

// ── Single URL content fetch (1 attempt, no retries) ──────────────────────

export async function fetchContent(url: string): Promise<FetchResult> {
	try {
		const response = await fetch(url, {
			headers: { "User-Agent": USER_AGENT },
			signal: AbortSignal.timeout(FETCH_TIMEOUT),
			redirect: "follow",
		})
		if (!response.ok) {
			return { url, content: null, error: `HTTP ${response.status}`, isHosts: false }
		}
		const text = await response.text()
		return { url, content: text, error: null, isHosts: isHostsFormat(text) }
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		return { url, content: null, error: msg, isHosts: false }
	}
}

// ── Fetch first N bytes of a URL (for metadata extraction) ─────────────

export async function fetchHead(url: string, maxBytes: number): Promise<FetchResult> {
	try {
		const response = await fetch(url, {
			headers: { "User-Agent": USER_AGENT },
			signal: AbortSignal.timeout(FETCH_TIMEOUT),
			redirect: "follow",
		})
		if (!response.ok) {
			return { url, content: null, error: `HTTP ${response.status}`, isHosts: false }
		}
		// Read only the first chunk
		const reader = response.body?.getReader()
		if (!reader) {
			return { url, content: null, error: "No response body", isHosts: false }
		}

		const chunks: Uint8Array[] = []
		let totalBytes = 0
		const decoder = new TextDecoder("utf-8", { fatal: false })

		while (totalBytes < maxBytes) {
			const { done, value } = await reader.read()
			if (done || !value) break
			chunks.push(value)
			totalBytes += value.byteLength
		}

		// Cancel the rest of the body
		reader.cancel().catch(() => {})

		const combined = new Uint8Array(totalBytes)
		let offset = 0
		for (const chunk of chunks) {
			combined.set(chunk, offset)
			offset += chunk.byteLength
		}

		const text = decoder.decode(combined)
		return { url, content: text, error: null, isHosts: false }
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		return { url, content: null, error: msg, isHosts: false }
	}
}

// ── Concurrent fetch all with not-found tracking ──────────────────────────

export async function fetchAll(
	urls: string[],
	concurrency: number,
	notFoundPath?: string,
): Promise<FetchResult[]> {
	const total = urls.length
	let done = 0
	const failedUrls: string[] = []

	const results = await pooled(urls, concurrency, async (url) => {
		const result = await fetchContent(url)
		done++
		if (result.error) {
			logError(`[${done}/${total}] ✗ ${url} — ${result.error}`)
			failedUrls.push(url)
		} else {
			const tag = result.isHosts ? " (hosts)" : ""
			const lines = result.content?.split("\n").length ?? 0
			log(`[${done}/${total}] ✓ ${url}${tag} (${lines} lines)`)
		}
		return result
	})

	// Append failures to not-found.txt
	if (notFoundPath && failedUrls.length > 0) {
		await appendToNotFound(failedUrls, notFoundPath)
	}

	return results
}

// ── Concurrent metadata-only fetch ────────────────────────────────────────

export async function fetchAllMetadata(
	urls: string[],
	concurrency: number,
	maxBytes: number,
	notFoundPath?: string,
): Promise<FetchResult[]> {
	const total = urls.length
	let done = 0
	const failedUrls: string[] = []

	const results = await pooled(urls, concurrency, async (url) => {
		const result = await fetchHead(url, maxBytes)
		done++
		if (result.error) {
			logError(`[${done}/${total}] ✗ ${url} — ${result.error}`)
			failedUrls.push(url)
		} else {
			log(`[${done}/${total}] ✓ ${url}`)
		}
		return result
	})

	if (notFoundPath && failedUrls.length > 0) {
		await appendToNotFound(failedUrls, notFoundPath)
	}

	return results
}
