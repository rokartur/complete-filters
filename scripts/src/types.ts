// ── Fetch & Build types ────────────────────────────────────────────────────

export interface FetchResult {
	url: string
	content: string | null
	error: string | null
	isHosts: boolean
}

export type LineKind = "rule" | "comment" | "directive" | "meta" | "header" | "blank"

export interface ParsedLine {
	text: string
	condStack: readonly string[]
	kind: LineKind
}

export interface BuildMetadata {
	title: string
	homepage: string
	description: string
	expires: string
}

export interface Stats {
	totalRules: number
	uniqueRules: number
	duplicates: number
	hostsConverted: number
	sourcesOk: number
	sourcesFailed: number
	emptyBlocksRemoved: number
}

export interface BuildResult {
	stats: Stats
	valid: boolean
	results: FetchResult[]
}
