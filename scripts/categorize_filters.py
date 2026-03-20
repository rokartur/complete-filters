from __future__ import annotations

import argparse
import logging
import re
import ssl
import time
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

from build import DEFAULT_INPUT, DEFAULT_JOBS, load_urls

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT_DIR = ROOT / "categories"
MAX_RETRIES = 3
BACKOFF_BASE = 1.5

log = logging.getLogger("categorize")

TITLE_RE = re.compile(
    r"^(?:!|#)\s*(Title|Description|Homepage|Expires|Version|Last modified|Name)\s*:\s*(.*)$",
    re.IGNORECASE,
)
FORMAT_HEADER_RE = re.compile(
    r"^\[(?:Adblock(?:\s*Plus)?|uBlock Origin)[^\]]*\]\s*$",
    re.IGNORECASE,
)
REGIONAL_PREFIX_RE = re.compile(r"\b[A-Z]{2,4}:\s")

CATEGORIES = (
    "ads",
    "annoyances",
    "anti-adblock",
    "compatibility",
    "content",
    "cookies",
    "malware",
    "mobile",
    "mixed",
    "privacy",
    "regional",
    "social",
    "video",
)

EXACT_OVERRIDES = {
    "https://hole.cert.pl/domains/v2/domains_adblock.txt": "malware",
    "https://hole.cert.pl/domains/v2/domains_ublock.txt": "malware",
    "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters-general.txt": "ads",
    "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/resource-abuse.txt": "malware",
}


@dataclass
class SourceMeta:
    url: str
    category: str
    reason: str
    title: str = ""
    description: str = ""
    homepage: str = ""
    comments: list[str] | None = None
    error: str | None = None


def _build_opener() -> urllib.request.OpenerDirector:
    ctx = ssl.create_default_context()
    handler = urllib.request.HTTPSHandler(context=ctx)
    opener = urllib.request.build_opener(handler)
    opener.addheaders = [("User-Agent", "Mozilla/5.0 (compatible; PolishCompleteFilters/2.0)")]
    return opener


def _fetch_one(url: str, opener: urllib.request.OpenerDirector) -> SourceMeta:
    last_err = ""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with opener.open(url, timeout=120) as resp:
                text = resp.read(65536).decode("utf-8", errors="replace")
            return _parse_source_meta(url, text)
        except Exception as exc:  # noqa: BLE001
            last_err = f"{type(exc).__name__}: {exc}"
            if attempt < MAX_RETRIES:
                wait = BACKOFF_BASE ** attempt
                log.warning("  ⚠ attempt %d/%d failed for %s — retrying in %.1fs (%s)",
                            attempt, MAX_RETRIES, url, wait, last_err)
                time.sleep(wait)

    category = EXACT_OVERRIDES.get(url, "mixed")
    return SourceMeta(
        url=url,
        category=category,
        reason=f"fetch failed, fallback category {category}",
        error=last_err,
    )


def _parse_source_meta(url: str, text: str) -> SourceMeta:
    title = ""
    description = ""
    homepage = ""
    comments: list[str] = []

    for raw_line in text.splitlines()[:80]:
        line = raw_line.strip("\ufeff").rstrip()
        if not line or FORMAT_HEADER_RE.match(line):
            continue

        match = TITLE_RE.match(line)
        if match:
            key = match.group(1).lower()
            value = match.group(2).strip()
            if key == "title" and not title:
                title = value
            elif key == "description" and not description:
                description = value
            elif key == "homepage" and not homepage:
                homepage = value
            continue

        if line.startswith(("!", "#")):
            comment = line.lstrip("!#").strip()
            if comment:
                comments.append(comment)

        if title and description and homepage and len(comments) >= 6:
            break

    category, reason = classify_source(url, title, description, comments)
    return SourceMeta(
        url=url,
        category=category,
        reason=reason,
        title=title,
        description=description,
        homepage=homepage,
        comments=comments[:8],
    )


def classify_source(
    url: str,
    title: str,
    description: str,
    comments: list[str],
) -> tuple[str, str]:
    if url in EXACT_OVERRIDES:
        category = EXACT_OVERRIDES[url]
        return category, f"exact override for {url}"

    primary_text = " ".join([url, title, description]).lower()
    text = " ".join([url, title, description, *comments]).lower()
    title_text = title.lower()
    desc_text = description.lower()

    def has_primary(*needles: str) -> bool:
        return any(needle in primary_text for needle in needles)

    def has(*needles: str) -> bool:
        return any(needle in text for needle in needles)

    if "/uassets/master/filters/filters" in primary_text:
        return "ads", "uAssets core filters family"

    if has_primary("quick-fixes", "unbreak", "brave-unbreak", "sugarcoat"):
        return "compatibility", "compatibility family"

    if has_primary("brave-android-specific", "brave-ios-specific"):
        return "mobile", "mobile Brave family"

    if has_primary("brave-firstparty.txt"):
        return "ads", "Brave first-party ads family"

    if has_primary("polishannoyancefilters/master/ppb.txt"):
        return "annoyances", "explicit Polish annoyance list"

    if has_primary("polish-adblock-filters/adblock.txt"):
        return "ads", "explicit Polish adblock list"

    if has_primary("easylistpolish"):
        return "regional", "regional EasyList variant"

    if has_primary("fuckfuckadblock-mining"):
        return "malware", "explicit mining list"

    if has_primary("fuckfuckadblock"):
        return "anti-adblock", "explicit anti-adblock list"

    if has_primary("/extension/ublock/filters/11.txt"):
        return "mobile", "AdGuard mobile filter id"

    if has_primary("/extension/ublock/filters/14.txt", "/extension/chromium/filters/14.txt"):
        return "annoyances", "AdGuard annoyances filter id"

    if has_primary("/extension/ublock/filters/2_without_easylist.txt"):
        return "ads", "AdGuard base filter id"

    if has_primary("/extension/ublock/filters/17.txt"):
        return "privacy", "AdGuard URL tracking filter id"

    if has_primary("/extension/ublock/filters/4.txt"):
        return "social", "AdGuard social filter id"

    if has_primary("/extension/ublock/filters/3.txt"):
        return "privacy", "AdGuard tracking protection filter id"

    if has_primary("/filter_2_base/"):
        return "ads", "AdGuard FiltersRegistry base filter"

    if has_primary("/filter_3_spyware/"):
        return "privacy", "AdGuard FiltersRegistry spyware filter"

    if has_primary("/filter_4_social/"):
        return "social", "AdGuard FiltersRegistry social filter"

    if has_primary("/filter_17_trackparam/"):
        return "privacy", "AdGuard FiltersRegistry trackparam filter"

    if has_primary("/filter_14_annoyances/", "/filter_19_annoyances_popups/",
                   "/filter_20_annoyances_mobileapp/", "/filter_21_annoyances_other/",
                   "/filter_22_annoyances_widgets/"):
        return "annoyances", "AdGuard FiltersRegistry annoyances filter"

    if has_primary("/filter_18_annoyances_cookies/"):
        return "cookies", "AdGuard FiltersRegistry cookies filter"

    if has_primary("/filter_10_useful/"):
        return "compatibility", "AdGuard FiltersRegistry useful filter"

    if has_primary("/filter_11_mobile/"):
        return "mobile", "AdGuard FiltersRegistry mobile filter"

    if has_primary("/filter_15_dnsfilter/"):
        return "mixed", "AdGuard FiltersRegistry DNS bundle"

    if has_primary("/filter_5_experimental/"):
        return "ads", "AdGuard FiltersRegistry experimental filter"

    if has_primary(
        "/filter_1_russian/",
        "/filter_6_german/",
        "/filter_7_japanese/",
        "/filter_8_dutch/",
        "/filter_9_spanish/",
        "/filter_13_turkish/",
        "/filter_16_french/",
        "/filter_23_ukrainian/",
        "/filter_224_chinese/",
    ):
        return "regional", "AdGuard FiltersRegistry regional filter"

    if has_primary("anti-malware list"):
        return "malware", "explicit anti-malware title"

    if has_primary("nordic filters"):
        return "regional", "regional Nordic title"

    if has_primary(
        "pro++",
        "pro blocklist",
        "dns filter",
        "filter composed of several other filters",
        "aggressive cleans the internet",
        "blocks ads, affiliate, tracking, metrics, telemetry, phishing, malware",
        "big broom",
        "sweeper",
        "kad",
        "oisd",
        "ultralist",
    ):
        return "mixed", "multi-purpose source"

    if has_primary("cookie"):
        return "cookies", "cookie-related keyword"

    if has_primary("social", "facebook plugins", "social media"):
        return "social", "social keyword"

    if has_primary("youtube", "yt-", "twitch", "shorts"):
        return "video", "video-platform keyword"

    if has_primary("gambling", "dating"):
        return "content", "content-blocking keyword"

    if has_primary("quick fixes", "quick-fixes", "unbreak", "sugarcoat", "useful"):
        return "compatibility", "compatibility keyword"

    if has_primary(
        "annoyance",
        "annoyances",
        "newsletter",
        "mobile notifications",
        "push notifications",
        "anti-chat",
        "chatapps",
        "widgets",
        "popup",
        "pop-up",
        "paywall",
        "ai suggestion",
        "mobileapp",
        "rss",
    ):
        return "annoyances", "annoyance keyword"

    if has_primary("antiadblock", "adblock warning removal", "anti-adblock"):
        return "anti-adblock", "anti-adblock keyword"

    if has_primary(
        "malware",
        "phishing",
        "badware",
        "threat intelligence",
        "urlhaus",
        "scam",
        "fake",
        "abused tlds",
        "dns rebind",
        "malicious",
        "hoster",
        "cryptojacking",
        "nocoin",
        "resource abuse",
        "warning list",
    ):
        return "malware", "security keyword"

    if (
        REGIONAL_PREFIX_RE.search(title)
        or has_primary(
            "easylistpolish",
            "polish filter",
            "polish adblock",
            "polish annoyance",
            "ukrainian",
            "chinese",
            "turkish",
            "spanish",
            "dutch",
            "japanese",
            "french",
            "german",
            "russian",
            "hebrew",
            "lithuania",
            "list-kr",
            "korean",
            "vietnamese",
            "macedonian",
            "hungarian",
            "persian",
            "nordic",
            "pol:",
            "kor:",
            "vnm:",
            "mkd:",
            "hun:",
            "lit:",
            "isr:",
            "irn:",
            "chn:",
            "tur:",
        )
    ):
        return "regional", "regional keyword"

    if has_primary(
        "privacy",
        "tracking protection",
        "tracking",
        "tracker",
        "telemetry",
        "removeparam",
        "trackparam",
        "spyware",
        "fingerprint",
    ):
        return "privacy", "privacy keyword"

    if has_primary("android", "ios", "mobile ads", "mobile-specific", "android-specific", "ios-specific"):
        return "mobile", "mobile keyword"

    if has_primary(
        "easylist",
        "ad hosts",
        "ads rule",
        "adblock filters",
        "advertising networks",
        "base filter",
        "specific filters (tracking or ads) for brave",
        "firstparty",
        "recommended",
    ):
        return "ads", "ads keyword"

    if has("cookie"):
        return "cookies", "cookie fallback from comments"

    if has("annoyance", "annoyances", "newsletter", "push notifications", "widgets", "popup", "paywall"):
        return "annoyances", "annoyance fallback from comments"

    if has("antiadblock", "anti-adblock", "adblock warning removal"):
        return "anti-adblock", "anti-adblock fallback from comments"

    if has("youtube", "twitch", "shorts"):
        return "video", "video fallback from comments"

    if "tracking" in title_text or "tracker" in title_text or "privacy" in desc_text:
        return "privacy", "privacy fallback from title/description"

    return "mixed", "fallback"


def fetch_all_metadata(urls: list[str], jobs: int) -> list[SourceMeta]:
    opener = _build_opener()
    results: dict[str, SourceMeta] = {}
    total = len(urls)
    done_count = 0

    with ThreadPoolExecutor(max_workers=jobs) as pool:
        futures = {pool.submit(_fetch_one, url, opener): url for url in urls}
        for future in as_completed(futures):
            result = future.result()
            done_count += 1
            status = f"{result.category}"
            if result.error:
                status += f", error={result.error}"
            log.info("[%d/%d] %s → %s", done_count, total, result.url, status)
            results[result.url] = result

    return [results[url] for url in urls]


def write_manifests(results: list[SourceMeta], output_dir: Path) -> None:
    buckets: dict[str, list[str]] = defaultdict(list)
    for result in results:
        buckets[result.category].append(result.url)

    output_dir.mkdir(parents=True, exist_ok=True)

    for category in CATEGORIES:
        urls = sorted(dict.fromkeys(buckets.get(category, [])))
        manifest_path = output_dir / f"{category}.txt"
        lines = [
            f"# category: {category}",
            "# generated by categorize_filters.py from filters.txt headers",
            *urls,
            "",
        ]
        manifest_path.write_text("\n".join(lines), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Classify source filter lists into category manifests using upstream headers.",
    )
    parser.add_argument("-i", "--input", type=Path, default=DEFAULT_INPUT,
                        help="Path to the file containing source URLs (default: filters.txt)")
    parser.add_argument("-o", "--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR,
                        help="Directory where category manifests will be written")
    parser.add_argument("-j", "--jobs", type=int, default=DEFAULT_JOBS,
                        help="Number of concurrent download workers (default: 10)")
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="Enable debug-level logging")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(message)s",
    )

    urls = load_urls(args.input)
    log.info("Loaded %d source URLs from %s", len(urls), args.input)

    results = fetch_all_metadata(urls, args.jobs)
    write_manifests(results, args.output_dir)
    log.info("Wrote category manifests to %s", args.output_dir)


if __name__ == "__main__":
    main()
