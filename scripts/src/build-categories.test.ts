import { expect, test } from "bun:test"
import { findBadlistedUrls } from "./build-categories.ts"

test("findBadlistedUrls flags manifest URLs listed in uBO badlists", () => {
	const badlists = [
		"# whitelisting lists",
		"https://easylist-downloads.adblockplus.org/exceptionrules.txt",
		"https://hosts-file.net/ad_servers.txt remove",
		"! not a url",
	].join("\n")
	const urls = [
		"https://easylist.to/easylist/easylist.txt",
		"https://easylist-downloads.adblockplus.org/exceptionrules.txt",
		"https://hosts-file.net/ad_servers.txt",
	]
	expect(findBadlistedUrls(urls, badlists)).toEqual([
		"https://easylist-downloads.adblockplus.org/exceptionrules.txt",
		"https://hosts-file.net/ad_servers.txt",
	])
})
