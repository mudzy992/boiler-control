# PLAN — formula v2: penzionisanje stare krive i puštanje toplotnog bilansa

Status: **F1 implementiran; F2 implementiran, CI zelen (2026-11-07), nije pušten
u produkciju**; F3–F5 nijesu. **Blokada je dijagnostikovana (§10.1): pisac
`daily-2` još ne piše u produkciji** — `DailyRecord` ima 304 dana, ali svi su
backfill (`backfill-events-1`, 301) ili `daily-1` (3). Bez `daily-2` nema
`nightMinC`, pa se F2 ne pušta. `backfill_apply` je izvršen (§10.2: 0 redova,
historija je već popunjena), a **uzrok je redoslijed upisa** (§10.3): pisac
preskače dan koji već ima red, pa `daily-2` može nastati tek za prvi dan bez
reda — **11-12**. Čekanje ide od tog datuma, ne od backfill-a.

**Prvi `daily-2` dan je nastao** (§10.7): 11-12, upisan `05:00 UTC` = 06:00
lokalno, dakle **prije** današnjeg deploya u 07:42 — prethodni redeploy je
stvarno uzeo F1 kod. Noć u tom danu je djelimična (`nightHoursUsed < 8`), pa se
puna noć očekuje 11-13.

Gejt je **zelen u cijelosti** (§10.6, `d04dfab`): Audit, Frontend CI, Mobile CI,
Secret scan, Backend build. Usput su popravljena dva stvarna kvara koja su se
krila iza crvenog CI-ja: mobilni `testTimeout` (§10.4) i `/api/dashboard` koji je
vraćao 500 kad Open-Meteo ne odgovori (§10.5). Odluka vlasnika
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

### 1.1 Stanje po fazama (2026-11-12)

| Faza | Stanje | Dokaz |
|---|---|---|
| F1 — podaci | **urađeno**, `nightMinC`/`dayMaxC` se pišu; backfill izvršen | §10.1, §10.2, §10.7 |
| F2 — formula | **urađeno u kodu**, ostaje u shadow režimu | §10.3, `formula_v2_golden.cjs` |
| F3.1 — pokrivenost | **izmjereno**: `NOT_ENOUGH_DAYS (0/8)`, `NO_OUTDOOR 3` — isti korijen kao F3.4 (v. §10.31) | §10.10, §10.31 |
| F3.3 — ablacija | **urađeno**: `--ablate`, `--table`, `--self-test` | §10.14 |
| F3.7 — shadow vs. proposed | **izmjereno**: podizanja su `NO_MODEL`; drugi prozor **2026-11-30** | §10.9 |
| F3.4 — greška prognoze | **flag uključen, lanac radi**; ostaje `MIN_DAYS=5` parova → prvi broj ~**2026-11-18** (§10.33) | §10.17, §10.30, §10.33 |
| F3.5 — saturacija | **izmjereno**: 5/303 dana na granici, 0 `CAPACITY` | §10.16 |
| F3.8 — osjetljivost | **urađeno**: `DWELL` 7 ⇒ 3× više ciklusa | §10.8 |
| F4 — penzionisanje krive | **djelimično**: F4.1–F4.6 i F4.8 urađeni; **F4.7 blokiran** — stara kriva ima 2 živa potrošača | §10.21–§10.27 |
| F5.1 — konstante | **urađeno**, jedan modul + contract test | §10.11 |
| F5.2 — ključ intervala | **bio već urađen**; mjerenje pokazalo da migracija nije potrebna | §10.12 |
| F5.6 — `FORMULA.md` | **urađeno**, sa provjerom koja pada kad dokument ostarji | §10.13 |
| F4.2 | **urađeno**: zajednička odluka izdvojena; writer uzima `F_eq`, ne kontroler | §10.26 |
| F4.5 | **kod urađen, gejt otvoren do deploya** — ponovljeno mjerenje mora ići sa `--since=<deploy>` | §10.25 |
| F4.5 | **urađeno**: `resolveDailyFlow` — jedan broj za dan; mjerenje prije: 10/27 vidljivo, max 2,76 K | §10.24 |
| F4.5 | **mjereno**: 10/27 kuća-dana vidljivo pomjeranje, max 2,76 K; izmjena koda slijedi | §10.23 |
| F4.3/F4.4 | **urađeno (backend)**: breakdown v2 nosi `engine`+`model`; kriva je `null`, ne `0` | §10.22 |
| F4.1 | **urađeno**: prekidač `PROPOSAL_ENGINE`, zadano `curve` (deploy ne mijenja ništa) | §10.21 |
| F4.6 | **urađeno**: `HeatingRecommendationService` više ne piše `Recommendation`; mjereno 15/54 dana, max 3,74 K | §10.26b |
| F4.8 | **urađeno**: granica unosa = fizički pod (30), ne pod krive (46); mjereno 32,9 °C gdje je unos bio zaključan | §10.27 |
| F4.7 | **BLOKIRANO**: 4 živa potrošača (§10.28) + mjereno da je motor **živi fallback** 5/61 dana, praznina 2026-10-06…10 (§10.29) | §10.28, §10.29 |
| F5.3–F5.5 | **urađeno**: `confidence` iz dokaza, premašivanje jednom (p90), klamp imenovan | §10.18–10.20 |
| `u_day` u predlogu | **isključen** (`DAY_GAIN_IN_PROPOSAL = false`), procjena se i dalje mjeri | §10.14, §10.15 |

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
| F3.3 | **✓ urađeno** — **Ablacija** | koji član stvarno nosi odluku | `learning_sim.cjs --ablate=uday\|cihigh\|nightfloor\|shortcycle` |
| F3.4 | **✓ skripta** — **Greška prognoze** | `dF/dO = s ≈ 1` ⇒ 1 K greške u noći = 1 K u polaznoj | `nightMinC` vs `nightMinOutdoorMeasuredC`, histogram razlike |
| F3.5 | **✓ izmjereno** — **Saturacija** | koliko % zimskih dana radi na `maxFlowC` | iz `DailyRecord.shadowFlowC` vs `HomeProfile.maxHeatingFlowC` |
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
| F4.1 | **✓ urađeno** — `PROPOSAL_ENGINE=curve\|model` (env), default `curve` dok F1–F3 ne prođu | `daily-record.writer.ts` | oba puta pokrivena testom |
| F4.2 | **✓ urađeno** — model put uzima `F_eq` (kontroler je relativni, v. §10.26) | | `writer.ts:331` | test: isti ulaz ⇒ isti izlaz kao shadow odluka istog dana |
| F4.3 | **✓ urađeno (backend)** — `Recommendation.breakdown` dobija `engine: 'model'` + polja `s`, `c`, `ciLow/High`, `flow`, `reasons` | `recommendation-breakdown.ts` + DTO | OpenAPI se regeneriše; `frontend` tipovi (`openapi:check`) prolaze |
| F4.4 | **✓ urađeno (ugovor)** — `baseCurveTemp` je `null` kad je `engine='model'`; ekran (web+mobile) ostaje | — polje dobija `null` i klijent prikazuje model | `RecommendationBreakdown.tsx` (web + mobile) | vizuelni test: nema „0,00 °C" |
| F4.5 | **✓ kod** — `resolveDailyFlow`; `/boiler/sync` i polling vraćaju zapisani predlog (mjereno 10/27 prije izmjene) |; vraćaju posljednji `DailyRecord` | `boiler.service.ts:208`, `thermostat.polling.service.ts:267` | test: polling ne piše novi broj usred dana |
| F4.6 | `HeatingRecommendationService` prestaje pisati `Recommendation` (ostaje samo `intervalLearning`) ili se gasi | `heating.recommendation.service.ts:161` | test: jedan pisac `Recommendation` redova |
| F4.7 | **⚠ blokirano** — brisanje traži 4 koraka migracije prije (`§10.28`); danas 4 živa potrošača | `Heating/engine` (2 fajla), `Heating/strategies` (5) | `grep` vraća 0 hitova; suite zelen |
| F4.8 | **✓ kod** — granica unosa = fizički pod (30), ne pod krive (46); mjereno `MODEL_BELOW_OLD_FLOOR` 1/1, 13,1 K (§10.27) | `flow-range.ts:SYSTEM_MIN_CURRENT_FLOW_TEMP` | test: predlog uvijek unutar raspona koji korisnik smije upisati |

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
| F5.3 | **✓ urađeno** — `confidence` prestaje biti monotona: `n/(n+10)·max(0, 1 − residualStd/2)` | F7; ulazi u health score sa 35 % |
| F5.4 | **✓ urađeno** — Overshoot se uči jednom (p90, ne prosjek) | sada dvaput: `HeatingRecommendation` EMA + `0,5·avgOvershoot` u `full.strategy.ts:15` |
| F5.5 | **✓ urađeno** — Log svakog klampa sa razlogom (`clamp-log.ts`) | danas se clamp vidi samo u `params.clamp`, ne u logu |
| F5.6 | **✓ urađeno** — `docs/FORMULA.md` jedna stranica: jednačine, konstante, opravdanje | sada rasuto po komentarima i „§" referencama |

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

### 10.7 Prvi `daily-2` dan nastao — 11-12, prije današnjeg deploya

Predviđanje iz §10.3 se potvrdilo: baseline `43170154084` (2026-11-12 06:43 UTC)
daje `305` dana i prvi red po novom piscu:

```
11-12  daily-2  (tabela zadnjih 14 dana)
porijeklo: model=daily-2 → 1 dan
```

**Ali sat upisa mijenja tumačenje.** Red je upisan `11-12 05:00 UTC` = **06:00
lokalno** (CET). Vlasnik je izmjene pustio u produkciju u **07:42 lokalno** =
06:42 UTC. Dakle red je nastao **1 h 42 min prije** današnjeg deploya, iz koda
koji je već bio na produkciji — i nosi `daily-2`. To je nezavisan dokaz da je
**prethodni** redeploy (11-11, poslije F1 commita u 11:23 UTC) stvarno uzeo F1
kod. Današnji deploy zato ništa ne mijenja; on je dodatna sigurnost, ne uslov.

Isti run pokazuje i mehaniku obračuna ishoda: `11-11` sada ima `updatedAt
11-12 02:20 UTC` = **03:20 lokalno**, što je sat obračuna prethodnog dana iz
plana. Red je nastao u 05:00, a obračunat u 02:20 sljedećeg dana — dvije odvojene
faze, kako je i zamišljeno.

#### Operativno pravilo koje ovo otkriva

Pisac piše dan **samo između 06:00 i 12:00 lokalno** (`isWithinProposalWindow`).
Izvan tog prozora dan se i dalje bilježi, ali sa `skipReason: 'MISSED_WINDOW'` —
**bez predloga**. A pošto pisac preskače dan koji već ima red (§10.3), takav dan
je za mjerenje izgubljen trajno.

Zato: **deploy (ili restart) poslije 12:00 lokalno, na dan koji još nema zapis,
znači izgubljen dan za F2/F3.** Deploy u 07:42 je bio bezbjedan jer je zapis već
postojao. Pravilo za dalje: puštati izmjene pisca **prije 06:00 ili poslije
12:00 lokalno**, nikad između ako zapis još nije nastao.

Notifikacija o dnevnoj prognozi koju je vlasnik dobio danas odgovara tom zapisu —
`DAILY_RECOMMENDATION` se šalje jednom po UTC danu (`startOfUtcDay`), pa restart
u 07:42 ne pravi drugu.

#### Stanje mjerenja poslije prvog dana

| stavka | vrijednost | značenje |
|---|---|---|
| `daily-2` dana | **1** (11-12) | pisac radi u produkciji |
| noć u tom danu | **postoji, ali djelimična** (`nightHoursUsed < 8`) | `O_ref` je slabiji nego što izgleda |
| `daily-2` sa `nightMinOutdoorMeasuredC` | još **0** | F3.4 i dalje nemjerljiva |

Djelimična noć je očekivana za prvi dan: satni niz za 11-12 pokriva samo dio noći
zato što je zapis nastao u 06:00 lokalno, a noć je „minimalna temperatura u
satima prije zore". Puna noć (`nightHoursUsed >= 8`) se očekuje za 11-13, jer
tada satni niz pokriva cijelu noć između dva zapisa.

### 10.8 F3.8 izmjereno — `DWELL` je odluka, `STEP_DOWN` preko 2 nema efekta

`scripts/audit/controller_sensitivity.cjs` (novo) vrti grid 4 × 3 × 3 kuće,
60 dana, kroz **iste** module koje koristi proizvod. Puni izvještaj:
`docs/audit/F3.8-osjetljivost.md`.

Mehanizam mjerenja bez kopije formule: `decideProposal` čita `STEP_UP_K`,
`STEP_DOWN_K` i `DWELL_DAYS` iz svog modula pri svakom pozivu, pa
`controller_sim.cjs --params=` zamijeni te vrijednosti za jedan prolaz. U
proizvodni kod **nije** dodan prekidač — on ne treba proizvodu, treba mjerenju.

| nalaz | broj |
|---|---|
| prekršaji granice komfora (1 K) ili tvrdih granica | **0** u svih 12 kombinacija × 3 kuće |
| `DWELL=7` vs `DWELL=3`, ciklusa/dan (`light`/`medium`/`heavy`) | **39,6 / 19,5 / 11,3** vs 27,3 / 14,0 / 8,1 |
| `DWELL=7` konačna polazna | +1,5 K na svakoj kući |
| `STEP_DOWN` 2 i 3 | **identični** redovi na svakoj kući |
| `STEP_DOWN=0,5` | najviše ciklusa (44,5 / 23,0 / 13,2 na dan) |

**Zaključak:** `DWELL=3` (sadašnja vrijednost) je bolji od 7 na oba mjerenja —
manje ciklusa i niža polazna. `STEP_DOWN>2` nema efekta jer se odluka skupi na
ravnotežnu polaznu bez obzira na veličinu koraka; veličina koraka mijenja samo
**koliko dana** treba. Dakle pragovi nijesu proizvoljni: `DWELL` je stvarna
odluka, a `STEP_DOWN` je odluka samo između 0,5 i 2.

Dvije pogrešne metrike na putu do ovoga — zapisane su u skripti, jer je pouka
važnija od brojeva: prvo se mjerila samo konačna polazna (pa su 2 i 3 izgledali
identično **zbog** toga, a ne uprkos), pa se 20-dnevni tranzijent proglasio
nalazom. Sada se mjeri i dan dostizanja, uz marginalne tabele preko drugog
praga. CI čuva samo `--self-test` (~6 s), jer pun grid traje ~7 min.

### 10.9 F3.7 prvi izvještaj — podizanja su `NO_MODEL`, ne nalaz o modelu

Shadow nad stvarnim podacima (run `43178842590`):

```
F3.7 shadow: NOT_ENOUGH_DAYS, 3/4 dana sa razlikom
             (spušta 1, podiže 2), neobjašnjeno 0, blokirano modelom 0
F3.7: svaka razlika ima razlog
F3.7: kontroler diže polaznu na 2/3 dana
      (2026-11-10 NO_MODEL, 2026-11-12 NO_MODEL)
```

Ovo je **dobra** vijest, ali se mora čitati pažljivo. „Podiže 2 dana" zvuči kao
da kontroler grije više nego formula; u stvari oba dana nose `NO_MODEL` — dakle
model još ne postoji, pa kontroler ne odlučuje nego ostaje pri prethodnoj
vrijednosti. To je ispravno ponašanje, ne neslaganje.

Uz to: **nijedna razlika nije bez razloga** (`neobjašnjeno 0`) i **nijedan dan
nije blokiran `MODEL_UNVERIFIED`** — dakle model bojlera je potvrđen iz
kataloga, pa F2 neće stati na tom pravilu.

Presuda `NOT_ENOUGH_DAYS` je stanje, ne nalaz: `SHADOW_MIN_DAYS` je 21, a shadow
postoji za 4 dana. Backfill dani (301) ga nemaju i nikad ga neće imati — v. §10.3.

**Mjerni prozor za F3.7** zato ide od 11-10 (prvi dan sa shadow-om), a ne od
backfill-a. 21 dan se navršava **2026-11-30**.

### 10.10 F3.1 izmjereno — model se još ne može fitingovati, i to nije greška modela

`backend/scripts/ci-coverage-readonly.cjs` (novo) mjeri pokrivenost intervala
pouzdanosti kroz iste module koje koristi proizvod (`fitDailyBalance`,
`buildDayRow`). Rezultat (run `43182703213`):

```
F3.1 dom 3: NOT_ENOUGH_DAYS (0/8 dana, odbijeno 4: INCOMPLETE 2, NO_OUTDOOR 2)
```

**Nijedan dan nije prošao filtere fita**, pa se pokrivenost ne može izmjeriti.
Ali razlozi su mjerljivi i oni mijenjaju ono što bi se popravljalo:

| razlog | dana | prag iz `daily-balance` | šta znači |
|---|---|---|---|
| `INCOMPLETE` | 2 | uzoraka < 80 % od 288 | dnevni niz ne pokriva dan (231 uzorak je minimum) |
| `NO_OUTDOOR` | 2 | nijedan uzorak bez vanjske temperature | vanjska temp. nije stigla u uzorke tih dana |

Ovo **nije** kvar modela: nema dovoljno dana sa punim uzorkovanjem. Zaključak
koji se ne smije izvesti je „model ne radi" — model nije ni dobio priliku.
Zaključak koji se smije izvesti: **F3.1 je mjerljiva tek kad se skupi 8 dana sa
punim dnevnim nizom**, a to je vezano za pouzdanost pollinga, ne za formulu.

Zašto je metoda leave-one-out a ne samo in-sample: in-sample pokrivenost je na
danima na kojima je model fitovan, pa je po pravilu previsoka. Samo taj broj bi
bio samozavaravanje, a cijeli smisao F3.1 je da se prije puštanja zna da interval
nije sistematski pogrešan.

**Mjerni prozor:** F3.1 čeka 8 dana sa punim nizom **nakon** 11-12. Uz današnje
stanje to je najranije **2026-11-20**; ako `INCOMPLETE` nastavi, uzrok je polling
i tada se popravlja njega, ne model.

### 10.11 `gasOpenSheets` — šesta dijagnoza je bila tačna

Test je padao **šest** puta i pet dijagnoza je bilo pogrešno. Lanac, redom:

| pokušaj | hipoteza | zašto nije bila tačna |
|---|---|---|
| 1 | test je spor | `SHEET_TIMEOUT_MS` 15 s nije pomogao |
| 2 | razlika u instalaciji | `--ignore-scripts` nije pomogao (i vraćen) |
| 3 | Jest `testTimeout` 5 s | **stvarna greška**, ali ne i jedina |
| 4 | padne prije `try/catch` | tačno, ali dijagnostika je ostala prazna |
| 5 | `clearMocks` briše mock | **stvarna greška**, ali ne i jedina |
| 6 | `renderScreen` čeka naslov koji postoji i u skeletonu | **ovo je bilo zadnje** |

Zadnja tri su bila stvarna kvara i sva tri su morala biti popravljena. Ono što
ih je držalo skrivenim nije bio kod nego **nedostatak mjerenja**:

1. logovi joba se ne mogu preuzeti;
2. artefakti se ne mogu preuzeti (`blob.core.windows.net` blokiran, 0 bajtova);
3. `jest_report.cjs` svjesno ne ispisuje sirove poruke (da ne procuri vrijednost
   iz testa), a anotacije nosе samo prvih ~8 linija.

Zato je ključni potez bio premjestiti **dijagnostiku u anotaciju**: test pri
padu baca jednu liniju `SHEET_DIAG[testID=...;label=...;treeBytes=...]`, a
izvlači je reporter uz allowlist znakova. Prvi put kad je to proradilo, uzrok je
bio očit u jednom pogledu:

```
SHEET_DIAG[testID=gas-readings-header;label=-;treeBytes=4467]
```

Nijedan `accessibilityLabel` i 4467 B stabla = ekran je u skeleton stanju.
Dakle dugme „+" nikad nije postojalo, a cijela teorija o `Sheet` primitivu je
bila pogrešna.

**Pravilo:** kad padne test koji prolazi lokalno, **prvo se uloži u to da uzrok
bude vidljiv**, pa se popravlja. Pet popravki bez mjerenja su bile skuplje od
jedne mjere koja uzrok učini čitljivim.

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

### 10.12 F5.2 — modul je već bio spojen; migracija ključeva nije potrebna

**Nalaz.** F5.2 je u planu stajala kao posao („`getIntervalKey()` sa
`User.timezone`; jedan format ključa"), ali posao je već bio urađen:
`backend/src/modules/Heating/interval-key.ts` postoji i **spojen je** u četiri
mjesta — `Boiler/boiler.service.ts`, `HeatingRecommendation/heating.recommendation.service.ts`,
`DailyRecord` i `proposal-schedule`. Pretraga nije našla nijednu preostalu kopiju
logike `dayPart` izvan tog modula.

Ono što je zaista nedostajalo nije kod, nego **mjerenje**: da li u produkciji
postoje intervali zapisani u oba formata (kanonski `weekday_morning` i v1
`1_morning`). Bez tog broja se odluka o migraciji donosila na osnovu osjećaja.

**Mjerenje** (`backend/scripts/backfill-coverage.cjs`, novi odjeljak F5.2:
`byFormat` + `splitPairs` — JOIN po istom intervalu u oba formata), baseline run
`43187045233`:

```
F5.2: nema razdvojene historije (0 intervala u oba formata)
F3.6: 10 ključeva, 234 uzorka ukupno, 6 sa < 3 uzorka
      (weekday_1_afternoon=0, weekday_1_late_morning=1, weekday_1_morning=2,
       weekday_1_night=2, weekend_2_evening=1, weekend_2_night=0)
```

**Zaključak.** Migracija ključeva se **ne radi**. Stari v1 ključevi nijesu
„drugi format istog intervala" nego stari intervali koje novi kod više ne piše;
`intervalKeyCandidates` ih i dalje čita, pa nema izgubljenog učenja, a nema ni
dvostrukog zapisa koji bi trebalo spajati. Šest od deset ključeva ima manje od
tri uzorka — učenje je rijetko, ali to je pitanje količine podataka, ne formata.

**Šta je popravljeno usput** (i zašto je to bio pravi posao): `findFirst` sa
`orderBy: { intervalKey: 'desc' }` poredi **tekst**, pa je birao `weekend_*`
ispred `weekday_*` bez obzira na to koji je interval stvarno tražen. Sada
`boiler.service.ts` čita `findMany` i bira po `intervalKeyCandidates`
(kanonski-prvi). Uz to, dom učitan bez `user.timezone` tiho je padao na
`Europe/Sarajevo` i promašivao interval — zato `include.homeProfile` sada nosi
`user: { select: { timezone: true } }`.

**Pouka.** Zadatak formulisan kao „napiši modul" može biti već urađen; zadatak
formulisan kao „dokaži da nema razdvojene historije" nije. Plan je zato bolje
pisati kao **tvrdnju koju treba izmjeriti** nego kao posao koji treba obaviti.

---

### 10.13 F5.6 — `FORMULA.md` i provjera koja pada kad dokument ostarje

**Šta je urađeno.** `docs/FORMULA.md` — jedna stranica: dnevni bilans iz kojeg
izraz izlazi, sam izraz sa opravdanjem svakog člana, redoslijed pravila
kontrolera, tvrde granice sa vlasnikom po granici, filteri učenja, noćni
minimum, ključ intervala i odjeljak „šta ovaj sistem **ne** tvrdi".

**Zašto provjera, a ne samo dokument.** Dokument sa brojevima je najlakše mjesto
da tiho postane laž: kod se promijeni u jednom fajlu, dokument ostane na starom
broju, i niko to ne primijeti jer dokument niko ne izvršava. Zato
`scripts/audit/formula_doc_check.cjs` **čita kod** (regexom, jer traži doslovno
`export const NAME = <broj>`) i poredi sa tabelom §8 i sa devet brojeva
navedenih u prozi. Provjera pada i kad uputa u dokumentu vodi na nepostojeći
fajl — mrtva uputa je gora od nijedne.

**Dokaz da provjera nije ukras.** `backend/src/modules/DailyRecord/tests/formula-doc.spec.ts`
ima tri testa: (1) pravi dokument se slaže sa kodom; (2) dokument sadrži
jednačinu i granice; (3) ista provjera, na **kopiji** dokumenta sa
`DWELL_DAYS = 4`, pada i imenuje `DWELL_DAYS` (`dokument 4 ≠ kod 3`). Kopija ide
u `os.tmpdir()`; pravi dokument se ne dira, jer test koji kvari pravi fajl je
test koji nekad ostane pokvaren.

Ručno provjereno i u drugom smjeru: `CURVE_MIN_FLOW_C` privremeno na `47` u kodu
⇒ `✗ CURVE_MIN_FLOW_C: dokument 46 ≠ kod 47`, exit 1; vraćeno na `46` ⇒ exit 0.

**Gate.** `node ../scripts/audit/formula_doc_check.cjs` je korak
`FORMULA.md matches code (F5.6)` u `backend-audit.yml`, odmah iza F3.8 i
namjerno **bez** zavisnosti od `prepare` (dokument i kod su isti bez
PostgreSQL-a).

### 10.14 F3.3 — ablacija: koji član stvarno nosi odluku

**Zašto.** Do sada se svaki član mogao gasiti pojedinačno (`--c=0`,
`--dayref=0`, `--conservative=0`), ali **pravila kontrolera** — noćna granica i
kratki ciklusi — bila su uvijek uključena. Zato se nije moglo reći da li se
brojevi mijenjaju zbog formule ili zbog granice koja ih prepisuje: granica je
bila maska preko svega ispod nje. F3.3 dodaje `--ablate=uday|cihigh|nightfloor|shortcycle`.

**Prvo nalaz o samom mjerenju.** Prva verzija `u_day`-a davala je uvijek nulu
(±0,1 K) — jer je simulirana kuća imala **konstantne** dobitke (200 W). Ablacija
člana koji je po konstrukciji nula „pokazuje da član ništa ne mijenja", a to
nije nalaz nego tautologija. Zato kuća sada ima dnevne dobitke ±450 W sa **sporim
udjelom** (period 9 dana, kao sunčan period) i malim dnevnim šumom. Na čistom
dnevnom šumu `u_day` (medijana 7 dana) mjerio bi veličinu koje u kući nema, pa
bi ablacija „dokazala" da član nešto kvari. Nakon toga `u_day` stoji u
**−1,3…+0,9 K**, unutar projektne granice ±2 K (`DAY_GAIN_CAP_C`) — dakle mjeri
ono za šta je napravljen.

**Mjereno** (`node scripts/audit/learning_sim.cjs --days=60 --table`):

| postavka | light | medium | heavy |
|---|---|---|---|
| ništa (zlatni) | 37,1 °C · 23,03/d · 7/50 · 1,70 K | 40,4 · 17,75 · 5/50 · 1,32 | 42,9 · 5,35 · 0/50 · 0,96 |
| bez `u_day` | 37,2 · 23,28 · **4/50** · 1,29 | 41,5 · 17,88 · 4/50 · 1,32 | 42,7 · 5,38 · 0/50 · 0,89 |
| bez CI gornje | 37,4 · **17,62** · **12/50** · 1,71 | 40,7 · **13,72** · **11/50** · 1,35 | 42,6 · **3,97** · **3/50** · 1,14 |
| bez noćne granice | 37,0 · 22,22 · **12/50** · **2,25** | 41,2 · 16,92 · **10/50** · **1,69** | 42,9 · 5,10 · **6/50** · 1,14 |
| bez kratkih ciklusa | 37,1 · 23,03 · 7/50 · 1,70 | 40,4 · 17,75 · 5/50 · 1,32 | 42,9 · 5,35 · 0/50 · 0,96 |
| bez svih | 36,9 · 16,53 · **14/50** · 2,20 | 41,4 · 12,87 · 10/50 · 1,55 | 42,4 · 3,52 · **10/50** · 1,57 |

**Šta tabela kaže.**

1. **Noćna granica je najveći pojedinačni nosilac komfora.** Bez nje podbačaj
   skače na svakoj kući (7→12, 5→10, 0→6 od 50 dana) i najgori podbačaj raste
   na 2,25 K. To je i očekivano: granica postoji upravo zato što prosječan dan
   ne pokriva najhladniji sat.
2. **Gornja CI granica nosi učenje, ne komfor.** Bez nje ciklusi padaju
   (23,03→17,62; 17,75→13,72; 5,35→3,97) i podbačaj raste — dakle konzervativni
   nagib **proizvodi** više ciklusa. To je cijena, ne kvar: mlad model sa
   potcijenjenim nagibom grije previše i ciklusira. `SLOPE_CONSERVATIVE_MAX_DAYS`
   je zato mjera kompromisa, ne optimizacija.
3. **`u_day` je jedini član koji djeluje u obje strane.** Sa njim je najgori
   podbačaj manji na light (1,70 → 1,29) i heavy (0,96 → 0,89), jednak na
   medium (1,32), a broj dana sa podbačajem je **veći** na medium (4 → 5 od 50).
   Uzrok je vidljiv iz polazne: `u_day` spušta polaznu (medium 41,5 → 40,4), pa
   na kući koja nije previsoko griјаla smanjuje rezervu — a na kući koja jest
   (light, polazna 37,2 → 37,1) popravlja najgori slučaj. To je **nalaz, ne
   bug**: član trguje prosječnom marginom za dane sa dobitkom. **Odluka:**
   `u_day` ostaje uključen (projektna odluka iz `17` §13), ali se sada **mjeri**;
   ako F3.1 pokaže isti obrazac na stvarnim podacima, gasi se postavljanjem
   `HomeModel.uDayC = null` — bez promjene formule i bez novog prekidača u
   proizvodnom kodu.
4. **Kratki ciklusi u simulaciji ne mijenjaju ništa** (isti red sa i bez): medijana
   ciklusa je 15–81 min, tj. uvijek iznad `SHORT_CYCLE_MIN = 6`. To **nije**
   dokaz da je pravilo suvišno u produkciji — u produkciji su kratki ciklusi
   izmjereni (F3.8 ih mjeri preko `controller_sim`), a ovdje ih simulirana kuća
   ne proizvodi. Zapisano da se ne pročita kao „pravilo ne radi".

**Zlatni brojevi prepisani** (`formula_v2_golden.json`): `flowEnd` light 37,1
(isto), medium 40,4 (bilo 41,4), heavy 42,9 (bilo 42,6); `cyclesPerDay` i
`undershootDaysAfter10` po tabeli. Uzrok je **promjena simulirane kuće** (dnevni
dobici), ne formula — zato snimak sada nosi `settings.dayGain = true` i polje
`why`, da sljedeći `--write` bez objašnjenja bude vidljiv u diffu.

**Gate.** `node ../scripts/audit/learning_sim.cjs --self-test` u
`backend-audit.yml` (korak `Ablation toggles actually act (F3.3)`): provjerava
da prazna ablacija daje **isti** rezultat kao pokretanje bez prekidača (da
prekidač nije neutralan), da isključena noćna granica **mijenja** bar jednu
metriku (da granica nije mrtva), i da `u_day` stvarno varira (da ablacija nije
tautologija). Traje ~0,5 s.

### 10.15 `u_day` isključen iz predloga (2026-11-12, odluka vlasnika)

**Odluka.** Vlasnik je poslije mjerenja iz §10.14 rekao „možeš odmah isključiti".
`u_day` **ne ulazi** u predlog dok F3.1 ne pokaže da nosi.

**Kako je ugašen.** Prekidač `DAY_GAIN_IN_PROPOSAL = false` u
`proposal-shadow.service.ts`, primijenjen na **jednom mjestu** gdje član ulazi u
izraz (`equilibriumFlow({ uDayC })`). Izraz nije mijenjan — `equilibrium-flow.ts`
i dalje podržava član, sa testovima; gasi se poziv, ne formula.

**Zašto prekidač a ne brisanje.** Procjena se **nastavlja računati**
(`HomeModel.uDayC`, `estimateDayGain`) i log je ispisuje uz oznaku „(ne ulazi u
predlog)". Bez toga bi odluka izgubila dokaz: kad F3.1 za 8 dana pokaže da
član nosi ili ne nosi, nema podataka da se to kaže. Uključivanje je tada
`true`, bez ponovnog pisanja i bez prazne historije.

**`null`, a ne `0`.** Isključen član šalje `null`. `0` bi tvrdio „izmjeren je
nulti dobitak" — to je druga tvrdnja i pogrešna.

**Log.** Prije popravke, sa ugašenim članom, log bi pisao `u_day 0.0 K` i time
**sakrio** izmjereno. Sada log nosi `u_day <mjereno> K (ne ulazi u predlog)`.

**Dokaz da prekidač djeluje u oba smjera.**
- `false` ⇒ `proposal-shadow.service.spec.ts` **35/35**; testovi sada tvrde da je
  odluka **ista** sa dobitkom i bez njega (sa `uDayC: 2` i bez, oba 44,04 °C).
- `true` privremeno ⇒ **padaju 3 testa** (ista vrijednost, negativan dobitak,
  granica koraka). Dakle uključivanje ne može proći tiho.
- `formula_doc_check.cjs` sada provjerava i `DAY_GAIN_IN_PROPOSAL`
  (`true` ⇒ `✗ dokument 0 ≠ kod 1`), pa ni dokument ne može ostati na staroj
  tvrdnji „član ulazi u izraz".

**Jedan nalaz usput.** Test „korak spuštanja ograničava dnevnu promjenu" je
očekivao 44,00 °C a dobio 44,04 °C. To je **ispravno** ponašanje kontrolera:
kad je ravnotežna između granice koraka (45 − 1 = 44) i prošle polazne (45),
uzima se ravnotežna — promjena je 0,96 K, tj. manja od punog koraka. Stari
broj je važio samo zato što je `u_day` spuštao ravnotežnu ispod granice. Test
je popravljen sa obrazloženjem, ne prilagođen naslijepo.

**Kada se vraća.** Kad F3.1 (mjerljivo od **2026-11-20**) pokaže da polazna bez
člana sistematski prelazi ono što model traži na danima sa dobitkom.

### 10.16 F3.5 — saturacija izmjereno: kuća nije na granici, i to je nalaz

**Mjereno** (`saturation-readonly.cjs`, baseline run `43220294408`):

```
F3.5: 302 dana, 5 na granici, 0 CAPACITY, 0/1 domova
```

5 od 302 dana (1,7 %) predlog je bio na gornjoj granici, i **nijedan** od tih
dana nije bio hladan. Presuda doma: **`AT_LIMIT_SOMETIMES`**, ne `CAPACITY`.

**Zašto je to dobra vijest, a ne prazno mjerenje.** `CAPACITY` bi značio da kuća
traži više nego što kotao daje — tada nijedna formula ne pomaže i F4 (puštanje
modela) ne bi imao smisla raditi prije izolacije. Nula takvih dana znači da
gornja granica nije ono što ograničava sistem, pa je prostor za spuštanje
polazne stvarno otvoren.

**Šta mjerenje razlikuje** (i zašto dvije kolone a ne jedna): predlog na granici
govori šta je **formula** tražila; kotao na granici govori šta je **sistem**
radio. Prvo bez drugog je mišljenje, drugo bez prvog ne kaže je li formula
previsoko računala. Zato presuda ima četiri ishoda, a ne „procenat na granici".

**Ograničenje koje se ne prećutkuje.** Za 301 backfillovan dan nema satnih
uzoraka, pa `maxFlowSetC` (kotao izmjereno na granici) postoji samo za dane sa
uzorcima — dakle mjerenje „kotao na granici" je za sada tanko, a „predlog na
granici" je puno. To je zapisano u izlazu skripte, ne u fusnoti.

---

### 10.17 F3.4 — prognoza noći se još ne može ocijeniti, i uzrok je izmjeren

**Prvi run** (`43219575015`): `F3.4: nema dana sa prognozom i mjerenjem`.
**Drugi run** poslije dodate rezerve (mjerenje iz satnih uzoraka): isti ishod.
**Završni run** (`43221828031`, bez dijagnostike):

```
F3.4: nema dana sa prognozom i mjerenjem — prognoza 1, obračun 0, kolona 0,
      uzorci 904 na 4 dana (2026-11-09→2026-11-12)
```

Dakle: `nightMinC` ima **1** dan (11-12, `daily-2`), obračun ( `outcomeAt` ) **0**
dana, izmjerena kolona **0** dana, satni uzorci na **4** dana. Greška prognoze
traži dan sa **oba** prva polja — a takvog dana nema ni jedan. Ovo je prvi ispis
koji se može provjeriti: svaki broj ima ime i može se ponoviti upitom.
Zato je uzrok izmjeren, ne pretpostavljen (privremena dijagnostika, poslije
uklonjena — nije dio mjernog seta):

```
DIAG ThermostatObservation samples=902 days=4 2026-11-09 09:25 .. 2026-11-12 12:40
DIAG model=backfill-events-1 measured=false outcome=true days=301 2026-01-05..2026-11-08
     daysWithSamples=0 avgSamples=0 avgNightSamples=0
DIAG model=daily-1 outcome=true days=3 2026-11-09..2026-11-11
     daysWithSamples=3 avgSamples=254 avgNightSamples=72
DIAG model=daily-2 outcome=false days=1 2026-11-12 daysWithSamples=1 avgNightSamples=72
```

**Tri činjenice iz toga:**

1. `nightMinOutdoorMeasuredC` je `false` na **svih 305 dana** — kolonu ne piše
   nijedan put koji je do sada radio na historiji.
2. 301 od 305 dana je `backfill-events-1`, a `backfill-reconstruction.ts`
   izričito ne piše tu kolonu (v. `missing.push(...)`). To nije propust: backfill
   nema satni niz, pa nema iz čega izmjeriti noć.
3. **Satni uzorci postoje za 4 dana** (2026-11-09 → 11-12), svi sa ~72 noćna
   uzorka. Dakle mjerenje **nije nemoguće**, samo ima 4 dana — ispod praga od 5.

**Zaključak.** F3.4 nije neuspjelo mjerenje nego mjerenje koje čeka uzorke. Prvi
dan sa satnim nizom je **2026-11-09**, pa:

- **2026-11-13** (5 dana uzoraka) izlazi prvi broj, iako tanki;
- **2026-11-16** (8 dana) ima smisla čitati ga kao grešku prognoze.

Ali uzorci sami nijesu dovoljni: treba i `nightMinC` **za te iste dane**, a on
sada postoji za 1 dan. Zato F3.4 ima **dva** uslova, ne jedan: uzorke *i*
dnevni pisac. Drugi uslov je vezan za F1 pisac (`daily-2`), koji radi od 11-12 —
pa se oba uslova stižu otprilike u isto vrijeme.

**Rezerva je ipak zadržana.** Iako sada ne pomaže, ona je ono što će poslije
omogućiti da se greška prognoze mjeri **bez** čekanja dnevnog obračuna za svaki
dan — a ukloniti je znači vratiti se na jedno mjesto koje tiho ne piše kolonu.

**Pouka.** „Nema podataka" nije nalaz. Nalaz je „nema podataka **zato što** je
301 dan backfill bez satnog niza, a uzorci postoje na 4 dana". Prvi ispis je
trošio rundu CI-ja i nije rekao ništa što se može provjeriti; drugi kaže kada
će se moći provjeriti.

### 10.18 F5.3 — `confidence` je bio konstanta, ne mjera

**Izmjereno prije popravke.** Stara formula:

```
conf' = min(1, (conf·n + 0,1) / (n+1))
```

To je pokretni prosjek sa **fiksnim prirastom 0,1**, pa mu je fiksna tačka
0,1 — ako krene od 0,1, tu i ostaje. Pušteno kroz 320 koraka:

```
samples=  1 confidence=0.1000
samples= 20 confidence=0.1000
samples=320 confidence=0.1000
```

Dakle broj koji nosi **35 % health score-a** (`HEALTH_WEIGHTS.learningConfidence`)
nije mjerio ništa. To je najgora vrsta greške: mjera koja izgleda kao mjera.

**Novi izraz** (`learning-confidence.ts`):

```
conf = (n / (n + 10)) · max(0, 1 − residualStd / 2,0)
```

- prvi član: **koliko dokaza ima** — 0 uzoraka ⇒ 0, 10 uzoraka ⇒ 0,5;
- drugi član: **koliko se slažu** — `max(0, …)` je namjerno: odstupanje iznad
  2 K mora pasti na **nulu**, a ne na malu vrijednost, jer bi „skoro pouzdano"
  kroz 35 % težine dao pokvaren model sa visokim skorom;
- nepoznat `residualStd` **nije** savršeno slaganje nego nula slaganja.

`residualStd` se mjeri **istim brojem koji se već akumulira** (`|avgOvershoot|`):
standardno odstupanje bi tražilo da pamtimo svaki uzorak, a interval je jedan red.

**Migracija** `20261121100000_interval_confidence_and_p90`: dodaje
`HeatingIntervalLearning.residualStd` (nullable). Postojeći redovi ostaju `NULL`
⇒ `confidence = 0`, dakle „neprovjereno" — namjerno, umjesto da naslijede staru
tihu konstantu.

**Testovi** (`learning-confidence.spec.ts`, 9): prvi ide do **320 uzoraka** jer
bi kratak niz prošao i sa starom formulom — to je jedini način da test hvata
regresiju koju treba da hvata.

**Nalaz usput, veći od F5.3.** `confidence` se u strategijama i **ne koristi** za
interval: `full.strategy.ts` množi `homeProfile.confidence` (što je
`HomeProfile.learningConfidence`), a `intervalLearning.confidence` ide samo u
`recommendation-breakdown` i health score. Drugim riječima, `confidence` je do
sada bio isključivo **prikaz**, a ne ulaz u odluku — pa je popravka uticala na
health score, ne na polaznu. Zapisano da se ne pročita kao veći zahvat nego što
jeste.

---

### 10.19 F5.4 — premašivanje je ulazilo 1,5 puta

**Putanja koja je bila dvostruka.** U `heating.recommendation.service.ts`:

```
overshoot = T_soba_trenutno − T_soba_cilj
offset        ← pokretni prosjek `overshoot`
avgOvershoot  ← pokretni prosjek `overshoot`     ← isti broj, druga kolona
```

a `full.strategy.ts` ih je sabirao:

```
intervalOffset = offset + avgOvershoot·0,5 + …
```

Isti mjereni broj, 1,5 puta, bez ijednog mjesta u kodu gdje se to vidi kao
odluka.

**Ispravka.** `offsets` ne mijenja značenje: `offset` nosi ukupno odstupanje u
oba smjera (i podbačaj). Premašivanje sada nosi **90. percentil** kroz novo
polje `p90OvershootC` i `overshootCorrectionFrom()`. `avgOvershoot` ostaje u
bazi i u API-ju (dashboard ga prikazuje), ali **prestaje ulaziti u odluku** — u
tipu je označen `@deprecated`.

**Zašto percentil.** Prosjek nosi dva dana od 5 K kao tipske dane: 25 dana po
0,1 K + 2 dana po 5 K daje prosjek **0,46 K**, pa bi se polazna spuštala zbog
dva dana koja nijesu bila greška modela. Medijana bi ih ignorisala, ali bi
ignorisala i sistematsko premašivanje. 90. percentil odgovara na pitanje
„koliko visoko premašuje **kad** premašuje" — a to je ono što korekcija treba.

**Težina 0,5 i granica 2 K** su ostale (ista logika kao stara `* 0.5`), ali sada
**jednom** i sa imenom. Granica je `MAX_DAILY_CHANGE_K` reda veličine: veća
korekcija bi bila veći skok nego što kontroler smije napraviti u danu, pa bi
broj u zapisu bio lažan.

**Tekući percentil, ne tačan.** `HeatingIntervalLearning` je jedan red po
intervalu, pa se 90. percentil iz skupa ne može izračunati. `nextPercentile()`
drži tekuću vrijednost: ispod `OVERSHOOT_MIN_SAMPLES = 5` **ne mijenja ništa**
(percentil od dva uzorka je maksimum tih dvaju — isti problem, drugo ime), a
iznad praga rep podiže **za pola razlike** a spušta **za desetinu**. Asimetrija
je odluka: kad rep poraste kuća se pregrijava i treba reagovati odmah; kad
padne, dokaz slabije stoji.

**Testovi** (`overshoot-learning.spec.ts`, 13), uključujući jedan koji čita
`full.strategy.ts` i pada ako se `avgOvershoot` vrati u kod (u komentaru smije
ostati).

---

### 10.20 F5.5 — klamp je bio broj bez razloga

**Problem.** Klamp se vidio samo u `params.clamp`:
`{ applied, rawFinalTemp, minC, maxC }`. Iz toga se broj može **rekonstruisati**,
ali ne i reći **zašto** je odsječen — a tri razloga traže tri različite akcije:

| razlog | šta znači | akcija |
|---|---|---|
| fizička granica kotla (30/55) | motor traži nemoguće | nalaz o motoru ili podacima |
| granica doma (`min/maxHeatingFlowC`) | korisnik tako želi | nije greška |
| dnevna promjena (±2 K) | namjerno usporavanje | nije odsjecanje |

Bez imena, sva tri su u logu izgledala isto: „polazna je 55, traženo je 58".

**Ispravka** (`clamp-log.ts`). `describeFlowClamp()` vraća `applied`, `bound`,
`cutK` i jednu liniju za log. Granica se traži **od najspecifičnije ka
najopštijoj**: ako je dom postavio granicu i klamp je na njoj, to je granica doma
— iako je i ona unutar sistema. Suprotno bi svako podešavanje korisnika
izgledalo kao kvar motora. Dom iznad fizičke granice se prijavljuje kao
sistemska (jer je stvarno odsjekla sistemska).

**Jedan izvor za log i zapis.** `params.clamp` sada koristi **isti** izvještaj
(`clampReport.applied/bound/cutK`) umjesto svog poređenja
`proposedFlowTemp !== result.finalTemp`. Bez toga bi prag od 0,001 K mogao da se
razide, pa bi zapis tvrdio klamp kojeg log nema. Test to zaključava čitanjem
izvora.

**Usput.** `LoadedHome` nije imao `minHeatingFlowC`/`maxHeatingFlowC`, iako ih
`include: { user: true }` učitava. Tip ih je prećutkivao — dodati su, jer bez
njih granica doma nije mogla ni da se imenuje.

### 10.21 F4.1 — prekidač `PROPOSAL_ENGINE` (zadano `curve`)

**Zašto prekidač prije ijedne promjene ponašanja.** Prelazak na model dira ono
što korisnik vidi. Bez prekidača bi rollback značio novo izdanje **i** pitanje
šta je u međuvremenu upisano u bazu — a `DailyRecord` bi već nosio predloge iz
modelskog puta. Sa prekidačem se vraća jednom riječju u okruženju, a redovi
ostaju uporedivi jer svaki nosi `params.engine`.

**Zadano je `curve`**, dakle deploy ne mijenja ništa. To nije stidljivost nego
uslov: dok F3.1 ne izmjeri pokrivenost intervala pouzdanosti, model nije
provjeren na stvarnim podacima.

**Tipfeler se odbija, ne ignorše.** `PROPOSAL_ENGINE=modl` **ne** pada tiho na
`curve` — vraća `problem`, writer ga loguje, a vrijednost ostaje sigurna.
Razlika je bitna: tiho ignorisan tipfeler znači da čovjek misli da je model
pušten, a razlika se vidi tek na računu za gas mjesec dana kasnije. Zato
`true`/`1`/`on` **nijesu** prihvaćeni kao `model`, iako prekidač izgleda kao
bulov.

**Ime `PROPOSAL_ENGINE`, ne `FORMULA`.** „Formula" je u ovom projektu korištena
za staru krivu *i* za novi izraz — ime okruženja bilo bi dvosmisleno. „Engine"
imenuje mjesto u kodu (`FlowTemperatureEngine`), ne matematiku.

**Prekid se ne dešava.** Ako je vrijednost neispravna, predlog se **ne** obara:
predlog za danas je važniji od konfiguracije, a izbor je već siguran.

**Testovi** (`proposal-engine.spec.ts`, 9). Nijedan ne provjerava samo čitanje —
najvažniji provjerava da tipfeler ne prođe tiho, i da `writer` zaista čita
prekidač i upisuje `engine` u `params` (dva testa čitaju izvor, jer bi inače
prekidač mogao postojati a ne biti spojen).

### 10.22 F4.3/F4.4 — breakdown nosi motor, kriva je `null` a ne `0`

**Zašto verzija 2, a ne polja bez verzije.** Breakdown je jedini dio ugovora koji
klijent čita da **objasni** broj. Ako polja rastu a `version` stoji, klijent ne
može reći „ovo je stari snimak" i mora pogađati po prisustvu polja. Zato `2`,
a stari redovi ostaju čitljivi jer su polja aditivna.

**`engine: null` nije isto što `engine: 'curve'`.** Red zapisan prije F4.3 nije
tvrdio koji ga je motor dao. Upisati `'curve'` značilo bi izmisliti podatak o
prošlosti — a upravo se ta prošlost poredi u F3.7.

**F4.4 — `null`, ne `0`.** Ovo je najveći rizik u planu jer dira ekran. `0` bi
klijentu dao „0,00 °C" i to bi izgledalo kao kvar, a ne kao „ovaj put nema
krive". Zato `baseCurveTemp`, `weightedExternalTemp` i `appliedOffsets` postaju
`null` kad je motor `model`, a `model` nosi članove izraza.

**Zašto odvojen objekat `model`.** Šest polja razbacano po breakdown-u znači da
klijent provjerava šest stvari na `null`. Jedan objekat znači jednu provjeru:
`model !== null` ⇒ prikaži model.

**`finalTemp` i `confidence` se ne mijenjaju zbog motora.** Breakdown je
**snimak**, ne proračun. Test to zaključava — inače bi „popravljanje" breakdown-a
moglo tiho promijeniti broj koji korisnik vidi.

**Ugovor je regenerisan i provjeren.** Lokalno nema generisanog Prisma klijenta,
pa je za generisanje korišten privremeni stub u `src/generated/prisma`
(u `.gitignore`, nije ušao u commit). Prije commita: `openapi:generate -- --check`
exit 0 i `openapi-schema.spec.ts` 27/27. Diff ugovora sadrži **samo** F4.3
izmjene.

**Testovi:** breakdown 7 (3 stara ažurirana + 4 nova), write-sites 3,
openapi-schema 27. Zaključan je tačan skup ključeva — aditivno ne znači „bilo
šta smije ući".

**Lažno zelena `tsc` provjera (nalaz).** `npx tsc --noEmit` u `frontend/`
prolazi za 0,4 s i ne prijavljuje ništa — jer je `tsconfig.json` samo
`references`. Mjerodavno je `tsc -p tsconfig.app.json` (to je i `npm run build`
i CI). Isto važi za mobilni: `tsc --noEmit -p tsconfig.json`. Prva provjera
F4.4 na ekranu bila je zato lažno zelena; tek `tsconfig.app.json` pokazao je
6 grešaka. **Ne vjerovati golorukom `tsc --noEmit`** — bez `-p` se ne
provjerava ništa.

**Rizik F4.4 je zatvoren na oba klijenta.** Web (`38c1b77`) i mobilni:
`null` nikad ne postaje „0,0 °C" ni „NaN"; kad je motor `model`, redovi krive
se **izostavljaju** (tabela puna crtica ne objašnjava ništa), a prikazuju se
članovi izraza. Stari redovi (`engine = null`) prikazuju krivu kao i prije —
`null` znači „ne zna se koji motor", ne „model".

**Mobilni ima svoje tipove.** `mobile/src/types/Dashboard.ts` ne čita
`frontend/src/types/api.d.ts`, pa ga `openapi:check` ne štiti. Isti ugovor je
tamo prepisan ručno — to je dug koji ostaje (v. §7, tabela rizika).

### 10.23 F4.5 — koliko se broj zaista mijenjao kroz dan (mjerenje, run `43246164833`)

**Nalog je bio: prvo izmjeriti, pa dirati `/boiler/sync`.** Mjerenje je
urađeno prije ijedne izmjene proizvodnog koda.

**Prvi pokušaj je bio bezvrijedan i to se imenuje.** Skripta je čitala
`DailyRecord.params.formulaDriftC`. Rezultat (run `43241653802`):
`NO_DRIFT_RECORDED: 56 dana, 0 sa kolonom`. Tačno — ali dokazano bespredmetno:
`daily-record.writer.ts` tu kolonu **ne piše** (`grep`: 0 hitova). Da se dodao
upis, mjerila bi se **vlastita izmjena**, a ne stanje.

**Zato se mjeri ono što sistem već bilježi:** `BoilerHistory.suggestedTemp` —
broj koji je otišao kotlu, sa vremenom. Različite vrijednosti **istog dana** su
oscilacija koju je korisnik vidio na displeju, bez obzira ko ju je proizveo.

**Rezultat (60 dana, run `43246164833`):**

| mjera | vrijednost |
|---|---|
| kuća-dana | 27 |
| sa više od jedne vrijednosti | 11 (40,7 %) |
| raspon > 0,5 K (**vidljivo**) | **10** |
| samo zaokruživanje (< 0,5 K) | 1 |
| jedna vrijednost | 16 |
| raspon max / prosjek | **2,76 K** / 0,86 K |

**Presuda: `OSCILLATION_VISIBLE`.** 10 od 27 kuća-dana ima pomjeranje veće od
0,5 K — dakle korisnik **vidi** drugi broj. Najveće pomjeranje je 2,76 K, što je
više od pola stepena na displeju kotla i više od cijelog stepena razlike u
toplini.

**Šta ovo mjerenje NE tvrdi.** Ne mjeri je li promjena bila **opravdana**
(izmjeren manjak) — `BoilerHistory` ne nosi razlog. Ne tvrdi se ni da svaka
promjena dolazi od krive: isti broj može doći iz korisnikovog rasporeda ili iz
`anchorDailyFlow`. Mjeri se **veličina problema**, ne njegov uzrok.

**Ograničenje uzorka, zapisano a ne prećutano.** `BoilerHistory` nema
`homeProfileId`, pa je grupa `(userId, dan)`; korisnik sa više kuća bio bi
spojen. Kolona se **ne dodaje samo radi mjerenja** — to bi bila izmjena šeme
koja služi mjerenju, a ne proizvodu. 27 kuća-dana u 60 dana je mali uzrok:
presuda je „problem postoji i vidljiv je", ne „problem je velik".

**Zašto to mijenja nalaz o F4.5.** U kodu `anchorDailyFlow`
(`morning-anchor.ts`) **već** čuva jutarnji broj: dokaz (manjak) je jedini
razlog da broj ode gore, spuštanje usred dana nije dozvoljeno. Dakle dashboard
je već popravljen. Ono što oscilira je **`BoilerService.calculateFlowTemp`**,
koji `/boiler/sync` i `ThermostatPoll` zovu direktno — a to je ono što F4.5
treba da preusmjeri na zapisani `DailyRecord`.

**Dvije greške u prvim pokušajima, obje poučne:**
1. Prvi run je rekao samo „exit 1". Anotacija je hvatala linije sa dva razmaka,
   pa uzrok (`column b.suggestedFlowTemp does not exist`) nije stigao do
   anotacije. Popravljeno: uzrok pada ide u `::error::`.
2. Kolona u bazi je `suggestedTemp`, ne `suggestedFlowTemp` — sema ima
   `@map("suggestedTemp")`, pa polje Prisme i kolona nemaju isto ime. Ime je
   provjereno u migraciji, ne po pamćenju.

**Mjerenje ostaje u CI-ju** (`baseline` job, `workflow_dispatch`), da se poslije
F4.5 može ponoviti istim brojevima i uporediti.

### 10.24 F4.5 — izmjena koda: jedan broj za dan

**Mjerenje je pokazalo problem, ne uzrok.** Oscilacija (10/27 kuća-dana,
max 2,76 K) nije dolazila iz `anchorDailyFlow` — on od F14 već čuva jutarnji
broj. Dolazila je iz `BoilerService.calculateFlowTemp`, koji **računa iznova**
na svakom pozivu, a njegov broj ide na kotao (`/boiler/sync`) i u
`BoilerHistory` (polling).

**Rješenje je jedna čista funkcija, `resolveDailyFlow`** (`daily-flow.ts`), bez
baze i sata. Pravilo „jedan broj za dan" mora važiti na **svakom** mjestu koje
broj predlaže; da je metoda na jednom servisu, drugo mjesto bi imalo svoju
kopiju — a dvije kopije istog pravila se raziđu prvom izmjenom.

**Pravilo, po redu:**
1. Zapisani predlog važi bez obzira koliko formula odstupa. Drift se **i dalje
   mjeri** — bez toga bi se izgubio podatak iza cijelog F4.5 mjerenja.
2. Dokaz (izmjeren manjak) je **jedini** razlog da broj ode gore. Spuštanje
   usred dana nije dozvoljeno ni sa dokazom.
3. `outcomeAt == null` **nije** dokaz nule: „nije se još mjerilo" ≠ „izmjereno
   je 0". Da se to pomiješa, manjak nikad ne bi podigao broj.
4. Nema zapisa ⇒ motorov broj, i to se **kaže** (`CURVE`) — ne tvrdi se da je
   jutro potvrdilo formulu.

**`calculateFlowTemp` sada vraća i `flowSource` i `curveFlowTemp`.** `flowTemp`
je broj koji ide na kotao; `curveFlowTemp` je ono što motor računa sada. Bez
drugog polja se ne može reći je li se formula razišla s predlogom.

**Posljedica koju je uhvatio test, ne čitanje koda.** Dashboard je čitao
`formula.flowTemp` kao `currentFlowC`. Od F4.5 bi to bio **zapisani predlog**,
pa bi `formulaDriftC` uvijek bio 0 i mjerenje bi tiho nestalo. Sada čita
`curveFlowTemp`. Da test nije pisan prije spajanja, ovo bi prošlo CI zeleno i
tek bi sljedeće mjerenje pokazalo nulu bez uzroka.

**Zašto mjerenje ostaje.** Ponoviti istu skriptu poslije izmjene i uporediti
brojeve: prije `OSCILLATION_VISIBLE` (10/27, max 2,76 K), poslije se očekuje
`STABLE` ili `OSCILLATION_INVISIBLE`. Ako se ne promijeni, uzrok je drugdje i
to je nalaz, ne neuspjeh.

### 10.25 F4.5 — zašto ponovljeno mjerenje daje iste brojeve (i šta je pravi gejt)

**Ponovljeno mjerenje poslije izmjene koda (run `43277288749`) dalo je
identične brojeve:** 10/27 kuća-dana, max 2,76 K, prosjek 0,86 K.

**To nije dokaz da izmjena nije pomogla — to je dokaz da se mjerio pogrešan
prozor.** Mjerenje čita `BoilerHistory`, historiju, a prozor od 60 dana uvijek
sadrži dane kad je stari kod radio. Isti ulaz ⇒ isti izlaz; ništa se nije
promijenilo ni treba da se promijeni.

**Zato je dodan `--since=YYYY-MM-DD`** (i ulaz `drift_since` u workflow-u).
Mjerenje poslije deploya mora gledati **samo dane koji su nastali poslije**
deploya. Bez toga bi se svako buduće mjerenje zauvijek vraćalo na iste brojeve
i izgledalo kao da izmjena ne radi.

**Gejt za F4.5 zato glasi, tačno:**
- **prije** (run `43246164833`, cijeli prozor): `OSCILLATION_VISIBLE`,
  10/27, max 2,76 K — stanje je izmjereno;
- **poslije** (`--since=<datum deploya>`, prozor od najmanje 7 dana):
  `STABLE` ili `OSCILLATION_INVISIBLE` — ako nije, uzrok je drugdje i **to je
  nalaz**, ne neuspjeh;
- mjerenje se ne izvršava lokalno, nego u `baseline` jobu, istim brojevima.

**Zašto se gejt ne može zatvoriti danas.** Kod nije u produkciji, a historija se
ne može prepisati — mjerenje je read-only i ne izmišlja podatke. Do deploya se
može tvrditi samo: pravilo je u kodu (12 testova), spajanje je dokazano testom
(motorovih 45 **ne** ide na kotao kad zapis kaže 48), i mjerenje je spremno da
se ponovi istim brojevima.

### 10.26 F4.2 — izdvajanje odluke i nalaz koji je to promijenio

**Zašto poziv shadow servisa nije bio moguć.** `ProposalShadowService.evaluate()`
**čita** `DailyRecord` (`nightMinC`, `dayMaxC`) — red koji writer tek treba da
napiše. Writer radi prije shadow-a (`daily.recommendation.service` piše predlog
na `:76`, shadow zove na `:95`). Poziv bi bio i ciklična zavisnost i odluka o
redu koji ne postoji.

**Rješenje: `nightMinC`/`dayMaxC` postaju ulaz, ne upit.** Shadow ih čita iz
zapisa, writer iz prognoze koju upravo upisuje — iste vrijednosti, različit
izvor. Prikupljanje je izdvojeno u `ProposalInputsService`, odluka u
`proposal-decision.ts` (dva sloja, jer servis ima `await`-ove **između**
izračuna: `daysSinceChange`, `nightFloorFor`).

**Ponašanje shadow-a je nepromijenjeno i to je dokazano, ne tvrđeno.**
387 testova `DailyRecord` modula prošlo je **bez izmjene ijednog testa** — to je
jedini uvjerljiv dokaz da izdvajanje nije promjena formule. Uz to
`proposal-decision.spec` poredi izdvojeni put sa putem prepisanim **doslovno**
onako kako je stajao u `evaluate()`.

### Nalaz: `decideProposal` je relativni kontroler, ne apsolutni broj

Ovo je otkriveno tek pri spajanju writer-a, i bez toga bi F4.2 bio „spojen" a
nefunkcionalan:

- `decideProposal` polazi od **prošle polazne** i pomjera je za korak kad ima
  izmjereni dokaz. Bez ishoda vraća `previous` uz `HOLD/NO_OUTCOME`
  (`proposal-controller.ts:215`).
- U 06:00, kad writer piše predlog, ishoda **nema** — obračun ide u 03:20 **za
  prethodni dan**. Zato je prvi pokušaj dao tačno:
  `flowC null, action HOLD, reasons ['NO_OUTCOME']` — model put bi zauvijek
  vraćao `null` i nikad ne bi radio.
- **Apsolutni** broj za dan je ravnotežna polazna `F_eq`
  (`equilibrium-flow.ts`). Kontroler je sloj **iznad** nje koji shadow mjeri.

Writer zato uzima `F_eq`; kontroler ostaje u shadow-u. Da je test pisan poslije
spajanja, greška bi prošla CI zeleno (model put „spojen", vraća `null`).

**`params.engine` nosi stvarno korišten motor**, ne traženi. Ako je tražen
`model` a model nije dao broj (nema noćne prognoze), zapis kaže `curve` — inače
bi se poslije tvrdilo da je modelski put radio. Test to zaključava i **brani**
staru formu (`not.toContain('engine: engineChoice.engine')`).

**Konstante su premještene, ne duplirane.** `DAY_GAIN_IN_PROPOSAL` i
`DEFAULT_TARGET_ROOM_C` treba i novi servis, pa su u `flow-constants.ts`, a
`proposal-shadow.service` ih re-exportuje. `formula_doc_check.cjs` ih zato
traži na novom mjestu, a `FORMULA.md` je ažuriran — inače bi F5.6 gejt padao
zbog refaktora, a ne zbog razilaženja s kodom.

**Testovi:** `daily-record-writer` +3 (model daje **46,74** a ne krivinih 45;
bez noćne prognoze ostaje 45 uz `engine=curve`; zadano `curve` **ne poziva**
prikupljanje), `proposal-decision` 7, `DailyRecord` **397/397**, `tsc` 0,
`eslint` 0, `FORMULA.md` gejt: 22 konstante.

### 10.26b F4.6 — jedan pisac `Recommendation` redova

**Tvrdnja koja se mjerila.** Dva mjesta su pisala `Recommendation`:
`DailyRecordWriter` (u istoj transakciji kao zapis) i
`HeatingRecommendationService`. Ako pišu oba, „jedan pisac po redu“ ne
vrijedi, a red koji korisnik vidi zavisi od toga koji je zadnji.

**Mjerenje prije izmjene** (`recommendation-drift-readonly.cjs`, run
`43282265347`, 60 dana): uporedivih **54** dana, razlikuje se **23 (42,6 %)**;
isto / zaokruženo / vidljivo **31 / 8 / 15**; |razlika| max **3,74 K**,
prosjek **0,50 K** ⇒ **`DIFF_VISIBLE`**. Dakle nije kozmetika — 15 dana se
korisniku vidio drugi broj nego što ga zapis nosi.

**Izmjena.** Servis prestaje pisati `Recommendation` i prestaje zvati motor.
**Učenje ostaje** (`heatingIntervalLearning.updateMany`) — to je jedini vlasnik
tog reda i ne dira se. Uklonjeni su i importi koji su time postali mrtvi.

**Dokaz je statika, ne tvrdnja.** `recommendation-write-sites.spec.ts` ima 4
testa: nema pisanja pri izvršavanju, **i** staticka provjera izvora —
`recommendation.create`/`.update` ne smiju postojati u servisu, a
`tx.recommendation.create` mora postojati u writer-u. Bez statickog dijela,
test bi prošao i da neko vrati pisanje u granu koja se u testu ne izvršava.
Test koji je provjeravao uklonjeni weather put je obrisan (`git rm`), jer bi
inače „zelen“ branio put koga nema.

**Testovi:** write-sites 4/4, `HeatingRecommendation` 33/33, backend
**1696/1696** (138 suite) na `3c20534`.

### 10.27 F4.8 — granica unosa nije smjela biti granica krive

**Nalaz prije izmjene.** Zadana donja granica unosa bila je
`SYSTEM_MIN_FLOW_C = 46` — granica **krive**. Bilo je tačno dok je kriva jedini
računač. Model daje niže; za tipičnu kuću (`s = 0,9`, `c = 1 K`, cilj
22 °C) izmjereno na `equilibrium-flow.ts`:

| noćna temp | `F_eq` |
|---|---|
| +5 °C | **34,7 °C** |
| 0 °C | 39,2 °C |
| −5 °C | 43,7 °C |
| −10 °C | 48,2 °C |
| −15 °C | 52,7 °C |

Unos zaključan na 46 pri noći na +5 °C znači da korisnik **ne može
prihvatiti vlastiti predlog**. To je ista greška kao „zadano 48 vs. predlog
47,7“ iz `F13`, samo dublje: 34,7 prema 46 je **11,3 K**.

**Šta se mijenja, a šta ne.** `SYSTEM_MIN_CURRENT_FLOW_TEMP` postaje
`ABSOLUTE_MIN_FLOW_C` (30) — fizički pod. Mijenja se **samo ono što korisnik
smije upisati**. Motor i dalje klampuje svoj izlaz na 46–55; garant „raspon ne
dira motor“ postoji i ostaje zelen. `SYSTEM_MIN_FLOW_C` ostaje dostupan
(re-export) jer je i dalje granica **motora**, drugi pojam od granice **unosa**
— i to je razlika koju je F4.8 otkrio: dva broja su izgledala kao jedan.

**Mjerenje je prvo dalo nulu, i nula je bila pogrešno pročitana.**
`flow-floor-gap-readonly.cjs`, run `43285799640`: **56 predloga, 0 ispod 46 °C**.
Izgledalo je kao „nema problema“. Nije: do F4.8 su predloge dale kriva i
kontroler, a oba su klampovana na 46. Izmjereno na motoru — noć +15 °C daje
**tačno 46,0** — dakle kriva **ne može** dati ispod 46 ni teoretski. Brojanje
zatečenih predloga zato mjeri **klamp, ne problem**. Presuda je preimenovana u
`NONE_BELOW_BY_CLAMP` i sada izričito kaže da F4.8 time nije zatvoren.

**Prava mjera je preračun, ne brojanje.** `model-floor-gap-readonly.cjs`
računa `F_eq` na **istim ulazima** koje zapis nosi
(`params.input.forecast.nightMinC`/`dayMaxC`) — ne na današnjoj prognozi, koja
se od tada promijenila. Run `43287531318`:

- `MODEL_BELOW_OLD_FLOOR`: **1/1** dana sa ulazima, `F_eq` **32,9 °C**,
  **13,1 K** ispod stare granice, **0** ispod novog poda (30).
- Pokrivenost uzorka: **1 dan od 56** — ostali nemaju zapisanu noćnu prognozu.
  Zato je nalaz **smjer, ne udio**, i izlaz to sada ispisuje uz upozorenje.
- Referentni nagib je **imenovan u izlazu** (`s = 0,9`, `c = 1 K`): model kuće
  nije u `params`, pa je broj donja granica reda veličine, ne broj po danu.

**Dvije greške u izvještavanju, obje uhvaćene, obje popravljene.** Prva verzija
je brojala „ispod granice“ samo kao „ispod 30“, pa bi 34,7 — ključni slučaj
F4.8 — ostalo **neizbrojano**; self-test je to uhvatio. Isto je ostalo u
`ratio`, koje je uz 1/1 ispod granice ispisalo **0,0 %**; popravljeno i
pokriveno testom. Self-test: **15/15**.

**Testovi:** `boiler-flow-range` 20/20 (+1: modelski predlog od 34,7 prolazi
kroz **zadani** raspon), `Boiler`+`BoilerCatalog` 60/60, `tsc` 0, `eslint` 0.

### 10.28 F4.7 — zašto brisanje nije urađeno (dokaz, ne procjena)

F4.7 u tabeli traži `grep` sa **0 hitova**. Mjereno 2026-11-12 na
`ec2016b` — hitova nema 0:

| mjesto | šta koristi | zašto je živo |
|---|---|---|
| `Boiler/boiler.service.ts:16` | `FlowTemperatureEngine.calculate` | `/boiler/sync` — motor je **fallback** kad zapisa nema, i daje `curveFlowTemp` |
| `DailyRecord/daily-record.writer.ts:3` | isto | writer u `PROPOSAL_ENGINE=curve` režimu (zadano) |
| `Boiler/flow-range.ts:48,53` | `SYSTEM_MAX/MIN_FLOW_C` | re-export; granice motora |
| `HeatingRecommendation/recommendation-breakdown.ts:1` | tipovi | `FlowTempResult` u breakdown-u |

Izvršenje F4.7 kako piše oborilo bi **i** `/boiler/sync` i jutarnji predlog u
zadanom režimu. Zato F4.7 nije urađen; to nije odgađanje nego nalaz.

**Šta F4.7 zaista traži, po redu.** Nijedan korak se ne smije preskočiti, jer
svaki sljedeći uzima zdravo stanje prethodnog:

1. **`boiler.service` prestaje zvati motor.** Danas je motor tu na dva načina:
   kao fallback (`daily.flowC ?? result.finalTemp`) i kao `curveFlowTemp` za
   drift na dashboardu (`dashboard.service.ts:900`). Oba se rješavaju
   *prije* brisanja: fallback postaje `NONE` (ne izmišljati broj — isto
   pravilo kao `resolveDailyFlow`), a drift se mjeri iz zapisa, ne iz motora.
   **Mjerenje prije:** koliko `/boiler/sync` poziva padne u fallback, jer to je
   broj korisnika koji bi ostao bez polazne.
2. **`PROPOSAL_ENGINE` zadano postaje `model`**, pa `curve` grane u writer-u
   prestaju biti zadane. **Mjerenje prije:** `params.engine` po danu — koliko
   zapisa nosi `curve`, a koliko `model`; prelazak je dozvoljen tek kad model
   daje broj na svim danima gdje kriva daje.
3. **Granice krive nestaju.** `CURVE_MIN_FLOW_C` je već imenovan kao vlasništvo
   krive (`flow-constants.ts`), pa njegovo uklanjanje ide zajedno sa krivom —
   inače ostaje broj bez vlasnika, tačno ono što F5.1 zabranjuje.
   Re-exporti u `flow-range.ts:48,53` tada moraju nestati u **istoj** izmjeni.
4. **Tipovi sele u trajno mjesto.** `FlowTempResult`/`FlowCalcMode` koristi
   `recommendation-breakdown`; ne smiju se brisati zajedno s motorom, nego
   preseliti — inače F4.4 (`baseCurveTemp: null`) gubi tip.

**Gejt za početak:** korak 1 ima svoje mjerenje. Do tada F4.7 ostaje
blokiran, a `grep` u tabeli ostaje neispunjen **namjerno** — lažno zelenilo
bilo bi gore od otvorene stavke.

### 10.29 F4.7 korak 1 — motor je i dalje živi fallback (5/61)

**Šta se mjerilo.** F4.7 traži da `Heating/engine` nestane. Prvo se mora znati
koliko puta je motor bio **jedini broj**: u `boiler.service` on je fallback kad
za danas nema `DailyRecord`-a ili predloga. Mjeri se po **kuća-danu**
(`curve-fallback-readonly.cjs`).

**Tri pogrešna nalaza prije tačnog — i zašto su popravljena, a ne zataškana.**

| run | nalaz | zašto nije bio tačan |
|---|---|---|
| `43305122303` | 61/61 bez zapisa | spajalo se po `homeProfileId`; skripte u repou spajaju po `userId` |
| `43311754595` | isto, i poslije popravke veze | `generate_series(date, date, interval)::text` daje **timestamp** `2026-10-09 00:00:00+00`, a `localDate` je `YYYY-MM-DD` — join po tekstu promaši sve |
| `43316724988` | 5/61, presuda odrezana | GitHub drži **10 anotacija** po koraku; presuda je bila zadnja linija |

**Dijagnostika je bila ta koja je našla drugu grešku, ne pretpostavka.** Uz
nalaz se mjeri i veza: `56` redova u prozoru, `56` spojenih po `userId`, `56` po
`homeProfileId`, `0` siročadi. Kad se to ne slaže sa `0` u gridu, greška je u
**gridu**, ne u vezi — i tako je nađen `to_char`. Bez tog reda nalaz bi bio
uvjerljiv i netačan.

**Tačan nalaz** (run `43318671541`, 60 dana, 1 kuća):

- **56/61** kuća-dana ima jutarnji predlog; **0** zapisa bez predloga;
- **5** dana **bez zapisa**: `2026-10-06` … `2026-10-10`;
- prvi zapisani dan: **2026-09-13** — dakle praznina je **poslije** prvog
  zapisa, pa je to **živa zavisnost**, ne artefakt početka rada;
- presuda: **`CURVE_IS_LIVE_FALLBACK`**.

Pošto je praznina u sredini rada, brisanje motora bi tih 5 dana ostavilo bez
polazne — a to je tačno ono što F4.7 ne smije uraditi. **Zato F4.7 korak 1 nije
završen** i brisanje ostaje blokirano.

**Pet dana je malo, i to je dio nalaza.** Ne tvrdi se da je uzorak velik; tvrdi
se da praznina postoji, da je identificirana po datumu, i da je ne treba
pripisati početku rada kad nije.

### 10.30 F3.4 — ne čeka kalendar, nego `WEATHER_POLL_V2` (i CI je to krio)

**Nalaz.** Mjerenje `43379496307`: F3.4 „nema dana sa prognozom i mjerenjem”,
uz **1110 satnih uzoraka na 5 dana** i `nightMinOutdoorMeasuredC = 0`.

Skripta je to opisivala kao „čeka uzorke”, i iz toga slijedi pogrešan sljedeći
korak: *sačekaj još dana*. Ali uzoraka **ima**. Skripta ih samo nije pitala imaju
li `outdoorTempC`.

**Lanac, dokazan čitanjem koda:**

| korak | mjesto |
|---|---|
| `nightMinOutdoorMeasuredC` traži `outdoorTempC` na uzorku | `day-outcome.ts:312` |
| `outdoorTempC` piše polling | `thermostat.polling.service.ts:398` |
| vraća `null` kad je `WEATHER_POLL_V2` isključen | `polling-weather.service.ts:24` |
| a **zadano je `off`** | `backend/.env.example:43`, `env.md:71` |

Dakle kolona se ne popunjava dok je flag isključen — **čekanje ne mijenja
ništa**. To nije isto kao „čeka kalendar”, a razlika je odluka: prvo je jedna
env varijabla, drugo je 5+ dana.

**Potvrđeno mjerenjem, ne zaključkom** (`43380962071`):
`1113 uzoraka na 5 dana, nijedan nema outdoorTempC` ⇒
`UZROCI_BEZ_OUTDOOR`. Skripta sada imenuje jedan od tri uzroka
(`UZROCI_BEZ_OUTDOOR` / `NEMA_UZORAKA` / `NEDOVOLJNO_PAROVA`), jer prva dva
izgledaju isto (nula), a rješavaju se različito.

**Šta je ovo krivalo: CI je tiho odbacivao zadnja mjerenja.** GitHub prima
**50 anotacija po job-u** i odbacuje ostatak bez greške. Baseline job ima 9
mjerenja, a svako je emitovalo svaku liniju sa dva razmaka kao zasebnu
anotaciju (~10 po mjerenju). Zato **F3.4 i F3.5 nijednom nisu stigli do
anotacija** — a log job-a se u ovom okruženju ne može preuzeti, pa nalaz
nije bio vidljiv nigdje. Redoslijed koraka je odlučivao koji se nalaz vidi.

**Popravka:** `scripts/ci/emit_notice.sh` — jedna anotacija po mjerenju, sa
prefiksom i presudom prvom. Svih 5 postojećih mjerenja preseljeno (bilo ~10
anotacija, sada 1), F3.4 i F3.5 dobili anotaciju. Rezultat: **9 mjerenja → 30
anotacija** ukupno, daleko ispod limita, i nijedno mjerenje više ne zavisi od
toga je li prvo ili zadnje u jobu.

**Odluka koja ostaje vlasniku:** da bi F3.4 dao broj, `WEATHER_POLL_V2=on` mora
biti u produkcijskom env-u. To nije izmjena koda i ne može se uraditi iz
repoua — zato F3.4 ostaje otvoren sa **imenovanim** uzrokom, a ne sa „čeka se”.

### 10.31 `WEATHER_POLL_V2` — šta tačno treba (izmjereno, ne pretpostavljeno)

**Pitanje:** je li F3.4 blokiran samo flagom? **Ne.** Mjerenje
`43385118170` (`weather-v2-readiness-readonly.cjs`):

> `TREBA_LOKACIJU — 0/1 profila potvrđeno`, profil 3 fali **svih 8 polja**
> (`weatherLatitude`, `weatherLongitude`, `weatherTimezone`,
> `weatherLocationProvider`, `weatherLocationProviderId`,
> `weatherLocationLabel`, `weatherLocationName`, `weatherLocationConfirmedAt`)

**Lanac, dokazan čitanjem koda.** Flag sam ne daje broj; treba **potvrđena
lokacija**, jer `confirmedLocation()` (`weather-v2.service.ts:86`) traži **svih
osam** polja i vraća `null` ako ijedno fali — šest popunjenih je isto što i nula.

| korak | uslov | gdje |
|---|---|---|
| 1. flag | `WEATHER_LOCATION_V2=on` **i** `WEATHER_POLL_V2=on` | env |
| 2. lokacija | 8/8 polja u `HomeProfile` | `POST /weather/v2/locations/:id/confirm` |
| 3. keš | `getCachedWeather` **ne dohvata**, samo čita | `weather-v2.service.ts:208` |
| 4. upis | `outdoorTempC` u `ThermostatObservation` | `polling.service.ts:398` |
| 5. par | `nightMinOutdoorMeasuredC` za **završene** dane | `day-outcome.ts:312` |

**Provajder ne traži API ključ.** `WEATHER_V2_PROVIDER = 'open-meteo'`
(`weather-v2.types.ts:1`), a `openmeteo-v2.provider.ts:15` zove javni
`api.open-meteo.com`. Nema tajne koju treba nabaviti.

**Rok poslije flaga se ne izmišlja.** `nightMinOutdoorMeasuredC` se popunjava
za **završene** dane (`outcomeAt`), pa se prvi parovi noći broje od **sljedeće
noći**, a F3.4 traži `MIN_DAYS` parova. Flag dakle ne daje broj istog dana.

**Uzrok nije u repou.** Nijedan od pet koraka se ne mijenja kodom; prvi je env
varijabla, drugi je korisnička radnja u aplikaciji. Zato F3.4 i F3.1 ostaju
otvoreni — blokirani **imenovanim** uzrokom, ne čekanjem.

**Veza koja se dosad nije vidjela:** F3.1 je odbijao 5 dana sa `NO_OUTDOOR 3` —
to je **isti** korijen. Uključivanje flaga i potvrda lokacije otvaraju **oba**
mjerenja odjednom.

### 10.32 Šta zaista pokreće punjenje keša (i zašto „potvrdi lokaciju” nije dovoljno)

**Provjereno čitanjem poziva, ne pretpostavkom.** `getCachedWeather`
(`weather-v2.service.ts:208`) radi ovako:

1. `assertEnabled()` — traži `WEATHER_LOCATION_V2`;
2. `confirmedLocation()` — traži svih 8 polja;
3. **pročita** `WeatherV2Cache`; ako reda nema → **`null`**, i tu staje.

Dakle **keš puni isključivo `getWeather()`**, a njega zove samo
`GET /api/weather/v2/current/:homeProfileId` (`weather.controller.ts:96`).
Nema crona, nema intervala:

```
grep -rn "getWeather(" | grep -v weather-v2.service   ->  samo controller
grep -rn "@Cron|setInterval" src/modules/Weather      ->  nista
```

Svi read-only potrošači traže **keš** i ne pune ga:
`polling-weather.service.ts:30`, `boiler-weather.service.ts:21`,
`dashboard-weather.service.ts:70`, `recommendation-weather.service.ts:24`.

**Posljedica za podešavanje.** Samo potvrđena lokacija **ne daje**
`outdoorTempC`. Treba i **jedan poziv** `GET /v2/current/{id}` poslije potvrde —
inače `getCachedWeather` zauvijek vraća `null` i polling nema šta upisati.
To je lako propustiti jer izgleda kao da se keš puni sam.

**`WEATHER_SWR_ENABLED=off` je ispravno za prvo punjenje.** Bez SWR-a `getWeather`
radi `await this.refresh(...)` **sinhrono** (`:269`) — keš je pun kad odgovor
stigne. Sa SWR-om bi prvi poziv vratio `null`-ish stanje i punjenje bi otišlo u
pozadinu. Za provjeru da lanac radi, `off` je bolji.

**Svježina je uslov za upis, ne za broj noći.** `toResponse` (`:350`) skriva
`current` kad je keš stariji od `WEATHER_CURRENT_HIDDEN_AFTER_MINUTES`
(zadano **60**), a `PollingWeatherService` prihvata samo konačan
`current.temperatureC`. Dakle **keš mora biti mlađi od 60 min** u trenutku
polling ciklusa; inače `outdoorTempC` ostaje `null` iako je lokacija potvrđena.

Kako se to održava: polling bucket je češći od 60 min, pa normalno korištenje
aplikacije (dashboard/prognoza) obnavlja keš. Ali ako niko ne otvori
prognozu, keš ostari i `outdoorTempC` opet pada na `null` — tiho.

**Zato F3.4 poslije uključivanja treba mjeriti, ne pretpostaviti:**
`UZORCI_BEZ_OUTDOOR` mora preći u broj veći od nule. Ako ostane nula uz
potvrđenu lokaciju, uzrok je **star keš**, i to je novo mjerenje, ne ista greška.

### 10.33 Flag uključen — lanac radi, ostaje čekanje (mjereno)

**Postavljeno u produkciji (2026-11-13):** `WEATHER_LOCATION_V2=on`,
`WEATHER_POLL_V2=on`, `WEATHER_SWR_ENABLED=off`. Lokacija potvrđena:
`Visoko, Federation of Bosnia and Herzegovina` — `providerId 3187609`,
**43.98889, 18.17806**, `Europe/Sarajevo`, `confirmedAt 08:59:47Z`.

**Zašto taj kandidat, a ne drugi.** Pretraga „Visoko” dala je **5** kandidata.
Po koordinatama:

| `providerId` | udaljenost | napomena |
|---|---|---|
| **3187609** (FBiH) | **0 km** | izabran |
| 3256948 (RS) | 67,3 km | **isto ime, ista zona** — vidi se samo po koordinatama |
| 3187607 (Varaždin, HR) | 276,2 km | |
| 8555020 (Zelenikovo, MK) | 358,5 km | |
| 784385 (Prilep, MK) | 413,1 km | |

Kandidat iz RS-a ima **istu zonu** (`Europe/Sarajevo`), pa se greška po vremenu
ne bi primijetila — samo po geografskoj širini. Zato se lokacija provjerava
koordinatama, ne državom ni imenom.

**Lanac je potvrđen dvama mjerenjima, prije i poslije.**

| | prije (`43385118170`) | poslije (`43397850858`) |
|---|---|---|
| readiness | `TREBA_LOKACIJU` 0/1 | **`FLAG_DOVOLJAN` 1/1** |
| F3.4 uzrok | `UZORCI_BEZ_OUTDOOR` | **`NEDOVOLJNO_PAROVA`** |
| outdoorTempC | nijedan uzorak | **ulazi** |

Promjena **uzroka** je dokaz, a ne broj: `outdoorTempC` je počeo ulaziti u
uzorke, pa je nestala blokada koju je skripta imenovala, a ostala je druga
(„malo parova”). Da flag nije radio, uzrok bi ostao isti.

**Šta se sada čeka — tačno, ne okvirno:**

| korak | kad |
|---|---|
| `outdoorTempC` u uzorke | svaki polling ciklus (radi) |
| `nightMinOutdoorMeasuredC` za **završene** dane | `@Cron('20 3 * * *')` — **03:20 UTC** |
| prag F3.4 | `MIN_DAYS = 5` parova |

Dakle prvi parovi nastaju u noći **14.11.**, a peti tek oko **18.11.** F3.4 tada
prvi put daje broj. Do tada je svaki run `NEDOVOLJNO_PAROVA` — i to je
**očekivano stanje**, ne greška.

**Jedan uslov koji se mora održavati.** `toResponse` skriva `current` kad je keš
stariji od `WEATHER_CURRENT_HIDDEN_AFTER_MINUTES` (**60**), a polling prihvata
samo konačan `temperatureC`. Ako se keš ne obnovi (niko ne otvori prognozu),
`outdoorTempC` tiho pada na `null`. Zato će F3.4 poslije 18.11. moći i da
**opadne** ako keš stari — i taj pad treba čitati kao nalaz o kešu, ne o formuli.

### 10.34 F4.5 gejt — `--since` radi, ali dan bez grijanja ne mjeri ništa

**Kad je mjerljivo.** Deploy u `main` (`1c56f4a`, **05:13 UTC** / 06:13 lokalno).
Predlog se piše od **06:00 lokalno** (`PROPOSAL_LOCAL_HOUR = 6`), pa je
**današnji zapis nastao poslije deploya** — dakle današnji `DailyRecord` je
prvi pod novim kodom. `--since=2026-11-13` je zato tačan datum, ne približan.

**Prvi pokušaj (`43402878050`): `NO_DAYS`.** Bez ijednog reda u prozoru. To je
bilo **nepotpuno**, i to dvaput:

1. `NO_DAYS` nije razlikovao tri stanja (`NEMA_UOPSTE` / `NEMA_U_PROZORU` /
   `NEMA_POLAZNE`) — a rješavaju se različito. Dodato u `b12e10b`.
2. Druga verzija (`43404381843`) rekla je „prozor je prekratak, ne kod” —
   i **to je bila pretpostavka**. Provjereno u kodu: `BoilerHistory` red
   nastaje **samo pri početku grijanja** (`polling.service.ts:504`, grana
   `handleHeatingStart`). Odsustvo redova zato ne znači samo „preuzak prozor”.

**Tačan nalaz** (`43405672403`, `--since=2026-11-13`):

> `CEMA_HLADNIJI_DAN: 432 redova ukupno, zadnji 2026-11-12; dan danas nema
> grijanja (0 HeatingEvent poslije ponoći)`

Mjeri se **i** `HeatingEvent`, ne samo `BoilerHistory`, jer dvoje ima
**suprotne** sljedeće korake:

| grijanja danas | redova u prozoru | presuda | šta raditi |
|---|---|---|---|
| **0** | 0 | `CEMA_HLADNIJI_DAN` | čekati hladniji dan **— kod je u redu** |
| > 0 | 0 | `UZROK_U_KODU` | upis pri početku grijanja ne radi |

Bez te razlike bi nula bila pročitana kao „popravka nije uspjela” i F4.5 bi
bio vraćen na početak bez razloga. 13.11. je u Visokom bio topao dan
(dnevni maksimum **19,6 °C** po prognozi iz `curl`-a) — grijanje se nije
uključilo, pa oscilacija polazne nije ni mogla nastati.

**Stanje gejta:** `--since` je **ispravan i spreman**; prvo mjerenje je
**prvog dana kad se grije**. Do tada nijedan broj o oscilaciji — ni dobar ni
loš — ne postoji, i to je tačno ono što izlaz sada kaže.

