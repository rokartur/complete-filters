from __future__ import annotations

import argparse
import logging
import re
import ssl
import subprocess
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
DEFAULT_INPUT = ROOT / "filters.txt"
DEFAULT_CATEGORY_DIR = ROOT / "categories"
DEFAULT_CATEGORY_OUTPUT_DIR = ROOT / "filter"
DEFAULT_EXTRA_RULESETS = (
    ROOT / "manual-rules" / "developer-infrastructure-allowlist.txt",
    ROOT / "manual-rules" / "manual-blocklist.txt",
)
DEFAULT_JOBS = 10
MAX_RETRIES = 3
BACKOFF_BASE = 1.5

DEFAULT_TITLE = "Complete Filters"
DEFAULT_HOMEPAGE = "https://github.com/rokartur/complete-filters"
DEFAULT_DESCRIPTION = "Combined filter list from upstream sources for uBlock Origin"
DEFAULT_EXPIRES = "6 hours"

log = logging.getLogger("build")

_HOSTS_RE = re.compile(
    r"^(?:0\.0\.0\.0|127\.0\.0\.1)\s+(\S+)\s*$"
)
_HOSTS_SKIP = frozenset({
    "localhost",
    "localhost.localdomain",
    "local",
    "broadcasthost",
    "ip6-localhost",
    "ip6-loopback",
    "ip6-localnet",
    "ip6-mcastprefix",
    "ip6-allnodes",
    "ip6-allrouters",
    "ip6-allhosts",
    "0.0.0.0",
})

_FORMAT_HEADER_RE = re.compile(r"^\[(?:Adblock(?:\s*Plus)?|uBlock Origin)[^\]]*\]\s*$", re.IGNORECASE)
_META_PREFIXES = (
    "! Title:",
    "! Homepage:",
    "! Expires:",
    "! Version:",
    "! Checksum:",
    "! Last modified:",
    "! Last updated:",
    "! Description:",
    "! Licence:",
    "! License:",
    "! TimeUpdated:",
    "! Redirect:",
    "! URL:",
    "! Source:",
)

_OPTION_ALIASES: dict[str, str] = {
    "1p": "first-party",
    "3p": "third-party",
    "xhr": "xmlhttprequest",
    "css": "stylesheet",
    "frame": "subdocument",
    "doc": "document",
    "queryprune": "removeparam",
    "ehide": "elemhide",
    "ghide": "generichide",
    "shide": "specifichide",
}

_VALUE_OPTIONS = frozenset({
    "domain", "from", "to", "denyallow",
    "redirect", "redirect-rule", "rewrite",
    "csp", "permissions", "header",
    "removeparam", "queryprune",
    "replace", "urltransform",
    "method",
})


def _normalize_options(options_str: str) -> str:
    parts: list[str] = []
    for opt in options_str.split(","):
        opt = opt.strip()
        if not opt:
            continue
        negated = opt.startswith("~")
        if negated:
            opt = opt[1:]
        name = opt
        value = ""
        if "=" in opt:
            name, value = opt.split("=", 1)
        name_lower = name.lower()
        name_lower = _OPTION_ALIASES.get(name_lower, name_lower)
        rebuilt = f"{'~' if negated else ''}{name_lower}"
        if value:
            rebuilt += f"={value}"
        parts.append(rebuilt)
    parts.sort(key=lambda p: p.lstrip("~").split("=", 1)[0])
    return ",".join(parts)


_COSMETIC_MARKERS = {"##", "#?#", "#@#", "#@?#"}
_SCRIPTLET_MARKER = "##+js("
_HTML_FILTER_MARKER = "##^"
_BADFILTER_RE = re.compile(r"\$.*\bbadfilter\b", re.IGNORECASE)
_COSMETIC_SEP_RE = re.compile(r"(?:^|[^\\])(?:##\^|#@?\??#)")


def _is_cosmetic_or_scriptlet(line: str) -> bool:
    if _SCRIPTLET_MARKER in line:
        return True
    if _HTML_FILTER_MARKER in line:
        return True
    return bool(_COSMETIC_SEP_RE.search(line))


def _split_network_rule(line: str) -> tuple[str, str | None]:
    if _is_cosmetic_or_scriptlet(line):
        return line, None

    body = line[2:] if line.startswith("@@") else line

    if body.startswith("/"):
        idx = 1
        while idx < len(body):
            if body[idx] == "/" and body[idx - 1] != "\\":
                rest = body[idx + 1:]
                if rest.startswith("$"):
                    prefix = line[: len(line) - len(rest)]
                    return prefix, rest[1:]
                return line, None
            idx += 1
        return line, None

    dollar = line.rfind("$")
    if dollar <= 0:
        return line, None

    candidate = line[dollar + 1:]
    if not candidate:
        return line, None

    if any(c in candidate for c in (",", "=")) or candidate.split(",")[0].lower().rstrip("~") in (
        "third-party", "3p", "first-party", "1p", "script", "image", "stylesheet",
        "css", "xmlhttprequest", "xhr", "subdocument", "frame", "object",
        "ping", "media", "font", "websocket", "other", "popup", "document",
        "doc", "all", "important", "badfilter", "match-case", "domain",
        "redirect", "redirect-rule", "csp", "removeparam", "queryprune",
        "denyallow", "from", "to", "header", "method", "permissions",
        "rewrite", "urltransform", "replace", "elemhide", "ehide",
        "generichide", "ghide", "specifichide", "shide", "genericblock",
        "mp4", "empty", "inline-script", "inline-font",
    ):
        return line[:dollar], candidate
    return line, None


def _make_dedup_key(line: str) -> str:
    stripped = line.rstrip()

    if _BADFILTER_RE.search(stripped):
        return f"__badfilter__{id(stripped)}__"

    if _is_cosmetic_or_scriptlet(stripped):
        return stripped

    pattern, options = _split_network_rule(stripped)
    if options is None:
        return stripped

    norm_opts = _normalize_options(options)
    return f"{pattern}${norm_opts}"


def _is_hosts_format(text: str) -> bool:
    total = 0
    hits = 0
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or line.startswith("!"):
            continue
        total += 1
        if _HOSTS_RE.match(line):
            hits += 1
        if total >= 200:
            break
    return total > 0 and (hits / total) >= 0.6


def _convert_hosts_line(line: str) -> str | None:
    m = _HOSTS_RE.match(line)
    if not m:
        return None
    domain = m.group(1).lower().strip(".")
    if domain in _HOSTS_SKIP or not domain:
        return None
    return f"||{domain}^"


@dataclass
class FetchResult:
    url: str
    content: str | None = None
    error: str | None = None
    is_hosts: bool = False


@dataclass(frozen=True)
class BuildMetadata:
    title: str = DEFAULT_TITLE
    homepage: str = DEFAULT_HOMEPAGE
    description: str = DEFAULT_DESCRIPTION
    expires: str = DEFAULT_EXPIRES


def _build_opener() -> urllib.request.OpenerDirector:
    ctx = ssl.create_default_context()
    handler = urllib.request.HTTPSHandler(context=ctx)
    opener = urllib.request.build_opener(handler)
    opener.addheaders = [("User-Agent", "Mozilla/5.0 (compatible; PolishCompleteFilters/2.0)")]
    return opener


def _fetch_one(url: str, opener: urllib.request.OpenerDirector) -> FetchResult:
    last_err = ""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with opener.open(url, timeout=120) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
            return FetchResult(url=url, content=raw)
        except Exception as exc:  # noqa: BLE001
            last_err = f"{type(exc).__name__}: {exc}"
            if attempt < MAX_RETRIES:
                wait = BACKOFF_BASE ** attempt
                log.warning("  ⚠ attempt %d/%d failed for %s — retrying in %.1fs (%s)",
                            attempt, MAX_RETRIES, url, wait, last_err)
                time.sleep(wait)
    return FetchResult(url=url, error=last_err)


def fetch_all(urls: list[str], jobs: int) -> list[FetchResult]:
    opener = _build_opener()
    results: dict[str, FetchResult] = {}
    total = len(urls)
    done_count = 0

    with ThreadPoolExecutor(max_workers=jobs) as pool:
        futures = {pool.submit(_fetch_one, u, opener): u for u in urls}
        for future in as_completed(futures):
            res = future.result()
            done_count += 1
            if res.error:
                log.error("[%d/%d] ✗ %s — %s", done_count, total, res.url, res.error)
            else:
                assert res.content is not None
                is_h = _is_hosts_format(res.content)
                res.is_hosts = is_h
                tag = " (hosts)" if is_h else ""
                log.info("[%d/%d] ✓ %s%s (%d lines)",
                         done_count, total, res.url, tag,
                         res.content.count("\n"))
            results[res.url] = res

    return [results[u] for u in urls]


def load_local_rulesets(paths: tuple[Path, ...]) -> list[FetchResult]:
    results: list[FetchResult] = []
    for path in paths:
        try:
            content = path.read_text(encoding="utf-8")
        except Exception as exc:  # noqa: BLE001
            results.append(FetchResult(url=f"local:{path.name}", error=f"{type(exc).__name__}: {exc}"))
            continue

        results.append(
            FetchResult(
                url=f"local:{path.name}",
                content=content,
                is_hosts=_is_hosts_format(content),
            )
        )

    return results


@dataclass
class ParsedLine:
    text: str
    cond_stack: tuple[str, ...] = ()
    kind: str = "rule"


def _should_strip_meta(line: str) -> bool:
    if _FORMAT_HEADER_RE.match(line):
        return True
    for prefix in _META_PREFIXES:
        if line.startswith(prefix):
            return True
    return False


def parse_source(result: FetchResult) -> list[ParsedLine]:
    if result.content is None:
        return []

    lines: list[ParsedLine] = []
    cond_stack: list[str] = []
    hosts_converted = 0

    for raw_line in result.content.splitlines():
        line = raw_line.rstrip()

        if not line:
            lines.append(ParsedLine("", tuple(cond_stack), "blank"))
            continue

        if _FORMAT_HEADER_RE.match(line):
            lines.append(ParsedLine(line, tuple(cond_stack), "header"))
            continue

        if line.startswith("!#"):
            directive_lower = line.lower()

            if directive_lower.startswith("!#include"):
                continue

            if directive_lower.startswith("!#if ") or directive_lower.startswith("!#if\t"):
                condition = line[5:].strip()
                cond_stack.append(condition)
                lines.append(ParsedLine(line, tuple(cond_stack), "directive"))
                continue

            if directive_lower.startswith("!#endif"):
                lines.append(ParsedLine(line, tuple(cond_stack), "directive"))
                if cond_stack:
                    cond_stack.pop()
                else:
                    log.warning("  unmatched !#endif in %s", result.url)
                continue

            lines.append(ParsedLine(line, tuple(cond_stack), "directive"))
            continue

        if line.startswith("!") and _should_strip_meta(line):
            lines.append(ParsedLine(line, tuple(cond_stack), "meta"))
            continue

        if line.startswith("!"):
            lines.append(ParsedLine(line, tuple(cond_stack), "comment"))
            continue

        if result.is_hosts:
            if line.startswith("#"):
                lines.append(ParsedLine(f"! {line[1:].strip()}", tuple(cond_stack), "comment"))
                continue
            converted = _convert_hosts_line(line)
            if converted:
                hosts_converted += 1
                lines.append(ParsedLine(converted, tuple(cond_stack), "rule"))
                continue
            if line.strip():
                continue
            lines.append(ParsedLine("", tuple(cond_stack), "blank"))
            continue

        lines.append(ParsedLine(line, tuple(cond_stack), "rule"))

    if cond_stack:
        log.warning("  %d unclosed !#if block(s) in %s", len(cond_stack), result.url)

    if hosts_converted:
        log.info("  converted %d hosts entries → adblock rules from %s",
                 hosts_converted, result.url)

    return lines


@dataclass
class Stats:
    total_rules: int = 0
    unique_rules: int = 0
    duplicates: int = 0
    hosts_converted: int = 0
    sources_ok: int = 0
    sources_failed: int = 0
    empty_blocks_removed: int = 0


def _append_source_block(
    output: list[str],
    res: FetchResult,
    parsed_lines: list[ParsedLine],
    seen: set[tuple[str, tuple[str, ...]]],
    stats: Stats,
) -> None:
    output.append(f"! ===== SOURCE: {res.url}")

    if res.error:
        output.append(f"! ✗ Failed to load: {res.error}")
        output.append("")
        return

    Block = list[tuple[ParsedLine, bool]]
    block_stack: list[Block] = []
    top_level: list[str] = []

    source_unique = 0

    for pline in parsed_lines:
        if pline.kind in ("meta", "header"):
            continue

        if pline.kind == "blank":
            if not block_stack:
                if top_level and top_level[-1] == "":
                    continue
                top_level.append("")
            else:
                block_stack[-1].append((pline, False))
            continue

        if pline.kind == "comment":
            if not block_stack:
                top_level.append(pline.text)
            else:
                block_stack[-1].append((pline, False))
            continue

        if pline.kind == "directive":
            low = pline.text.lower()

            if low.startswith("!#if ") or low.startswith("!#if\t"):
                block_stack.append([(pline, False)])
                continue

            if low.startswith("!#endif"):
                if block_stack:
                    block = block_stack.pop()
                    block.append((pline, False))
                    has_unique = any(is_u for _, is_u in block)

                    if has_unique:
                        target = block_stack[-1] if block_stack else None
                        for bline, bu in block:
                            if target is not None:
                                target.append((bline, bu))
                            else:
                                top_level.append(bline.text)
                    else:
                        stats.empty_blocks_removed += 1
                else:
                    top_level.append(pline.text)
                continue

            if not block_stack:
                top_level.append(pline.text)
            else:
                block_stack[-1].append((pline, False))
            continue

        stats.total_rules += 1
        dedup_key_text = _make_dedup_key(pline.text)
        key = (dedup_key_text, pline.cond_stack)

        if key in seen:
            stats.duplicates += 1
            if block_stack:
                block_stack[-1].append((pline, False))
            continue

        seen.add(key)
        stats.unique_rules += 1
        source_unique += 1

        if block_stack:
            block_stack[-1].append((pline, True))
        else:
            top_level.append(pline.text)

    while block_stack:
        block = block_stack.pop()
        has_unique = any(is_u for _, is_u in block)
        if has_unique:
            for bline, _ in block:
                top_level.append(bline.text)

    if source_unique == 0:
        output.append("! (all rules already included from earlier sources)")

    output.extend(top_level)
    output.append("")


def assemble(
    urls: list[str],
    fetch_results: list[FetchResult],
    extra_results: list[FetchResult] | None = None,
    metadata: BuildMetadata | None = None,
) -> tuple[list[str], Stats]:
    stats = Stats()
    metadata = metadata or BuildMetadata()

    all_results = [*fetch_results, *(extra_results or [])]

    seen: set[tuple[str, tuple[str, ...]]] = set()

    output: list[str] = [
        "[Adblock Plus 2.0]",
        f"! Title: {metadata.title}",
        f"! Description: {metadata.description}",
        f"! Last modified: {time.strftime('%d %b %Y %H:%M UTC', time.gmtime())}",
        f"! Expires: {metadata.expires}",
        f"! Homepage: {metadata.homepage}",
        f"! Source count: {stats.sources_ok} / {len(urls) + len(extra_results or [])}",
        "!",
    ]

    for res in all_results:
        if res.error:
            stats.sources_failed += 1
            _append_source_block(output, res, [], seen, stats)
            continue

        parsed_lines = parse_source(res)
        stats.sources_ok += 1
        _append_source_block(output, res, parsed_lines, seen, stats)

    output[6] = f"! Source count: {stats.sources_ok} / {len(urls) + len(extra_results or [])}"

    output.append(f"! Total unique rules: {stats.unique_rules}")
    output.append(f"! Duplicates removed: {stats.duplicates}")
    if stats.sources_failed:
        output.append(f"! Failed sources: {stats.sources_failed}")

    return output, stats


def validate_output(lines: list[str]) -> bool:
    depth = 0
    ok = True
    for i, line in enumerate(lines, 1):
        low = line.lower()
        if low.startswith("!#if ") or low.startswith("!#if\t"):
            depth += 1
        elif low.startswith("!#endif"):
            depth -= 1
            if depth < 0:
                log.error("Validation: unmatched !#endif at line %d", i)
                ok = False
                depth = 0
    if depth > 0:
        log.error("Validation: %d unclosed !#if block(s) at end of output", depth)
        ok = False
    if ok:
        log.info("Validation: all !#if / !#endif blocks are balanced ✓")
    return ok


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Build category manifests and category filter lists from filters.txt.",
    )
    p.add_argument("-i", "--input", type=Path, default=DEFAULT_INPUT,
                   help="Path to the file containing source URLs (default: filters.txt)")
    p.add_argument("--categories-dir", type=Path, default=DEFAULT_CATEGORY_DIR,
                   help="Directory where category manifests will be written")
    p.add_argument("--output-dir", type=Path, default=DEFAULT_CATEGORY_OUTPUT_DIR,
                   help="Directory where generated category filter lists will be written")
    p.add_argument("-j", "--jobs", type=int, default=DEFAULT_JOBS,
                   help="Number of concurrent download workers (default: 10)")
    p.add_argument("--skip-categorize", action="store_true",
                   help="Reuse existing category manifests and only rebuild category outputs")
    p.add_argument("-v", "--verbose", action="store_true",
                   help="Enable debug-level logging")
    p.add_argument("--dry-run", action="store_true",
                   help="Fetch and parse but do not write category output files")
    return p.parse_args()


def load_urls(path: Path) -> list[str]:
    return [
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]


def run_build(
    urls: list[str],
    output_path: Path,
    jobs: int,
    metadata: BuildMetadata | None = None,
    extra_rulesets: tuple[Path, ...] = DEFAULT_EXTRA_RULESETS,
    dry_run: bool = False,
) -> tuple[Stats, bool, list[FetchResult]]:
    metadata = metadata or BuildMetadata()

    log.info("Fetching with %d workers ...", jobs)
    t0 = time.monotonic()
    results = fetch_all(urls, jobs)
    elapsed = time.monotonic() - t0
    log.info("Fetching done in %.1fs", elapsed)

    extra_results = load_local_rulesets(extra_rulesets) if extra_rulesets else []
    if extra_results:
        log.info("Loaded %d local ruleset(s)", len(extra_results))

    log.info("Assembling ...")
    output_lines, stats = assemble(urls, results, extra_results, metadata=metadata)
    valid = validate_output(output_lines)

    total_sources = len(urls) + len(extra_rulesets)

    log.info("─" * 60)
    log.info("Sources OK:            %d / %d", stats.sources_ok, total_sources)
    if stats.sources_failed:
        log.warning("Sources FAILED:        %d", stats.sources_failed)
        for r in results:
            if r.error:
                log.warning("  ✗ %s — %s", r.url, r.error)
    log.info("Total rules seen:      %d", stats.total_rules)
    log.info("Unique rules kept:     %d", stats.unique_rules)
    log.info("Duplicates removed:    %d", stats.duplicates)
    if stats.empty_blocks_removed:
        log.info("Empty !#if blocks removed: %d", stats.empty_blocks_removed)
    log.info("─" * 60)

    if dry_run:
        log.info("Dry run — not writing output.")
    else:
        text = "\n".join(output_lines) + "\n"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(text, encoding="utf-8")
        size_mb = output_path.stat().st_size / (1024 * 1024)
        log.info("Wrote %s (%.1f MB, %d lines)",
                 output_path, size_mb, len(output_lines))

    return stats, valid, results


def main() -> None:
    args = parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(message)s",
    )
    commands: list[list[str]] = []

    if not args.skip_categorize:
        categorize_cmd = [
            sys.executable,
            str(SCRIPT_DIR / "categorize_filters.py"),
            "-i", str(args.input),
            "-o", str(args.categories_dir),
            "-j", str(args.jobs),
        ]
        if args.verbose:
            categorize_cmd.append("-v")
        commands.append(categorize_cmd)

    build_categories_cmd = [
        sys.executable,
        str(SCRIPT_DIR / "build_categories.py"),
        "-i", str(args.categories_dir),
        "-o", str(args.output_dir),
        "-j", str(args.jobs),
    ]
    if args.verbose:
        build_categories_cmd.append("-v")
    if args.dry_run:
        build_categories_cmd.append("--dry-run")
    commands.append(build_categories_cmd)

    for cmd in commands:
        log.info("Running: %s", " ".join(cmd))
        subprocess.run(cmd, check=True)


if __name__ == "__main__":
    main()
