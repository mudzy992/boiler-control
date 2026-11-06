# Modul: gas-readings

Faza 2. Datum: 2026-11-06. Ruta `/gas/readings`. Analitika je sljedeći modul. Dijeli `useGasReadingsQuery` i ključ `gas-readings`.

Odgovor na provjeru: tokovi unosa, brisanja, reference, slike i fakture mogu se ponovo složiti odavde. Stranica se ne može učitati: importi ne postoje, a `message` nije definisan.

## 1. Svrha i tokovi

1. Lista očitanja, novije prvo. Prazan ekran nudi prvi unos.
2. Novi unos: stanje brojila, datum, opciona slika. Validacija je u `GasForm`.
3. Brisanje očitanja traži `window.confirm`.
4. Očitavanje se označava ili skida kao referentno.
5. Slika brojila i PDF fakture se dodaju, otvaraju i (faktura) brišu.
6. CSV skida trenutnu listu.

## 2. Struktura

| Fajl | Linije | Uloga |
|---|---:|---|
| `features/gas/pages/GasReadingsPage.tsx` | 308 | upiti i mutacije |
| `features/gas/components/GasForm.tsx` | 333 | dijalog unosa |
| `features/gas/components/GasReadingCard.tsx` | 189 | kartica |
| `features/gas/hooks/useGasQueries.ts` | 50 | dijeljeni upit |

`GasReadingsPage.tsx:9` importuje `../components/index`. To je `features/gas/components/index.ts`. Fajla nema.

`GasForm.tsx` linije 4–5 i `GasReadingCard.tsx:4` importuju `./Input` i `./Button`. Tih fajlova nema u folderu. Vitest ne učitava `GasForm.test.tsx` ni `GasReadingCard.test.tsx` (`03-baseline.md`).

`message.error` se zove na linijama 38, 52, 64, 75, 95, 106, 143, 159, 275, 281. `message` nije importovan.

## 3. Tok podataka

`GET /api/gas/readings`. Ključ `gasReadings`, stale 5 min. Ako tijelo nije niz, keš postaje `[]` (`useGasQueries.ts` 22), što React Query tretira kao uspjeh.

Mutacije invalidiraju `gasReadings`. Unos, brisanje, referenca, faktura i brisanje fakture invalidiraju i `gasAnalysisRoot`. Slika brojila invalidira samo očitanja (71–72).

| Akcija | API |
|---|---|
| unos | `POST /api/gas/reading` multipart |
| brisanje | `DELETE /api/gas/reading/:id` |
| referenca | `PATCH /api/gas/reading/:id/reference` |
| slika | `POST .../meter-image` |
| faktura | `POST .../invoice` |
| brisanje fakture | `DELETE .../invoice` |
| preuzimanje | `downloadProtectedFile` na URL iz `getGasMeterImageUrl` / `getGasInvoiceUrl` |

Nema optimističnog updatea. Redis nema.

Potrošnja na kartici (`GasReadingCard.tsx` 63–68): lista je nova→stara. Kartici se kao `previousReading` daje noviji susjed (`GasReadingsPage.tsx` 263). Formula je `novijeStanje - ovoStanje`, dani su `novijiDatum - ovajDatum`. To je potrošnja od ovog očitanja do sljedećeg, ne do prethodnog. Najnovija kartica nema taj blok. Ime propa je obrnuto od smjera. Matematika ostaje.

CSV (`172–178`) ide iz `readings`, ne iz `sortedReadings`. Isti skup, drugi redoslijed.

## 4. UI

`isError` ima tekst `gas.loadError` i nema retry (`203–208`). Loading je spinner, ne skeleton. Prazno stanje ima tekst i ikonu, ali nema dugme. Dodavanje je u zaglavlju.

Sve mutacije dijele `allPending` (196–201). Jedan upload zaključa brisanje na svim karticama.

Fajl se bira preko `document.createElement('input')` (131, 150), van forme. Prihvat: PDF, odnosno JPEG/PNG/WebP.

`GasForm` je `role="dialog"`, `aria-modal`, Escape i Tab ciklus (133–162, 178). Fokus se vraća na prethodni element. To je jedini dijalog u dashboardu koji to radi. Zadržati ponašanje, zamijeniti nedostajuće `Input`/`Button`.

Tekst ide kroz `t('gas.*')`. Datumi na kartici su `MMM DD, YYYY` (engleski mjesec) i kad je jezik bs.

Light/dark klase postoje. `id="content"` se poklapa sa shellom.

## 5. Pristupačnost

Dijalog unosa je najbliži WCAG obrascu u aplikaciji. Testovi koji to pokrivaju se ne učitavaju zbog importa.

Brisanje je `window.confirm`. Nije fokus-trap u aplikaciji.

File input iz koda nema vidljiv label u stranici. Kartica dugmadi ima tekst.

Potrošnja i bedževi imaju tekst, ne samo boju.

## 6. Usko grlo

Nema paginacije. Sve kartice se crtaju. Nije mjereno koliko očitanja korisnik ima. Virtualizacija postoji kao zavisnost i ovdje se ne koristi. Uvesti je tek ako lista bude duga. Do tada ostaje puna lista.

`as AppGasReading[]` (`useGasQueries.ts` 22) preskače provjeru polja.

## 7. Kvalitet

`GasForm.tsx` 117: `catch (error: any)`. ESLint to javlja.

`message` je antd global koji nije ni importovan. Q1: poruke greške idu kroz stanje na stranici, ne kroz `message`.

Dupli error na uploadu: `onError` mutacije i `catch` oko `mutateAsync` oba zovu istu poruku (74–76 i 158–159, isto za fakturu).

Nema `useEffect` na stranici. Forma ga koristi za fokus. To ostaje.

## 8. Rizici

- Referenca i faktura mijenjaju analitiku. Invalidacija `gasAnalysisRoot` mora ostati.
- Slika namjerno ne invalidira analitiku. Ne širiti to bez razloga.
- Okretanje `previousReading` na starijeg susjeda mijenja predznak potrošnje.
- Preuzimanje mora ostati na `downloadProtectedFile`. Direktan `fetch` sa `localStorage` tokenom lomi cookie tok (komentar 110–119).
- `GasForm` focus trap je pokriven testom koji trenutno ne može da se učita. Prepis ne smije izgubiti Escape i povrat fokusa.

## 9. Nalazi

| ID | Opis | Dokaz | Ozbiljnost | Uticaj | Trud |
|---|---|---|---|---|---|
| GR-01 | Importi `components/index`, `./Button`, `./Input` ne postoje | stranica linija 9; forma 4–5; kartica 4; Vitest | kritično | Ruta i testovi se ne učitavaju | S |
| GR-02 | `message` nije definisan | stranica 38 i ostali pozivi | kritično | Greška mutacije baca drugi izuzetak | S |
| GR-03 | Dupla poruka na uploadu | `onError` i `catch` oko `mutateAsync` | srednje | Dva ista upozorenja | S |
| GR-04 | Greška liste nema retry | 203–208 | srednje | Korisnik stoji na tekstu | S |
| GR-05 | Jedan pending zaključa sve kartice | 196–201, 283 | srednje | Sporiji rad | S |
| GR-06 | `window.confirm` za brisanje | kartica 72 | srednje | a11y | S |
| GR-07 | CSV nije sortiran kao ekran | 172–178 naspram 166–169 | nisko | Red u fajlu | S |
| GR-08 | `catch (error: any)` | `GasForm.tsx:117` | nisko | Tip | S |

## 10. Prijedlog

Povezati `Button`, `Input` i `Card` na shadcn set. Poruka greške je lokalno stanje, `role="alert"`, jednom po mutaciji.

Zadržati formulu potrošnje i smjer susjeda. Preimenovati prop u `newerReading` u istom prolazu, da redizajn ne okrene razliku.

`isError` dobija retry preko `refetch`. Prazno stanje zadržava postojeći copy i vodi na isti dijalog.

File picker ostaje sa istim `accept`. Dijalog unosa zadržava focus trap. Brisanje prelazi na isti obrazac dijaloga, umjesto `window.confirm`.

CSV: isti redoslijed kao ekran. Bez novog endpointa.

## 11. Testovi

Postoje `GasForm.test.tsx` i `GasReadingCard.test.tsx`. Ne učitavaju se. Poslije ispravke putanje moraju proći prije izmjene validacije i potrošnje.

Dodati jedan test: noviji susjed 110 m³ i stariji 100 m³ daju potrošnju 10, ne −10.

## 12. Otvoreno

Nema novog pitanja. `useGasAnalysisQuery` guta grešku u `{}` (`useGasQueries.ts` 39–46). To ide u modul analitike, ne ovdje.
