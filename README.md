# Polish Complete Filters

Kompletna, agresywna lista filtrów dla polskiego internetu, zbudowana jako agregat wielu publicznych źródeł dla adblockerów.

## TL;DR

- to jedna zbiorcza lista filtrów dla polskiego internetu,
- działa agresywnie, więc czasem może psuć elementy stron,
- dodasz ją przez: <https://rokartur.github.io/polish-complete-filters/>,
- bezpośredni URL listy: `https://raw.githubusercontent.com/rokartur/polish-complete-filters/main/polish-complete-filters.txt`,

- jeśli coś przestaje działać, zgłoś problem: <https://github.com/rokartur/polish-complete-filters/issues/new/choose>

## Najważniejsze informacje

- blokuje reklamy, tracking, popupy i inne irytujące elementy stron,
- łączy wiele publicznych list w jeden zestaw reguł,
- usuwa duplikaty i scala reguły do jednego pliku,
- jest przeznaczona głównie dla polskich użytkowników internetu.

## Uwaga: to są bardzo agresywne filtry

> Ta lista została przygotowana z naciskiem na maksymalną skuteczność blokowania.
> W praktyce oznacza to, że niektóre strony albo ich elementy mogą działać niepoprawnie.

Jeśli zauważysz problem:

- sprawdź, czy znika po wyłączeniu listy,
- upewnij się, że nie został już zgłoszony,
- zgłoś błąd tutaj: [Issues](https://github.com/rokartur/polish-complete-filters/issues/new/choose).

## Szybka instalacja

Najprostsza opcja:

- wejdź na stronę projektu: <https://rokartur.github.io/polish-complete-filters/>

Możesz też dodać listę ręcznie przez URL:

```txt
https://raw.githubusercontent.com/rokartur/polish-complete-filters/main/polish-complete-filters.txt
```

## Instalacja ręczna

1. Otwórz ustawienia swojego adblockera.
2. Przejdź do sekcji typu **Własne filtry** / **Custom filters**.
3. Dodaj adres listy:

   ```txt
   https://raw.githubusercontent.com/rokartur/polish-complete-filters/main/polish-complete-filters.txt
   ```

4. Zapisz zmiany i odśwież listy filtrów.

## Obsługiwane adblocki

Lista powinna działać z większością narzędzi kompatybilnych ze składnią Adblock, w szczególności:

- **uBlock Origin**,
- **AdGuard**,
- **AdBlock**,
- **Adblock Plus**,
- **Brave Browser** (wbudowane filtrowanie),
- innymi rozwiązaniami zgodnymi z listami filtrów Adblock.

## Kiedy używać ostrożnie

Szczególną ostrożność warto zachować przy filtrowaniu na poziomie systemowym lub DNS, np. w konfiguracjach takich jak:

- **AdGuard DNS**,
- **AdGuard Desktop**,
- inne rozwiązania filtrujące cały ruch systemowy.

Repozytorium zawiera kilka jawnych wyjątków kompatybilności dla infrastruktury developerskiej, żeby ograniczyć ryzyko psucia narzędzi systemowych i CLI — między innymi dla GitHub, GitLab, Bitbucket, popularnych rejestrów pakietów, rejestrów kontenerów, marketplace'ów rozszerzeń oraz wybranych platform deploymentowych i narzędzi takich jak HashiCorp / Terraform, Cloudflare, Vercel, Netlify i Supabase.

## Cel projektu

Celem projektu jest utrzymywanie jednej możliwie kompletnej listy filtrów dla polskiego internetu, która:

- agreguje istniejące źródła,
- usuwa duplikaty reguł,
- poprawia skuteczność blokowania,
- upraszcza instalację dla użytkownika końcowego.

## Jak działa generator

Skrypt `build.py`:

1. pobiera listy z adresów zapisanych w `filters.txt`,
2. ładuje lokalne reguły dodatkowe z `manual-rules/`,
3. normalizuje i porządkuje reguły,
4. usuwa duplikaty,
5. zapisuje wynik do `polish-complete-filters.txt`.

## Źródła filtrów i attribution

Projekt jest agregatorem. Korzysta z publicznie dostępnych list społeczności adblock i zachowuje prawa oraz licencje ich autorów.

Pełną listę źródeł znajdziesz w pliku [`filters.txt`](./filters.txt).

Przykładowe ważne źródła wykorzystywane w projekcie:

- [MajkiIT / polish-ads-filter](https://github.com/MajkiIT/polish-ads-filter)
- [FiltersHeroes / PolishAnnoyanceFilters](https://github.com/FiltersHeroes/PolishAnnoyanceFilters)
- [FiltersHeroes / KAD](https://github.com/FiltersHeroes/KAD)
- [uBlockOrigin / uAssets](https://github.com/uBlockOrigin/uAssets)
- [AdGuard filters](https://github.com/AdguardTeam/AdguardFilters)
- [HaGeZi DNS blocklists](https://github.com/hagezi/dns-blocklists)

## Zgłaszanie problemów

Warto zgłaszać przede wszystkim:

- strony, które przestają działać po włączeniu listy,
- fałszywe blokady,
- niewyłapane reklamy lub trackery,
- propozycje wyjątków kompatybilności,
- nowe źródła lub reguły warte dodania.

Zgłoszenia można tworzyć tutaj:

- <https://github.com/rokartur/polish-complete-filters/issues/new/choose>

## Współtworzenie projektu

Każdy może pomóc w rozwoju projektu.

Najprostszy workflow:

1. zrób fork repozytorium,
2. dodaj lub popraw reguły,
3. uruchom generator lokalnie,
4. sprawdź wynik,
5. otwórz Pull Request.

## Licencja

Ten projekt działa jako agregator filtrów.

- kod i dokumentacja repozytorium są objęte licencją opisaną w pliku [`LICENSE`](./LICENSE),
- poszczególne listy źródłowe i treści upstreamowe pozostają na licencjach swoich autorów,
- przed dalszą redystrybucją warto sprawdzić warunki licencyjne upstreamów.
