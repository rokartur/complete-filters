import type { Category, SourceMeta, FetchResult } from "./types.ts"
import {
	CATEGORIES,
	CATEGORIES_DIR,
	EXACT_OVERRIDES,
	FORMAT_HEADER_RE,
	META_FETCH_BYTES,
	NOT_FOUND_TXT,
	REGIONAL_PREFIX_RE,
	TITLE_RE,
} from "./constants.ts"
import { log, logVerbose } from "./utils.ts"
import { fetchAllMetadata } from "./fetcher.ts"

// ── Parse source metadata from first chunk of downloaded text ──────────────

function parseSourceMeta(url: string, text: string): SourceMeta {
	let title = ""
	let description = ""
	let homepage = ""
	const comments: string[] = []

	const lines = text.split("\n")
	const limit = Math.min(lines.length, 80)

	for (let i = 0; i < limit; i++) {
		const line = lines[i]!.replace(/^\ufeff/, "").trimEnd()
		if (!line || FORMAT_HEADER_RE.test(line)) continue

		const match = TITLE_RE.exec(line)
		if (match) {
			const key = match[1]!.toLowerCase()
			const value = match[2]!.trim()
			if (key === "title" && !title) title = value
			else if (key === "description" && !description) description = value
			else if (key === "homepage" && !homepage) homepage = value
			continue
		}

		if (line.startsWith("!") || line.startsWith("#")) {
			const comment = line.replace(/^[!#]+/, "").trim()
			if (comment) comments.push(comment)
		}

		if (title && description && homepage && comments.length >= 6) break
	}

	const [category, reason] = classifySource(url, title, description, comments)
	return { url, category, reason, title, description, homepage, comments: comments.slice(0, 8), error: null }
}

// ── Classification logic ───────────────────────────────────────────────────

export function classifySource(
	url: string,
	title: string,
	description: string,
	comments: string[],
): [Category, string] {
	// Exact overrides
	if (url in EXACT_OVERRIDES) {
		return [EXACT_OVERRIDES[url]!, `exact override for ${url}`]
	}

	const primaryText = [url, title, description].join(" ").toLowerCase()
	const fullText = [url, title, description, ...comments].join(" ").toLowerCase()
	const titleText = title.toLowerCase()
	const descText = description.toLowerCase()

	const hasPrimary = (...needles: string[]) => needles.some((n) => primaryText.includes(n))
	const has = (...needles: string[]) => needles.some((n) => fullText.includes(n))

	// ── Explicit URL patterns ──────────────────────────────────────────

	if (hasPrimary("/uassets/master/filters/filters")) {
		return ["ads", "uAssets core filters family"]
	}

	if (hasPrimary("quick-fixes", "unbreak", "brave-unbreak", "sugarcoat")) {
		return ["compatibility", "compatibility family"]
	}
	if (hasPrimary("brave-android-specific", "brave-ios-specific")) {
		return ["mobile", "mobile Brave family"]
	}
	if (hasPrimary("brave-firstparty.txt")) {
		return ["ads", "Brave first-party ads family"]
	}
	if (hasPrimary("polishannoyancefilters/master/ppb.txt")) {
		return ["annoyances", "explicit Polish annoyance list"]
	}
	if (hasPrimary("polish-adblock-filters/adblock.txt")) {
		return ["ads", "explicit Polish adblock list"]
	}
	if (hasPrimary("easylistpolish")) {
		return ["regional", "regional EasyList variant"]
	}
	if (hasPrimary("fuckfuckadblock-mining")) {
		return ["malware", "explicit mining list"]
	}
	if (hasPrimary("fuckfuckadblock")) {
		return ["anti-adblock", "explicit anti-adblock list"]
	}

	// ── AdGuard filter IDs ─────────────────────────────────────────────

	if (hasPrimary("/extension/ublock/filters/11.txt")) return ["mobile", "AdGuard mobile filter id"]
	if (hasPrimary("/extension/ublock/filters/14.txt", "/extension/chromium/filters/14.txt")) return ["annoyances", "AdGuard annoyances filter id"]
	if (hasPrimary("/extension/ublock/filters/2_without_easylist.txt")) return ["ads", "AdGuard base filter id"]
	if (hasPrimary("/extension/ublock/filters/17.txt")) return ["privacy", "AdGuard URL tracking filter id"]
	if (hasPrimary("/extension/ublock/filters/4.txt")) return ["social", "AdGuard social filter id"]
	if (hasPrimary("/extension/ublock/filters/3.txt")) return ["privacy", "AdGuard tracking protection filter id"]

	// ── AdGuard FiltersRegistry paths ──────────────────────────────────

	if (hasPrimary("/filter_2_base/")) return ["ads", "AdGuard FiltersRegistry base filter"]
	if (hasPrimary("/filter_3_spyware/")) return ["privacy", "AdGuard FiltersRegistry spyware filter"]
	if (hasPrimary("/filter_4_social/")) return ["social", "AdGuard FiltersRegistry social filter"]
	if (hasPrimary("/filter_17_trackparam/")) return ["privacy", "AdGuard FiltersRegistry trackparam filter"]
	if (hasPrimary("/filter_14_annoyances/", "/filter_19_annoyances_popups/", "/filter_20_annoyances_mobileapp/", "/filter_21_annoyances_other/", "/filter_22_annoyances_widgets/")) return ["annoyances", "AdGuard FiltersRegistry annoyances filter"]
	if (hasPrimary("/filter_18_annoyances_cookies/")) return ["cookies", "AdGuard FiltersRegistry cookies filter"]
	if (hasPrimary("/filter_10_useful/")) return ["compatibility", "AdGuard FiltersRegistry useful filter"]
	if (hasPrimary("/filter_11_mobile/")) return ["mobile", "AdGuard FiltersRegistry mobile filter"]
	if (hasPrimary("/filter_15_dnsfilter/")) return ["mixed", "AdGuard FiltersRegistry DNS bundle"]
	if (hasPrimary("/filter_5_experimental/")) return ["ads", "AdGuard FiltersRegistry experimental filter"]
	if (hasPrimary(
		"/filter_1_russian/", "/filter_6_german/", "/filter_7_japanese/",
		"/filter_8_dutch/", "/filter_9_spanish/", "/filter_13_turkish/",
		"/filter_16_french/", "/filter_23_ukrainian/", "/filter_224_chinese/",
	)) return ["regional", "AdGuard FiltersRegistry regional filter"]

	// ── Title/description keyword matches ──────────────────────────────

	if (hasPrimary("anti-malware list")) return ["malware", "explicit anti-malware title"]
	if (hasPrimary("nordic filters")) return ["regional", "regional Nordic title"]

	if (hasPrimary(
		"pro++", "pro blocklist", "dns filter",
		"filter composed of several other filters",
		"aggressive cleans the internet",
		"blocks ads, affiliate, tracking, metrics, telemetry, phishing, malware",
		"big broom", "sweeper", "kad", "oisd", "ultralist",
	)) return ["mixed", "multi-purpose source"]

	if (hasPrimary("cookie")) return ["cookies", "cookie-related keyword"]
	if (hasPrimary("social", "facebook plugins", "social media")) return ["social", "social keyword"]
	if (hasPrimary("youtube", "yt-", "twitch", "shorts")) return ["video", "video-platform keyword"]
	if (hasPrimary("gambling", "dating")) return ["content", "content-blocking keyword"]
	if (hasPrimary("quick fixes", "quick-fixes", "unbreak", "sugarcoat", "useful")) return ["compatibility", "compatibility keyword"]

	if (hasPrimary(
		"annoyance", "annoyances", "newsletter", "mobile notifications",
		"push notifications", "anti-chat", "chatapps", "widgets", "popup",
		"pop-up", "paywall", "ai suggestion", "mobileapp", "rss",
	)) return ["annoyances", "annoyance keyword"]

	if (hasPrimary("antiadblock", "adblock warning removal", "anti-adblock")) return ["anti-adblock", "anti-adblock keyword"]

	if (hasPrimary(
		"malware", "phishing", "badware", "threat intelligence", "urlhaus",
		"scam", "fake", "abused tlds", "dns rebind", "malicious", "hoster",
		"cryptojacking", "nocoin", "resource abuse", "warning list",
	)) return ["malware", "security keyword"]

	if (
		REGIONAL_PREFIX_RE.test(title) ||
		hasPrimary(
			"easylistpolish", "polish filter", "polish adblock", "polish annoyance",
			"ukrainian", "chinese", "turkish", "spanish", "dutch", "japanese",
			"french", "german", "russian", "hebrew", "lithuania", "list-kr",
			"korean", "vietnamese", "macedonian", "hungarian", "persian", "nordic",
			"pol:", "kor:", "vnm:", "mkd:", "hun:", "lit:", "isr:", "irn:", "chn:", "tur:",
		)
	) return ["regional", "regional keyword"]

	if (hasPrimary(
		"privacy", "tracking protection", "tracking", "tracker", "telemetry",
		"removeparam", "trackparam", "spyware", "fingerprint",
	)) return ["privacy", "privacy keyword"]

	if (hasPrimary("android", "ios", "mobile ads", "mobile-specific", "android-specific", "ios-specific")) {
		return ["mobile", "mobile keyword"]
	}

	if (hasPrimary(
		"easylist", "ad hosts", "ads rule", "adblock filters", "advertising networks",
		"base filter", "specific filters (tracking or ads) for brave", "firstparty", "recommended",
	)) return ["ads", "ads keyword"]

	// ── Fallback: match from full text (includes comments) ─────────────

	if (has("cookie")) return ["cookies", "cookie fallback from comments"]
	if (has("annoyance", "annoyances", "newsletter", "push notifications", "widgets", "popup", "paywall")) {
		return ["annoyances", "annoyance fallback from comments"]
	}
	if (has("antiadblock", "anti-adblock", "adblock warning removal")) {
		return ["anti-adblock", "anti-adblock fallback from comments"]
	}
	if (has("youtube", "twitch", "shorts")) return ["video", "video fallback from comments"]

	if (titleText.includes("tracking") || titleText.includes("tracker") || descText.includes("privacy")) {
		return ["privacy", "privacy fallback from title/description"]
	}

	return ["mixed", "fallback"]
}

// ── Fetch metadata and classify all sources ────────────────────────────────

export async function classifyAll(
	urls: string[],
	concurrency: number,
	notFoundPath?: string,
): Promise<SourceMeta[]> {
	const results = await fetchAllMetadata(urls, concurrency, META_FETCH_BYTES, notFoundPath)
	const metas: SourceMeta[] = []

	for (const result of results) {
		if (result.error) {
			const category = EXACT_OVERRIDES[result.url] ?? "mixed"
			metas.push({
				url: result.url,
				category,
				reason: `fetch failed, fallback category ${category}`,
				title: "",
				description: "",
				homepage: "",
				comments: [],
				error: result.error,
			})
		} else {
			metas.push(parseSourceMeta(result.url, result.content!))
		}
	}

	return metas
}

// ── Write category manifests ───────────────────────────────────────────────

export async function writeManifests(
	metas: SourceMeta[],
	outputDir: string,
): Promise<void> {
	const buckets = new Map<string, string[]>()
	for (const meta of metas) {
		const list = buckets.get(meta.category) ?? []
		list.push(meta.url)
		buckets.set(meta.category, list)
	}

	// Ensure directory exists
	const { mkdir } = await import("node:fs/promises")
	await mkdir(outputDir, { recursive: true })

	for (const category of CATEGORIES) {
		const urls = [...new Set(buckets.get(category) ?? [])].sort()
		const lines = [
			`# category: ${category}`,
			"# curated filter list sources",
			...urls,
			"",
		]
		const filePath = `${outputDir}/${category}.txt`
		await Bun.write(filePath, lines.join("\n"))
	}
}
