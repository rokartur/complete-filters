import type { FetchResult, ParsedLine, BuildMetadata, Stats } from "./types.ts"
import {
	DEFAULT_TITLE,
	DEFAULT_HOMEPAGE,
	DEFAULT_DESCRIPTION,
	DEFAULT_EXPIRES,
	MANUAL_RULES,
} from "./constants.ts"
import { log, logError, logWarning } from "./utils.ts"
import { parseSource, makeDedupKey } from "./parser.ts"
import { isHostsFormat } from "./fetcher.ts"

// ── Load local ruleset files as FetchResults ──────────────────────────────

export async function loadLocalRulesets(paths: readonly string[]): Promise<FetchResult[]> {
	const results: FetchResult[] = []

	for (const path of paths) {
		try {
			const file = Bun.file(path)
			if (!(await file.exists())) {
				results.push({ url: `local:${path.split("/").pop()}`, content: null, error: "File not found", isHosts: false })
				continue
			}
			const content = await file.text()
			results.push({
				url: `local:${path.split("/").pop()}`,
				content,
				error: null,
				isHosts: isHostsFormat(content),
			})
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			results.push({ url: `local:${path.split("/").pop()}`, content: null, error: msg, isHosts: false })
		}
	}

	return results
}

// ── Append a single source block to output ─────────────────────────────────

function appendSourceBlock(
	output: string[],
	result: FetchResult,
	parsedLines: ParsedLine[],
	seen: Set<string>,
	stats: Stats,
): void {
	output.push(`! ===== SOURCE: ${result.url}`)

	if (result.error) {
		output.push(`! ✗ Failed to load: ${result.error}`)
		output.push("")
		return
	}

	type Block = Array<{ line: ParsedLine; isUnique: boolean }>
	const blockStack: Block[] = []
	const topLevel: string[] = []
	let sourceUnique = 0

	for (const pline of parsedLines) {
		// Skip metadata headers
		if (pline.kind === "meta" || pline.kind === "header") continue

		// Blank lines
		if (pline.kind === "blank") {
			if (blockStack.length === 0) {
				if (topLevel.length > 0 && topLevel[topLevel.length - 1] === "") continue
				topLevel.push("")
			} else {
				blockStack[blockStack.length - 1]!.push({ line: pline, isUnique: false })
			}
			continue
		}

		// Comments
		if (pline.kind === "comment") {
			if (blockStack.length === 0) {
				topLevel.push(pline.text)
			} else {
				blockStack[blockStack.length - 1]!.push({ line: pline, isUnique: false })
			}
			continue
		}

		// Directives
		if (pline.kind === "directive") {
			const low = pline.text.toLowerCase()

			if (low.startsWith("!#if ") || low.startsWith("!#if\t")) {
				blockStack.push([{ line: pline, isUnique: false }])
				continue
			}

			if (low.startsWith("!#endif")) {
				if (blockStack.length > 0) {
					const block = blockStack.pop()!
					block.push({ line: pline, isUnique: false })
					const hasUnique = block.some((b) => b.isUnique)

					if (hasUnique) {
						if (blockStack.length > 0) {
							const target = blockStack[blockStack.length - 1]!
							for (const b of block) target.push(b)
						} else {
							for (const b of block) topLevel.push(b.line.text)
						}
					} else {
						stats.emptyBlocksRemoved++
					}
				} else {
					topLevel.push(pline.text)
				}
				continue
			}

			if (blockStack.length === 0) {
				topLevel.push(pline.text)
			} else {
				blockStack[blockStack.length - 1]!.push({ line: pline, isUnique: false })
			}
			continue
		}

		// Rules — dedup
		stats.totalRules++
		const dedupKeyText = makeDedupKey(pline.text)
		const condKey = `${dedupKeyText}\0${pline.condStack.join("\0")}`

		if (seen.has(condKey)) {
			stats.duplicates++
			if (blockStack.length > 0) {
				blockStack[blockStack.length - 1]!.push({ line: pline, isUnique: false })
			}
			continue
		}

		seen.add(condKey)
		stats.uniqueRules++
		sourceUnique++

		if (blockStack.length > 0) {
			blockStack[blockStack.length - 1]!.push({ line: pline, isUnique: true })
		} else {
			topLevel.push(pline.text)
		}
	}

	// Flush any remaining unclosed blocks
	while (blockStack.length > 0) {
		const block = blockStack.pop()!
		if (block.some((b) => b.isUnique)) {
			for (const b of block) topLevel.push(b.line.text)
		}
	}

	if (sourceUnique === 0) {
		output.push("! (all rules already included from earlier sources)")
	}

	// Avoid spread — topLevel can have 100k+ elements which blows the call stack
	for (let i = 0; i < topLevel.length; i++) output.push(topLevel[i]!)
	output.push("")
}

// ── Main assembly function ─────────────────────────────────────────────────

export function assemble(
	urls: string[],
	fetchResults: FetchResult[],
	extraResults: FetchResult[] = [],
	metadata?: Partial<BuildMetadata>,
): { lines: string[]; stats: Stats } {
	const meta: BuildMetadata = {
		title: metadata?.title ?? DEFAULT_TITLE,
		homepage: metadata?.homepage ?? DEFAULT_HOMEPAGE,
		description: metadata?.description ?? DEFAULT_DESCRIPTION,
		expires: metadata?.expires ?? DEFAULT_EXPIRES,
	}

	const stats: Stats = {
		totalRules: 0,
		uniqueRules: 0,
		duplicates: 0,
		hostsConverted: 0,
		sourcesOk: 0,
		sourcesFailed: 0,
		emptyBlocksRemoved: 0,
	}

	const seen = new Set<string>()
	const allResults = [...fetchResults, ...extraResults]

	const now = new Date()
	const dateStr = now.toUTCString().replace(/^.*,\s*/, "").replace(/\s*GMT$/, " UTC")

	const output: string[] = [
		"[Adblock Plus 2.0]",
		`! Title: ${meta.title}`,
		`! Description: ${meta.description}`,
		`! Last modified: ${dateStr}`,
		`! Expires: ${meta.expires}`,
		`! Homepage: ${meta.homepage}`,
		`! Source count: 0 / ${allResults.length}`, // placeholder, updated later
		"!",
	]

	for (const result of allResults) {
		if (result.error) {
			stats.sourcesFailed++
			appendSourceBlock(output, result, [], seen, stats)
			continue
		}

		const parsedLines = parseSource(result)
		stats.sourcesOk++
		appendSourceBlock(output, result, parsedLines, seen, stats)
	}

	// Update source count line
	output[6] = `! Source count: ${stats.sourcesOk} / ${allResults.length}`

	output.push(`! Total unique rules: ${stats.uniqueRules}`)
	output.push(`! Duplicates removed: ${stats.duplicates}`)
	if (stats.sourcesFailed) {
		output.push(`! Failed sources: ${stats.sourcesFailed}`)
	}

	return { lines: output, stats }
}

// ── Validate !#if / !#endif balance ────────────────────────────────────────

export function validateOutput(lines: string[]): boolean {
	let depth = 0
	let ok = true

	for (let i = 0; i < lines.length; i++) {
		const low = lines[i]!.toLowerCase()
		if (low.startsWith("!#if ") || low.startsWith("!#if\t")) {
			depth++
		} else if (low.startsWith("!#endif")) {
			depth--
			if (depth < 0) {
				logError(`Validation: unmatched !#endif at line ${i + 1}`)
				ok = false
				depth = 0
			}
		}
	}

	if (depth > 0) {
		logError(`Validation: ${depth} unclosed !#if block(s) at end of output`)
		ok = false
	}

	if (ok) {
		log("Validation: all !#if / !#endif blocks are balanced ✓")
	}

	return ok
}
