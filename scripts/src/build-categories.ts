import type { FetchResult } from "./types.ts"
import {
	CATEGORIES_DIR,
	DEFAULT_JOBS,
	FILTER_DIR,
	MANUAL_RULES,
	UBO_BADLISTS_URL,
} from "./constants.ts"
import { loadUrls, log, logWarning, normalizeUrl } from "./utils.ts"
import { fetchAll, fetchContent } from "./fetcher.ts"
import { runBuild } from "./builder.ts"
import { readdir, mkdir, unlink } from "node:fs/promises"

export interface BuildCategoriesOptions {
	jobs?: number
	dryRun?: boolean
	verbose?: boolean
}

function categoryTitle(category: string): string {
	const label = category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
	return `Complete Filters - ${label}`
}

function categoryDescription(category: string): string {
	return `Combined filter list for the ${category} category.`
}

export async function runBuildCategories(opts: BuildCategoriesOptions = {}): Promise<void> {
	const jobs = opts.jobs ?? DEFAULT_JOBS
	const dryRun = opts.dryRun ?? false

	// ── Discover category manifests ────────────────────────────────────────
	await mkdir(CATEGORIES_DIR, { recursive: true })
	const entries = await readdir(CATEGORIES_DIR)
	const manifests = entries.filter((e) => e.endsWith(".txt") && !e.startsWith("_")).sort()

	if (manifests.length === 0) {
		throw new Error(`No manifest files found in ${CATEGORIES_DIR}`)
	}

	const expectedOutputNames = new Set(manifests)

	// ── Clean stale outputs ──────────────────────────────────────────────
	await mkdir(FILTER_DIR, { recursive: true })
	const outputEntries = await readdir(FILTER_DIR)
	for (const name of outputEntries) {
		if (!name.endsWith(".txt") || expectedOutputNames.has(name)) continue
		if (dryRun) {
			log(`Dry run — would remove stale output ${name}`)
		} else {
			await unlink(`${FILTER_DIR}/${name}`)
			log(`Removed stale output ${name}`)
		}
	}

	// ── Collect all unique URLs across ALL categories for a global fetch ──
	const allCategoryUrls = new Map<string, string[]>() // category → urls
	const globalUrlSet = new Set<string>()

	for (const manifest of manifests) {
		const category = manifest.replace(/\.txt$/, "")
		const urls = await loadUrls(`${CATEGORIES_DIR}/${manifest}`)
		allCategoryUrls.set(category, urls)
		for (const u of urls) globalUrlSet.add(u)
	}

	const globalUrlList = [...globalUrlSet]
	log(`Global URL pool: ${globalUrlList.length} unique URLs across all categories`)

	const badlists = await fetchContent(UBO_BADLISTS_URL)
	if (badlists.content === null) {
		throw new Error(`Cannot check sources against uBO badlists: ${badlists.error}`)
	}
	const badlisted = findBadlistedUrls(globalUrlList, badlists.content)
	if (badlisted.length > 0) {
		throw new Error(`Sources listed in uBO badlists.txt, remove them from categories/:\n${badlisted.join("\n")}`)
	}

	// ── Global fetch: download everything once ─────────────────────────────
	log(`\nFetching all ${globalUrlList.length} URLs with ${jobs} workers ...`)
	const t0 = performance.now()
	const allResults = await fetchAll(globalUrlList, jobs)
	const elapsed = ((performance.now() - t0) / 1000).toFixed(1)
	log(`Global fetch done in ${elapsed}s`)

	// Build global cache
	const globalCache = new Map<string, FetchResult>()
	for (let i = 0; i < globalUrlList.length; i++) {
		globalCache.set(globalUrlList[i]!, allResults[i]!)
	}

	// ── Build each category ──────────────────────────────────────────────────
	let failures = 0

	for (const [category, urls] of allCategoryUrls) {
		const outputPath = `${FILTER_DIR}/${category}.txt`
		const extraRulesets = [...MANUAL_RULES]

		if (urls.length === 0) {
			const file = Bun.file(outputPath)
			if (await file.exists()) {
				if (dryRun) {
					log(`Dry run — would remove empty category output ${category}.txt`)
				} else {
					await unlink(outputPath)
					log(`Removed empty category output ${category}.txt`)
				}
			} else {
				log(`Skipping ${category} (no source URLs)`)
			}
			continue
		}

		log("\n" + "=".repeat(60))
		log(`Building category ${category} (${urls.length} sources)`)

		const { stats, valid } = await runBuild(urls, outputPath, {
			jobs,
			dryRun,
			metadata: {
				title: categoryTitle(category),
				description: categoryDescription(category),
				homepage: "https://github.com/rokartur/complete-filters",
			},
			extraRulesets,
			cachedResults: globalCache,
		})

		if (stats.sourcesFailed || !valid) failures++
	}

	if (failures) {
		logWarning(`\n${failures} category build(s) had partial source failures or validation warnings.`)
	}
}

export function findBadlistedUrls(urls: string[], badlistsText: string): string[] {
	const badlisted = new Set<string>()
	for (const line of badlistsText.split("\n")) {
		// Entries are "<url>" or "<url> remove"; other lines are comments.
		const url = line.trim().split(/\s+/)[0]!
		if (url.startsWith("http")) badlisted.add(normalizeUrl(url))
	}
	return urls.filter((url) => badlisted.has(normalizeUrl(url)))
}
