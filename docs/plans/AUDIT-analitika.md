# AUDIT — analitika: može li se unaprijediti, i prikazuje li web/mobil pravu analitiku

Datum: 16.11.2026 · Grana: `arena/456ec6f2-boiler-control` · Mjerenje: run `43833708635` (job `baseline`), skripta `backend/scripts/analytics-truth-readonly.cjs` (self-test 17/17).

Tri pitanja iz zahtjeva, tri sekcije. **Svaka tvrdnja ima dokaz**: ili broj iz mjerenja, ili `fajl:linija`. Gdje je uzrok više njih, razdvojeni su brojem.

---

## 0. Mjerenje (sirovi nalaz)

CI anotacija, run `43833708635`:

```
ANALITIKA SAZETAK:
  M1 NEMA_OTVORENIH        (66 ciklusa, 0 bez kraja, prosj. 223.06 vs 223.06 min)
  M2 NULA_U_PROSJEKU       (1 nula od 66, prikazano 20.31 vs stvarno 20.62 °C, razlika 0.31 K)
  M3 METRIKE_RIJETKE       (5/86 obračunatih dana ima metrike, 20 plin od 87)
  M4 PRAG_GA_ISKLJUCUJE    (32 dana sa outdoorTempC, 32 ispod praga 8,
                            prosj. 2.1 redova/dan, max 5, stepen-dan upisan 0/87)
```

| mjerenje | presuda | broj |
|---|---|---|
| M1 prosječno trajanje | `NEMA_OTVORENIH` | 66/66 zatvoreno → prosjek **nije** podcijenjen |
| M2 `avgIndoorTemp` | `NULA_U_PROSJEKU` | 1 nula od 66 → prikaz **niži za 0,31 K** |
| M3 dnevne metrike | `METRIKE_RIJETKE` | **5/86** (6 %) dana nosi `dutyPercent`+`overshootC`+`hysteresisK` |
| M4 `degreeDays` | `PRAG_GA_ISKLJUCUJE` | 32 dana ima `outdoorTempC`, **svih 32 ispod praga 8**, prosj. **2,1** red/dan |

Skripta je read-only (`SET TRANSACTION READ ONLY`, samo `SELECT`), ima `--self-test` koji ne traži bazu, i u CI-u se pušta prije `F3.4`. Sve tri presude idu u **jednu** anotaciju jer `emit_notice.sh` uzima prvu liniju koja nosi odluku (vidi §10.45).

---

## 1. Može li se analitika unaprijediti? — Da, i nalaz je veći od očekivanog

### 1.1 Najveći dobitak nije popravka broja, nego podatak koji već postoji a nigdje se ne čita

`DailyRecord` nosi **20+ mjernih kolona** (`backend/prisma/schema.prisma:533`+):

```
dutyPercent, medianCycleMin, overshootC, undershootC, nightUndershootC,
hysteresisK, hysteresisAsymmetryK, heatRateCPerHour, heatRateFlowC, heatRateRoomC,
nightMinOutdoorMeasuredC, nightFlowC, slopeS, slopeCi, params, degreeHours, ...
```

Nijedan analitički endpoint ih **ne čita**. Dokaz — svi endpointi `api/dashboard/*` vraćaju isključivo podatke iz `HeatingEvent`:

| endpoint | izvor | šta vraća |
|---|---|---|
| `heating-summary` | `HeatingEvent` | `totalCycles`, `totalDurationMin`, `avgDurationMin`, `avgIndoorTemp` |
| `heating-stats` | `HeatingEvent` | bucketi: `avgTargetTemp`, `avgCurrentTemp`, `totalDurationMin`, `cycles` |
| `learning-trends` | `HeatingIntervalLearning` | `avgConfidence`, `samples` |
| `export` | ista tri | CSV |

`DailyRecord` čitaju **samo** `daily-record/history` i `shadow-report`. Zato ekran zvan „Analitika" ne može reći **ni jedno** od pitanja koja korisnik stvarno postavlja: „koliko je kotao radio u praznom hodu", „je li prebacivao cilj", „koliko je noću falilo". Ta mjerenja su izmjerena i zapisana — samo nisu izložena.

**Mjera (M3): 5/86 dana (6 %) ima te metrike.** Dakle: kanal nedostaje, ali i podataka je malo. Oba su uzrok, i to ovim redom:
1. **Kanal** — 100 % dana je nevidljivo svakom ekranu, bez obzira na popunjenost.
2. **Podatak** — samo 5/86 dana uopšte ima šta pokazati.

Popravka samo kanala dala bi praznu karticu na 81 od 86 dana. Popravka samo podatka ne bi promijenila ništa na ekranu. **Redoslijed je zato: prvo kanal (jedan endpoint nad `DailyRecord`), pa podatak.** Suprotno bi dalo utisak da je popravka pala.

### 1.2 `degreeDays` — otvoreno pitanje iz §10.46 je zatvoreno, i uzrok je **prag**, ne pisac

§10.46 je ostavio otvoreno: „`stepen-dan 0/87`. Nije kvar pisca — `degreeDays` traži ≥ 8 `externalTemp`/dan. **Otvoreno: koliko `BoilerHistory` redova nastaje po danu.**"

Odgovor (M4): **prosječno 2,1 red/dan, maksimalno 5.** Prag je 8 (`backfill-reconstruction.ts:37`). **Nijedan dan ga ne dostiže** — 32/32 dana sa `outdoorTempC` je ispod praga. Dakle `null` u `degreeDays` je **tačan**, a polje se neće popuniti ni kad izvor bude savršen.

Popravke, po uzroku:
- **Gušći polling** (`BoilerHistory` 2,1 → ≥8 redova/dan) — rješava uzrok, ali dira write put.
- **Prag 8 → 2** — rješava prikaz, ali mijenja značenje: 2 uzorka na dan nije „dnevni prosjek", to je dvije tačke. Nazvati to mjerenjem bilo bi isto što i nula u prosjeku iz M2.
- **Ostaviti `null`** — tačno, i to je trenutno stanje.

Preporuka: **ne dirati prag.** 2,1 reda/dan ne nosi stepen-dan. Nalaz je da ovo polje **ne treba** čekati za F3.7.

### 1.3 M2 — jedina greška koja mijenja broj na ekranu, i ima je 0,31 K

`dashboard.service.ts:411`:

```ts
events.reduce((acc, e) => acc + (e.roomCurrentTemp ?? 0), 0) / totalCycles
```

`?? 0` ovdje ne miješa `null` (kolona je `Float`, obavezna — `schema.prisma:156`), ali **nula kao vrijednost** ulazi u prosjek kao 0 °C. Mjerenje: **1 takav red od 66**, i prikazani prosjek je **20,31 °C umjesto 20,62 °C** — niže za **0,31 K**.

Popravka je jedna linija (`FILTER (WHERE currentTemp <> 0)` ili `if (e.roomCurrentTemp > 0)`), ali **tek poslije odluke šta nula znači**: ako je nula „senzor nije javio", red ne smije u prosjek; ako je stvarno 0 °C, smije. Danas se te dvije stvari ne razlikuju — i to je pravi nalaz, ne sama nula.

### 1.4 M1 — provjereno, nije greška u ovom prozoru, ali kvar je strukturni

`totalCycles = events.length` (`:396`), a `totalDurationMin` sabira **samo** redove sa `timestampEnd` (`:397`–`:402`). Mjerenje: **0 otvorenih od 66**, pa je prosjek danas tačan (223,06 = 223,06 min).

Ali to je tačno **slučajno**, ne po konstrukciji: čim grijanje traje u trenutku zahtjeva, otvoren ciklus uđe u imenilac a ne u brojilac i prosjek padne. Isti obrazac kao greška iz §10.46 (prazan red u prosjeku) — samo još nije ispalio. Popravka: brojiti cikluse istim filterom kao trajanje, ili otvoren ciklus produžiti do `now()`.

### 1.5 Manje stvari, svaka sa dokazom

| nalaz | dokaz | efekat |
|---|---|---|
| `expectedHeatTimeMin` uvijek 0 → web prikazuje „—" | writer ga ne računa; komentar to priznaje | tačno, ali kartica je mrtva |
| `assertUserHasThermostat` baca goli `Error` | `dashboard.service.ts:1058` | 500 umjesto 4xx — korisnik bez termostata vidi „server error" |
| web gas: `isError` **nikad** nije istinit → metrike se crtaju sa nulama | `useGasQueries.ts:71–78` hvata grešku i vraća `{}`; `GasAnalyticsPage.tsx:66` zato nikad ne uđe u `error`, a `gas-analytics-metrics.tsx:31–58` pretvara `undefined` u `0` | pad servera izgleda kao „0 m³, 0 €" — `QueryState` postoji ali se ne aktivira |
| mobilni gas: `limit: 200` hardkodiran | `client.ts:288` | _nedokazano_ — 200 > trenutnih ~132, ali prag nije izmjeren |
| mobilni gas: **ne poštuje odabrani period** | `GasAnalyticsCard` računa iz svih dohvaćenih očitanja; `timeRange` mu se ne prosljeđuje | „Ovaj mjesec" i „Ova godina" daju **iste** brojke |
| web gas: `periodMode` eksplicitan | `GasAnalyticsPage.tsx:72` | web poštuje period — mobilni ne |

---

## 2. Prikazuje li web pravu analitiku?

**Djelimično: brojevi su pravi, ali to nije ekran „analitika".**

Web nema analitičku stranicu u smislu agregata. `ReportsPage` (`reports/pages/ReportsPage.tsx`) prikazuje:

| blok | izvor | je li analitika |
|---|---|---|
| `ShadowReportPanel` | `shadow-report` | poređenje modela — **analitika** |
| `DailyHistoryPanel` | `daily-record/history` | tabela dnevnih zapisa — **analitika** |
| tabela preporuka | `reports` | lista, ne agregat |
| dashboard kartice | `heating-summary` | 4 broja za **jedan dan** (zadano `startOf('day')` → danas) |
| gas analitika | `gas/analysis` | **analitika** (poštuje period, `periodMode`) |

Presuda po dijelovima:
- **Gas analitika — prava.** Poštuje period (`periodDays`), ima `periodMode` i upozorava kad je period skraćen (`readingsTruncated`). Jedini dio weba koji je potpuna analitika.
- **Dnevna historija — prava.** `null` → „—" (`valueOrNull`), `origin` badge, `truncated` baner. Ne tvrdi da je prikazano sve.
- **Dashboard 4 kartice — prave zа danas, ali nisu analitika.** Raspon je zadano **jedan dan**; `avgIndoorTemp` nosi grešku iz §1.3.
- **Periodi postoje, ali su fiksni — korisnik ih ne bira.** Shadow izvještaj je **zadnjih 30 dana** (`ReportsPage.tsx:49`, namjerno: „mjesec dana je najmanji period u kojem se vidi i hladan i topao dan"), historija ide od `2026-01-01` (`:60`), a `heating-summary` se zove **samo za jedan dan** (dashboard). Gas analitika je jedina sa **bira­nim** periodom (`periodDays`).

**Zaključak:** web prikazuje **tačne** brojeve za ono što prikazuje. Ali:
1. **nema bira­nog perioda** za grijanje — korisnik ne može pitati „ovaj mjesec vs prošli" (mobilni može);
2. `DailyRecord` metrike (§1.1) **ne diraju se** ni na jednom ekranu osim tabele historije;
3. jedina greška u broju je `avgIndoorTemp` 0,31 K (§1.3), i ona je ista na webu i mobilnom jer je u servisu.

---

## 3. Prikazuje li mobilni pravu i adekvatnu analitiku u svim karticama?

`AnalyticsScreen.tsx` je jedini ekran sa 8 kartica. **Kartica po karticu:**

| # | kartica | izvor | presuda | dokaz |
|---|---|---|---|---|
| 1 | KPI: prosj. unutrašnja | `heating-summary` | **tačna osim 0,31 K** | §1.3; ista funkcija kao web |
| 2 | KPI: sati grijanja + ciklusi | `heating-summary` | **prava** | 66/66 zatvoreno (M1) |
| 3 | KPI: pouzdanost | `learning-trends` | **zbunjujuća** | dvije kartice zovu istu stvar „uzorci" a broje različito: `samples` je kumulativno po intervalu, `points.length` je broj **dana** — `AnalyticsScreen.tsx:413` vs `:598` |
| 4 | Graf temperature | `heating-stats` bucketi | **prava** | `bucketPoints` filtrira `!isFinite`; cilj iz `avgTargetTemp > 0` |
| 5 | Cilj vs postignuto | `dashboard` (živa očitanja) | **prava, ali nije analitika** | trenutna temperatura, ne prosjek perioda |
| 6 | Vrijednost / Prethodno | `heating-summary` ×2 | **prava** | `getPreviousDateRange` pomjera oba kraja za dužinu perioda |
| 7 | **Plinsko očitanje** | `gas/readings` (**bez `from`/`to`**) | **NEPRAVA** | kartici se `timeRange` ne prosljeđuje → „Danas" i „Ova godina" daju iste brojke |
| 8 | Dnevna historija | `daily-record/history` (`limit=14`) | **NEPRAVA u naslovu** | vidi dolje |
| 9 | Model učenja | `learning-trends` | **prava** | isti izvor kao #3 |
| 10 | Izvoz | `export` | **prava** | CSV iz stvarnih agregata |

### 3.1 Kartica 8 — „Dnevni zapisi" tvrdi više nego što prikazuje

`DailyHistoryCard.tsx:81`:

```
t('analytics.dailyHistorySummary', { count: report?.summary.days ?? 0 })
→ "14 dana zabilježeno" / "{{count}} days recorded"
```

`summary.days` je **`rows.length`** — dužina **stranice**, ne perioda (`daily-history.ts:154` (`days: rows.length`)). Backend uredno vraća `truncated: true` (`daily-history.ts:165`), ali kartica ga **ne čita**. U bazi je **311–312 dana** (§10.46 mjerenje). Korisnik čita „14 dana zabilježeno" kao „imate 14 dana podataka" — a ima 312.

Web ovo radi ispravno: `historyTruncated` baner sa `{{limit}}` (`DailyHistoryPanel.tsx:138`). **Mobilni je jedini koji laže**, i to istom rečenicom koju web ispravno formulira. Popravka je jedna linija + jedna postojeća poruka.

### 3.2 Kartica 7 — plin ignorše period

`analytics.api.ts` i `AnalyticsScreen` traže `getGasReadings()` **bez raspona** (`client.ts:286`), a `GasAnalyticsCard` računa `totalConsumption`/`avgDailyConsumption` iz **svih** dohvaćenih očitanja (`GasAnalyticsCard.tsx:57–85`). Segment „Danas / Ova sedmica / Ovaj mjesec / Ova godina" mijenja **sve ostale kartice** osim ove.

To nije „nedostatak funkcije" nego **pogrešan broj**: korisnik koji prebaci na „Danas" dobija zbroj od ~6 mjeseci pod naslovom „Ukupno". Web istu stvar rješava sa `from`/`to` (`useGasQueries.ts`, `getGasAnalysis(from, to)`).

### 3.3 Kartica 3 — dva različita „uzorka", isti ekran

- `AnalyticsScreen.tsx:413`: `samplesValue: { value: latestLearning.samples }` → **kumulativni** broj uzoraka **jednog intervala** (`@@unique([homeProfileId, intervalKey])`, `schema.prisma` — red se ažurira na mjestu, pa `samples` nikad ne opada i nije „uzorci danas")
- `AnalyticsScreen.tsx:598`: `modelConfidenceLine: { samples: learningQuery.data?.points.length }` → broj **dana** u periodu

Isti ekran, ista riječ „uzoraka", dva različita značenja — i **treće** u samom backendu: `getLearningTrends` (`dashboard.service.ts:587–588`) sabira `samples` preko svih intervala ažuriranih tog dana (`d.total += i.confidence`, `d.samples++`), pa `samples` u odgovoru nije ni uzorci ni intervali nego **broj intervala ažuriranih tog dana**.

Tri značenja iste riječi na jednom ekranu. Nijedno nije greška u računu; sve tri zajedno su greška u prikazu.

### 3.4 Šta mobilni ima a web nema, i obrnuto

**Mobilni ima (web nema):** poređenje sa prethodnim periodom, KPI pouzdanosti, izvoz, cilj-vs-postignuto.
**Web ima (mobilni nema/ne radi):** shadow izvještaj, prava tabela historije sa straničenjem, gas analitika po periodu, `truncated` upozorenja.

**Ovo su dva različita proizvoda nad istim backendom.** Isti korisnik dobija različite brojeve i različite tvrdnje zavisno od ekrana. To je najveći nalaz audita.

---

## 4. Preporuke, po uzroku i redu

| # | popravka | uzrok | veličina | rizik |
|---|---|---|---|---|
| 1 | Mobilna historija: čitati `truncated` i prikazati „prikazano 14 od 312" | **prikaz laže** | 1 linija + postojeći prevod | nula |
| 2 | Mobilni plin: proslijediti `from/to` iz `timeRange` | **pogrešan broj** | API param + 1 hook | nizak |
| 3 | `avgIndoorTemp`: nula van prosjeka | **0,31 K greška** | 1 linija u servisu | nizak — treba odluka šta nula znači |
| 4 | Ciklusi i trajanje pod istim filterom | strukturni kvar (danas 0/66) | 2 linije | nizak |
| 5 | Ujednačiti „uzorke" na kartici 3 | zbunjujuće | 1 linija | nula |
| 6 | `throw new HttpException(..., 400)` u `assertUserHasThermostat` | 500 umjesto 4xx | 1 linija | nula |
| 7 | Novi endpoint: dnevne metrike iz `DailyRecord` | **kanal nedostaje** | veći posao | **prvo podatak** — 5/86 |
| 8 | Ne dirati prag 8 za `degreeDays` | 2,1 red/dan ne nosi mjerenje | — | — |

**Preporučeni red:** 1, 2, 5, 6 (nula rizika, uklanja laž), pa 3 i 4 (mijenjaju broj, treba odluka), pa 7 (tek kad podatak naraste iznad praga 25 %).

**Šta ne radi:** popravke 3 i 4 mijenjaju prikazane brojeve. Ako se rade prije 1 i 2, korisnik vidi promjenu broja bez objašnjenja, a lažna rečenica („14 dana zabilježeno") ostaje. Redoslijed nije estetski.

---

## 5. Reprodukcija

```bash
# bez baze — provjera presuda
node backend/scripts/analytics-truth-readonly.cjs --self-test     # 17/17

# mjerenje (read-only)
cd backend && DATABASE_URL_READONLY=... node scripts/analytics-truth-readonly.cjs
cd backend && DATABASE_URL_READONLY=... node scripts/analytics-truth-readonly.cjs --json

# kroz CI (anotacija u run-u)
gh workflow run backend-build.yml --ref <grana> -f baseline=true
```

Mjerenje je u CI-ju prije `F3.4` (`.github/workflows/backend-build.yml`, korak „Analytics truth").
