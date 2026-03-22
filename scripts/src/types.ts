// ── FilterLists API response types ──────────────────────────────────────────

export interface SoftwareEntry {
	id: number
	name: string | null
	syntaxIds: number[] | null
}

export interface SyntaxEntry {
	id: number
	name: string | null
	softwareIds?: number[] | null
	filterListIds?: number[] | null
}

export interface FilterListSummary {
	id: number
	name: string | null
	description: string | null
	syntaxIds: number[] | null
}

export interface ViewUrl {
	segmentNumber: number | null
	primariness: number | null
	url: string | null
}

export interface FilterListDetail {
	id: number
	name: string | null
	description: string | null
	syntaxIds: number[] | null
	viewUrls: ViewUrl[] | null
}

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

export type Category =
	| "ads"
	| "annoyances"
	| "anti-adblock"
	| "compatibility"
	| "content"
	| "cookies"
	| "hagezi"
	| "malware"
	| "mobile"
	| "mixed"
	| "privacy"
	| "regional"
	| "social"
	| "video"

export interface SourceMeta {
	url: string
	category: Category | string
	reason: string
	title: string
	description: string
	homepage: string
	comments: string[]
	error: string | null
}

export interface BuildResult {
	stats: Stats
	valid: boolean
	results: FetchResult[]
}
