import {
	fetchSoftware,
	fetchSyntaxes,
	fetchLists,
	fetchAllListDetails,
	findUblockSoftware,
	collectCompatibleSyntaxIds,
	collectCompatibleListIds,
	extractCandidateUrls,
	mergeUrls,
} from "./api.ts"
import { DEFAULT_JOBS, FILTERS_TXT, NOT_FOUND_TXT } from "./constants.ts"
import { loadUrls, loadNotFound, dedupePreserveOrder, log, logVerbose } from "./utils.ts"

export interface FetchFilterListsOptions {
	jobs?: number
	dryRun?: boolean
	verbose?: boolean
}

export async function runFetchFilterLists(opts: FetchFilterListsOptions = {}): Promise<void> {
	const jobs = opts.jobs ?? DEFAULT_JOBS
	const dryRun = opts.dryRun ?? false

	log("Fetching /software …")
	const softwareItems = await fetchSoftware()
	const ublockSoftware = findUblockSoftware(softwareItems)
	logVerbose(`Found ${ublockSoftware.name} (id: ${ublockSoftware.id})`)

	log("Fetching /syntaxes …")
	const syntaxes = await fetchSyntaxes()
	const compatibleSyntaxIds = collectCompatibleSyntaxIds(ublockSoftware, syntaxes)
	logVerbose(`Compatible syntax IDs: ${[...compatibleSyntaxIds].sort().join(", ")}`)

	log("Fetching /lists …")
	const lists = await fetchLists()
	const compatibleListIds = collectCompatibleListIds(lists, compatibleSyntaxIds)
	log(`Compatible lists via summary syntax filter: ${compatibleListIds.length}`)

	log(`Fetching ${compatibleListIds.length} compatible list details …`)
	const { details, failures } = await fetchAllListDetails(compatibleListIds, jobs)

	const { urls: candidateUrls, stats: discoveryStats } = extractCandidateUrls(details)
	const discoveredUrls = dedupePreserveOrder(candidateUrls)

	// Load not-found URLs and filter them out
	const notFoundSet = await loadNotFound(NOT_FOUND_TXT)
	const filteredUrls = discoveredUrls.filter((u) => !notFoundSet.has(u))

	const existingUrls = await loadUrls(FILTERS_TXT)
	const { merged, newUrls } = mergeUrls(existingUrls, filteredUrls)

	// ── Summary ──────────────────────────────────────────────────────────
	log("")
	log("── Summary ──────────────────────────────────────────────")
	log(`Software entries:                  ${softwareItems.length}`)
	log(`Syntax entries:                    ${syntaxes.length}`)
	log(`API lists total:                   ${lists.length}`)
	log(`Compatible syntax IDs:             ${[...compatibleSyntaxIds].sort().join(",")}`)
	log(`Compatible lists:                  ${compatibleListIds.length}`)
	log(`Detail responses fetched:          ${details.length}`)
	log(`Detail fetch failures:             ${failures.length}`)
	log(`Lists with usable viewUrls:        ${discoveryStats.withUrls}`)
	log(`Lists without usable viewUrls:     ${discoveryStats.withoutUrls}`)
	log(`Accepted detail URLs before dedup: ${discoveryStats.acceptedUrls}`)
	log(`Discovered URLs after dedup:       ${discoveredUrls.length}`)
	log(`Excluded (not-found):              ${discoveredUrls.length - filteredUrls.length}`)
	log(`Existing URLs:                     ${dedupePreserveOrder(existingUrls).length}`)
	log(`New URLs:                          ${newUrls.length}`)
	log(`Merged URLs:                       ${merged.length}`)

	if (failures.length > 0) {
		logVerbose("── Detail Failures ──")
		for (const f of failures.slice(0, 50)) {
			logVerbose(`  ${f.id}: ${f.error}`)
		}
		if (failures.length > 50) logVerbose(`  ... and ${failures.length - 50} more`)
	}

	if (newUrls.length > 0) {
		log("── New URLs ──")
		for (const url of newUrls) log(`  ${url}`)
	} else {
		log("── No new URLs discovered ──")
	}

	if (dryRun) {
		log("Dry run — not writing output.")
		return
	}

	await Bun.write(FILTERS_TXT, merged.join("\n") + "\n")
	log(`Wrote merged URL list to ${FILTERS_TXT}`)
}
