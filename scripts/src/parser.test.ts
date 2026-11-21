import { expect, test } from "bun:test"
import { parseSource } from "./parser.ts"

test("parseSource drops rules that block a whole public suffix", () => {
	const content = [
		"||com^",
		"||*.online^$third-party",
		"||*.co.uk^",
		"||*.example.com^",
		"||ads.example.online^",
		"@@||*.site^$third-party,domain=example.com",
	].join("\n")
	const rules = parseSource({ url: "test", content, error: null, isHosts: false })
		.filter((line) => line.kind === "rule")
		.map((line) => line.text)
	expect(rules).toEqual([
		"||*.example.com^",
		"||ads.example.online^",
		"@@||*.site^$third-party,domain=example.com",
	])
})
