import { existsSync } from "node:fs"
import { NOT_FOUND_TXT } from "./constants.ts"

// ── URL helpers ────────────────────────────────────────────────────────────

export function normalizeUrl(url: string): string {
	return url.trim()
}

export function isValidHttpUrl(value: string): boolean {
	const trimmed = value.trim()
	if (!trimmed) return false
	try {
		const u = new URL(trimmed)
		return u.protocol === "http:" || u.protocol === "https:"
	} catch {
		return false
	}
}

export function dedupePreserveOrder(urls: string[]): string[] {
	const seen = new Set<string>()
	const output: string[] = []
	for (const raw of urls) {
		const url = normalizeUrl(raw)
		if (!url || seen.has(url)) continue
		seen.add(url)
		output.push(url)
	}
	return output
}

// ── File I/O ───────────────────────────────────────────────────────────────

export async function loadUrls(path: string): Promise<string[]> {
	const file = Bun.file(path)
	if (!(await file.exists())) return []
	const text = await file.text()
	return text
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l && !l.startsWith("#"))
}

export async function loadNotFound(path: string = NOT_FOUND_TXT): Promise<Set<string>> {
	const file = Bun.file(path)
	if (!(await file.exists())) return new Set()
	const text = await file.text()
	const urls = text
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean)
	return new Set(urls)
}

export async function appendToNotFound(urls: string[], path: string = NOT_FOUND_TXT): Promise<void> {
	if (urls.length === 0) return

	// Load existing, merge, dedupe, write back
	const existing = await loadNotFound(path)
	const newUrls = urls.filter((u) => !existing.has(u))
	if (newUrls.length === 0) return

	const file = Bun.file(path)
	let content = ""
	if (await file.exists()) {
		content = await file.text()
		if (content.length > 0 && !content.endsWith("\n")) {
			content += "\n"
		}
	}
	content += newUrls.join("\n") + "\n"
	await Bun.write(path, content)
}

// ── Concurrency pool ──────────────────────────────────────────────────────

export async function pooled<T, R>(
	items: T[],
	concurrency: number,
	fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	const results = new Array<R>(items.length)
	let nextIndex = 0

	async function worker(): Promise<void> {
		while (true) {
			const idx = nextIndex++
			if (idx >= items.length) return
			results[idx] = await fn(items[idx]!, idx)
		}
	}

	const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
	await Promise.all(workers)
	return results
}

// ── Logging ────────────────────────────────────────────────────────────────

let verboseEnabled = false

export function setVerbose(v: boolean): void {
	verboseEnabled = v
}

export function isVerbose(): boolean {
	return verboseEnabled
}

export function log(msg: string, ...args: unknown[]): void {
	console.log(msg, ...args)
}

export function logVerbose(msg: string, ...args: unknown[]): void {
	if (verboseEnabled) console.log(msg, ...args)
}

export function logError(msg: string, ...args: unknown[]): void {
	console.error(msg, ...args)
}

export function logWarning(msg: string, ...args: unknown[]): void {
	console.warn(msg, ...args)
}
