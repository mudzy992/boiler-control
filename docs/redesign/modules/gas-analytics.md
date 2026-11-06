# Modul: gas-analytics

Faza 2. Datum: 2026-11-06. Ruta `/gas/analytics`. Dijeli hook sa očitanjima.

Odgovor na provjeru: ekran se može ponovo složiti odavde. Ne može se renderovati dok `Card` nije importovan, a `Button` je antd komponenta sa propovima lokalnog dugmeta.

## 1. Svrha i tokovi

1. Podrazumijevano: analiza od referentnog očitanja do sada. Dugme "reference" ne šalje `from`/`to`.
2. 7d, 14d, 30d, 90d, 1y šalju `from` i `to` kao `YYYY-MM-DD`, kraj je danas.
3. Ako ima očitanja, prikazuju se potrošnja, sati grijanja, prosječan polaz, m³/h, cijene, prozori cijene, efikasnost i 5 zadnjih očitanja.
4. Ako lista očitanja bude prazna, metrike se ne crtaju. Korisnik ostaje na praznom stanju.

## 2. Struktura

`features/gas/pages/GasAnalyticsPage.tsx`, 290 linija. Upit je `useGasAnalysisQuery` i `useGasReadingsQuery` u `useGasQueries.ts`.

`Card` se koristi od linije 42 i nije importovan. ESLint: `Card is not defined`.

`Button` je iz `antd` (linija 5), a dobija `variant` i `size="sm"` (linije 77–78). Lokalno dugme ima te propove. Antd `size` je `small` | `middle` | `large`.

## 3. Tok podataka

`GET /api/gas/analysis` sa ili bez `from`/`to` (`api.ts` 505–514).

Ključ je `gas-analysis` plus `default-range` ili `${from}-${to}` (`useGasQueries.ts` 34–37). Stale 5 min.

`queryFn` hvata grešku, loguje je i vraća `{}` (linije 39–46). React Query to vidi kao uspjeh. `error` na stranici (linija 40) za pad mreže ostaje prazan. Grana 40–46 se tada ne izvršava.

Nedostajuća polja postaju 0 preko `?? 0` (137–160). Neuspjeh i nulta potrošnja izgledaju isto.

Očitanja dijele ključ `gasReadings`. Ako tijelo nije niz, hook vraća `[]` i to je uspjeh.

Redis nema. Nema mutacije. Cijena se ne računa na klijentu.

## 4. UI

Loading je spinner ispod zaglavlja. Period i info kartica se crtaju i tokom učitavanja.

Prazno stanje gleda `readings.length`, ne analizu. Tekst je `t('gas.noReadingsYet')`. Nema dugmeta ka unosu. Unos je na drugoj ruti.

Pet zadnjih: isti smjer kao kartica očitanja. `previousReading` je noviji susjed. Razlika je `novije − ovo`. Na liniji 271 ispred broja stoji fiksni `+`. Negativna razlika postaje `+-1.00`.

`hours` i `m³/hour` su van `t()`. Datumi u listi su `MMM DD`. Prozor je `DD.MM.YYYY`.

`id="content"` se poklapa sa shellom.

## 5. Pristupačnost

Period ima `<label>`, ali nije vezan za grupu (`htmlFor` ne postoji). Dugmad nisu `aria-pressed`.

Tabela cijena nema caption. Efikasnost ima tekst labele. Znak `✓` / `?` je dodatak.

Greška, kad bi se prikazala, nema retry.

## 6. Usko grlo

Dva GET-a. Nema velike liste osim što se sva očitanja povuku da bi se prikazalo pet. To je cijeli `gasReadings` keš, isti kao na drugoj stranici. Nije poseban N+1.

`priceBreakdown.map((row: any)` (180).

## 7. Kvalitet

`any` na redu cijene. Nema testa stranice. Greška se guta u hooku, pa stranica ne može razlikovati stanja. `Button` iz antd-a je suprotan odluci Q1 i ne odgovara pozivu.

## 8. Rizici

- Referentni režim bez query parametara je ugovor. Slanje današnjeg datuma umjesto toga mijenja `period.mode`.
- Nule moraju ostati nule kad je odgovor stvarno nula. `{}` poslije greške ne smije i dalje prolaziti kao nula.
- Formula pet redova je ista kao na očitanjima. Okretanje susjeda mijenja predznak.
- Invalidacija `gasAnalysisRoot` sa stranice očitanja mora i dalje pokriti sve `gas-analysis` ključeve. TanStack prefix to radi za ključ koji počinje sa `['gas-analysis']` (`queryKeys.gasAnalysisRoot`).

## 9. Nalazi

| ID | Opis | Dokaz | Ozbiljnost | Uticaj | Trud |
|---|---|---|---|---|---|
| GA-01 | `Card` nije importovan | linija 42; ESLint | kritično | Stranica se ne renderuje | S |
| GA-02 | Greška analize postaje `{}` i zatim nule | `useGasQueries.ts` 39–46; stranica 137–160 | visoko | Lažni KPI, mrtav error UI | S |
| GA-03 | Antd `Button` sa `variant` i `size="sm"` | linije 5, 77–78 | visoko | Period se ne stilizuje kao ostala dugmad | S |
| GA-04 | Prazan ekran zavisi od liste očitanja, ne od analize | 117–129 | srednje | Analiza se sakrije kad lista ne stigne | S |
| GA-05 | Fiksni `+` ispred potrošnje | linija 271 | srednje | Negativan broj je `+-` | S |
| GA-06 | `row: any` | linija 180 | nisko | Tip | S |
| GA-07 | Sufiksi `hours` van `t()` | 143, 218 | nisko | Q7 | S |

## 10. Prijedlog

Hook ne guta grešku. Stranica na `isError` prikazuje postojeći copy i retry. `?? 0` ostaje samo za uspješan odgovor.

`Card` i `Button` idu iz shadcn seta. Referentni režim i dalje zove analizu bez datuma.

Potrošnja pet redova koristi istu formulu kao očitanja, bez prisilnog plusa. Negativan broj se vidi kao negativan.

Prazno stanje ostaje kad nema očitanja i upit je uspješan. Pad liste nije prazno stanje.

Ne računati cijenu u pregledniku.

## 11. Testovi

Nema testa stranice. Prije izmjene hooka:

- bacanje iz `getGasAnalysis` ne vraća `{}`
- `consumptionFromReferenceM3: 0` ostaje 0
- noviji 110 i stariji 100 daju 10, a prikaz nije `+` zalijepljen na minus

## 12. Otvoreno

Nema novog pitanja.
