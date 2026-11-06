# Modul: boiler

Faza 2. Datum: 2026-11-06. Ruta `/boiler`. Jedan fajl, `features/boiler/pages/BoilerPage.tsx` (249 linija).

Odgovor na provjeru: tok se može ponovo složiti iz ovog dokumenta. Stranica se ne može renderovati dok `Button`, `Card` i `InputNumber` nemaju import. ESLint to javlja (`03-baseline.md`).

## 1. Svrha i tokovi

1. Korisnik vidi historiju kotla: vanjska temperatura, predloženi i stvarni polaz, delta, početak i kraj grijanja.
2. Otvara dijalog i šalje trenutnu temperaturu polaza, 48–55 °C, jednu decimalu.
3. Poslije uspjeha lista se ponovo učitava.

`POST /api/boiler/sync` postoji (`boiler.controller.ts` 44–66). Ova stranica ga ne zove.

## 2. Struktura

`DeltaChip` je u istom fajlu. Prag je fiksiran: apsolutna delta ≤ 2 je `OK`, iznad predloženog je `HIGH`, ispod je `LOW` (linije 27–34).

Modal je kopija dashboard bloka (195–244 naspram `DashboardPage.tsx` 1099–1148), uključujući isti naslov i isti SVG za zatvaranje.

`InputNumber` je omot oko antd (`components/InputNumber.tsx` linija 2). Stranica nema `import ... from 'antd'`, ali i dalje vuče antd kroz taj omot.

## 3. Tok podataka

`GET /api/boiler/history` preko `getBoilerEvents`. Query ključ `boilerEvents`. Ako tijelo nije niz, uzima se `data.events`, inače prazan niz (49–54).

Kontroler u `catch` vraća `[]` (linije 34–36). Klijent tada vidi uspjeh i praznu tabelu, ne grešku.

`PATCH /api/boiler/current-temp` sa `{ currentFlowTemp }`. Zatim `invalidateQueries` na `boilerEvents` (87). Dashboard ključ `dashboard` se ne invalidira. Poslije snimanja ovdje, otvoreni dashboard može pokazati staru temperaturu do svog refetcha.

Van raspona i `NaN` se tiho odbijaju (72–80). `isWithinFlowTempRange` se ne koristi. Početna vrijednost je zadnji `actualFlowTemp`, inače `suggestedFlowTemp`, inače 52 (61–68).

Redis nema. Nema optimističnog updatea.

## 4. UI

Loading je spinner preko stranice (95–100). `error` se samo loguje (57–59). `events` tada ostaje `[]`, pa mrežna greška izgleda kao "No boiler events recorded yet."

Nema posebnog disabled stanja osim `disabled` na Save dok vrijednost nije broj. Success poruke nema.

Tabela ima horizontalni scroll. Nema paginacije. `id="content"` se poklapa sa shellom.

Tekst je engleski, van `t()`. Light/dark klase postoje. `z-modal` i `z-modal-backdrop` nisu u Tailwind temi (isti nalaz kao shell).

## 5. Pristupačnost

Tabela nema caption. Dijalog nema `role="dialog"`, labelu, focus trap ni Escape. Zatvoren panel ostaje u DOM-u bez `hidden` i bez `pointer-events-none` (202–206), pa tab može ući u nevidljiva dugmad. Overlay je `div` sa `onClick`. Close ima `sr-only` "Close".

## 6. Usko grlo

Jedan GET bez limita u ovom fajlu. Ako historija naraste, tabela crta sve redove. N+1 u ovom fajlu nema. Bundle: antd ulazi preko `InputNumber`.

## 7. Kvalitet

Nema `any`. Nema `useEffect`. Nema testa. `Button` / `Card` / `InputNumber` nisu importovani. Delta prag 2 nije imenovana konstanta. Dijalog je dupliciran s dashboardom.

## 8. Rizici

Granice 48–55 i polje `currentFlowTemp` moraju ostati. Delta ≤ 2 = OK je pravilo prikaza, nije serverska validacija. Ne spajati ga sa clampom preporuke na 46.

Invalidacija samo `boilerEvents` ostavlja dashboard keš. Zajednička mutacija treba osvježiti i `queryKeys.dashboard`.

Kontroler guta grešku historije i vraća `[]`. Klijent to ne može razlikovati od prazne historije bez izmjene API-ja. Prijedlog ispod ne mijenja taj ugovor. Prazan niz poslije HTTP 200 ostaje prazna tabela. `isError` pokriva samo pad mreže ili ne-2xx.

## 9. Nalazi

| ID | Opis | Dokaz | Ozbiljnost | Uticaj | Trud |
|---|---|---|---|---|---|
| BO-01 | `Button`, `Card`, `InputNumber` nisu importovani | `BoilerPage.tsx` 115, 121, 219; ESLint | kritično | Stranica se ne renderuje | S |
| BO-02 | Greška upita izgleda kao prazna historija | linije 49–59, 183–187 | visoko | Nema retry | S |
| BO-03 | Van raspona se guta bez poruke | 76–80 | srednje | Korisnik misli da ništa nije kliknuo | S |
| BO-04 | Dijalog nije modal za tastaturu i ostaje u tab redu | 195–244 | srednje | a11y | M |
| BO-05 | Snimanje ne invalidira dashboard | linija 87; dashboard ima isti PATCH | srednje | Dva ekrana se razilaze | S |
| BO-06 | Antd ostaje kroz `InputNumber` | `InputNumber.tsx:2` | srednje | Q1 | S |
| BO-07 | Cijela historija u jednoj tabeli | 141 | nisko | Raste s vremenom | M |
| BO-08 | Delta ±2 i tekst van `t()` | 30–34, 107–112 | nisko | Q7 | S |

## 10. Prijedlog

Isti dijalog temperature kao na dashboardu, jedna komponenta. shadcn input za broj, bez antd omota. Poslije uspjeha invalidirati `boilerEvents` i `dashboard`.

`isError`: poruka i retry. HTTP 200 i `[]` ostaje prazna tabela. Van raspona: `flowTempRangeMessage()`. Delta prag ostaje 2, kao imenovana konstanta. Tekst kroz `t()`. Tabela dobija caption. Dijalog je shadcn, Escape zatvara, zatvoren nije u tab redu.

`POST /sync` se ne dodaje na ekran. Nema ga u trenutnom toku.

## 11. Testovi

Nema testa stranice. Prije izdvajanja dijaloga:

- 47.9 i 55.1 ne zovu PATCH
- 48 i 55 zovu PATCH i invalidiraju `boilerEvents` i `dashboard`
- delta 2 je OK, 2.1 je HIGH, −2.1 je LOW

## 12. Otvoreno

Nema novog pitanja. Serverski `catch` koji vraća `[]` ostaje van opsega.
