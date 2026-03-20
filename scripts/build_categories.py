from __future__ import annotations

import argparse
import logging
from pathlib import Path

from build import (
    BuildMetadata,
    DEFAULT_EXTRA_RULESETS,
    DEFAULT_JOBS,
    load_urls,
    run_build,
)

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT_DIR = ROOT / "categories"
DEFAULT_OUTPUT_DIR = ROOT / "filter"
DEFAULT_ALL_INPUT = ROOT / "filters.txt"
ALL_OUTPUT_NAME = "all.txt"

log = logging.getLogger("build-categories")


def category_title(category: str) -> str:
    label = category.replace("-", " ").title()
    return f"Complete Filters - {label}"


def category_description(category: str) -> str:
    return f"Combined filter list for the {category} category."


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build aggregated filter lists for every category manifest.",
    )
    parser.add_argument("-i", "--input-dir", type=Path, default=DEFAULT_INPUT_DIR,
                        help="Directory containing category manifest files")
    parser.add_argument("-o", "--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR,
                        help="Directory where generated category filter lists will be written")
    parser.add_argument("--all-input", type=Path, default=DEFAULT_ALL_INPUT,
                        help="Path to the master source list used to generate filter/all.txt")
    parser.add_argument("-j", "--jobs", type=int, default=DEFAULT_JOBS,
                        help="Number of concurrent download workers per category build")
    parser.add_argument("--dry-run", action="store_true",
                        help="Fetch and parse but do not write output files")
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="Enable debug-level logging")
    return parser.parse_args()


def iter_manifests(input_dir: Path) -> list[Path]:
    return sorted(
        path
        for path in input_dir.glob("*.txt")
        if not path.name.startswith("_")
    )


def cleanup_stale_outputs(output_dir: Path, expected_files: set[str], dry_run: bool) -> None:
    if not output_dir.exists():
        return

    for path in output_dir.glob("*.txt"):
        if path.name in expected_files:
            continue
        if dry_run:
            log.info("Dry run — would remove stale output %s", path.name)
            continue
        path.unlink()
        log.info("Removed stale output %s", path.name)


def main() -> None:
    args = parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(message)s",
    )

    manifests = iter_manifests(args.input_dir)
    if not manifests:
        raise SystemExit(f"No manifest files found in {args.input_dir}")

    expected_output_names = {manifest.name for manifest in manifests}
    expected_output_names.add(ALL_OUTPUT_NAME)
    cleanup_stale_outputs(args.output_dir, expected_output_names, args.dry_run)

    failures = 0
    for manifest in manifests:
        category = manifest.stem
        urls = load_urls(manifest)
        output_path = args.output_dir / manifest.name
        if not urls:
            if output_path.exists():
                if args.dry_run:
                    log.info("Dry run — would remove empty category output %s", output_path.name)
                else:
                    output_path.unlink()
                    log.info("Removed empty category output %s", output_path.name)
            else:
                log.info("Skipping %s (no source URLs)", manifest.name)
            continue

        metadata = BuildMetadata(
            title=category_title(category),
            description=category_description(category),
            homepage="https://github.com/rokartur/complete-filters",
        )

        log.info("=" * 60)
        log.info("Building category %s from %s (%d sources)", category, manifest.name, len(urls))
        stats, valid, _ = run_build(
            urls=urls,
            output_path=output_path,
            jobs=args.jobs,
            metadata=metadata,
            extra_rulesets=DEFAULT_EXTRA_RULESETS,
            dry_run=args.dry_run,
        )
        if stats.sources_failed or not valid:
            failures += 1

    all_output_path = args.output_dir / ALL_OUTPUT_NAME
    all_urls = load_urls(args.all_input)
    if not all_urls:
        if all_output_path.exists():
            if args.dry_run:
                log.info("Dry run — would remove empty aggregate output %s", all_output_path.name)
            else:
                all_output_path.unlink()
                log.info("Removed empty aggregate output %s", all_output_path.name)
        else:
            log.info("Skipping %s (no source URLs)", ALL_OUTPUT_NAME)
    else:
        log.info("=" * 60)
        log.info("Building aggregate list %s from %s (%d sources)",
                 ALL_OUTPUT_NAME, args.all_input.name, len(all_urls))
        stats, valid, _ = run_build(
            urls=all_urls,
            output_path=all_output_path,
            jobs=args.jobs,
            metadata=BuildMetadata(
                title="Complete Filters",
                description="Combined filter list from all configured sources.",
                homepage="https://github.com/rokartur/complete-filters",
            ),
            extra_rulesets=DEFAULT_EXTRA_RULESETS,
            dry_run=args.dry_run,
        )
        if stats.sources_failed or not valid:
            failures += 1

    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
