# PLAN — popravke iz audita analitike

Izvor nalaza: `docs/plans/AUDIT-analitika.md` (§4), mjerenje run `43833708635`.
Ovaj dokument je **izvršni** plan: redoslijed, tačan fajl, test koji dokazuje, i
šta se mjeri prije/poslije. Presude se ne prepisuju — pozivaju se.

## Zašto redoslijed nije estetski

Dvije vrste popravaka:

| vrsta | primjer | efekat na ekran |
|---|---|---|
| **prikaz laže** | „14 dana zabilježeno" za 312 dana | rečenica se mijenja, broj ostaje isti |
| **broj je pogrešan** | `avgIndoorTemp` 0,31 K niži | **broj se mijenja** |

Ako broj ide prvi, korisnik vidi da mu se brojka promijenila bez objašnjenja, a
lažna rečenica ostaje. Zato: **prvo laž, pa broj.** Faze su zato A → B → C → D, i
ne spajaju se u jedan commit.

---

## Faza A — rečenice koje tvrde više nego podaci (0 rizika)

Nijedan broj se ne mijenja. Samo se uklanja tvrdnja koju podaci ne nose.

### A1. Mobilna historija: „14 dana zabilježeno" → „prikazano 14 od 312"

- **Uzrok:** `summary.days` je `rows.length` — dužina stranice
  (`backend/src/modules/DailyRecord/daily-history.ts:154`). Backend uredno vraća
  `truncated: true` (`:165`), kartica ga **ne čita**.
- **Fajl:** `mobile/src/components/analytics/DailyHistoryCard.tsx` (`:81`),
  `mobile/src/locales/config.ts` (novi ključ + `en`/`bs`).
- **Izmjena:** kad `report?.truncated` → poruka „prikazano najnovijih `{{count}}`
  od ukupno `{{total}}`". Ukupno dolazi iz `historyQuery` odgovora; ako ga nema,
  rečenica ostaje bez „od ukupno" radije nego da izmisli broj.
- **Test:** `mobile/src/components/analytics/__tests__/DailyHistoryCard.test.tsx`
  (nov) — `truncated: true` **mora** dati rečenicu sa oba broja; `truncated:
  false` mora dati staru rečenicu.
- **Prije/poslije:** isti odgovor (14 redova, `truncated: true`) → prije „14
  dana zabilježeno", poslije „prikazano 14 od 312".

### A2. Mobilni plin: kartica mora poštovati odabrani period

- **Uzrok:** `getGasReadings()` se zove bez `from`/`to`
  (`mobile/src/services/api/client.ts:286`), a `GasAnalyticsCard` sabira **sva**
  dohvaćena očitanja (`GasAnalyticsCard.tsx:57–85`). `timeRange` do kartice ne
  stiže.
- **Fajl:** `mobile/src/screens/analytics/AnalyticsScreen.tsx` (proslijedi
  `from`/`to`), `mobile/src/services/api/client.ts` (proslijedi parametre),
  `mobile/src/components/analytics/GasAnalyticsCard.tsx`.
- **Izmjena:** raspon dolazi iz istog `dateRange` koji koristi `heating-summary`,
  da obje kartice govore o **istom** periodu.
- **Test:** `f3Analytics.test.tsx` — isti mock, dva `timeRange`-a; tvrdi da
  `getGasReadings` **nije** pozvan sa istim parametrima za „Danas" i „Ovu
  godinu". Danas bi taj test pao (parametri su identični).
- **Prije/poslije:** „Danas" i „Ova godina" daju iste brojke → različite.

### A3. Tri značenja riječi „uzorci"

- **Uzrok:** `samples` = kumulativno po intervalu (`schema.prisma`,
  `@@unique([homeProfileId, intervalKey])`), `points.length` = broj dana,
  backend sabira treće (`dashboard.service.ts:587–588`).
- **Fajl:** `mobile/src/screens/analytics/AnalyticsScreen.tsx:413` i `:598`,
  `mobile/src/locales/config.ts`.
- **Izmjena:** tri različita **imena**, ne tri ista. Npr. „uzoraka po intervalu",
  „dana u periodu", „intervala ažurirano".
- **Test:** `f3Analytics.test.tsx` — tvrdi da se na ekranu ne pojavljuje isti
  ključ prevoda za dva različita broja.
- **Napomena:** backend se **ne mijenja**. Ovo je isključivo prikaz.

---

## Faza B — gdje broj stvarno laže (mijenja prikaz, traži odluku)

### B1. `avgIndoorTemp`: nula van prosjeka (0,31 K)

- **Uzrok:** nula je **vrijednost** u `Float` koloni, pa ulazi u prosjek kao
  0 °C. Mjerenje: 1 red od 66 → **20,31 vs 20,62 °C**.
- **Fajl:** `backend/src/modules/Dashboard/dashboard.service.ts:411`.
- **Otvorena odluka (mora je donijeti vlasnik prije koda):** šta nula znači —
  (a) senzor nije javio → red **ne ulazi** u prosjek; (b) stvarno 0 °C → ulazi.
  Ako se to ne odluči, popravka samo premješta grešku.
- **Preporuka:** (a) + brojati koliko je redova izostavljeno i vratiti ga u
  odgovor (`excludedZeroTemp`), da prikaz može reći „prosjek od 65 od 66".
  Bez tog broja korisnik ne zna da nešto nedostaje — ista greška kao `truncated`.
- **Test:** `backend/src/modules/Dashboard/tests/dashboard-summary-temp.spec.ts`
  (nov, po šablonu `dashboard-heating-events.spec.ts`: pravi servis + lažna baza)
  — 3 događaja (20, 22, 0) → prosjek **21,0**, ne 14,0; `excludedZeroTemp = 1`.
- **Prije/poslije:** 20,31 → 20,62 °C na oba klijenta (ista funkcija).

### B2. Ciklusi i trajanje pod istim filterom

- **Uzrok:** `totalCycles = events.length` (`:396`), trajanje sabira samo redove
  sa `timestampEnd` (`:397`–`:402`). Danas 0 otvorenih od 66 — **tačno
  slučajno**, ne po konstrukciji.
- **Fajl:** isti servis, isti test fajl kao B1.
- **Izmjena:** otvoren ciklus se produžava do `now()` (grijanje **traje**), a ne
  odbacuje. Alternativa — brojati cikluse istim filterom — gubi činjenicu da
  grijanje radi. Zato: produži.
- **Test:** 2 zatvorena (60 i 30 min) + 1 otvoren prije 10 min → prosjek 33,3
  min, `totalCycles = 3`.
- **Napomena:** mijenja brojeve **samo** kad ima otvoren ciklus. Na današnjem
  prozoru (0/66) razlika je **nula** — zato ide poslije B1.

### B3. `assertUserHasThermostat` baca goli `Error` → 500

- **Fajl:** `dashboard.service.ts:1058`.
- **Izmjena:** `new HttpException(..., HttpStatus.BAD_REQUEST)` ili
  `NotFoundException` — odluka: korisnik **bez** termostata nije greška servera.
- **Test:** `backend/src/modules/Dashboard/tests/dashboard-heating-events.spec.ts`
  (postoji, već ima pravi servis + lažnu bazu sa `thermostatDevice.count`) —
  proširiti: `count: 0` → baca `HttpException` sa statusom **400/404**, ne goli
  `Error`.
- **Ne** `dashboard-query-http.spec.ts`: taj fajl **mockuje cijeli servis**
  (`jest.mock('../dashboard.service', ...)`), pa ne može vidjeti kako se servis
  ponaša bez termostata. Test na pogrešnom nivou bi prošao i sa greškom.

---

## Faza C — kanal koji ne postoji (najveći dobitak, najveći posao)

### C1. Endpoint nad dnevnim mjernim kolonama

- **Nalaz:** `DailyRecord` nosi 20+ mjernih kolona i **nijedan** endpoint ih ne
  čita (§1.1). Kanal je 100 % nevidljiv.
- **Blokada:** **5/86 dana (6 %)** ih ima (M3, prag 25 %). Endpoint danas vraća
  brojeve za 5 dana i `null` za 81 — zato **kanal prvo, ali ekran tek kad
  podatak naraste**.
- **Redoslijed unutar faze:**
  1. `GET api/daily-record/metrics` (read-only, `DailyRecord` → `dutyPercent`,
     `overshootC`, `undershootC`, `hysteresisK`, `heatRateCPerHour`,
     `nightUndershootC`) — **vraća i `days`/`withMetrics`**, da klijent ne mora
     pogađati pokrivenost.
  2. Kartica na mobilnom i webu — **tek** kad `withMetrics/days ≥ 25 %`.
     Prije toga kartica bi bila prazna na 81 danu, što izgleda kao kvar.
- **Test:** backend `daily-metrics.spec.ts` (nov) — 2 dana, jedan sa metrikama:
  odgovor nosi `days: 2`, `withMetrics: 1`, `null` za dan bez.
- **Mjerenje:** ponoviti `analytics-truth-readonly.cjs` (M3) poslije C1 — broj
  `withMetrics` **ne smije pasti**.

### C2. Prag 8 za `degreeDays` — **ne dirati**

- **Dokaz:** 32/32 dana ispod praga, prosj. **2,1 red/dan**, max 5 (M4).
- **Zašto ne:** spuštanje praga na 2 bila bi ista greška kao nula u prosjeku iz
  B1 — dvije tačke na dan proglašene „mjesečnim prosjekom".
- **Šta bi radilo:** gušći polling `BoilerHistory` (2,1 → ≥ 8). To je **write
  put**, ne analitika — zaseban zadatak. Do tada `null` ostaje, i to je tačno.

---

## Faza D — jednoznačnost između weba i mobila

### D1. Web: bira­ni period za grijanje

- **Nalaz:** web ima **fiksne** periode (§2): shadow 30 dana, historija od
  2026-01-01, `heating-summary` **samo za jedan dan**. Mobilni ima
  dan/sedmica/mjesec/godina + poređenje sa prethodnim.
- **Obim:** `heating-summary` + `heating-stats` preko raspona, `Segmented` kao na
  mobilnom, tabela „Vrijednost / Prethodno" (`getPreviousDateRange` već postoji
  u mobilnom — prenijeti u shared).
- **Zašto poslije C:** D1 bez C1 daje isti siromašan presjek, samo sa biračem
  perioda. Birač nad 4 broja ne rješava nalaz.

### D2. Web gas: greška se nikad ne prikaže

- **Uzrok:** `useGasQueries.ts:71–78` hvata grešku i vraća `{}` → `isError` nikad
  nije istinit (`GasAnalyticsPage.tsx:66`) → metrike crtaju `undefined` kao `0`.
  `QueryState` postoji, ali se ne aktivira.
- **Fajl:** `frontend/src/features/gas/hooks/useGasQueries.ts`.
- **Izmjena:** ne gutati grešku; pustiti `QueryState` da radi (ili vratiti
  `null` i prikazati „—", nikad `0`).
- **Test:** `frontend/src/features/gas/__tests__/gasAnalyticsError.test.tsx`
  (nov) — odbijen zahtjev → ekran **ne** piše „0 m³", piše grešku/retry.

---

## Redoslijed izvršenja i mjerenje

| # | faza | mijenja broj? | test | mjerenje poslije |
|---|---|---|---|---|
| 1 | A1 | ne | `DailyHistoryCard.test.tsx` | — |
| 2 | A2 | ne (mijenja **šta** se sabira) | `f3Analytics.test.tsx` | — |
| 3 | A3 | ne | `f3Analytics.test.tsx` | — |
| 4 | B3 | ne | `dashboard-heating-events.spec.ts` | — |
| 5 | B1 | **da** (+0,31 K) | `dashboard-summary-temp.spec.ts` | M2 → `NEMA_NULA` ili `NULA_VAN_PROSJEKA` |
| 6 | B2 | **da** (samo sa otvorenim) | isti | M1 ostaje `NEMA_OTVORENIH`, ali presuda više ne zavisi od sreće |
| 7 | D2 | ne | `gasAnalyticsError.test.tsx` | — |
| 8 | C1 | da (novi ekran) | `daily-metrics.spec.ts` | M3 `withMetrics` ne smije pasti |
| 9 | D1 | da (novi ekran) | — | — |

**Kapija:** poslije svake faze `analytics-truth-readonly.cjs` mora dati **istu ili
bolju** presudu. Ako M2 pređe iz `NULA_U_PROSJEKU` u nešto drugo a M3 padne,
popravka je pokvarila mjerenje — i to se vidi u CI-ju, ne u utisku.

## Šta se ne radi u ovom planu

- **Ne dira se prag 8** za `degreeDays` (C2) — dokazano da je uzrok, i da
  popravka nije u analitici.
- **Ne spaja se A i B u jedan commit** — inače se ne vidi šta je promijenilo broj.
- **Ne dodaje se kartica prije nego podatak pređe 25 %** (C1).
- **Ne mijenja se backend zbog A3** — to je prikaz, ne račun.

## Otvorene odluke (traže vlasnika, ne kod)

1. **B1:** šta nula u `roomCurrentTemp` znači — senzor nije javio (izostavi) ili
   stvarno 0 °C (zadrži). Preporuka: izostavi + vrati `excludedZeroTemp`.
2. **D1:** da li web dobija isti birač perioda kao mobilni, ili mobilni ostaje
   jedini analitički ekran. Ovo mijenja obim, ne ispravnost.

---

## Stanje izvršenja

### Faza A — završena (commit `348d97c`)

| # | šta je urađeno | test | dokaz da test hvata grešku |
|---|---|---|---|
| A1 | `dailyHistorySummaryTruncated` + `total` u mobilnom tipu | `DailyHistoryCard.test.tsx` (3) | sa starom karticom **1/3 pada** |
| A2 | raspon plina = `dateRange`, u ključu i u pozivu | `f3Analytics.test.tsx` (+2) | sa starim kodom **2/2 padaju** |
| A3 | tri imena za tri broja | `f3Analytics.test.tsx` (+1) | traži `cumulative`/`dana u periodu` u stvarnom rječniku |

Uz A2 je došla i straža koja nije bila u planu: **jedno očitanje u periodu
nije „0 m³"** nego „za potrošnju su potrebna dva". Prije popravke taj slučaj
skoro nije bio dostižan (kartica je gledala sva očitanja), a poslije A2 kratak
period često ima tačno jedno — pa bi popravka otvorila novu lažnu nulu.

**Nusnalaz u snapshotu.** `analyticsNativeWind` je prije padao zbog A1, i to
zato što je `getDailyHistory` bio **nemockovan**: kartica je završavala u grešci,
a snapshot je to skrivao kao skeleton (`importantForAccessibility="no-hide-descendants"`).
Uz to je `toMatchSnapshot` snimao tabelu **prije** nego što stigne prethodni
period (`periodPrevious: —` umjesto `2.5`). Popravljeno: mock + čekanje na
`2.5`. Snapshot sada prikazuje stanje koje korisnik stvarno vidi.

### Kapija poslije A — mjerenje `43841582208`

```
M1 OTVORENI_PODCJENJUJU (67 ciklusa, 1 bez kraja, prosj. 219.73 vs 223.06 min)
M2 NULA_U_PROSJEKU      (1 nula od 67, prikazano 20.32 vs stvarno 20.63, razlika 0.31 K)
M3 METRIKE_RIJETKE      (5/86)
M4 PRAG_GA_ISKLJUCUJE   (32/32 ispod praga, prosj. 2.1 red/dan)
```

**M2/M3/M4 nepromijenjeni — faza A nije dirala brojeve, kako je i planirano.**

**M1 se promijenio sam, i to je dokaz da je B2 potreban.** Prije (run
`43833708635`) bilo je `NEMA_OTVORENIH` — 0 otvorenih od 66. Sada grijanje
**traje** u trenutku mjerenja, pa je 1 ciklus otvoren od 67, a prosječno
trajanje koje korisnik vidi palo je sa 223,06 na **219,73 min** — iako se
trajanje **nije promijenilo**, samo se imenilac povećao. To je tačno kvar iz
audita §1.4, uhvaćen u stvarnom radu, a ne u testu. Popravka je B2.

### Faza B — završena (`97e41af` … `9a34fac`)

| # | šta je urađeno | test | dokaz da test hvata grešku |
|---|---|---|---|
| B1 | nula `< 5 °C` van prosjeka, uz `excludedZeroTemp` | `heating-totals.spec.ts` (8), `dashboard-summary-totals.spec.ts` (5) | sa starim servisom **5/5 pada** |
| B2 | otvoren ciklus se mjeri do `now` | isto | isto |
| B3 | `NotFoundException` umjesto golog `Error` | isto | isto |

**Sabiranje je izdvojeno u `common/heating-totals.ts`**, jer su iste brojeve
računala **tri** mjesta: `getHeatingSummary`, `analytics-export.ts` (`version=2`)
i `version=1` izvoz (koji zove servis). Popravka na jednom mjestu ne bi bila
popravka — a upravo se to do 16.11. i nije desilo.

**Postojeći test je bio dokaz kvara, ne smetnja.** `analytics-export.spec.ts` je
očekivao `avgIndoorTemp: 8.75` iz redova `20` i `-2.5` — dakle da temperatura
sobe od −2,5 °C uđe u prosjek. Test je tvrdio kvar. Ažuriran je uz imenovanje
zašto.

### Granica koju je trebalo povući (i prvi pokušaj nije bio tačan)

Prva verzija B1 vraćala je `null` i za **prazan raspon**. Integracioni test je
pokazao da je to preširoko:

| slučaj | prije | poslije | zašto |
|---|---|---|---|
| nema događaja | `0` | **`0`** (nepromijenjeno) | `totalCycles` već kaže da je prazno; nula ne tvrdi mjerenje |
| ima događaja, nijedna temperatura nije mjerena | `0` | **`null`** | nula bi rekla „u sobi je 0 °C" |
| ima mjerenja | prosjek | prosjek | — |

Razlika je razlučiva po `totalCycles`, pa nije trebalo mijenjati postojeći ugovor.

### Šta je mjerenje pokazalo poslije B

Kapija `43841582208` (poslije A) je već pokazala kvar koji B2 rješava. Poslije B
isti prozor daje otvoren ciklus uračunat u **trajanje**, pa prosjek prestaje da
padne samim tim što je mjerenje palo usred grijanja.

### CI: tri odvojena uzroka, ne jedan

Faza B je otkrila tri stvari koje su izgledale kao jedan pad:

1. **`OpenAPI contract in sync`** — nova polja u DTO-u mijenjaju šemu. `tsc` i
   `eslint` su bili **0 grešaka**; pad je bio ugovor. Regenerisano generatorom
   (`npm run openapi:generate`), ne ručno; `nullable: true` je sada u ugovoru.
2. **Zaključan spisak polja** (`openapi-schema.spec.ts`) — polje koje se doda
   bez odluke ovdje nije dio ugovora nego slučajnost. Ažurirano uz objašnjenje.
3. **`Exceeded timeout` na `/api/dashboard`** — **nije** moja promjena. Dokaz:
   - `9d11838` mijenja **samo** `contracts/openapi.json` i `api.d.ts`, i prvi put
     pokazuje timeout — dakle ne može biti uzrok;
   - **Backend build** (isti testovi, `1754/1754`) prolazi u 79 s, **Audit
     checks** (isti testovi + `--coverage --runInBand`) padne u 138 s;
   - ponovljen run istog commita (`9a34fac`) → **success**, korak 22 u 82 s.

   Zaključak: nestabilnost uslova u Audit jobu (tajmaut na sporijem runnew),
   ne regresija. Nije "popravljeno" jer nema šta da se popravi u kodu — ali je
   zabilježeno da se ne bi gonilo kao greška.

### Kapija poslije B — mjerenje `43851109488` **ne mjeri popravku**

```
M1 NEMA_OTVORENIH (67 ciklusa, 0 bez kraja, prosj. 220.51 vs 220.51 min)
M2 NULA_U_PROSJEKU (1 nula od 67, prikazano 20.32 vs stvarno 20.63, razlika 0.31 K)
```

**M2 je i dalje `NULA_U_PROSJEKU` i to nije regresija.** Skripta
`analytics-truth-readonly.cjs` čita **bazu**, a ne kod: `HeatingEvent` red sa
0 °C je i dalje u bazi. Popravka B1 ga izostavlja iz **prosjeka koji se
prikazuje**, ali ne mijenja podatak — i ne treba: red je zapis da je senzor
javio 0, a ne da je u sobi 0 °C.

Isto važi za M1: `NEMA_OTVORENIH` sada samo znači da u trenutku mjerenja nije
bilo otvorenog ciklusa. **Mjerenje ovdje ne može razlikovati „nema otvorenih" od
„ima otvorenih, a popravka radi"** — jer oba daju isti broj kad je `open = 0`.

Zato je za fazu B dokaz **test**, ne mjerenje:

| kvar | kako je dokazan |
|---|---|
| B1 | `dashboard-summary-totals.spec.ts` — 5/5 pada sa starim servisom |
| B2 | isto; + `heating-totals.spec.ts` tvrdi da je prosjek **isti** prije i poslije zatvaranja ciklusa |
| B3 | isto — `NotFoundException` vs goli `Error` |

**Ovo je ograničenje mjerenja, ne nalaz.** Da bi mjerenje moglo provjeriti B,
trebalo bi čitati **odgovor endpointa**, a ne bazu. To je sljedeći korak ako se
mjerenje želi zadržati kao kapija (v. „Šta ostaje").
