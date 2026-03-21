from __future__ import annotations

import argparse
import json
import logging
import ssl
import subprocess
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections.abc import Iterable
from pathlib import Path
from urllib.parse import urlparse

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
DEFAULT_OUTPUT = ROOT / "filters.txt"
API_BASE = "https://api.filterlists.com"
DEFAULT_TIMEOUT = 120
DEFAULT_JOBS = 12

log = logging.getLogger("fetch-filterlists")

# Safety net for formats already handled by scripts/build.py.
KNOWN_UBLOCK_COMPATIBLE_SYNTAX_IDS = frozenset({1, 2, 3, 4, 6})
EXPECTED_UBLOCK_NAME = "uBlock Origin"
USER_AGENT = "Mozilla/5.0 (compatible; PolishCompleteFilters/2.0)"


class ApiError(RuntimeError):
    """Raised when the FilterLists API returns unexpected data."""


def _build_opener() -> urllib.request.OpenerDirector:
    ctx = ssl.create_default_context()
    handler = urllib.request.HTTPSHandler(context=ctx)
    opener = urllib.request.build_opener(handler)
    opener.addheaders = [(
        "User-Agent",
        USER_AGENT,
    ), (
        "Accept",
        "application/json",
    )]
    return opener


def _fetch_text_with_curl(url: str) -> str:
    proc = subprocess.run(
        [
            "curl",
            "-fsSL",
            "-A",
            USER_AGENT,
            "-H",
            "Accept: application/json",
            url,
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return proc.stdout


def _fetch_json(opener: urllib.request.OpenerDirector, path: str) -> object:
    url = f"{API_BASE}{path}"
    payload = ""
    try:
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
            },
        )
        with opener.open(request, timeout=DEFAULT_TIMEOUT) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            payload = response.read().decode(charset, errors="replace")
    except Exception as exc:  # noqa: BLE001
        log.info("urllib request failed for %s (%s); retrying with curl", url, exc)
        try:
            payload = _fetch_text_with_curl(url)
        except Exception as curl_exc:  # noqa: BLE001
            raise ApiError(
                f"Failed to fetch {url} via urllib and curl: {type(exc).__name__}: {exc}; "
                f"curl fallback: {type(curl_exc).__name__}: {curl_exc}"
            ) from curl_exc
    try:
        return json.loads(payload)
    except json.JSONDecodeError as exc:
        raise ApiError(f"Invalid JSON from {url}: {exc}") from exc


def _ensure_list_of_dicts(payload: object, path: str) -> list[dict[str, object]]:
    if not isinstance(payload, list):
        raise ApiError(f"Expected list payload from {path}, got {type(payload).__name__}")
    bad = [item for item in payload if not isinstance(item, dict)]
    if bad:
        raise ApiError(f"Expected only objects from {path}, got invalid items")
    return payload  # type: ignore[return-value]


def fetch_software(opener: urllib.request.OpenerDirector) -> list[dict[str, object]]:
    return _ensure_list_of_dicts(_fetch_json(opener, "/software"), "/software")


def fetch_syntaxes(opener: urllib.request.OpenerDirector) -> list[dict[str, object]]:
    return _ensure_list_of_dicts(_fetch_json(opener, "/syntaxes"), "/syntaxes")


def fetch_lists(opener: urllib.request.OpenerDirector) -> list[dict[str, object]]:
    return _ensure_list_of_dicts(_fetch_json(opener, "/lists"), "/lists")


def fetch_list_detail(
    opener: urllib.request.OpenerDirector,
    list_id: int,
) -> dict[str, object]:
    payload = _fetch_json(opener, f"/lists/{list_id}")
    if not isinstance(payload, dict):
        raise ApiError(f"Expected object payload from /lists/{list_id}")
    return payload


def fetch_list_details(
    opener: urllib.request.OpenerDirector,
    list_ids: list[int],
    jobs: int,
) -> tuple[list[dict[str, object]], list[tuple[int, str]]]:
    details: dict[int, dict[str, object]] = {}
    failures: list[tuple[int, str]] = []

    with ThreadPoolExecutor(max_workers=jobs) as pool:
        future_map = {
            pool.submit(fetch_list_detail, opener, list_id): list_id
            for list_id in list_ids
        }
        for future in as_completed(future_map):
            list_id = future_map[future]
            try:
                details[list_id] = future.result()
            except Exception as exc:  # noqa: BLE001
                failures.append((list_id, f"{type(exc).__name__}: {exc}"))

    ordered = [details[list_id] for list_id in list_ids if list_id in details]
    return ordered, failures


def _coerce_int_list(value: object) -> list[int]:
    if value is None:
        return []
    if not isinstance(value, list):
        return []
    ints: list[int] = []
    for item in value:
        if isinstance(item, int):
            ints.append(item)
    return ints


def find_ublock_software(software_items: Iterable[dict[str, object]]) -> dict[str, object]:
    by_name: dict[str, object] | None = None

    for item in software_items:
        if item.get("name") == EXPECTED_UBLOCK_NAME:
            by_name = item

    if by_name is None:
        raise ApiError(
            f"Could not find {EXPECTED_UBLOCK_NAME!r} in /software response"
        )
    return by_name


def collect_compatible_syntax_ids(
    ublock_software: dict[str, object],
    syntax_items: Iterable[dict[str, object]],
) -> set[int]:
    compatible = set(KNOWN_UBLOCK_COMPATIBLE_SYNTAX_IDS)
    compatible.update(_coerce_int_list(ublock_software.get("syntaxIds")))
    ublock_software_id = ublock_software.get("id")

    for syntax in syntax_items:
        syntax_id = syntax.get("id")
        if not isinstance(syntax_id, int):
            continue
        software_ids = _coerce_int_list(syntax.get("softwareIds"))
        name = syntax.get("name")
        if isinstance(ublock_software_id, int) and ublock_software_id in software_ids:
            compatible.add(syntax_id)
        if isinstance(name, str):
            normalized = name.lower()
            if normalized in {
                "adblock plus",
                "hosts",
                "domains-only",
                "ublock origin static filtering",
                "adguard",
            }:
                compatible.add(syntax_id)

    return compatible


def collect_compatible_filterlist_ids(
    syntax_items: Iterable[dict[str, object]],
    compatible_syntax_ids: set[int],
) -> set[int]:
    compatible_ids: set[int] = set()
    for syntax in syntax_items:
        syntax_id = syntax.get("id")
        if not isinstance(syntax_id, int) or syntax_id not in compatible_syntax_ids:
            continue
        compatible_ids.update(_coerce_int_list(syntax.get("filterListIds")))
    return compatible_ids


def collect_compatible_list_ids_from_summaries(
    list_items: Iterable[dict[str, object]],
    compatible_syntax_ids: set[int],
) -> list[int]:
    compatible_ids: list[int] = []
    for item in list_items:
        list_id = item.get("id")
        if not isinstance(list_id, int):
            continue
        syntax_ids = set(_coerce_int_list(item.get("syntaxIds")))
        if syntax_ids & compatible_syntax_ids:
            compatible_ids.append(list_id)
    return compatible_ids


def is_valid_http_url(value: object) -> bool:
    if not isinstance(value, str):
        return False
    stripped = value.strip()
    if not stripped:
        return False
    parsed = urlparse(stripped)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def normalize_url(url: str) -> str:
    return url.strip()


def load_existing_urls(path: Path) -> list[str]:
    if not path.exists():
        return []
    return [
        normalize_url(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if normalize_url(line) and not normalize_url(line).startswith("#")
    ]


def extract_view_urls(list_detail: dict[str, object]) -> list[str]:
    raw_view_urls = list_detail.get("viewUrls")
    if not isinstance(raw_view_urls, list):
        return []

    best_by_segment: dict[int, tuple[int, str]] = {}
    standalone: list[str] = []

    for item in raw_view_urls:
        if not isinstance(item, dict):
            continue
        url = item.get("url")
        if not is_valid_http_url(url):
            continue
        normalized_url = normalize_url(str(url))
        segment_number = item.get("segmentNumber")
        primariness = item.get("primariness")

        if isinstance(segment_number, int):
            rank = primariness if isinstance(primariness, int) else 999999
            existing = best_by_segment.get(segment_number)
            if existing is None or rank < existing[0]:
                best_by_segment[segment_number] = (rank, normalized_url)
        else:
            standalone.append(normalized_url)

    segment_urls = [
        url for _, url in sorted(best_by_segment.values(), key=lambda value: (value[0], value[1]))
    ]
    return dedupe_preserve_order([*segment_urls, *standalone])


def extract_candidate_urls(
    list_details: Iterable[dict[str, object]],
) -> tuple[list[str], dict[str, int]]:
    urls: list[str] = []
    stats = {
        "detail_lists": 0,
        "lists_with_view_urls": 0,
        "lists_without_view_urls": 0,
        "accepted_urls": 0,
    }

    for detail in list_details:
        stats["detail_lists"] += 1
        extracted = extract_view_urls(detail)
        if extracted:
            stats["lists_with_view_urls"] += 1
            stats["accepted_urls"] += len(extracted)
            urls.extend(extracted)
        else:
            stats["lists_without_view_urls"] += 1

    return urls, stats


def dedupe_preserve_order(urls: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for url in urls:
        normalized = normalize_url(url)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        output.append(normalized)
    return output


def merge_urls(existing: list[str], discovered: list[str]) -> tuple[list[str], list[str]]:
    existing_deduped = dedupe_preserve_order(existing)
    existing_set = set(existing_deduped)
    discovered_deduped = dedupe_preserve_order(discovered)
    new_urls = [url for url in discovered_deduped if url not in existing_set]
    merged = [*existing_deduped, *new_urls]
    return merged, new_urls


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Discover uBlock-compatible filter lists from FilterLists API and merge them into filters.txt."
    )
    parser.add_argument(
        "--jobs",
        type=int,
        default=DEFAULT_JOBS,
        help=f"Concurrent detail requests (default: {DEFAULT_JOBS})",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Output file path (default: filters.txt)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Do not write the file; print only summary and newly discovered URLs.",
    )
    parser.add_argument(
        "--print-new-only",
        action="store_true",
        help="Print newly discovered URLs, one per line.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging.",
    )
    return parser.parse_args(argv)


def configure_logging(verbose: bool) -> None:
    level = logging.INFO if verbose else logging.WARNING
    logging.basicConfig(level=level, format="%(message)s")


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    configure_logging(args.verbose)

    opener = _build_opener()

    log.info("Fetching /software …")
    software_items = fetch_software(opener)
    ublock_software = find_ublock_software(software_items)
    log.info("Found %s with syntax IDs: %s", ublock_software.get("name"), _coerce_int_list(ublock_software.get("syntaxIds")))

    log.info("Fetching /syntaxes …")
    syntax_items = fetch_syntaxes(opener)
    compatible_syntax_ids = collect_compatible_syntax_ids(ublock_software, syntax_items)
    compatible_filterlist_ids = collect_compatible_filterlist_ids(syntax_items, compatible_syntax_ids)
    log.info("Compatible syntax IDs: %s", sorted(compatible_syntax_ids))
    log.info("Compatible filter list IDs collected from syntaxes: %d", len(compatible_filterlist_ids))

    log.info("Fetching /lists …")
    list_items = fetch_lists(opener)
    compatible_list_ids = collect_compatible_list_ids_from_summaries(
        list_items,
        compatible_syntax_ids,
    )
    log.info("Compatible lists via summary syntax filter: %d", len(compatible_list_ids))

    log.info("Fetching %d compatible list details …", len(compatible_list_ids))
    list_details, detail_failures = fetch_list_details(
        opener,
        compatible_list_ids,
        jobs=max(1, args.jobs),
    )
    discovered_urls, discovery_stats = extract_candidate_urls(list_details)
    discovered_urls = dedupe_preserve_order(discovered_urls)

    existing_urls = load_existing_urls(args.output)
    merged_urls, new_urls = merge_urls(existing_urls, discovered_urls)

    print(f"Software entries: {len(software_items)}")
    print(f"Syntax entries: {len(syntax_items)}")
    print(f"API lists total: {len(list_items)}")
    print(f"Compatible syntax IDs: {','.join(str(x) for x in sorted(compatible_syntax_ids))}")
    print(f"Compatible lists via syntax map: {len(compatible_filterlist_ids)}")
    print(f"Compatible lists via summary syntax filter: {len(compatible_list_ids)}")
    print(f"Detail responses fetched: {len(list_details)}")
    print(f"Detail fetch failures: {len(detail_failures)}")
    print(f"Lists with usable viewUrls: {discovery_stats['lists_with_view_urls']}")
    print(f"Lists without usable viewUrls: {discovery_stats['lists_without_view_urls']}")
    print(f"Accepted detail URLs before dedupe: {discovery_stats['accepted_urls']}")
    print(f"Discovered URLs after dedupe: {len(discovered_urls)}")
    print(f"Existing URLs: {len(dedupe_preserve_order(existing_urls))}")
    print(f"New URLs: {len(new_urls)}")
    print(f"Merged URLs: {len(merged_urls)}")

    if args.verbose and detail_failures:
        print("--- DETAIL FAILURES ---")
        for list_id, error in detail_failures[:50]:
            print(f"{list_id}: {error}")
        if len(detail_failures) > 50:
            print(f"... and {len(detail_failures) - 50} more")

    if args.print_new_only or args.dry_run:
        if new_urls:
            print("--- NEW URLS ---")
            for url in new_urls:
                print(url)
        else:
            print("--- NEW URLS ---")
            print("(none)")

    if args.dry_run:
        return 0

    args.output.write_text("\n".join(merged_urls) + "\n", encoding="utf-8")
    print(f"Wrote merged URL list to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
