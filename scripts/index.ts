import { parseArgs } from "node:util"
import { setVerbose, log } from "./src/utils.ts"
import { runFetchFilterLists } from "./src/fetch-filterlists.ts"
import { runCategorize } from "./src/categorize.ts"
import { runBuildCategories } from "./src/build-categories.ts"

// ── CLI argument parsing ──────────────────────────────────────────────────

const USAGE = `
Usage: bun run index.ts <command> [options]

Commands:
	fetch        Discover uBlock-compatible URLs from FilterLists API
	categorize   Classify filters.txt sources into category manifests
	build        Build category filter lists from category manifests
	all          Alias for build (no FilterLists API fetch)

Options:
  --jobs, -j <n>   Concurrent workers (default: 24)
  --dry-run        Don't write output files
  --verbose, -v    Enable verbose logging
  --help, -h       Show this help
`.trim()

const { values, positionals } = parseArgs({
	args: Bun.argv.slice(2),
	options: {
		jobs: { type: "string", short: "j", default: "24" },
		"dry-run": { type: "boolean", default: false },
		verbose: { type: "boolean", short: "v", default: false },
		help: { type: "boolean", short: "h", default: false },
	},
	allowPositionals: true,
	strict: true,
})

if (values.help || positionals.length === 0) {
	console.log(USAGE)
	process.exit(0)
}

const command = positionals[0]
const jobs = parseInt(values.jobs ?? "24", 10)
const dryRun = values["dry-run"] ?? false
const verbose = values.verbose ?? false

setVerbose(verbose)

const t0 = performance.now()

try {
	switch (command) {
		case "fetch":
			await runFetchFilterLists({ jobs, dryRun, verbose })
			break

		case "categorize":
			await runCategorize({ jobs, verbose })
			break

		case "build":
			await runBuildCategories({ jobs, dryRun, verbose })
			break

		case "all":
			log("═".repeat(60))
			log("Building filter lists from category manifests")
			log("═".repeat(60))
			await runBuildCategories({ jobs, dryRun, verbose })
			break

		default:
			console.error(`Unknown command: ${command}`)
			console.log(USAGE)
			process.exit(1)
	}

	const elapsed = ((performance.now() - t0) / 1000).toFixed(1)
	log(`\n✓ Done in ${elapsed}s`)
} catch (err) {
	const elapsed = ((performance.now() - t0) / 1000).toFixed(1)
	console.error(`\n✗ Failed after ${elapsed}s:`, err)
	process.exit(1)
}