# Modul: reports

Faza 2. Datum: 2026-11-06. Ruta `/reports`. Čita sačuvane preporuke. Ne generiše novu.

Odgovor na provjeru: tabela i proširenje mogu se ponovo složiti odavde. Stranica puca na prvom renderu jer `useTranslation` nije importovan, a `Card` i `Button` nisu definisani.

## 1. Svrha i tokovi

1. Korisnik vidi datum, preporučeni polaz, očekivano vrijeme grijanja i pouzdanost.
2. "Show details" otvara red sa `RecommendationBreakdown` ako snapshot postoji.
3. Ponovni klik zatvara. Drugi red zatvara prethodni (`expandedId` je jedan broj).

`generateReport()` je uklonjen iz klijenta (`api.ts` 539–540). Ne vraća se na ekran.

## 2. Struktura

`features/reports/pages/ReportsPage.tsx`, 120 linija. Breakdown je iz heating modula.

`useTranslation` se zove na liniji 11. Nema importa. `Card` (50) i `Button` (81) nisu importovani. ESLint to javlja za `Card` i `Button`.

## 3. Tok podataka

`GET /api/recommendations` preko `getReports`. Ključ `reports`. Ako tijelo nije niz, stanje je `[]` i upit je uspjeh (17–19).

`RecommendationResponseDto` ima `date`, `recommendedFlowTemp`, `expectedHeatTimeMin`, `confidenceScore`, opcioni `breakdown` (`recommendation-response.dto.ts` 71–99). `breakdown` je null za stare redove.

Nema mutacije. Redis nema. Klijent ne računa preporuku. Pouzdanost se množi sa 100 i zaokružuje (78), isto kao breakdown.

## 4. UI

Loading je spinner cijele stranice. `error` se samo loguje (23–25). Lista tada izgleda kao `reports.noData`. Nema retry.

Naslov i prazan tekst su `t('reports.*')`. Zaglavlja kolona Date, Flow Temp, Expected Heat Time, Confidence, Details su engleski literali (55–59).

Ako nema `breakdown`, dugme i dalje radi, `expanded` postane true, a drugi red se ne crta (91). Dugme kaže "Hide details" i ništa se ne otvori.

`id="content"` se poklapa sa shellom.

## 5. Pristupačnost

Dugme ima `aria-expanded`. Tabela nema caption. Datum je `toLocaleDateString()` bez eksplicitne locale. Breakdown, kad se otvori, nosi svoj caption. Taj blok danas puca (HE-02) prije prikaza.

## 6. Usko grlo

Jedan GET. Nema paginacije u fajlu. Broj redova nije izmjeren. N+1 nema.

## 7. Kvalitet

Nema `any`. Nema `useEffect`. Nema testa stranice. Tri nedostajuća simbola su dovoljna da ruta ne živi. `React.Fragment` se koristi, a `React` jeste importovan.

## 8. Rizici

- Ne dodavati generisanje. Klijentska metoda je namjerno obrisana.
- Ne računati polaz iz breakdowna. Prikaz je snapshot.
- `confidenceScore` se tretira kao udio 0–1 jer se množi sa 100. Ako neki stari red već bude 0–100, procenat će biti pogrešan. DTO ne opisuje raspon. To ostaje pretpostavka usklađena sa testom breakdowna (`0.72` → `72%`), ne sa posebnim assertom za reports.

## 9. Nalazi

| ID | Opis | Dokaz | Ozbiljnost | Uticaj | Trud |
|---|---|---|---|---|---|
| RE-01 | `useTranslation` nije importovan | linija 11 | kritično | Prvi render baca ReferenceError | S |
| RE-02 | `Card` i `Button` nisu importovani | linije 50, 81; ESLint | kritično | JSX nije definisan | S |
| RE-03 | Greška upita izgleda kao prazan izvještaj | 23–25, 104–109 | visoko | Nema retry | S |
| RE-04 | Detalji bez snapshot-a mijenjaju labelu i ne otvaraju ništa | 81–99 | srednje | Lažan toggle | S |
| RE-05 | Zaglavlja van `t()` | 55–59 | nisko | Q7 | S |
| RE-06 | Raspon `confidenceScore` nije zapisan u DTO | dto linija 85; stranica 78 | nisko | Prikaz procenta | S |

## 10. Prijedlog

Importovati `useTranslation`. `Card` i `Button` iz shadcn seta. `isError` koristi postojeći `reports` copy plus retry. Prazan niz ostaje `reports.noData`.

Dugme detalja je disabled ili skriveno kad `breakdown` nije tu. Otvoreni red i dalje zove isti breakdown, bez formule.

Zaglavlja kroz `t()`. Ne uvoditi generate.

## 11. Testovi

Nema testa stranice. Poslije HE-02, jedan test: red bez `breakdown` ne prikazuje breakdown tabelu i ne prelazi u "Hide details" bez sadržaja.

## 12. Otvoreno

RE-06 ostaje pretpostavka dok se ne vidi stvarni `confidence` u jednom odgovoru. Ne blokira redizajn ako se zadrži trenutno množenje.
