import type {
	SoftwareEntry,
	SyntaxEntry,
	FilterListSummary,
	FilterListDetail,
	ViewUrl,
} from "./types.ts"
import {
	API_BASE,
	USER_AGENT,
	API_TIMEOUT,
	KNOWN_UBLOCK_COMPATIBLE_SYNTAX_IDS,
	EXPECTED_UBLOCK_NAME,
	UBLOCK_COMPATIBLE_SYNTAX_NAMES,
} from "./constants.ts"
import { isValidHttpUrl, normalizeUrl, dedupePreserveOrder, pooled, log, logVerbose } from "./utils.ts"

// ── Generic API fetch ──────────────────────────────────────────────────────

async function fetchJson<T>(path: string): Promise<T> {
	const url = `${API_BASE}${path}`
	const response = await fetch(url, {
		headers: {
			"User-Agent": USER_AGENT,
			Accept: "application/json",
		},
		signal: AbortSignal.timeout(API_TIMEOUT),
	})
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} from ${url}`)
	}
	return (await response.json()) as T
}

// ── API endpoints ──────────────────────────────────────────────────────────

export async function fetchSoftware(): Promise<SoftwareEntry[]> {
	return fetchJson<SoftwareEntry[]>("/software")
}

export async function fetchSyntaxes(): Promise<SyntaxEntry[]> {
	return fetchJson<SyntaxEntry[]>("/syntaxes")
}

export async function fetchLists(): Promise<FilterListSummary[]> {
	return fetchJson<FilterListSummary[]>("/lists")
}

export async function fetchListDetail(id: number): Promise<FilterListDetail> {
	return fetchJson<FilterListDetail>(`/lists/${id}`)
}

// ── Fetch multiple details concurrently ────────────────────────────────────

export async function fetchAllListDetails(
	ids: number[],
	concurrency: number,
): Promise<{ details: FilterListDetail[]; failures: Array<{ id: number; error: string }> }> {
	const details: FilterListDetail[] = []
	const failures: Array<{ id: number; error: string }> = []

	const results = await pooled(ids, concurrency, async (id) => {
		try {
			return { ok: true as const, id, detail: await fetchListDetail(id) }
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			return { ok: false as const, id, error: msg }
		}
	})

	// Preserve original order
	for (const r of results) {
		if (r.ok) {
			details.push(r.detail)
		} else {
			failures.push({ id: r.id, error: r.error })
		}
	}

	return { details, failures }
}

// ── Compatibility logic ────────────────────────────────────────────────────

export function findUblockSoftware(items: SoftwareEntry[]): SoftwareEntry {
	const found = items.find((s) => s.name === EXPECTED_UBLOCK_NAME)
	if (!found) {
		throw new Error(`Could not find "${EXPECTED_UBLOCK_NAME}" in /software response`)
	}
	return found
}

export function collectCompatibleSyntaxIds(
	ublockSoftware: SoftwareEntry,
	syntaxes: SyntaxEntry[],
): Set<number> {
	const compatible = new Set(KNOWN_UBLOCK_COMPATIBLE_SYNTAX_IDS)

	// Add syntax IDs from uBlock Origin software entry
	if (ublockSoftware.syntaxIds) {
		for (const id of ublockSoftware.syntaxIds) compatible.add(id)
	}

	const ublockId = ublockSoftware.id

	for (const syntax of syntaxes) {
		if (syntax.id == null) continue

		// If uBlock supports this syntax's software list
		const softwareIds = syntax.softwareIds ?? []
		if (softwareIds.includes(ublockId)) {
			compatible.add(syntax.id)
		}

		// If syntax name is a known compatible one
		if (syntax.name && UBLOCK_COMPATIBLE_SYNTAX_NAMES.has(syntax.name.toLowerCase())) {
			compatible.add(syntax.id)
		}
	}

	return compatible
}

export function collectCompatibleListIds(
	lists: FilterListSummary[],
	compatibleSyntaxIds: Set<number>,
): number[] {
	const ids: number[] = []
	for (const item of lists) {
		if (item.id == null) continue
		const syntaxIds = item.syntaxIds ?? []
		if (syntaxIds.some((id) => compatibleSyntaxIds.has(id))) {
			ids.push(item.id)
		}
	}
	return ids
}

// ── View URL extraction ────────────────────────────────────────────────────

export function extractViewUrls(detail: FilterListDetail): string[] {
	const rawViewUrls = detail.viewUrls
	if (!rawViewUrls || !Array.isArray(rawViewUrls)) return []

	const bestBySegment = new Map<number, { rank: number; url: string }>()
	const standalone: string[] = []

	for (const item of rawViewUrls as ViewUrl[]) {
		if (!item.url || !isValidHttpUrl(item.url)) continue
		const url = normalizeUrl(item.url)

		if (item.segmentNumber != null) {
			const rank = item.primariness ?? 999_999
			const existing = bestBySegment.get(item.segmentNumber)
			if (!existing || rank < existing.rank) {
				bestBySegment.set(item.segmentNumber, { rank, url })
			}
		} else {
			standalone.push(url)
		}
	}

	const segmentUrls = [...bestBySegment.entries()]
		.sort(([, a], [, b]) => a.rank - b.rank || a.url.localeCompare(b.url))
		.map(([, v]) => v.url)

	return dedupePreserveOrder([...segmentUrls, ...standalone])
}

export function extractCandidateUrls(
	details: FilterListDetail[],
): { urls: string[]; stats: { detailLists: number; withUrls: number; withoutUrls: number; acceptedUrls: number } } {
	const urls: string[] = []
	const stats = { detailLists: 0, withUrls: 0, withoutUrls: 0, acceptedUrls: 0 }

	for (const detail of details) {
		stats.detailLists++
		const extracted = extractViewUrls(detail)
		if (extracted.length > 0) {
			stats.withUrls++
			stats.acceptedUrls += extracted.length
			urls.push(...extracted)
		} else {
			stats.withoutUrls++
		}
	}

	return { urls, stats }
}

// ── Merge discovered URLs with existing ────────────────────────────────────

export function mergeUrls(
	existing: string[],
	discovered: string[],
): { merged: string[]; newUrls: string[] } {
	const existingDeduped = dedupePreserveOrder(existing)
	const existingSet = new Set(existingDeduped)
	const discoveredDeduped = dedupePreserveOrder(discovered)
	const newUrls = discoveredDeduped.filter((u) => !existingSet.has(u))
	const merged = [...existingDeduped, ...newUrls]
	return { merged, newUrls }
}
