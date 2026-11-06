# Modul: heating

Faza 2. Datum: 2026-11-06. Ruta `/heating`. Uz stranicu ide `RecommendationBreakdown`, iako ga ova ruta ne renderuje. Koriste ga dashboard i reports.

Odgovor na provjeru: lista i breakdown se mogu ponovo složiti iz ovog dokumenta. Stranica ne može da se renderuje dok `Card` nije importovan. Breakdown puca čim se pozove.

## 1. Svrha i tokovi

1. Korisnik vidi do 100 zadnjih događaja grijanja: početak, kraj, sobna i ciljna temperatura, HVAC akcija, izvor, anomalija.
2. Nema unosa, filtera ni brisanja. `POST /api/heating-events` je stub koji web ne zove (`heating.controller.ts` 22–29). Ne dodaje se forma.

Breakdown, kad ga drugi ekran proslijedi, prikazuje serverski snapshot. Ne računa krivu niti mijenja preporuku (`RecommendationBreakdown.tsx` 22–27). Ako snapshot nedostaje, ne renderuje ništa.

## 2. Struktura

| Fajl | Uloga |
|---|---|
| `features/heating/pages/HeatingPage.tsx` | 123 linije, tabela |
| `features/heating/components/RecommendationBreakdown.tsx` | 125 linija |
| `components/__tests__/RecommendationBreakdown.test.tsx` | 4 testa, svi padaju |

`AnomalyBadge` je u stranici. `Card` se koristi na liniji 61 i nije importovan. ESLint: `Card is not defined`.

## 3. Tok podataka

`GET /api/heating-events`. Servis (`heating.service.ts` 13–28) vraća Prisma redove, `orderBy timestampStart desc`, `take: 100`. Polja se poklapaju sa interfejsom stranice: `timestampStart`, `timestampEnd`, `roomCurrentTemp`, `roomTargetTemp`, `hvacAction`, `source`, `isAnomaly`.

U `catch` servis vraća `[]`. Klijent tada vidi uspjeh i praznu tabelu.

Query ključ `heatingEvents`. Ako tijelo nije niz, uzima se `data.events` (linije 32–34). Stvarni odgovor je niz, ne omot.

Ovo nije isti ugovor kao dashboard. Tamo je `GET /api/dashboard/heating-events` i polje `startedAt`. Spajanje ta dva oblika u jedan tip bi pogrešno mapiralo kolone.

Redis nema. Nema mutacije.

Breakdown ne zove API. Čita `RecommendationBreakdownDto` iz `types/api.d.ts`.

## 4. UI

Loading je spinner (42–47). `error` se samo loguje (38–40). `events` ostaje `[]`, pa mrežna greška izgleda kao "No heating events recorded yet." Nema retry.

Nema oznake da je lista odsječena na 100. Nema paginacije.

Tekst stranice je engleski, van `t()`. Breakdown koristi `t('recommendation.*')`. Ključevi postoje u `locales/config.ts` od linije 217.

`id="content"` se poklapa sa shellom.

Breakdown: `useTranslation()` je na liniji 32, prije `if (!breakdown) return null`. Import ne postoji. Svaki render baci `ReferenceError`. Zato padaju i testovi koji šalju `null`.

`Card` i `Alert` su iz `antd` (linija 2), a `Card` dobija `padding` i `elevated` (linija 72). To su propovi lokalnog `components/Card`, ne antd kartice.

Format koji test očekuje i kod radi, kad bi se hook razriješio: temperatura jedna decimala, offset dvije (`0.125` → `+0.13`), confidence puta 100 pa `round` (`0.72` → `72%`), vrijeme `toFixed(0)` (`27.5` → `28 min`). `samples` i `expectedHeatTimeMin` se crtaju samo kad nisu `null`.

## 5. Pristupačnost

Tabela događaja nema caption. Badge ima tekst YES/NO, ne samo boju.

Breakdown ima `caption` sa `sr-only`, `scope="col"` i `scope="row"`. Antd `Alert` nosi savjet. To ostaje i kad antd izađe: savjet mora ostati tekst, ne samo ikona.

## 6. Usko grlo

Jedan GET, najviše 100 redova. Nema N+1 na klijentu. Nema virtualizacije. Nije mjereno kao problem pri 100 redova.

Breakdown je mali i čist. Pad je import, ne render petlja.

## 7. Kvalitet

Nema `any` na stranici. Nema `useEffect`. Nema testa stranice.

Breakdown: nedostaje import `useTranslation`. Miješa antd i API lokalne kartice. Pravilo "ne računaj formulu" je namjerno i pokriveno testom koji se trenutno ne izvrši do asserta.

## 8. Rizici

- `take: 100` i shape `timestampStart` su ugovor ove rute. Dashboard limit 500 i `startedAt` ostaju drugi ugovor.
- Stub POST se ne otvara u UI.
- Breakdown se ne smije početi računati na klijentu. Test FE2-10 to zaključava.
- `null` breakdown mora ostati prazan render, ne pogađanje.

## 9. Nalazi

| ID | Opis | Dokaz | Ozbiljnost | Uticaj | Trud |
|---|---|---|---|---|---|
| HE-01 | `Card` nije importovan | `HeatingPage.tsx:61`; ESLint | kritično | Stranica se ne renderuje | S |
| HE-02 | `useTranslation` nije importovan | `RecommendationBreakdown.tsx:32`; 4 pala testa | kritično | Dashboard i reports pucaju na preporuci | S |
| HE-03 | Greška upita izgleda kao prazna lista | linije 30–40, 108–112 | visoko | Nema retry | S |
| HE-04 | Cap 100 nije vidljiv | `heating.service.ts:23` | srednje | Stariji događaji nestanu bez poruke | S |
| HE-05 | Breakdown vuče antd `Card`/`Alert` | linije 2 i 72 | srednje | Q1 | S |
| HE-06 | Tekst stranice van `t()` | linije 53–57, 110 | nisko | Q7 | S |

## 10. Prijedlog

Stranica ostaje jedna tabela. `Card` ide iz shadcn seta. `isError` dobija poruku i retry. HTTP 200 i `[]` ostaje prazna tabela. Ako je vraćeno tačno 100, prikazati da je to zadnjih 100, bez novog endpointa.

Breakdown: dodati postojeći `useTranslation` import. Zamijeniti antd `Alert` i `Card` shadcn primitivima, zadržati caption, scope i iste formate. Ne uvoditi formulu.

Ne uvoditi kreiranje događaja.

## 11. Testovi

Postojeći FE2-10 ostaju. Poslije importa moraju proći bez izmjene očekivanih brojeva.

Prije izmjene stranice nema karakterizacije. Dovoljan je jedan test da `isError` ne prikazuje "No heating events recorded yet."

## 12. Otvoreno

Nema novog pitanja. Serverski `catch` koji vraća `[]` ostaje van opsega, isto kao kod kotla.
