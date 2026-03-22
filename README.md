# Complete Filters

Aggressive category-based filter lists for ad blockers.

## TL;DR

- combines multiple public filter lists into category-specific outputs,
- blocks ads, trackers, cookie banners, popups, anti-adblock, malware/phishing domains, and other unwanted web elements,
- to add filters, go to the [Available categories](#available-categories) section,
- the lists are intentionally aggressive, so some sites may partially break,
- if that happens, please report it [here](https://github.com/rokartur/complete-filters/issues/new/choose).

## What this project does

Complete Filters is an aggregator of public upstream filter sources. The project:

- merges multiple community-maintained filter lists,
- groups them into practical categories,
- removes duplicate rules within each generated category,
- adds local compatibility and manual rules where needed.

The repository is meant to provide ready-to-use category lists so you can subscribe only to the parts that fit your setup.

## Important: these are aggressive filters

> Complete Filters prioritizes blocking effectiveness over maximum compatibility.
> In practice, that means some websites, embedded widgets, sign-in flows, consent dialogs, or app-like interfaces may stop working correctly.

If something breaks:

- check whether the problem disappears after disabling the relevant list,
- verify that it has not already been reported,
- open a report in [Issues](https://github.com/rokartur/complete-filters/issues/new/choose).

## Available categories

Each file in [`filter/`](./filter/) is a separate generated list.

| Category | Purpose | Subscribe |
| --- | --- | --- |
| `ads` | General advertising and ad delivery domains | [Add to adblock](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/rokartur/complete-filters/refs/heads/main/filter/ads.txt&title=Complete%20Filters%20-%20Ads) |
| `annoyances` | Popups, overlays, newsletter nags, fake urgency, and other annoyances | [Add to adblock](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/rokartur/complete-filters/refs/heads/main/filter/annoyances.txt&title=Complete%20Filters%20-%20Annoyances) |
| `anti-adblock` | Anti-adblock scripts and related countermeasures | [Add to adblock](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/rokartur/complete-filters/refs/heads/main/filter/anti-adblock.txt&title=Complete%20Filters%20-%20Anti-Adblock) |
| `brave` | Rules and compatibility adjustments tailored for Brave Browser filtering | [Add to adblock](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/rokartur/complete-filters/refs/heads/main/filter/brave.txt&title=Complete%20Filters%20-%20Brave) |
| `compatibility` | Compatibility fixes and exceptions to reduce breakage | [Add to adblock](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/rokartur/complete-filters/refs/heads/main/filter/compatibility.txt&title=Complete%20Filters%20-%20Compatibility) |
| `content` | Content-specific clutter, sponsored sections, placeholders, or low-value page junk | [Add to adblock](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/rokartur/complete-filters/refs/heads/main/filter/content.txt&title=Complete%20Filters%20-%20Content) |
| `cookies` | Cookie banners and consent frameworks | [Add to adblock](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/rokartur/complete-filters/refs/heads/main/filter/cookies.txt&title=Complete%20Filters%20-%20Cookies) |
| `hagezi` | Dedicated HaGeZi upstream blocklists, separated into their own subscription | [Add to adblock](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/rokartur/complete-filters/refs/heads/main/filter/hagezi.txt&title=Complete%20Filters%20-%20HaGeZi) |
| `malware` | Malware, phishing, scam, and otherwise high-risk domains | [Add to adblock](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/rokartur/complete-filters/refs/heads/main/filter/malware.txt&title=Complete%20Filters%20-%20Malware) |
| `mixed` | Rules that do not fit neatly into a single narrow category | [Add to adblock](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/rokartur/complete-filters/refs/heads/main/filter/mixed.txt&title=Complete%20Filters%20-%20Mixed) |
| `mobile` | Mobile-specific nuisances and mobile web clutter | [Add to adblock](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/rokartur/complete-filters/refs/heads/main/filter/mobile.txt&title=Complete%20Filters%20-%20Mobile) |
| `polish` | Polish-language and Poland-specific ad, annoyance, and tracking rules | [Add to adblock](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/rokartur/complete-filters/refs/heads/main/filter/polish.txt&title=Complete%20Filters%20-%20Polish) |
| `privacy` | Tracking, analytics, fingerprinting, and privacy-invasive requests | [Add to adblock](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/rokartur/complete-filters/refs/heads/main/filter/privacy.txt&title=Complete%20Filters%20-%20Privacy) |
| `regional` | Poland-focused or region-specific rules | [Add to adblock](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/rokartur/complete-filters/refs/heads/main/filter/regional.txt&title=Complete%20Filters%20-%20Regional) |
| `social` | Social widgets, embedded platforms, and social tracking | [Add to adblock](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/rokartur/complete-filters/refs/heads/main/filter/social.txt&title=Complete%20Filters%20-%20Social) |
| `video` | Video ads and video-platform nuisances | [Add to adblock](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/rokartur/complete-filters/refs/heads/main/filter/video.txt&title=Complete%20Filters%20-%20Video) |

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

The canonical upstream URL manifests live in [`categories/`](./categories/). Each `filter/<category>.txt` output is generated from the matching `categories/<category>.txt` manifest and then merged with local compatibility/block overrides from [`manual-rules/`](./manual-rules/).

Local repo-maintained overlays currently added during builds include:

- [`manual-rules/website-compatibility-allowlist.txt`](./manual-rules/website-compatibility-allowlist.txt)
- [`manual-rules/popular-sites-document-allowlist.txt`](./manual-rules/popular-sites-document-allowlist.txt)
- [`manual-rules/developer-infrastructure-allowlist.txt`](./manual-rules/developer-infrastructure-allowlist.txt)
- [`manual-rules/manual-blocklist.txt`](./manual-rules/manual-blocklist.txt)
- [`manual-rules/anti-adblock-dns-compat.txt`](./manual-rules/anti-adblock-dns-compat.txt) for the `anti-adblock` category only

Category source overview:

- `ads` ([manifest](./categories/ads.txt)): primarily built from [EasyList](https://easylist.to/), [AdGuard Base / Filters Registry](https://github.com/AdguardTeam/FiltersRegistry), [uBlock Origin / uAssets](https://github.com/uBlockOrigin/uAssets), [Brave adblock-lists](https://github.com/brave/adblock-lists), and multiple regional ad lists such as [ABPindo](https://github.com/ABPindo/indonesianadblockrules), [MajkiIT / polish-ads-filter](https://github.com/MajkiIT/polish-ads-filter), [cjxlist](https://github.com/cjx82630/cjxlist), EasyList Thailand, EasyList Brasil, EasyList Czech and Slovak, Finnish EasyList Addition, DandelionSprout, and AnXh3L0 regional additions.
- `annoyances` ([manifest](./categories/annoyances.txt)): combines [Fanboy Annoyances](https://secure.fanboy.co.nz/), [AdGuard Annoyances / Filters Registry](https://github.com/AdguardTeam/FiltersRegistry), [uBlock Origin / uAssets](https://github.com/uBlockOrigin/uAssets), [FiltersHeroes / PolishAnnoyanceFilters](https://github.com/FiltersHeroes/PolishAnnoyanceFilters), [FiltersHeroes / PolishAntiAnnoyingSpecialSupplement](https://github.com/FiltersHeroes/PolishAntiAnnoyingSpecialSupplement), [adblockpolska / Adblock_PL_List](https://github.com/adblockpolska/Adblock_PL_List), [DandelionSprout / adfilt](https://github.com/DandelionSprout/adfilt), [MasterKia / PersianBlocker](https://github.com/MasterKia/PersianBlocker), [bcye / Hello-Goodbye](https://github.com/bcye/Hello-Goodbye), Frellwit's Swedish list, Finnish EasyList Addition, cjxlist annoyance rules, and rolist2.
- `anti-adblock` ([manifest](./categories/anti-adblock.txt)): merges [EasyList Anti-Adblock](https://easylist-downloads.adblockplus.org/antiadblockfilters.txt), [AdCrunchSoftware / Filters](https://github.com/AdCrunchSoftware/Filters), [AdGuard SDNS exceptions](https://github.com/AdguardTeam/AdGuardSDNSFilter), [deletescape / noads](https://github.com/deletescape/noads), [hant0508 / uBlock-filters](https://github.com/hant0508/uBlock-filters), [olegwukr / polish-privacy-filters](https://github.com/olegwukr/polish-privacy-filters), [reek / anti-adblock-killer](https://github.com/reek/anti-adblock-killer), and [uBlock Origin / uAssets badlists](https://github.com/uBlockOrigin/uAssets). This category also receives the local DNS compatibility patch from `manual-rules/anti-adblock-dns-compat.txt`.
- `brave` ([manifest](./categories/brave.txt)): dedicated Brave-oriented sources from [brave/adblock-lists](https://github.com/brave/adblock-lists) (`brave-specific`, `brave-social`, `brave-android-specific`, `brave-sugarcoat`, `brave-firstparty`, `brave-firstparty-regional`, `brave-cookie-specific`, `brave-twitch`) plus HaGeZi's `tif` hosts list.
- `compatibility` ([manifest](./categories/compatibility.txt)): built from [AdGuard Useful / unbreak sources](https://github.com/AdguardTeam/FiltersRegistry), [uBlock Origin / uAssets quick-fixes and unbreak](https://github.com/uBlockOrigin/uAssets), [brave/adblock-lists](https://github.com/brave/adblock-lists) unbreak/sugarcoat resources, [DandelionSprout / FalukorvList](https://github.com/DandelionSprout/adfilt), [Yuki2718 / adblock2](https://github.com/Yuki2718/adblock2), [deathbybandaid / piholeparser](https://github.com/deathbybandaid/piholeparser), [deletescape / noads](https://github.com/deletescape/noads), and [thedoggybrad / Frame-Blocker-Filter](https://github.com/thedoggybrad/Frame-Blocker-Filter).
- `content` (`filter/content.txt`): this output currently exists in [`filter/content.txt`](./filter/content.txt), but there is no longer a matching `categories/content.txt` manifest. The current generated file shows sources from AdGuard Hostlists Registry content-oriented assets (`filter_47`, `filter_57`), [arapurayil / aBL NSFW](https://github.com/arapurayil/aBL), plus the local repo-maintained overlays from [`manual-rules/`](./manual-rules/).
- `cookies` ([manifest](./categories/cookies.txt)): built from [uBlock Origin / uAssets cookies annoyances](https://github.com/uBlockOrigin/uAssets), [AdGuard Cookies / Filters Registry](https://github.com/AdguardTeam/FiltersRegistry), [Fanboy Cookiemonster](https://secure.fanboy.co.nz/), [I don't care about cookies](https://www.i-dont-care-about-cookies.eu/), [EFF cookieblocklist](https://www.eff.org/), [MajkiIT / polish-ads-filter cookie lists](https://github.com/MajkiIT/polish-ads-filter), [brave/adblock-lists](https://github.com/brave/adblock-lists), Thai Ads Filter, Ukrainian Filters, Adblock Colombia, DandelionSprout, AdditionalFiltersCN, [Rudloff / adblock-imokwithcookies](https://github.com/Rudloff/adblock-imokwithcookies), [r4vi / block-the-eu-cookie-shit-list](https://github.com/r4vi/block-the-eu-cookie-shit-list), [liamja / Prebake](https://github.com/liamja/Prebake), and [the-advoid / AdVoid](https://github.com/the-advoid/ad-void).
- `hagezi` ([manifest](./categories/hagezi.txt)): a dedicated opt-in bundle of [HaGeZi DNS blocklists](https://github.com/hagezi/dns-blocklists), including `tif`, `fake`, `spam-tlds`, `popupads`, `multi`, `pro.plus`, and multiple `native.*` lists, plus the matching AdGuard Hostlists Registry mirror entry.
- `malware` ([manifest](./categories/malware.txt)): built from anti-malware, phishing, scam, and abuse lists such as [DandelionSprout Anti-Malware List](https://github.com/DandelionSprout/adfilt), [uBlock Origin / uAssets badware and resource-abuse](https://github.com/uBlockOrigin/uAssets), [malware-filter](https://gitlab.com/malware-filter/malware-filter), [Phishing Army](https://phishing.army/), [CERT Polska / hole.cert.pl](https://hole.cert.pl/), [Scam-Blocklist](https://github.com/jarelllama/Scam-Blocklist), [durablenapkin / scamblocklist](https://github.com/durablenapkin/scamblocklist), [mitchellkrogza / Phishing.Database](https://github.com/mitchellkrogza/Phishing.Database), [Spam404 lists](https://github.com/Spam404/lists), [phishdestroy / destroylist](https://github.com/phishdestroy/destroylist), [blocklistproject](https://github.com/blocklistproject/Lists), [ShadowWhisperer / BlockLists](https://github.com/ShadowWhisperer/BlockLists), [quidsup / notrack-blocklists](https://gitlab.com/quidsup/notrack-blocklists), [stamparm / aux maltrail](https://github.com/stamparm/aux), [hoshsadiq / adblock-nocoin-list](https://github.com/hoshsadiq/adblock-nocoin-list), [braveinnovators / ukrainian-security-filter](https://github.com/braveinnovators/ukrainian-security-filter), [fanboy fake-news](https://github.com/ryanbr/fanboy-adblock), [AntiTLDAbuserFilterlist](https://github.com/thedoggybrad/AntiTLDAbuserFilterlist), [iam-py-test / my_filters_001](https://github.com/iam-py-test/my_filters_001), and [FiltersHeroes / KAD](https://github.com/FiltersHeroes/KAD).
- `mixed` ([manifest](./categories/mixed.txt)): intentionally broad “catch-all” sources such as [OISD](https://oisd.nl/), [AdGuard SDNS Filter](https://github.com/AdguardTeam/AdGuardSDNSFilter), [Peter Lowe / yoyo.org](https://pgl.yoyo.org/), [GoodbyeAds](https://github.com/jerryn70/GoodbyeAds), [StevenBlack / hosts](https://github.com/StevenBlack/hosts), and [someonewhocares.org hosts](https://someonewhocares.org/hosts/).
- `mobile` ([manifest](./categories/mobile.txt)): mobile-focused sources including [ABPVN](https://abpvn.com/), [AdGuard mobile filters / Hostlists Registry](https://github.com/AdguardTeam/FiltersRegistry), [BlackJack8 / iOSAdblockList](https://github.com/BlackJack8/iOSAdblockList), [YanFung / Ads](https://github.com/YanFung/Ads), [autinerd / anti-axelspringer-hosts](https://github.com/autinerd/anti-axelspringer-hosts), [brave/adblock-lists](https://github.com/brave/adblock-lists) Android/iOS lists, [furkun / AndroidSecurityHosts](https://github.com/furkun/AndroidSecurityHosts), and Fanboy mobile notifications.
- `polish` ([manifest](./categories/polish.txt)): aggregates Poland-focused sources including [CERT Polska / hole.cert.pl](https://hole.cert.pl/), [FiltersHeroes / KAD](https://github.com/FiltersHeroes/KAD), [FiltersHeroes / PolishAnnoyanceFilters](https://github.com/FiltersHeroes/PolishAnnoyanceFilters), [FiltersHeroes / PolishAntiAnnoyingSpecialSupplement](https://github.com/FiltersHeroes/PolishAntiAnnoyingSpecialSupplement), [MajkiIT / polish-ads-filter](https://github.com/MajkiIT/polish-ads-filter), [olegwukr / polish-privacy-filters](https://github.com/olegwukr/polish-privacy-filters), [CrusheerPL / AlleBlockV2](https://github.com/CrusheerPL/AlleBlockV2), and [EasyList Polish](https://easylist-downloads.adblockplus.org/easylistpolish.txt).
- `privacy` ([manifest](./categories/privacy.txt)): primarily sourced from [EasyPrivacy](https://easylist.to/), [uBlock Origin / uAssets privacy lists](https://github.com/uBlockOrigin/uAssets), [AdGuard Spyware / Tracking Parameter / CNAME trackers](https://github.com/AdguardTeam/FiltersRegistry), AdGuard Hostlists Registry privacy assets, [DandelionSprout / ClearURLs for uBo](https://github.com/DandelionSprout/adfilt), [blocklistproject tracking](https://github.com/blocklistproject/Lists), [notracking](https://github.com/notracking/hosts-blocklists), [Frogeye hostfiles](https://hostfiles.frogeye.fr/), [Disconnect tracking list](https://disconnect.me/), [quidsup / notrack-blocklists](https://gitlab.com/quidsup/notrack-blocklists), [DeveloperDan hosts](https://www.github.developerdan.com/hosts/), [DRSDavidSoft / additional-hosts](https://github.com/DRSDavidSoft/additional-hosts), [Perflyst / PiHoleBlocklist](https://github.com/Perflyst/PiHoleBlocklist), [ShadowWhisperer / BlockLists](https://github.com/ShadowWhisperer/BlockLists), and [olegwukr / polish-privacy-filters](https://github.com/olegwukr/polish-privacy-filters).
- `regional` ([manifest](./categories/regional.txt)): a language/region bucket built from [AdGuard regional filters / Hostlists Registry](https://github.com/AdguardTeam/FiltersRegistry), [EasyList regional lists](https://easylist.to/), [EasyDutch](https://easydutch-ubo.github.io/EasyDutch/), [EasyList Lithuania](https://github.com/EasyList-Lithuania/easylist_lithuania), Fanboy Español and Turkish, DandelionSprout's Nordic set, [MajkiIT / polish-ads-filter AdGuard variant](https://github.com/MajkiIT/polish-ads-filter), [ukrainianfilters](https://github.com/ukrainianfilters/lists), [JohnyP36 / Dutch-Filter-List](https://github.com/JohnyP36/Personal-List), [ROad-Block](https://github.com/tcptomato/ROad-Block), Macedonian community lists, [void.gr Greek filters](https://www.void.gr/kargig/void-gr-filters.txt), [HUFilter](https://filters.hufilter.hu/hufilter.txt), and [TurkishAdblockList](https://gitlab.com/huzunluartemis/TurkishAdblockList).
- `social` ([manifest](./categories/social.txt)): built from [Fanboy Social Blocking List](https://secure.fanboy.co.nz/), [AdGuard Social / Filters Registry](https://github.com/AdguardTeam/FiltersRegistry), [DandelionSprout / KnowYourMemePureBrowsingExperience](https://github.com/DandelionSprout/adfilt), and [MajkiIT / polish-ads-filter social lists](https://github.com/MajkiIT/polish-ads-filter).
- `video` ([manifest](./categories/video.txt)): focused on video-platform cleanup using [kbinani / adblock-youtube-ads](https://github.com/kbinani/adblock-youtube-ads), [eEIi0A5L / adblock_filter](https://github.com/eEIi0A5L/adblock_filter), [lilydjwg / abp-rules](https://github.com/lilydjwg/abp-rules), [brave/adblock-lists brave-twitch](https://github.com/brave/adblock-lists), and DandelionSprout's Twitch/anti-Elsagate lists.

The full raw upstream URL list is intentionally kept in the category manifests rather than duplicated in the README. Before redistributing generated outputs, review the licenses and attribution requirements of the relevant upstream projects.

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
