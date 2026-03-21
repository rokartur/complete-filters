import type { FetchResult } from "./types.ts"
import {
	CATEGORIES_DIR,
	DEFAULT_JOBS,
	FILTER_DIR,
	FILTERS_TXT,
	MANUAL_RULES,
	NOT_FOUND_TXT,
} from "./constants.ts"
import { loadUrls, loadNotFound, log, logWarning } from "./utils.ts"
import { fetchAll } from "./fetcher.ts"
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

	const expectedOutputNames = new Set([...manifests, "all.txt"])

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

	// ── Load not-found exclusions ──────────────────────────────────────────
	const notFoundSet = await loadNotFound(NOT_FOUND_TXT)

	// ── Collect all unique URLs across ALL categories for a global fetch ──
	const allCategoryUrls = new Map<string, string[]>() // category → urls
	const globalUrlSet = new Set<string>()

	for (const manifest of manifests) {
		const category = manifest.replace(/\.txt$/, "")
		const rawUrls = await loadUrls(`${CATEGORIES_DIR}/${manifest}`)
		const urls = rawUrls.filter((u) => !notFoundSet.has(u))
		allCategoryUrls.set(category, urls)
		for (const u of urls) globalUrlSet.add(u)
	}

	// Also collect all.txt URLs
	const allTxtRawUrls = await loadUrls(FILTERS_TXT)
	const allTxtUrls = allTxtRawUrls.filter((u) => !notFoundSet.has(u))
	for (const u of allTxtUrls) globalUrlSet.add(u)

	const globalUrlList = [...globalUrlSet]
	log(`Global URL pool: ${globalUrlList.length} unique URLs across all categories`)

	// ── Global fetch: download everything once ─────────────────────────────
	log(`\nFetching all ${globalUrlList.length} URLs with ${jobs} workers ...`)
	const t0 = performance.now()
	const allResults = await fetchAll(globalUrlList, jobs, NOT_FOUND_TXT)
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
			extraRulesets: MANUAL_RULES,
			cachedResults: globalCache,
		})

		if (stats.sourcesFailed || !valid) failures++
	}

	// ── Build aggregate all.txt ──────────────────────────────────────────────
	const allOutputPath = `${FILTER_DIR}/all.txt`

	if (allTxtUrls.length === 0) {
		const file = Bun.file(allOutputPath)
		if (await file.exists()) {
			if (dryRun) {
				log(`Dry run — would remove empty aggregate output all.txt`)
			} else {
				await unlink(allOutputPath)
				log(`Removed empty aggregate output all.txt`)
			}
		} else {
			log(`Skipping all.txt (no source URLs)`)
		}
	} else {
		log("\n" + "=".repeat(60))
		log(`Building aggregate list all.txt (${allTxtUrls.length} sources)`)

		const { stats, valid } = await runBuild(allTxtUrls, allOutputPath, {
			jobs,
			dryRun,
			metadata: {
				title: "Complete Filters",
				description: "Combined filter list from all configured sources.",
				homepage: "https://github.com/rokartur/complete-filters",
			},
			extraRulesets: MANUAL_RULES,
			cachedResults: globalCache,
		})

		if (stats.sourcesFailed || !valid) failures++
	}

	if (failures) {
		logWarning(`\n${failures} category build(s) had failures or validation errors.`)
		process.exitCode = 1
	}
}
