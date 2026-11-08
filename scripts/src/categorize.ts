import { CATEGORIES_DIR, DEFAULT_JOBS, FILTERS_TXT } from "./constants.ts"
import { loadUrls, log } from "./utils.ts"
import { classifyAll, writeManifests } from "./categorizer.ts"

export interface CategorizeOptions {
	jobs?: number
	verbose?: boolean
}

export async function runCategorize(opts: CategorizeOptions = {}): Promise<void> {
	const jobs = opts.jobs ?? DEFAULT_JOBS

	const urls = await loadUrls(FILTERS_TXT)
	log(`Loaded ${urls.length} source URLs from filters.txt`)

	const metas = await classifyAll(urls, jobs)
	await writeManifests(metas, CATEGORIES_DIR)
	log(`Wrote category manifests to ${CATEGORIES_DIR}`)
}
