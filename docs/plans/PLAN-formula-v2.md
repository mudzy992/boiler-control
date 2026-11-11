# PLAN — formula v2: penzionisanje stare krive i puštanje toplotnog bilansa

Status: **F1 implementiran; F2 implementiran, CI zelen (2026-11-07), nije pušten
u produkciju**; F3–F5 nijesu. **Blokada je dijagnostikovana (§10.1): pisac
`daily-2` još ne piše u produkciji** — `DailyRecord` ima 304 dana, ali svi su
backfill (`backfill-events-1`, 301) ili `daily-1` (3). Bez `daily-2` nema
`nightMinC`, pa se F2 ne pušta. `backfill_apply` je izvršen (§10.2: 0 redova,
historija je već popunjena), a **uzrok je redoslijed upisa** (§10.3): pisac
preskače dan koji već ima red, pa `daily-2` može nastati tek za prvi dan bez
reda — **11-12**. Čekanje ide od tog datuma, ne od backfill-a. Odluka vlasnika
(2026-11-07): stara formula ide u penziju, nova (`HomeModel` + `DailyRecord`)
postaje jedini put. Obim (dokumentovanje, planiranje, testiranje na CI prije
produkcije) je vlasnikov zahtjev.

Dokument je pisan tako da se po njemu radi bez ponovnog istraživanja koda.
Svaka stavka nosi: **zašto**, **gdje** (fajl:linija), **kako se mjeri da je
urađeno** i **rizik**. Mjerenja u ovom dokumentu su izvršena, ne procijenjena —
v. §9 „Dokazi".

---

## 0. Izvršni sažetak

**Tri nalaza mijenjaju redoslijed u odnosu na prvobitni predlog.**

1. **`DailyRecord.nightMinC` se nikada ne piše.** Nijedan `create` ni `update`
   u repozitoriju ne postavlja to polje; jedini čitač je
   `proposal-shadow.service.ts:169`. Posljedica: `nightFloorFor()` se poziva sa
   `null` → `NO_FORECAST`, pa **noćni pod nikad ne postoji**, a `exploration`
   je uvijek blokiran sa `NO_FORECAST`. To je tiho isključena polovina
   kontrolera.
2. **Ispravka `− c` smanjuje broj ciklusa za 16 % uz isti komfor**, i to u sve
   tri kuće (mjereno, v. §9). Ista greška (nedostaje `− c`) postoji i u
   `scripts/audit/learning_sim.cjs`, pa je dosadašnja simulacija mjerila
   pogrešan kontroler.
3. **`HeatingRecommendation.confidence` se prosječuje u health score (35 %
   težine)**, a sam je monotono rastući → pokazuje sve bolje stanje što duže
   sistem radi, nezavisno od stvarnog ishoda.

Redoslijed rada je zato: **prvo podaci koji ne postoje (F1), pa formula (F2),
pa mjerenja (F3), pa penzionisanje (F4)**. Penzionisanje stare krive je
najveći i najvidljiviji dio posla, ali nije prvi: bez F1 se nova formula ne
može ni ocijeniti.

---

## 1. Gdje smo danas (stanje koda, provjereno)

| Put | Šta je | Stanje |
|---|---|---|
| `Heating/strategies/*` | stara kriva + 3 aditivna offseta, klem 46–55 | **proizvodi predlog** (`daily-record.writer.ts:331`) i `/boiler/sync` (`boiler.service.ts:208`) |
| `HomeModel/daily-balance.ts` | dnevni bilans `y = s·x − c`, OLS + MAD + bootstrap CI | radi, ali `c` se **ne koristi** u predlogu |
| `DailyRecord/proposal-shadow.service.ts` | kontroler u sjenci (`shadowFlowC`) | računa se svaki dan, ali sa mrtvim noćnim podom (nalaz 1) |
| `DailyRecord/proposal-controller.ts` | red pravila, ±2 K/dan, dwell, tvrde granice | dobro postavljen; nikad nije pušten na bojler |
| `Boiler/boiler.service.ts` | kriva po zahtjevu, `getIntervalKey()` sa server `new Date()` | **koristi `User.timezone` nigdje** |
| `HeatingRecommendation/*` | EMA učenje overshoota, `confidence` monotona | piše `Recommendation` redove paralelno sa `DailyRecord` |

**Dva paralelna sistema.** `DailyRecord` (novi, tačan) i `Recommendation`
(stari, kriva) nastaju u različitim trenucima i sa različitim brojevima.
Klijenti čitaju `Recommendation.breakdown.baseCurveTemp` — dakle **staro**.
Penzionisanje zato nije „obrisati fajl", nego „prestati proizvoditi drugi
broj", a to dira ugovor prema frontendu i mobilnom.

---

## 2. Nalazi (ono što plan rješava)

### F1 — `nightMinC` / `dayMeanC` / `dayMaxC` / `degreeHours` se ne pišu
- **Dokaz:** `grep -rn "nightMinC" backend/src` → samo čitanja i tipovi; upisi u
  `dailyRecord.create` (`writer.ts:373`, `:436`) i `updateMany`
  (`daily-outcome.service.ts:198`, `:227`) nemaju ta polja.
- **Posljedica u kontroleru:** `proposal-shadow.service.ts:183` traži
  `nightMinC != null` → uvijek `false` → `modelFlowC = null` → kontroler vraća
  `HOLD` sa `NO_MODEL` **za svaku kuću, svaki dan**.
- **Posljedica u istraživanju:** `explorationFor()` blokira sa `NO_FORECAST`.
- **Zašto ovo nije uhvaćeno testovima:** `proposal-shadow.service.spec.ts` u
  fixture-u *postavlja* `nightMinC: -3`; test provjerava da servis ispravno
  čita polje koje u produkciji nikad ne postoji.

### F2 — `− c` nedostaje u ravnotežnoj polaznoj
- **Mjesto:** `proposal-shadow.service.ts:183-189`.
- **Trenutno:** `equilibriumFlowC = target + slopeCiHigh·(target − nightMin)`.
- **Treba:** `target + s·(target − O_ref) − c`, gdje je `c = internalGainC`
  (upisan u `HomeModel`, v. `daily-balance.ts:331`).
- **Izmjereno:** `c ≈ 0,92–1,01 K` u sve tri kuće, tačno od 10. dana. Ispravka
  snižava polaznu ~1 K i **smanjuje cikluse/dan sa 28,1 na 23,1 (light), 21,7
  na 18,2 (medium), 6,6 na 5,6 (heavy)** — bez ijednog dana podbačaja.

### F3 — `slopeCiHigh` uvijek gore
Jednosmjerna pristrasnost +0,2–0,3 K. Ima smisla **dok je model mlad**; poslije
20 dana CI je ±0,01 i gornja granica više ne štiti od ničega.

### F4 — model nema starost
`FIT_WINDOW_DAYS = 60`, filteri (`MIN_SIGNAL_K=5`, `MAX_EQUILIBRIUM_DEVIATION_K=2`,
`DUTY` 0,05–0,98) odbiju cijelu sezonu bez kontrasta; `slopeS` tada ostaje
zadnji izmjereni broj bez oznake starosti, a kontroler ga koristi isto kao
svjež.

### F5 — stare strategije: aditivni offset i lom krive
- Kriva: `51 − 0,3·ext`, `ext` klemovan na `−15…+10`, plus tvrdi skok `45` za
  `ext ≥ 10` i `56` za `ext ≤ −15` (`base.strategy.ts:58-62`). Pri `ext = 10`
  funkcija pada sa 48 na 45 — **prekid monotonosti**.
- Offsets su **°C na baznu vrijednost**: +4 K je 8 % polazne pri 0 °C, 30 % pri
  +10 °C. Fizikalno korekcija pripada na `(R̄ − Ō)`, tj. multiplikativno.
- `confidence` množi offset, ali ne ograničava bazu → pri `confidence = 0,1`
  offset od 4 °C ulazi gotovo pun.

### F6 — `intervalKey` u dva formata
5-dijelni (`weekday_morning`, `late_morning`, `afternoon`, `evening`, `night`)
iz `Boiler`/`HeatingRecommendation` vs. 2-dijelni iz
`proposal-schedule.ts:intervalKeyForLocalDate` (`weekend_morning`). Učenje i
predlog gledaju različite ključeve, a `morning` se dodatno množi ×0,6 i ×0,5.

### F7 — `confidence` je mrtav parametar i ulazi u health score
`(c·n + 0,1)/(n+1)` ignoriše novi dokaz → monotono raste prema 1.
`dashboard.service.ts:956-967` ga uzima sa težinom 35/100.

### F8 — nema verzije parametara uz predlog
`DailyRecord.modelVersion = 'daily-1'` je verzija **zapisivača**, ne formule.
`HomeModel.modelVersion = 'model-1'`. Nijedan broj (`s`, `ciLow/High`, `c`,
`u_day`) ne ide u izlaz predloga — pa se „prije/poslije" ne može izmjeriti.

---

## 3. Faze

### F1 — Podaci koje kontroler traži (preduslov za sve)

**Cilj:** `nightMinC`, `dayMeanC`, `dayMaxC` i `degreeHours` stvarno postoje,
iz prognoze koja je bila osnov predloga.

| # | Posao | Gdje | Mjera |
|---|---|---|---|
| F1.1 | `DailyWeatherInput` dobija `tempMin`, `tempMax` + **`nightMin`** (min satne prognoze 22:00–06:00 lokalno) | `Weather/daily-weather-input.ts`, `weather-v2.types.ts` | unit test: noćni min ≠ dnevni min na satu koji prelazi ponoć |
| F1.2 | `persistProposal` upisuje `nightMinC`, `dayMeanC`, `dayMaxC`, `degreeHours` | `daily-record.writer.ts:373` | `daily-record-writer.spec.ts`: polja nisu `null` |
| F1.3 | `persistSkipped` upisuje bar `nightMinC` ako prognoza postoji | `daily-record.writer.ts:436` | isto |
| F1.4 | Fallback za `WeatherCache` (bez v2): `nightMinC = temp_min` uz eksplicitno `nightMinSource: 'DAILY_MIN'` | `writer.ts:loadWeather` | test: bez v2 polje nije `null`, ali je označeno kao gruba procjena |
| F1.5 | Kad prognoze nema, polje ostaje `null` — **ne nula** | svuda | test: `NO_WEATHER` red ima `nightMinC: null` |
| F1.6 | **nije urađeno** — Backfill istorijskih `nightMinC` iz `ThermostatObservation.outdoorTempC` (mjereno, ne prognoza) u **odvojeno** polje `nightMinMeasuredC` | nova migracija + `backfill-reconstruction.ts` | skripta ispiše koliko % dana ima mjereno |

**Zašto odvojeno polje za mjereno:** `nightMinC` je *prognoza koja je bila osnov
predloga*, `nightMinOutdoorMeasuredC` je *šta se dogodilo*. Miješanje bi
onemogućilo ocjenu greške prognoze (F3.4).

**Rizik:** v2 prognoza vraća satne podatke (`WeatherHourV2[]`) — noćni min se
računa iz njih, ali satna prognoza može pokrivati samo 24 h od trenutka
preuzimanja. Zato F1.1 mora imati jasan test za noć koja prelazi granicu
dana; bez toga `nightMin` može biti min *pola* noći i izgledati ispravno.

**Definicija gotovog:** u produkcijskoj bazi, za 7 uzastopnih dana,
`COUNT(nightMinC IS NOT NULL) = COUNT(*)` za sve kuće koje imaju prognozu; a
`shadowReasons` prestaje da sadrži `NO_MODEL` zbog nedostatka noći.

#### Stanje F1 (implementirano 2026-11-07)

| # | Stanje | Gdje je sada |
|---|---|---|
| F1.1 | **urađeno** | `DailyRecord/night-forecast.ts` (novo): `nightMinimumFrom`, `daySummaryFrom`, `isNightHourOf`, `previousLocalDate`; `Weather/daily-weather-input.ts` računa `nightMinC` iz `response.hourly` u zoni kuće |
| F1.2 | **urađeno** | `daily-record.writer.ts` `persistProposal` upisuje `nightMinC`, `dayMeanC`, `dayMaxC`, `degreeHours` |
| F1.3 | **urađeno i prošireno** | `persistSkipped` prima prognozu; noć se upisuje i za `MISSED_WINDOW`, `OUT_OF_SEASON` (i `SUMMER`, i `AUTO`) |
| F1.4 | **urađeno** | fallback na `WeatherCache` daje `nightMinC = temp_min` uz `nightMinSource: 'DAILY_MIN'`; `dayMeanC`/`dayMaxC`/`degreeHours` ostaju `null` |
| F1.5 | **urađeno** | `null` kad prognoze nema; test tvrdi da nije nula |
| F1.6 | **nije urađeno** | backfill traži migraciju `nightMinMeasuredC` + odluku vlasnika (§7) |

**Odluke donesene tokom F1 (nisu u prvobitnom planu):**

1. **Verzija zapisa je podignuta na `daily-2`.** Polja su nova, pa `daily-1` i
   `daily-2` redovi ne smiju u istu analizu: noć u `daily-1` redu nije „nula",
   nego nije ni postojala.
2. **`nightMinSource` je dio zapisa** (`HOURLY` / `DAILY_MIN`), a ne samo
   interni detalj. Bez toga bi gruba procjena iz dnevnog minimuma izgledala
   isto kao mjerenje iz sata — a analiza greške prognoze (F3.4) bi mjerila
   sopstvenu zamjenu.
3. **`params` razdvaja ulaz motora od podataka zapisa.** Motor i dalje dobija
   `weather: { tempMin, tempMax }`, a noć/dan idu u `params.input.forecast`.
   Razlog: zapis mora ostati preračunljiv — ako se u `params.input.weather`
   podmetne prošireni objekat, stari motor ga ne bi mogao reproducirati.
4. **`daySummaryFrom` poštuje `degreeHours` kao `Σ max(0, 15 − T_sat)`**, a ne
   prosjek: stepen-sati su zbir, i sabiranje po satima je jedino što se može
   provjeriti. (U backfill-u se `degreeDays` računa iz mjerenog prosjeka —
   dvije veličine, dva izvora; ne miješati ih.)
5. **Pad prognoze ne oduzima red.** `tryLoadWeather` hvata grešku i vraća
   `null`; bez toga bi `MISSED_WINDOW` red prestao da nastaje zbog Open-Meteo
   greške — regresija uvedena samim F1.

---

### F2 — Formula: `− c` + referentna vanjska + starost modela

**Stanje: implementirano 2026-11-07, nije pušteno u produkciju.** Izraz živi u
`backend/src/modules/DailyRecord/equilibrium-flow.ts` (`EQUILIBRIUM_VERSION =
'equilibrium-1'`) i jedini ga poziva `proposal-shadow.service.ts`
(`SHADOW_VERSION = 'shadow-2'`).

#### Izraz

```
F_eq = T_cilj + s·(T_cilj − O_ref) − (c + u_day)

O_ref = (1 − w)·nightMinC + w·dayMaxC      w = 0,3
        (bez dayMaxC → O_ref = nightMinC, tj. ponašanje „noć samo")
s     = slopeCiHigh   dok je model.days < 20   (konzervativno)
        slopeS        inače
        nepoznat `days` → tretira se kao mlad
c     = internalGainC (null → 0, ne izmišlja se)
u_day = uDayC         (null → 0)
```

Nedostatak noći (`nightMinC` nema) ili nagiba (`s` nema) ⇒ `flowC = null`, razlog
`NO_NIGHT` / `NO_SLOPE`, kontroler drži `HOLD`. To je namjerno: bolje ne
predložiti ništa nego predložiti broj bez osnova.

`EquilibriumResult` nosi `flowC`, `slopeUsed`, `slopeSource` (`CI_HIGH`/`POINT`),
`outdoorRefC`, `outdoorRefSource` (`NIGHT`/`NIGHT_DAY_BLEND`),
`internalGainAppliedC`, `dayGainAppliedC`, `terms`, `reasons` — svaki predlog
zato može da se rekonstruiše iz loga, član po član.

#### Stavke

| # | Posao | Stanje | Gdje |
|---|---|---|---|
| F2.1 | `− c` u ravnotežnoj polaznoj | **urađeno** | `equilibrium-flow.ts` (`internalGainAppliedC`) |
| F2.2 | `O_ref = 0,7·nightMin + 0,3·dayMax` | **urađeno** | isto (`referenceOutdoorC`, `DAY_REFERENCE_WEIGHT`) |
| F2.3 | `s` po starosti: `days < 20` → `slopeCiHigh` | **urađeno** | isto (`chooseSlope`, `SLOPE_CONSERVATIVE_MAX_DAYS`) |
| F2.4 | `confidence = exp(−age/45)` kao prigušivač | **nije** — v. dolje | `proposal-controller.ts` |
| F2.5 | `u_day` i `− c` u isti znak, bez dvostrukog oduzimanja | **urađeno + test** | `equilibrium-flow.ts` + test „ne oduzima dvaput" |
| F2.6 | Ista greška u `scripts/audit/learning_sim.cjs` | **urađeno** | `--c=`, `--dayref=`, `--conservative=` |

**Zašto F2.4 nije urađeno:** mjereno u `learning_sim` — model od 10. dana ima
`c` tačan na 0,01 K, a `s` na 0,005 (v. §9). Prigušivanje po starosti bi zato
snižavalo polaznu **bez** ijednog dana manje greške; to je isti tip greške kao
`slopeCiHigh` poslije 20. dana, samo obrnutog znaka. F2.4 ostaje otvoreno dok
F3.2 (kalibracija `confidence`) ne pokaže da je starost stvarno prediktor
greške. Do tada je starost pokrivena kroz F2.3, gdje je efekat mjerljiv.

#### Mjereno (poslije implementacije, `learning_sim`, 60 dana, tri tipa kuće)

Komanda (ponovljiva):

```bash
node scripts/audit/learning_sim.cjs --scenario=controller --days=60 \
  --house=medium --json --c=<0|1> --dayref=<0|1>
```

| kuća | polazna: base → `−c` → `−c`+`O_ref` | ciklusa/dan: base → `−c` → `−c`+`O_ref` | podbačaj >1 K, dan 10+ |
|---|---|---|---|
| light | 39,1 → 38,0 → 37,1 | 28,37 → 23,47 → 17,78 | 0/50 u sva tri |
| medium | 43,6 → 42,6 → 41,4 | 21,80 → 18,63 → 13,52 | 0/50 u sva tri |
| heavy | 44,9 → 43,9 → 42,6 | 6,88 → 5,90 → 4,32 | 0/50 u sva tri |

Najgori podbačaj: 0,80 / 0,80 / 0,76 K — nepromijenjen kroz sve tri varijante,
tj. ni `−c` ni `O_ref` nijesu pojeli rezervu komfora.

**Efekat F2.3 (konzervativna granica prvih 20 dana) je mali i mjerljiv:** sa
`--conservative=20` medium ima 13,52 cikl/dan, sa `--conservative=0` 13,25 —
razlika 0,27 cikl/dan (2 %), uz istu polaznu na kraju i isti podbačaj. Dakle
konzervativnost košta 2 % ciklusa, a štiti prvih 20 dana; omjer je prihvatljiv.

**Kontradikcija iz ranijeg mjerenja je objašnjena, ne otklonjena.** Manje
ciklusa, ali **duži** medijalni ciklus na kraju (medium 52,5 → 79 min). To nije
greška modela nego mjerenja: `cycles.medianFirst` je prvih 10 dana, a
`medianLast` zadnjih 10, i polazna pada tokom 60 dana, pa ciklus duže traje dok
soba dođe do cilja. Duži ciklus **je** cilj (manje taktovanja), a broj ciklusa
pada jer ih je manje započeto — dvije brojke se ne isključuju.

#### CI zaštita (novo)

`scripts/audit/formula_v2_golden.cjs` + `fixtures/formula_v2_golden.json`
pokreću **istu** simulaciju i tvrde: polazna ±0,05 K, ciklusa/dan ±0,05,
podbačaj-dana tačno, najgori podbačaj ±0,01 K, dana preko 2 h tačno. Korak u
CI-ju: „Equilibrium controller golden (F2)" u `.github/workflows/backend-audit.yml`
(ne zavisi od baze). Namjerno nije `jest` test: kopija izraza u testu bi se mogla
pokvariti zajedno s izrazom, a ovako gate mjeri kroz istu skriptu koju čovjek
koristi za istraživanje.

**Reprodukcija:** `node scripts/audit/formula_v2_golden.cjs` (exit 1 na drift);
`--write` samo uz svjesnu odluku i objašnjenje u commitu.

**Rizik (nepromijenjen):** `− c` snižava polaznu, a jedini razlog zašto
simulacija ne pada u podbačaj je kontroler koji podiže na svaki podbačaj. Ako je
`c` precjenjen (cijeli `c` se pripisuje dobitku, a dio je greška fita), polazna
ide prenisko. Zato F2 ostaje u shadow režimu dok F3.1 (pokrivenost CI) i F3.4
(greška prognoze) ne budu imali izlaz na **stvarnim** podacima — a §10 pokazuje
da tih podataka za sada nema (`daily-2` upit vratio `0`).

**Definicija gotovog (ispunjeno osim produkcijske provjere):** manje ili isto
ciklusa i nijedan dodatni dan podbačaja na istoj istoriji ✓; izraz nosi sve
članove i verzije ✓; testovi 21 (modul) + 35 (servis) ✓; **CI zelen** ✓
(`dfc4ad5`: lint 0, `tsc` 0, jest 1574, F2 zlatni brojevi, build, frontend,
mobile) ; **stvarni podaci ✗** (nema `daily-2` redova — v. §10).

**Zaključak:** F2 je spreman za shadow produkciju po svim svojim kriterijumima
osim jednog — nema dokaza da `nightMinC` stvarno postoji u bazi. To je §10, i
to je sljedeći korak, ne F3.

#### Stanje CI gejta (2026-11-07)

Ovaj plan traži zelen CI prije produkcije, pa je gejt morao prvo **postojati**.
Do 2026-11-07 `backend-audit.yml` se nije pokretao na ovoj grani (trigger je
nabrajao dvije starije), pa je „CI zelen" značilo samo *build* + *frontend* +
*secret scan* — bez lint-a, `tsc`-a, jest-a sa Postgresom, OpenAPI provjere i
integracijskih testova. Prvi prolaz je zato našao 303 lint greške, 14 `tsc`
grešaka i zastario ugovor.

Sada, na `dfc4ad5`:

| provjera | rezultat |
|---|---|
| `Audit checks` — lint / `tsc` | **0 grešaka** (2 upozorenja `no-floating-promises`) |
| `Audit checks` — jest | **127 suiteova / 1574 testa** prolaze |
| `Audit checks` — integracijski | prolaze (uz Postgres) |
| `Audit checks` — **Equilibrium controller golden (F2)** | prolazi |
| `Audit checks` — OpenAPI ugovor | prolazi (ugovor regenerisan; falilo je sve iz F13/F15) |
| `Audit checks` — SEC-1/REL-4/PERF-1/redis repro | prolaze (prije su bili `exit 2` — skripte su nabrajale samo starije grane) |
| `Backend build` / `Frontend CI` / `Mobile CI` (418 testova) | prolaze |

`mobile-ci.yml` je dobio `arena/**` u trigger, jer je jedini koji vrti mobilne
**testove**; `backend-audit.yml` ima samo mobile `tsc`.

**Naučeno, da se ne ponovi:** artefakt `contracts/openapi.json` se kvario tiho
jer nijedan workflow koji ga provjerava nije pokrivat grane na kojima se radilo.
Gate bez pokrivene grane nije gate.

---

### F3 — Mjerenja (prije puštanja, ne poslije)

Svaka analiza je **offline skripta** koja čita bazu samo za čitanje (kao
`scripts/baseline-readonly.cjs`) ili radi na sintetici kao `learning_sim.cjs`.
Nijedna ne mijenja podatke.

| # | Analiza | Šta tvrdi | Kako |
|---|---|---|---|
| F3.1 | **Pokrivenost CI** | „95 % interval je stvarno 95 %" — koliko % dana padne unutar `[ciLow, ciHigh]` | novi `scripts/audit/ci_coverage.cjs`: za svaki dan sa modelom, uporedi stvarni `y` sa intervalom |
| F3.2 | **Kalibracija** | Brier score za `confidence` (mora biti bolji od stalnog 0,5) | isto, plus `confidence` iz `HeatingIntervalLearning` |
| F3.3 | **Ablacija** | koji član stvarno nosi odluku | `learning_sim.cjs --ablate=uday\|cihigh\|nightfloor\|shortcycle` |
| F3.4 | **Greška prognoze** | `dF/dO = s ≈ 1` ⇒ 1 K greške u noći = 1 K u polaznoj | `nightMinC` vs `nightMinOutdoorMeasuredC`, histogram razlike |
| F3.5 | **Saturacija** | koliko % zimskih dana radi na `maxFlowC` | iz `DailyRecord.shadowFlowC` vs `HomeProfile.maxHeatingFlowC` |
| F3.6 | **Drift `intervalKey`** | koliko ključeva ima `samples < 3` | `HeatingIntervalLearning` group by `intervalKey` |
| F3.7 | **Shadow vs. proposed** | koliko se kontroler razlikuje od krive i da li bi bio bolji | već postoji `shadow-report.service.ts`; treba samo CLI izvještaj |
| F3.8 | **Osjetljivost** | grid `STEP_UP/STEP_DOWN` × `DWELL` | `controller_sim.cjs` sa `--grid` |

**Redoslijed:** F3.1 i F3.4 prije F2.1 u produkciji; ostalo prije F4.

**Definicija gotovog:** svaka analiza ima izlaz u `docs/audit/` (tabela ili
JSON) i ponovljivu komandu u zaglavlju fajla.

---

### F4 — Penzionisanje stare krive (najveći dio)

Ovo je dio koji dira ugovor prema klijentima, pa ide u koracima sa prekidačem.

| # | Posao | Gdje | Mjera |
|---|---|---|---|
| F4.1 | `PROPOSAL_ENGINE=curve\|model` (env), default `curve` dok F1–F3 ne prođu | `daily-record.writer.ts` | oba puta pokrivena testom |
| F4.2 | Model put: `proposedFlowTemp = decideProposal(...)` umjesto `FlowTemperatureEngine.calculate` | `writer.ts:331` | test: isti ulaz ⇒ isti izlaz kao shadow odluka istog dana |
| F4.3 | `Recommendation.breakdown` dobija `engine: 'model'` + polja `s`, `c`, `ciLow/High`, `flow`, `reasons` | `recommendation-breakdown.ts` + DTO | OpenAPI se regeneriše; `frontend` tipovi (`openapi:check`) prolaze |
| F4.4 | Kad je `engine='model'`, `baseCurveTemp` **nije** izmišljen — polje dobija `null` i klijent prikazuje model | `RecommendationBreakdown.tsx` (web + mobile) | vizuelni test: nema „0,00 °C" |
| F4.5 | `/boiler/sync` (`calculateFlowTemp`) i `ThermostatPoll` prestaju zvati krivu; vraćaju posljednji `DailyRecord` | `boiler.service.ts:208`, `thermostat.polling.service.ts:267` | test: polling ne piše novi broj usred dana |
| F4.6 | `HeatingRecommendationService` prestaje pisati `Recommendation` (ostaje samo `intervalLearning`) ili se gasi | `heating.recommendation.service.ts:161` | test: jedan pisac `Recommendation` redova |
| F4.7 | Brisanje `Heating/engine` i `Heating/strategies` + njihovih testova | — | `grep` vraća 0 hitova; suite zelen |
| F4.8 | `minHeatingFlowC` default se usklađuje sa modelom (sada 46 iz krive) | `flow-range.ts` | test: predlog uvijek unutar raspona koji korisnik smije upisati |

**Rizik (najveći u cijelom planu):** F4.4 mijenja ono što korisnik vidi.
`baseCurveTemp` je danas uvijek broj; `null` traži izmjenu na webu **i** mobilnom,
a mobilni nosi `RecommendationBreakdown` sa vlastitim fallback-om
(`mobile/src/components/RecommendationBreakdown.tsx:60`). Ako se to propusti,
kartica prikaže `0,00 °C` ili padne.

**Rizik 2:** `FlowTemperatureEngine` koristi i `daily-record.writer` (predlog) i
`boiler.service` (polling, dashboard, `/boiler/sync`). Gašenje krive bez F4.5
ostavlja dashboard sa brojem koji nitko ne održava.

**Definicija gotovog:** `PROPOSAL_ENGINE=model` u produkciji 14 dana; nijedan
`shadowReasons` bez objašnjenja; `grep -r "FlowTemperatureEngine" src` prazan.

---

### F5 — Manje stavke koje idu uz F2/F4

| # | Posao | Zašto |
|---|---|---|
| F5.1 | Jedan modul konstanti (`FLOW_MIN/MAX`, dead zone 1,0 K, tolerancije) + contract test | ista konstanta danas u `flow-bounds.ts:12`, `base.strategy.ts:8`, `day-outcome.ts:27`, `thermostat.polling.service.ts:49` |
| F5.2 | `getIntervalKey()` sa `User.timezone`; jedan format ključa | `boiler.service.ts:240`, `heating.recommendation.service.ts:210` koriste server `new Date()` |
| F5.3 | `confidence` prestaje biti monotona: `n/(n+5)·max(0, 1 − residualStd/2)` | F7; ulazi u health score sa 35 % |
| F5.4 | Overshoot se uči jednom (percentil, ne prosjek) | sada dvaput: `HeatingRecommendation` EMA + `0,5·avgOvershoot` u `full.strategy.ts:15` |
| F5.5 | Log svakog klampa sa razlogom | danas se clamp vidi samo u `params.clamp`, ne u logu |
| F5.6 | `FORMULA.md` — jedna stranica: jednačine, konstante, opravdanje | sada rasuto po komentarima i „§" referencama |

---

## 4. Redoslijed i zavisnosti

```
F1 (podaci)  ──► F3.1, F3.4 ──► F2 (formula) ──► F3.3, F3.5..F3.8 ──► F4 (penzionisanje) ──► F5
   │                                    ▲
   └──────────► F1.6 (backfill) ────────┘
```

- **F2 ne može početi prije F1.2** — bez `nightMinC` nema `O_ref`, a bez
  `dayMaxC` nema ni mješavine. *(F2 je urađen na kodu prije nego što je F1
  potvrđen na stvarnoj bazi; zato F2 ostaje u shadow režimu — v. §10.)*
- **F4 ne može početi prije F3.1** — puštanje modela bez izmjerene pokrivenosti
  CI je zamjena jednog neprovjerenog broja drugim.
- **F5 ide paralelno**, osim F5.2 koja mijenja ponašanje učenja (i zato ide
  prije F4.6).

## 5. Testiranje na CI (vlasnikov zahtjev)

Postojeća infrastruktura je dovoljna, uz tri dodatka:

| Šta | Gdje | Zašto |
|---|---|---|
| `backend-build.yml` `test` job već vrti `jest --runInBand` na Postgresu 16 | `.github/workflows/backend-build.yml:145` | ništa novo ne treba za unit testove |
| **Novi korak: `Equilibrium controller golden (F2)`** — `node scripts/audit/formula_v2_golden.cjs` poredi `learning_sim` sa `scripts/audit/fixtures/formula_v2_golden.json` | `.github/workflows/backend-audit.yml`, `test` job | **urađeno 2026-11-07**; sprječava tihu regresiju formule; brojevi iz §9 su postali test. Exit 1 na drift > 0,05 K / 0,05 ciklusa / 1 dan podbačaja |
| **Novi korak:** migracije dvaput (već postoji) + provjera da `nightMinC` nije `null` na svježem seed-u | `backend-build.yml` `build` job | F1 se ne može „zaboraviti" |
| `frontend-ci.yml`: `openapi:check` mora proći poslije F4.3 | `frontend/package.json:17` | ugovor se mijenja svjesno |
| `mobile-ci.yml`: `tsc` poslije F4.4 | — | `null` u `baseCurveTemp` je tip |

**Pravilo:** nijedna faza se ne spaja ako CI nije zelen **i** ako brojevi iz
§9 nisu reprodukovani na CI mašini (ista verzija Node-a).

## 6. Šta ovaj plan namjerno NE radi

- **Ne dira multi-user, naplatu ni `UserPlan`** — odluka vlasnika: aplikacija
  ostaje privatna, za jednog korisnika.
- **Ne uvodi LAN ni lokalno čitanje uređaja** — odgođeno.
- **Ne mijenja `ThermostatObservation` šemu** — serija je dobra kakva jeste.
- **Ne optimizuje efikasnost kotla** (kondenzacijski limit). To je F5+ stavka i
  traži podatak o povratnom vodu kojeg danas nema.

## 7. Otvorena pitanja za vlasnika

1. **F1.2 `dayMaxC`:** uzimati iz prognoze ili izmjereno? Prognoza je ono što je
   bilo osnov predloga (konzistentno sa `nightMinC`), mjereno je ono što se
   dogodilo. Predlog: **prognoza** u `dayMaxC`, mjereno u odvojeno polje.
2. ~~**F2.3 granica 20 dana:**~~ **odgovoreno mjerenjem** — košta 2 % ciklusa
   (medium 13,52 vs 13,25 cikl/dan), podbačaj se ne mijenja. Zadržano na 20.
3. **F4.1 prekidač:** `PROPOSAL_ENGINE` kao env varijabla (brz rollback, ali
   stanje u konfiguraciji) ili kolona u `HomeProfile` (po kući, ali traži
   migraciju)? Predlog: **env**, jer je korisnik jedan.
4. **F4.4:** je li `baseCurveTemp = null` prihvatljivo na ekranu, ili radije
   prikazati „kriva se više ne koristi" uz `finalTemp`?

## 8. Procjena

| Faza | Posao | Procjena |
|---|---|---|
| F1 | podaci + migracija + backfill | 2–3 dana |
| F2 | formula + testovi | 2–3 dana |
| F3 | 8 analiza | 3–4 dana |
| F4 | penzionisanje + ugovor + web + mobile | 5–8 dana |
| F5 | male stavke | 3–4 dana |
| **Ukupno** | | **15–22 dana** |

Procjena je za jednog izvršioca, sekvencijalno, bez vremena na produkcijsko
posmatranje (F4 traži 14 dana rada prije nego se kriva obriše).

## 9. Dokazi (ponovljivo)

**Mjerenje 1 — ispravka `− c` i `O_ref`** (`learning_sim.cjs` sa dvije
patchovane linije, 60 dana, `--scenario=controller`):

| kuća | base | `−c` | `−c` + `O_ref` |
|---|---|---|---|
| light | 28,05 cikl/dan, 39,1 °C | 23,13, 38,1 °C | 17,15, 37,1 °C |
| medium | 21,65, 43,6 °C | 18,22, 42,6 °C | 13,25, 41,4 °C |
| heavy | 6,62, 44,9 °C | 5,57, 43,9 °C | 3,95, 42,5 °C |

Podbačaj: `0/50` dana u svakoj kombinaciji; najgori 0,76–0,81 K; nijedan dan
preko `T_max`.

**Mjerenje 2 — identifikacija `c`** (isti simulator, fit iz prvih `d` dana):

| kuća | dan 10 | dan 20 | dan 40 | dan 60 |
|---|---|---|---|---|
| light | 0,93 | 0,99 | 0,98 | 0,93 |
| medium | 0,92 | 1,01 | 0,98 | 0,96 |
| heavy | 0,93 | 0,96 | 1,04 | 1,00 |

`c` je tačan od 10. dana, isto kao `s` — dakle **nema razloga čekati** da se
počne koristiti.

**Reprodukcija:** patch je bio privremen (u `/tmp`, nije u repou). F2.6 ga je
pretvorio u trajne prekidače `learning_sim.cjs`:

| prekidač | značenje |
|---|---|
| `--c=0\|1` | oduzimati `c` (zadano `1`, kao produkcija) |
| `--dayref=0\|1` | `O_ref` miješa dan (zadano `1`) |
| `--conservative=n` | gornja CI granica prvih `n` dana (zadano 20, `0` = nikad) |

Brojevi iz tabele gore postaju CI test kroz
`scripts/audit/formula_v2_golden.cjs` (v. „CI zaštita" u F2).

---

## 10. Prvi korak

**F1.1–F1.5 su urađene** (v. „Stanje F1" gore), **F2 je implementiran ali nije
pušten**. Sljedeće je **provjera na stvarnoj bazi**, a ne novi kod — upit ispod
je pušten 2026-11-07 i vratio **`0`**:

```sql
SELECT COUNT(*) FILTER (WHERE "nightMinC" IS NOT NULL) AS ima_noc,
       COUNT(*) AS ukupno
FROM "DailyRecord"
WHERE "modelVersion" = 'daily-2'
  AND "localDate" >= (CURRENT_DATE - 7)::text;
```

### 10.1 Rezultat razlikovnog upita (2026-11-07, read-only, `baseline` job)

Mjereno na produkciji preko `DATABASE_URL_READONLY` (run `43026160240`), bez
ijednog upisa:

| šta | vrijednost |
|---|---|
| `DailyRecord` ukupno | **304 dana** |
| porijeklo | `backfill-events-1` → **301 dan**; `daily-1` → **3 dana** |
| `daily-2` redova | **0** |
| `daily-1` redova | **3** |
| `daily-2` sa noći | 0 (nema redova — pitanje se ne postavlja) |
| dnevni zapis sa `shadow*` | **2 dana** |

**Zaključak: uzrok `0` nije noć, nego to što pisac `daily-2` u produkciji još
ne piše.** Historija je 99 % rekonstruisana backfill-om (`backfill-events-1`,
301 dan) — to su dani bez prognoze, pa bez `nightMinC`, i to je ispravno
ponašanje, ne greška. F1 (koji uvodi `daily-2` i noć) je implementiran, ali
**nije pušten**, pa nema ni jednog dana po novom piscu.

Zato:

- **F2 se ne pušta** — `O_ref` bi bio `null` na svakom danu, jer nema `daily-2`.
- **F1.6 (backfill + `nightMinMeasuredC`) i puštanje pisca `daily-2` idu
  prvi.** Tek poslije nekoliko dana rada pisca ima smisla mjeriti §10 ponovo.
- Kad pisac proradi, isti `baseline` job već odgovara na pitanje — nema
  novog koda, samo novi run (`gh workflow run backend-build.yml -f baseline=true`).

Ostali nalazi iz istog runa, korisni za F3:

| nalaz | značenje za plan |
|---|---|
| ciklusi: 118 dana, 422 ciklusa (2026-01-07 → 2026-11-11) | dovoljno za F3.5/F3.7, ali samo 118 od 304 dana ima događaje |
| mjerenja: 618 uzoraka, 3 dana sa noćnim uzorcima | **F3.4 nije mjerljiva** — 3 dana je premalo za histogram greške prognoze |
| `nightMinOutdoorMeasuredC` parova | 0 (nema `daily-2`) |
| plin: 134 očitanja, 920,9 m³, medijana razmaka 1 dan | podaci za efikasnost postoje |
| šema: 5/5 kolona postoji | F1 kolone su primijenjene u produkciji |

### 10.2 `backfill_apply` izvršen (2026-11-07) — upisao 0 redova

Pokrenuto sa `gh workflow run backend-build.yml -f backfill_apply=true`
(run `43028503822`), sa produkcijskim kredencijalom za upis.

| | prije | poslije |
|---|---|---|
| `DailyRecord` | 304 dana | **304 dana** |
| `backfill-events-1` | 301 dan | **301 dan** |
| `daily-1` | 3 dana | **3 dana** |
| `daily-2` | 0 | **0** |
| `backfill upis` | — | **0 redova** („postojećih 304 dana") |

**Zašto 0:** rekonstrukcija ne nalazi nijedan dan koji još nema red. Izvori
su prazni za sve dane koje bi dopunili (`ciklusi 0, plin 0, stepen-dan 0,
predlog 0`), jer su ti dani već rekonstruisani u ranijem backfill-u. Upis je
time **no-op, ne neuspjeh** — i to je dobar ishod: nema duplikata, nema
prepisanih mjerenja.

**Šta ovo mijenja za plan:** ništa dobro ni loše po F2 — F2 i dalje čeka
`daily-2` redove. Ali **mijenja F1.6:** backfill više nije korak koji nešto
donosi. Historija je popunjena; ono što nedostaje je **novi pisac**, ne stari
dani. F1.6 se zato svodi na: pustiti pisac `daily-2` da radi, pa za nekoliko
dana ponovo pokrenuti baseline i vidjeti §10.

Sigurnosne osobine koje su se potvrdile u ovom runu (vrijedi zapisati, jer su
bile tvrdnje u kodu):
- upis traži **odvojen** kredencijal `DATABASE_URL_BACKFILL`; bez njega
  skripta odbija `--apply` i ne pada na `DATABASE_URL`,
- jedna transakcija (`BEGIN`/`COMMIT`, `ROLLBACK` na grešku),
- `ON CONFLICT ("homeProfileId", "localDate") DO NOTHING` — ponovni run ne
  pravi duplikate.

### 10.3 Zašto `daily-2` ne nastaje i poslije redeploya (2026-11-07)

Poslije redeploya baseline je ponovo mjeren (`43031117171`, `43032181999`) i
`daily-2` je i dalje **0**. Uzrok nije ni kod ni deploy — nego **redoslijed
upisa**. Dokazi, po datumu:

| dan | model | upisan (UTC) |
|---|---|---|
| 10-29 … 11-08 | `backfill-events-1` | 09.11. 11:19 (svih 11 u istoj minuti) |
| 11-09 | `daily-1` | **11.11. 02:20** |
| 11-10 | `daily-1` | **11.11. 02:20** |
| 11-11 | `daily-1` | **11.11. 05:00** |

F1 (`daily-2`) je commitovan **11.11. u 11:23 UTC** — poslije svih ovih upisa.
Zato:

1. **Dva reda u istoj minuti** znače da ih nije napisao cron (koji piše jedan
   dan za tekući dan), nego backfill za prošle dane.
2. Pisac **preskače dan za koji red već postoji**, bez obzira na
   `modelVersion` (`daily.recommendation.service.ts`, `written` skup). Dakle
   dan koji je jednom rekonstruisan ostaje `backfill-events-1` zauvijek.
3. `daily-2` može nastati **samo za dan koji još nema red** — dakle za
   **11-12**, prvi dan poslije deploya.

**Mjerni prozor se pomjera:** ne „poslije nekoliko dana od backfill-a", nego
**od prvog dana poslije 11.11. 11:23 UTC**. Prvi `daily-2` red se očekuje
11-12 oko 06:00 lokalno (05:00 UTC zimi).

Ovo je i dobar ishod: backfill je ostavio historiju, a pisac preuzima od prvog
dana bez reda. Nema miješanja dvije verzije u istom danu.

### 10.4 Gejt: dva kvara koja su izgledala kao kod (2026-11-07)

Dok se čekao prvi `daily-2` dan (§10.3), CI je tri puta pao na stvarima koje
nijesu bile u kodu. Vrijedi zapisati, jer oba obrasca se ponavljaju:

**1. `gasOpenSheets` — tri pada, tri pogrešne dijagnoze.** Test je padao sa
porukom koja izgleda kao da se sheet nije montirao. Redom je probano: veći
timeout u testu (15 s, commit `9060b19`), pa `--ignore-scripts` u instalaciji
(`fdcbb31`). Ni jedno nije pomoglo, jer pravi uzrok nije bio u testu nego u
**konfiguraciji runnera**: `jest.config.js` nije postavljao `testTimeout`, pa je
važilo zadanih **5000 ms po testu**. Test lokalno traje ~3,8 s; na opterećenom
runneru pređe 5 s i Jest ga ubije **prije** nego `findBy*` dođe do svoje granice
od 15 s. Granica u testu je bila nedostižna. Rješenje: `testTimeout: 20_000`
(`9509685`).

**2. Playwright CDN.** `npx playwright install` padao je u **oba** workflowa
(`frontend-ci.yml` i `backend-audit.yml`) na kodu koji je sat prije prolazio.
Dokaz da nije kod: `frontend-ci.yml` nije bio mijenjan, a pao je u 13:51 poslije
uspjeha u 13:48. Rješenje: keš browsera po `hashFiles('frontend/package-lock.json')`
(`69738dc`) + tri pokušaja sa 20 s pauze (`f3b269a`).

**Stanje na kraju (commit `1a92842`, 15:50 UTC):** Audit checks ✓, Frontend CI ✓,
Mobile CI ✓, Secret scan ✓, Backend build ✓. Baseline `43093726920` ponovljen
na tom commitu i daje isto kao u §10.3 — `304` dana, `daily-2` **0**,
zadnji `daily-1` upisan `11-11 05:00`. Gejt je zelen i mjeri tačno ono što
treba; nema više dijagnostike koja visi.

### 10.5 `/api/dashboard` je padao kad Open-Meteo ne odgovori (2026-11-07)

Gejt je na commit `f414109`, koji mijenja **samo dokumentaciju**, pao u backend
`test` jobu: `GET /api/dashboard` je vraćao **500**. Pošto taj commit ne dira kod,
pad je morao biti u kodu koji je već stajao — i bio je:

```
getDashboard → homeDailyFlow → boilerService.calculateFlowTemp
             → weatherService.getTodayWeather → throw
```

`getTodayWeather` baca grešku kad nema svježeg keša a Open-Meteo ne odgovori
(2 × 10 s timeout). Posljedica: dashboard padne **ulogovanom korisniku** kad god
je spoljni servis nedostupan — iako jutarnji predlog za dan već postoji u
`DailyRecord`-u i **ne zavisi od mreže**.

Popravka je degradacija, ne gašenje greške:

| putanja | prije | poslije |
|---|---|---|
| `homeDailyFlow`, predlog postoji | 500 | `basis: 'MORNING'`, `currentFlowC: null` |
| `homeDailyFlow`, bez predloga | 500 | `basis: 'NONE'` |
| anonimni dashboard | 500 | `recommendedFlowTemp: 0` |

`anchorDailyFlow` je sve tri situacije **već** podržavao — servis je bio taj koji
ih nije koristio. Test `dashboard-weather-failure.spec.ts` padao bi prije ove
izmjene.

Uz to `backend/jest.config.js` dobija `testTimeout: 30_000`, isto kao
`jest-integration.config.js`. Ugovorni test je pao kao „Exceeded timeout", ne
kao tvrdnja — dižu cijeli `AppModule`, pa im je zadanih 5 s tijesno. To je isti
uzrok kao kod mobilnog `gasOpenSheets` (§10.4): **granica u testu iznad zadanog
Jest limita nikad ne stupi na snagu.**

### 10.6 Završno stanje gejta (2026-11-07, `d04dfab`)

| provjera | stanje |
|---|---|
| Audit checks | ✓ (`test`, `frontend`, `mobile` svi zeleni) |
| Frontend CI | ✓ |
| Mobile CI | ✓ |
| Secret scan | ✓ |
| Backend build (baseline) | ✓ |

Baseline `43115294390`: `304` dana, `daily-2` **0**, zadnji `daily-1` upisan
`11-11 05:00 UTC` — dakle stanje je isto kao u §10.3, kako i treba: **prvi
`daily-2` dan je 11-12.**

**Zapažanje o flaky testovima.** `gasOpenSheets` je padao u četiri navrata i
svaki put sa porukom koja nije razlikovala uzroke. Pravi uzrok je bio
`testTimeout` (§10.4), ali je put do njega bio predug zato što **logovi joba
nijesu bili preuzimljivi** (`gh run view --log` vraća praznu arhivu), a
anotacije nose samo ime testa. Zato sada oba mobilna workflowa dodaju Jest JSON
kao artefakt pri padu (`b33f033`, `d04dfab`) — dijagnostika prestaje da bude
nagađanje.

**Pravilo koje izlazi iz oba:** kad gejt padne na koraku koji nije `test`/`lint`/
`tsc` (instalacija, preuzimanje, mreža), prvo se poredi **isti** korak u
**drugom** workflowu na **istom** commitu. Ako tamo prolazi, uzrok je
konfiguracija ili okruženje, ne kod.

**Automatizovano (2026-11-07):** isti razlikovni upit je sada dio
`backend/scripts/backfill-coverage.cjs` (`baseline` job, read-only, sekcija
„F2: noć u dnevnom zapisu"). Skripta ne samo broji, nego i **presuđuje**:
`0` redova → „F2 se ne pušta"; ima redova bez noći → „provjeri
`nightMinSource`"; noć djelimična → „`O_ref` je slabiji nego što izgleda".
Uz to mjeri i `dayMaxC` (potreban za `O_ref` mješavinu) i F3.4 parove
(`nightMinC` vs `nightMinOutdoorMeasuredC`, prosječna i najgora greška).
Pokretanje: `gh workflow run backend-build.yml -f baseline=true`.

Ručni upit ostaje za slučaj kad se gleda van CI-ja:

**Rezultat `0` je dvosmislen i to je blokada, ne prepreka.** `0` može značiti
(i) nema `daily-2` redova uopšte — pisac još ne piše u produkciji, ili (ii) ima
redova ali nijedan nema `nightMinC`. Upit ne razlikuje ta dva slučaja. Zato
prvo ide razlikovni upit, pa tek onda F3.4:

```sql
SELECT COUNT(*) AS ukupno,
       COUNT(*) FILTER (WHERE "nightMinC" IS NOT NULL) AS ima_noc,
       COUNT(*) FILTER (WHERE "nightHoursUsed" >= 8)   AS puna_noc,
       MIN("localDate") AS prvi,
       MAX("localDate") AS zadnji
FROM "DailyRecord"
WHERE "modelVersion" = 'daily-2';
```

- `ukupno = 0` → pisac `daily-2` ne radi u produkciji. F2 tada ostaje shadow i
  **ne smije** se puštati; radi se F1.6 (backfill) i provjera pisca.
- `ukupno > 0`, `ima_noc = 0` → noć se ne popunjava; uzrok je `nightMinSource =
  'DAILY_MIN'` ili kraći satni niz.
- `ima_noc > 0`, `puna_noc < ima_noc` → `nightHoursUsed < 8`; noć je djelimična
  i `O_ref` je slabiji nego što izgleda.

Ako je `ima_noc = ukupno`, noć postoji i F2 može u produkciju. Ako nije, uzrok je
jedan od tri: kuća nema prognozu, `nightMinSource = 'DAILY_MIN'` (nema satne),
ili je `sub` sat pokrio samo dio noći — treće se vidi po `nightHoursUsed < 8`.

Zatim **F3.4** (greška prognoze: `nightMinC` vs `nightMinOutdoorMeasuredC`) —
jedina analiza koja se može uraditi odmah, jer mjereno polje već postoji iz
`day-outcome.ts`. Bez nje se ne zna da li `− c` u F2 treba ići sa dnevnom
referencom ili ostati na noći.
