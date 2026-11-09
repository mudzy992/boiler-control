# 36 — Straničenje, filteri i tri vizuelne primjedbe

Datum: 2026-11-08. Sve u jednom prolazu, jer su primjedbe iste klase: ekran je
prikazivao **ono što stigne u jednom odgovoru**, bez ijednog znaka da postoji još.

## 1. Serversko straničenje tabela

| Ekran | Endpoint | Prije | Sada |
| --- | --- | --- | --- |
| `/heating` | `GET /api/heating-events` | najviše 100 redova, greška → `[]` | `{rows,total}` + `X-Total-Count`, `limit/offset/from/to/deviceId` |
| `/gas/readings` | `GET /api/gas/readings` | `limit` 100 (gornja granica 500) | `limit/offset/from/to` na `readingDate`, ukupno u zaglavlju |
| `/reports` (preporuke) | `GET /api/recommendations` | „učitaj još" do 200 | `limit/offset/from/to` na `date`, strana po strana |
| `/reports` (historija) | `GET /api/daily-record/history` | `truncated` banner uz `limit` 180 | `offset` + `total`; `truncated` znači „ima još POSLIJE ove strane" |

Konvencija je ista kao `33`: **niz u tijelu + `X-Total-Count` u zaglavlju**.
`setTotalCount` iz `common/pagination.ts` piše zaglavlje, `parsePage` čita
`limit/offset` uz gornju granicu po endpointu.

Dvije stvari koje nijesu kozmetika:

1. **`HeatingService` više ne guta grešku.** Prije je `catch` vraćao `[]`, pa je
   tabela tvrdila „nema zapisa" i kad ih je bilo 415 i kad je upit pao. Sada
   greška ide dalje i `QueryState` pokaže stanje greške.
2. **`total` se broji zasebno.** `take: limit + 1` kaže „ima još", ali ne koliko —
   bez `count`-a podnožje ne može napisati „21–40 od 302".

## 2. Filteri

- `DateRangeFilter` (`shared/components/table-controls.tsx`): dva `type="date"`
  polja, `od`/`do`, dugme „Očisti". Vrijednost je `YYYY-MM-DD`, isti oblik koji
  server prima; ručni format bi značio da `8.11.2026.` stiže kao greška 400.
- Promjena filtera vraća na **prvu stranu**. Bez toga bi „od 2026-01-01" sa strane
  7 pokazao praznu tabelu i filter bi izgledao pokvaren.
- `/gas/analytics`: uz brzi izbor (7d/14d/30d/90d/1y/referenca→sada) dodat je
  ručni raspon. Kad je postavljen, on pobjeđuje — i u upitu (`useDefaultReferenceRange`
  se gasi) i u prikazu (nijedno dugme nije aktivno).

## 3. Podnožje tabele

`TablePager` + `pageWindow(total, offset, limit)`; funkcija je izdvojena da se
testira bez renderovanja (`__tests__/table-controls.test.ts`, 6 testova), jer
off-by-one ovdje korisnik vidi odmah („303 od 302").

## 4. Splash na mobilnoj — „kao da se ne učitava"

`AnimatedSplash` je bio samo slika na bijelom, do 2,5 s, dok čeka jezik i
fontove. Sada poslije **400 ms** pokaže `ActivityIndicator` i „Pripremam
podatke…". Odmah ne — indikator u prvom kadru izgleda kao da je zapelo. Uz
`reduceMotion` i dalje nema animacije.

## 5. Početna — kartica „Status kotla"

- Red ispod trake (`Razlika … · izvan tolerancije` + `48 — 55`) se **prelama**
  (`flexWrap`); na bosanskom su dva `MonoMeta` bloka prelazila širinu ekrana.
- Ispod trake je sada objašnjenje (`boiler.gaugeHint`): traka pokazuje gdje je
  polazna voda unutar dozvoljenog raspona **48–55 °C**, nije napredak grijanja.
- Isto objašnjenje za karticu termostata (`heating.gaugeHint`): sobna temperatura
  na fiksnoj skali **0–30 °C**, oznaka je cilj.

## 6. Uklonjen duplikat „Režim: FULL · Interval: weekday_evening"

Red je stajao dvaput: uz traku termostata i na dnu ekrana u
`RecommendationBreakdown`. Uklonjen je donji; gornji ostaje jer je tamo kontekst
odluke. Snapshot test to sada čuva (`toBe(1)`, prije `toBe(2)`).

## Provjere

- backend: `npx jest src test/unit test/contract` → 1297 prošlo; 2 suite padaju
  **samo u sandboxu** (`EACCES /usr/src/app` iz `FileStorageService`, `MAINT-2`
  throttler) — iste dvije padaju i prije ovih izmjena.
- frontend: `tsc` čist, `vitest` **209 / 29 fajlova**, `eslint` 0 grešaka.
- mobile: `tsc` čist, `jest` **351 / 52 suite**, 4 snapshota svjesno ažurirana.
- `contracts/openapi.json` regenerisan (`npm run openapi:generate`), `from`/`to`/
  `offset` vidljivi na sva četiri endpointa.

## Šta nije provjereno

Nijedan ekran nije otvoren na stvarnom uređaju u ovom prolazu. Straničenje i
filteri su provjereni testovima i tipovima, ne klikom; potvrda ide kad vlasnik
pogleda `/heating`, `/gas/readings`, `/reports` i Početnu na telefonu.

## 7. „Historija dnevnih zapisa" u `/reports` (naknadni zahtjev)

Tabela je imala tri problema koja se vide odmah:

1. **Redoslijed.** Server vraća stranu od najnovijeg dana prema starijem, ali
   redove slaže **uzlazno** (to traže grafikoni). Tabela je prikazivala upravo
   to — na vrhu januar, današnji dan negdje na dnu. Sada se redovi obrću
   (`sortNewestFirst`), pa je prvi red uvijek najnoviji dan.
2. **Brojevi stranica.** „Prethodna/sljedeća" je bilo dovoljno dok je strana bila
   180 redova. Sada je strana 20 dana, a historija ima ~300 dana → 16 strana;
   korisnik mora vidjeti gdje je i skočiti. Novi `PageNumbers` računa prozor
   `1 … 6 7 8 9 10 … 16` preko `pageList()` (testirano za prvu, srednju i zadnju
   stranu, plus neispravan ulaz).
3. **Veličina strane.** `limit` je bio 180 — devet strana koje se ne mogu
   preskočiti. Sada 20.

Odgovor na pitanje „koliko dana": **cijela historija** (od 01.01.), 20 dana po
strani, najnovije prvo. Straničenje ostaje serversko (`limit`/`offset`,
`total` iz odgovora) — frontend ne sortira i ne reže podatke, samo obrće
poredak unutar dobijene strane.
