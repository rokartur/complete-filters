import type { FetchResult, BuildMetadata, Stats } from "./types.ts"
import {
	DEFAULT_JOBS,
	MANUAL_RULES,
	NOT_FOUND_TXT,
} from "./constants.ts"
import { log, logWarning } from "./utils.ts"
import { fetchAll } from "./fetcher.ts"
import { assemble, validateOutput, loadLocalRulesets } from "./assembler.ts"

export interface RunBuildOptions {
	jobs?: number
	metadata?: Partial<BuildMetadata>
	extraRulesets?: readonly string[]
	dryRun?: boolean
	/** Pre-fetched results to reuse (for global cache) */
	cachedResults?: Map<string, FetchResult>
}

export async function runBuild(
	urls: string[],
	outputPath: string,
	opts: RunBuildOptions = {},
): Promise<{ stats: Stats; valid: boolean; results: FetchResult[] }> {
	const jobs = opts.jobs ?? DEFAULT_JOBS
	const extraRulesets = opts.extraRulesets ?? MANUAL_RULES
	const dryRun = opts.dryRun ?? false
	const cachedResults = opts.cachedResults

	// ── Fetch ──────────────────────────────────────────────────────────────
	log(`Fetching with ${jobs} workers ...`)
	const t0 = performance.now()

	let results: FetchResult[]
	if (cachedResults) {
		// Use cached results where available, fetch only missing
		const uncachedUrls: string[] = []
		const uncachedIndices: number[] = []
		results = new Array<FetchResult>(urls.length)

		for (let i = 0; i < urls.length; i++) {
			const cached = cachedResults.get(urls[i]!)
			if (cached) {
				results[i] = cached
			} else {
				uncachedUrls.push(urls[i]!)
				uncachedIndices.push(i)
			}
		}

		if (uncachedUrls.length > 0) {
			log(`  ${urls.length - uncachedUrls.length} cached, fetching ${uncachedUrls.length} remaining ...`)
			const freshResults = await fetchAll(uncachedUrls, jobs, NOT_FOUND_TXT)
			for (let j = 0; j < uncachedIndices.length; j++) {
				results[uncachedIndices[j]!] = freshResults[j]!
				// Add to cache for future use
				cachedResults.set(uncachedUrls[j]!, freshResults[j]!)
			}
		} else {
			log(`  All ${urls.length} URLs served from cache`)
		}
	} else {
		results = await fetchAll(urls, jobs, NOT_FOUND_TXT)
	}

	const elapsed = ((performance.now() - t0) / 1000).toFixed(1)
	log(`Fetching done in ${elapsed}s`)

	// ── Local rulesets ─────────────────────────────────────────────────────
	const extraResults = await loadLocalRulesets(extraRulesets)
	if (extraResults.length > 0) {
		log(`Loaded ${extraResults.length} local ruleset(s)`)
	}

	// ── Assemble ───────────────────────────────────────────────────────────
	log("Assembling ...")
	const { lines, stats } = assemble(urls, results, extraResults, opts.metadata)
	const valid = validateOutput(lines)

	const totalSources = urls.length + extraRulesets.length

	// ── Report ─────────────────────────────────────────────────────────────
	log("─".repeat(60))
	log(`Sources OK:                ${stats.sourcesOk} / ${totalSources}`)
	if (stats.sourcesFailed) {
		logWarning(`Sources FAILED:            ${stats.sourcesFailed}`)
		for (const r of results) {
			if (r.error) logWarning(`  ✗ ${r.url} — ${r.error}`)
		}
	}
	log(`Total rules seen:          ${stats.totalRules}`)
	log(`Unique rules kept:         ${stats.uniqueRules}`)
	log(`Duplicates removed:        ${stats.duplicates}`)
	if (stats.emptyBlocksRemoved) {
		log(`Empty !#if blocks removed: ${stats.emptyBlocksRemoved}`)
	}
	log("─".repeat(60))

	if (dryRun) {
		log("Dry run — not writing output.")
	} else {
		const text = lines.join("\n") + "\n"
		const { mkdir } = await import("node:fs/promises")
		const dir = outputPath.split("/").slice(0, -1).join("/")
		if (dir) await mkdir(dir, { recursive: true })
		await Bun.write(outputPath, text)
		const sizeMb = (new TextEncoder().encode(text).byteLength / (1024 * 1024)).toFixed(1)
		log(`Wrote ${outputPath} (${sizeMb} MB, ${lines.length} lines)`)
	}

	return { stats, valid, results }
}
