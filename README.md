# Complete Filters

Aggressive category-based filter lists for ad blockers.

## TL;DR

- combines multiple public filter lists into category-specific outputs,
- blocks ads, trackers, cookie banners, popups, anti-adblock, malware/phishing domains, and other unwanted web elements,
- generated lists are available in [`filter/`](./filter/),
- easiest installation: <https://rokartur.github.io/complete-filters/>,
- you can also subscribe manually via raw GitHub URLs, for example:

  ```txt
  https://raw.githubusercontent.com/rokartur/complete-filters/main/filter/malware.txt
  ```

- the lists are intentionally aggressive, so some sites may partially break,
- if that happens, please report it here: <https://github.com/rokartur/complete-filters/issues/new/choose>

## What this project does

Complete Filters is an aggregator of public upstream filter sources. The project:

- merges multiple community-maintained filter lists,
- groups them into practical categories,
- removes duplicate rules within each generated category,
- adds local compatibility and manual rules where needed.

The repository is meant to provide ready-to-use category lists instead of a single monolithic file, so you can subscribe only to the parts that fit your setup.

## Important: these are aggressive filters

> Complete Filters prioritizes blocking effectiveness over maximum compatibility.
> In practice, that means some websites, embedded widgets, sign-in flows, consent dialogs, or app-like interfaces may stop working correctly.

If something breaks:

- check whether the problem disappears after disabling the relevant list,
- verify that it has not already been reported,
- open a report in [Issues](https://github.com/rokartur/complete-filters/issues/new/choose).

## Available categories

Each file in [`filter/`](./filter/) is a separate generated list.

| Category | Purpose |
| --- | --- |
| `ads` | General advertising and ad delivery domains |
| `annoyances` | Popups, overlays, newsletter nags, fake urgency, and other annoyances |
| `anti-adblock` | Anti-adblock scripts and related countermeasures |
| `compatibility` | Compatibility fixes and exceptions to reduce breakage |
| `content` | Content-specific clutter, sponsored sections, placeholders, or low-value page junk |
| `cookies` | Cookie banners and consent frameworks |
| `malware` | Malware, phishing, scam, and otherwise high-risk domains |
| `mixed` | Rules that do not fit neatly into a single narrow category |
| `mobile` | Mobile-specific nuisances and mobile web clutter |
| `privacy` | Tracking, analytics, fingerprinting, and privacy-invasive requests |
| `regional` | Poland-focused or region-specific rules |
| `social` | Social widgets, embedded platforms, and social tracking |
| `video` | Video ads and video-platform nuisances |

## Installation

### Recommended option

Use the project site:

- <https://rokartur.github.io/complete-filters/>

This is the easiest way to browse the ready-made categories and access the hosted resources.

### Manual subscription by URL

You can subscribe to any generated category directly through its raw GitHub URL:

```txt
https://raw.githubusercontent.com/rokartur/complete-filters/main/filter/<category>.txt
```

Example:

```txt
https://raw.githubusercontent.com/rokartur/complete-filters/main/filter/ads.txt
```

### Manual installation steps

1. Open your ad blocker settings.
2. Go to the **Custom filters** / **Filter lists** / **User-defined lists** section.
3. Add the URL of the category you want to use.
4. Save the changes and refresh the filter lists.

## Supported blockers

The generated lists should work with most tools compatible with Adblock-style syntax, especially:

- **uBlock Origin**,
- **AdGuard**,
- **AdBlock**,
- **Adblock Plus**,
- **Brave Browser** (built-in filtering),
- and other blockers that support Adblock-compatible filter lists.

## Use with extra care

Be especially careful when using these filters in system-wide or DNS-level environments, for example:

- **AdGuard DNS**,
- **AdGuard Desktop**,
- other tools that filter all traffic for the whole device or system.

This repository also includes explicit compatibility exceptions for developer infrastructure to reduce the risk of breaking system tools and CLI workflows.

## Sources and attribution

This project is an aggregator. It uses publicly available filter lists maintained by the adblock community and respects the rights and licenses of their original authors.

The full source list is available in [`filters.txt`](./filters.txt).

Some notable upstream sources used by the project include:

- [MajkiIT / ads-filter](https://github.com/MajkiIT/ads-filter)
- [FiltersHeroes / PolishAnnoyanceFilters](https://github.com/FiltersHeroes/PolishAnnoyanceFilters)
- [FiltersHeroes / KAD](https://github.com/FiltersHeroes/KAD)
- [uBlockOrigin / uAssets](https://github.com/uBlockOrigin/uAssets)
- [AdGuard filters](https://github.com/AdguardTeam/AdguardFilters)
- [HaGeZi DNS blocklists](https://github.com/hagezi/dns-blocklists)

## What to report

Issues are especially useful for:

- sites or page elements that stop working after enabling a list,
- false positives,
- ads or trackers that are still not blocked,
- missing compatibility exceptions,
- new sources or rules worth adding.

## License

This repository acts as an aggregator of filter lists.

- the repository code and documentation are covered by the license described in [`LICENSE`](./LICENSE),
- upstream lists and other imported rule content remain under the licenses chosen by their original authors,
- before redistributing generated outputs, review the licensing terms of the relevant upstream sources.
