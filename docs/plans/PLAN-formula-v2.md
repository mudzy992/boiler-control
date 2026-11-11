# PLAN — formula v2: penzionisanje stare krive i puštanje toplotnog bilansa

Status: **plan, ništa od ovoga nije implementirano.** Odluka vlasnika
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
| F1.6 | Backfill istorijskih `nightMinC` iz `ThermostatObservation.outdoorTempC` (mjereno, ne prognoza) u **odvojeno** polje `nightMinMeasuredC` | nova migracija + `backfill-reconstruction.ts` | skripta ispiše koliko % dana ima mjereno |

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

---

### F2 — Formula: `− c` + referentna vanjska + starost modela

| # | Posao | Gdje | Mjera |
|---|---|---|---|
| F2.1 | `equilibriumFlowC = target + s·(target − O_ref) − c` | `proposal-shadow.service.ts:183` | test sa `c = 0,95`, `s = 0,943`: polazna niža tačno za `c` |
| F2.2 | `O_ref = 0,7·nightMin + 0,3·dayMax` (dnevni prosjek umjesto najhladnijeg sata) | isto + `DailyRecord.dayMaxC` iz F1 | test: sunčan dan (max ≫ min) daje nižu polaznu |
| F2.3 | `s` se bira po starosti: `days < 20` → `slopeCiHigh`; inače `slopeS` | isto | test granice na 20. danu |
| F2.4 | `confidence = exp(−age/45)` gdje je `age` dani od `lastFitAt`; ulazi u odluku kao **prigušivač** (offset → 0 pri niskoj) | `proposal-controller.ts` | test: model star 90 dana ne mijenja polaznu bez svježeg ishoda |
| F2.5 | `u_day` i `− c` u isti znak — **jedan** test koji tvrdi da se ne oduzimaju dvaput | `day-gain.ts` + `proposal-shadow` | test: `u_day = 0` i `c = 0,95` ⇒ tačno `−c`; `u_day = 1` ⇒ još `−1` |
| F2.6 | Ispraviti istu grešku u `scripts/audit/learning_sim.cjs` (mjerio je pogrešan kontroler) | `scripts/audit/learning_sim.cjs:307` | ponovljen run daje iste brojeve kao §9 |

**Mjereno prije pisanja plana** (`learning_sim`, 60 dana, sve tri kuće):

| kuća | polazna (kraj) base → `−c` → `−c` + `O_ref` | ciklusa/dan | podbačaj-dana |
|---|---|---|---|
| light | 39,1 → 38,1 → 37,1 | 28,1 → 23,1 → 17,2 | 0/50 u sva tri |
| medium | 43,6 → 42,6 → 41,4 | 21,7 → 18,2 → 13,3 | 0/50 u sva tri |
| heavy | 44,9 → 43,9 → 42,5 | 6,6 → 5,6 → 4,0 | 0/50 u sva tri |

**Rizik:** `− c` snižava polaznu, a jedini razlog zašto simulacija ne pada u
podbačaj je kontroler koji podiže na svaki podbačaj. Ako je `c` precjenjen
(cijeli `c` se pripisuje dobitku, a dio je greška fita), polazna ide prenisko.
Zato F2.1 ide zajedno sa F3.1 (pokrivenost CI) i sa tvrdim testom da `c` nikad
nije veći od `residualStd`-om opravdane granice.

**Definicija gotovog:** na istoj istoriji, `− c` verzija ima **manje ili isto**
ciklusa i **nijedan** dodatni dan podbačaja; `params` svakog predloga nosi
`c`, `s`, `ciLow/High`, `modelVersion`, `constantsVersion`.

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
  `dayMaxC` nema ni mješavine.
- **F4 ne može početi prije F3.1** — puštanje modela bez izmjerene pokrivenosti
  CI je zamjena jednog neprovjerenog broja drugim.
- **F5 ide paralelno**, osim F5.2 koja mijenja ponašanje učenja (i zato ide
  prije F4.6).

## 5. Testiranje na CI (vlasnikov zahtjev)

Postojeća infrastruktura je dovoljna, uz tri dodatka:

| Šta | Gdje | Zašto |
|---|---|---|
| `backend-build.yml` `test` job već vrti `jest --runInBand` na Postgresu 16 | `.github/workflows/backend-build.yml:145` | ništa novo ne treba za unit testove |
| **Novi korak:** `node scripts/audit/learning_sim.cjs --json` i poređenje sa zlatnim brojevima u `scripts/audit/fixtures/formula-v2.json` | novi korak u `test` jobu | sprječava tihu regresiju formule; brojevi iz §9 postaju test |
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
2. **F2.3 granica 20 dana:** je li prihvatljivo da prvih 20 dana polazna ide po
   gornjoj granici CI? Do sada je tako radilo i nije bilo podbačaja.
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

**Reprodukcija:** patch je bio privremen (u `/tmp`, nije u repou). F2.6 ga
pretvara u trajnu mogućnost skripte (`--subc`, `--oref`) da brojevi iz ove
tabele postanu CI test.

---

## 10. Prvi korak

**F1.1 + F1.2 + F1.3** — prognoza noći i upis polja. To je jedina faza koja
otključava sve ostalo, a sama po sebi ništa ne mijenja u onome što korisnik
vidi (polja su nova, kontroler ih još ne koristi za predlog). Poslije nje
kontroler prestaje vraćati `NO_MODEL` — i **to** je prvi broj koji se može
izmjeriti na stvarnoj bazi.
