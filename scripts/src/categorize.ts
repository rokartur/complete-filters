import { CATEGORIES_DIR, DEFAULT_JOBS, FILTERS_TXT, NOT_FOUND_TXT } from "./constants.ts"
import { loadUrls, loadNotFound, log } from "./utils.ts"
import { classifyAll, writeManifests } from "./categorizer.ts"

export interface CategorizeOptions {
	jobs?: number
	verbose?: boolean
}

export async function runCategorize(opts: CategorizeOptions = {}): Promise<void> {
	const jobs = opts.jobs ?? DEFAULT_JOBS

	const allUrls = await loadUrls(FILTERS_TXT)
	log(`Loaded ${allUrls.length} source URLs from filters.txt`)

	// Exclude not-found URLs
	const notFoundSet = await loadNotFound(NOT_FOUND_TXT)
	const urls = allUrls.filter((u) => !notFoundSet.has(u))
	if (notFoundSet.size > 0) {
		log(`Excluded ${allUrls.length - urls.length} not-found URLs`)
	}

	const metas = await classifyAll(urls, jobs, NOT_FOUND_TXT)
	await writeManifests(metas, CATEGORIES_DIR)
	log(`Wrote category manifests to ${CATEGORIES_DIR}`)
}
