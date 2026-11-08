# Plan implementacije — polazna temperatura, učenje, anomalije, instrukcije

Status: **predlog, nije odobrenje za izmjene** · Datum: 2026-11-08 · Grana: `arena/da41e5ba-boiler-control`

Nadovezuje se na:
- `13-flow-temp-max-audit.md` — nalazi F-01…F-16, L-01…L-12, A-01…A-12 (dokazi)
- `10-implementation-plan.md`, Talas 2 i 4 — opšti okvir za formule u shadow modu

Ovaj dokument **ne mijenja** aplikacijski kod. Daje redoslijed, tačne izmjene i kriterije prihvata.

> **Revidirano 2026-11-08:** `15-daily-proposal-audit.md` utvrđuje da je ugovor proizvoda jedan **dnevni** potez. Zato se mijenja oblik ovih koraka: **F2.4** (bucket EWMA → dnevni EWMA), **F2.1** (uzorak = dan, ne ciklus), **F4** (dnevna instrukcija, ne „trenutna") i **F5** (mjere po danu i stepen-satima). Novi P0 koraci iz `15` §8 idu **prije** F1. Ostalo ostaje kako je napisano.

---

## 0. Zašto ovaj redoslijed

Pet stvari se ne smije raditi istovremeno, jer se njihovi efekti ne mogu razlikovati u produkciji:

1. **Prvo mreža, pa izmjena.** Danas ne postoji nijedan test za formulu (§6.0 audita). Svaka promjena bez snimka je nepovratna po tome što se ne zna šta se pokvarilo.
2. **Prvo zaustavljanje štete, pa matematika.** Frost guard i neizvršiva preporuka štete korisniku sada; matematička ispravka učenja je dugoročna i traži podatke.
3. **Prvo signal, pa model.** Dok se u učenje šalje početna temperatura sobe (L-01), svaki novi model uči istu grešku — samo brže.
4. **Prvo anomalije koje ne lažu, pa instrukcije.** Instrukcija izgrađena na lažnom alarmu je uvjerljivija i zato gora.
5. **Oblik krivulje se NE dira u prvom prolazu.** Linearna krivulja i njeni prekidi su loši, ali zamjena bez backtesta je zamjena jedne nevalidirane formule drugom. To je Talas 5.

---

## 1. Odluke koje blokiraju korake

| ID | Pitanje | Blokira | Predlog (traži potvrdu) |
|---|---|---|---|
| **D-1** | Smije li preporuka biti ispod 48 °C? | F1.2 | Izlaz motora ostaje 46–55, ali **instrukcija nikad ne traži unos ispod 48**; ako je izlaz < 48 → „ostavite trenutno" |
| **D-2** | Smije li `SUMMER` ugasiti grijanje pri vanjskoj ≤ 0 °C? | F1.1 | **Ne.** Frost guard je iznad korisničke postavke |
| **D-3** | Minimalan broj uzoraka prije primjene naučenog offseta | F2.4 | 8, uz `confidence ≥ 0,3` |
| **D-4** | Maksimalan doprinos naučenog offseta | F2.4 | ±3 °C po intervalu, ±2 °C promjena po danu |

Bez D-1 i D-2 koraci F1.1 i F1.2 se ne izvode. Bez D-3/D-4 F2.4 ostaje u shadow modu.

---

## 2. Talas F0 — sigurnosna mreža (urađeno)

### F0.1 Golden snimak motora i detektora
- **Fajlovi:** `scripts/audit/formula_max_audit.cjs`, `scripts/audit/fixtures/formula_golden.json`
- **Stanje:** **implementirano u ovom auditu.** `--write-golden` snima 133 slučaja (krivulja, granice ±1e-6, sve tri strategije, polja profila, učenje, događaji, nevalidni ulazi, detektor anomalija).
- **Provjera da gate stvarno hvata:** privremena izmjena `Math.max(46, …)` → `Math.max(47, …)` u `base.strategy.ts:25` proizvodi **17 razlika** i izlazni kod **1**; vraćanje fajla daje kod **0**.
- **Prihvat:** `node scripts/audit/formula_max_audit.cjs --check-golden` zelen; snimak se mijenja **samo** u commitu koji svjesno mijenja ponašanje, uz objašnjenje u poruci commita.
- **CI:** dodati kao korak u backend workflow na aktivnoj grani (`on.push.branches: [arena/da41e5ba-boiler-control]`), bez `pull_request` i bez `main`. Trajanje ~0,7 s, bez baze.
- **Rollback:** nema rizika; fajl je artefakt.

### F0.2 Ova dva harnessa kao osnova regresionih testova
- `formula_max_audit.cjs` — čista formula, `--only=…` po sekciji.
- `formula_pipeline_repro.cjs` — servisi nad lažnom bazom, sa `assert` tvrdnjama za F-04/F-08/F-12/A-06/L-06/L-10.
- **Prihvat:** oba izlaze s kodom 0; pad znači promjenu ponašanja koja mora biti namjerna.

---

## 3. Talas F1 — zaustavljanje štete (bez promjene matematike)

Zajedničko pravilo: nijedan korak ovog talasa **ne mijenja** `baseCurveTemp`, ni offsete, ni confidence. Mijenja se samo ono što korisnik vidi i što sistem dopušta.

### F1.1 Frost guard iznad sezone (B-102, D-2)
- **Fajlovi:** `backend/src/modules/Boiler/boiler.service.ts` (`calculateFlowTemp`, grana `seasonMode`), `backend/src/modules/Schedule/daily.recommendation.service.ts` (isti guard za push).
- **Promjena:** prije `createOffResult`, provjeriti vanjsku temperaturu:
  ```ts
  // prijedlog, nije primijenjeno
  const frostRisk = tempMin !== null && tempMax !== null && Math.min(tempMin, tempMax) <= 0;
  if (seasonMode === 'SUMMER' && frostRisk) {
    // ne gasiti grijanje; nastaviti proračun i označiti frost_risk
  }
  ```
- **Test-first:** `seasonMode='SUMMER'`, `tempMin=-12` → `flowTemp > 0` i `frostRisk=true`; `tempMin=18` → ostaje `0`.
- **Prihvat:** postojeći `boiler-v2-routing.spec.ts` zelen; novi test pokriva oba kraka.
- **Rollback:** revert; nema migracije.
- **Trud:** S. **Zavisnost:** D-2.

### F1.2 Izvršiva preporuka (B-101, D-1)
- **Fajlovi:** `backend/src/modules/HeatingRecommendation/recommendation-breakdown.ts`, `frontend/src/features/heating/components/RecommendationBreakdown.tsx`, `mobile/src/components/RecommendationBreakdown.tsx`, `backend/src/modules/Boiler/dto/set-current-temp.dto.ts` (samo čitanje granica — ne mijenjati).
- **Promjena:** u breakdown snapshot dodati dva polja, bez diranja `finalTemp`:
  ```ts
  // prijedlog, nije primijenjeno
  entryFloorTemp: 48,                       // iz jedne konstante, ne литерал
  actionable: finalTemp >= 48 && finalTemp <= 55,
  ```
  Klijent: kada `actionable === false`, ne prikazuj „postavi na X" nego „ostavite trenutno (minimum uređaja je 48 °C)".
- **Test-first:** engine vrati 46,00 → `actionable=false`, UI ne nudi unos; 51,20 → `actionable=true`, unos radi.
- **Prihvat:** `recommendation-breakdown.spec.ts` proširen; web i mobile testovi za oba stanja; DTO nepromijenjen (48–55 ostaje).
- **Rollback:** polja su aditivna; stari klijenti ih ignorišu.
- **Trud:** S. **Zavisnost:** D-1.

### F1.3 „Nepoznato" nije nula (B-112 dio, B-114)
- **Fajlovi:** `daily.recommendation.service.ts:93` (`expectedHeatTimeMin: 0`), `heating.recommendation.service.ts:166,176`, `recommendation-breakdown.ts`, oba `RecommendationBreakdown` komponenta.
- **Promjena:** `expectedHeatTimeMin: samples > 0 ? avgReachTimeMin : null`; u breakdown-u `null` umjesto `0`; UI prikazuje „nepoznato" umjesto „0 min".
- **Test-first:** dnevni cron bez učenja → `expectedHeatTimeMin === null`; UI ne sadrži tekst „0 min".
- **Prihvat:** nijedan put ne upisuje `0` kao „nepoznato"; `confidence: 0` se prikazuje kao „model se uči".
- **Rollback:** revert; kolona je `Float` i prima `null`? **Provjeriti** — `expectedHeatTimeMin Float` je NOT NULL u shemi (`schema.prisma:151`), pa je potrebna **aditivna migracija** na nullable ili slanje `null` samo u DTO/breakdown sloju. Preporuka: **ne dirati kolonu**, držati `null` u breakdown JSON-u.
- **Trud:** S. **Zavisnost:** nema.

### F1.4 Anonimna preporuka nije personalizovana (B-116)
- **Fajlovi:** `dashboard.service.ts:70-90`.
- **Promjena:** uz `source: 'LIVE_CALCULATION'` dodati `city: 'Visoko'`, `personalized: false`; UI prikazuje „opšta vrijednost za Visoko".
- **Test-first:** `getDashboard()` bez `userId` → `personalized === false`.
- **Prihvat:** nijedan anonimni prikaz ne izgleda kao izračun za korisnikovu kuću.
- **Rollback:** aditivno.
- **Trud:** S.

### F1.5 Jedan `Recommendation` po danu (B-121)
- **Fajlovi:** `daily.recommendation.service.ts:88-114`, `heating.recommendation.service.ts:153-182`, `backend/prisma/schema.prisma:147-159`.
- **Promjena:** (a) provjera „već poslano" **prije** `create`; (b) `upsert` po `(userId, date)`.
- **Migracija:** unikatni indeks `@@unique([userId, date])` **samo nakon** što se postojeći duplikati očiste. Postupak: prvo read-only brojanje duplikata po danu, pa zaseban odobren korak čišćenja, pa expand-only migracija indeksa. Bez mjerenja produkcije ne uvoditi constraint.
- **Test-first:** dva pokretanja → jedan red, jedna notifikacija (danas: dva reda — F-16).
- **Prihvat:** broj redova po `(user, dan)` ≤ 1 u testu; notifikacija ostaje deduplikovana.
- **Rollback:** indeks se skida bez gubitka podataka; provjera prije `create` se revertira.
- **Trud:** S (+ M za migraciju ako duplikati postoje). **Zavisnost:** read-only pregled produkcije.

---

## 4. Talas F2 — učenje koje se može mjeriti (iza flaga)

Uvodi se flag `HEATING_LEARNING_V2` (env, default `off`) koji uključuje **paralelno računanje** novog stanja i log agregata razlike. Korisnik i dalje vidi staru preporuku. Bez ovog flaga nijedan korak F2.2–F2.4 ne ide na vidljivi izlaz.

### F2.1 Perzistencija i idempotentnost (B-107)
- **Fajlovi:** `heating.recommendation.service.ts:52-97,190-207`.
- **Promjena:**
  ```ts
  // prijedlog, nije primijenjeno
  await this.prisma.$transaction(async (tx) => {
    const row = await tx.heatingIntervalLearning.upsert({
      where: { homeProfileId_intervalKey: { homeProfileId, intervalKey } },
      create: { homeProfileId, intervalKey, ...initial, samples: 1 },
      update: { ...next },
    });
    if (row.samples !== nextSamples) this.logger.warn('learning-sample-race', {...});
  });
  ```
  Ukloniti `id: 0` dummy i `updateMany`; provjeriti `count`/rezultat i logovati.
- **Test-first:** profil bez reda → **jedan** `create` u lažnoj bazi, `samples=1`; dva konkurentna poziva → `samples=2`, nijedan uzorak izgubljen.
- **Prihvat:** `formula_pipeline_repro.cjs` mijenja tvrdnju iz „0 upisanih" u „1 upisan"; nema tihog neuspjeha.
- **Rollback:** flag isključuje novi put; stara putanja ostaje dok se ne potvrdi.
- **Trud:** S. **Rizik:** nizak (nema promjene izlaza dok je flag off).

### F2.2 Ispravan završni signal (B-105, F-02/L-01)
- **Fajlovi:** `thermostat.polling.service.ts:480-490`, `heating.anomayl.checker.service.ts:313-322`.
- **Promjena:** u `handleHeatingEnd` proslijediti **završno** očitanje (`device.roomCurrentTemp` iz istog poll ciklusa), ne `lastEvent.roomCurrentTemp`. U zapis eventa dodati `roomCurrentTempEnd` (nova nullable kolona, expand-only) da povijest ostane dokaziva.
- **Migracija:** `ALTER TABLE "HeatingEvent" ADD COLUMN "roomCurrentTempEnd" DOUBLE PRECISION NULL` — aditivno, bez backfill-a; stare redove označiti kao „nepoznato", ne popunjavati početnom vrijednošću.
- **Test-first:** poller s `current=21,4 / target=21,5` na kraju → učenje dobija `deficitEnd = 0,1`, a ne `−1,5` iz starta.
- **Prihvat:** novi uzorci imaju `overshoot ≥ 0` kad je cilj pređen i `≈ 0` kad je dostignut; stari redovi imaju `null`.
- **Rollback:** nova kolona ostaje (expand-only), čitanje se vraća na staro.
- **Trud:** M. **Rizik:** **visok** — mijenja sve buduće preporuke; zato flag + shadow.

### F2.3 Uklanjanje dvostrukog sabiranja i obrnutog znaka (B-106, F-03/L-03/L-04)
- **Fajlovi:** `full.strategy.ts:13-26,53-56`.
- **Promjena:** `intervalOffset = offset` (jedan naučeni offset), a `avgOvershoot`/`avgReachTimeMin` ostaju **dijagnostika** za anomalije i instrukcije. Ako se zadrži korekcija, predznak je `−` prema overshootu i `+` prema rezervi snage, sa eksplicitnim capom.
- **Test-first (golden delta):** `overshoot=+2` → više **ne** daje `+3,00 °C` na polaznu; `reach=20` → nema pozitivne korekcije.
- **Prihvat:** golden snimak se mijenja **u jednom** commitu sa tabelom „prije/poslije" za svih 133 slučaja; nijedna promjena nije izvan očekivanog.
- **Rollback:** flag.
- **Trud:** M. **Rizik:** visok. **Zavisnost:** F2.2 (bez ispravnog signala popravka znaka samo obrće pristrasnost).

### F2.4 Ograničeno učenje i stvarna pouzdanost (B-108, B-109, D-3, D-4)
- **Fajlovi:** `heating.recommendation.service.ts` (novi `learning/ewma.ts` sa čistim funkcijama), `full.strategy.ts`, `profile.strategy.ts`.
- **Promjena:** bounded EWMA sa `α = max(0,05; 1/min(N; 40))`, varijansa, `N_min=8`, cap ±3 °C, `confidence = f(N, σ/μ)`, odbacivanje uzorka izvan 3σ. Motor primjenjuje offset **samo** ako `confidence ≥ 0,3`.
- **Test-first:** confidence raste s N i pada s varijansom (nikad konstanta 0,1); jedan outlier ne pomjera offset > 1 °C; N=7 → offset se ne primjenjuje.
- **Prihvat:** golden pokriva nove slučajeve; health `learningConfidence` više nije strukturno 10/100 (L-07).
- **Rollback:** flag; staro stanje se ne briše.
- **Trud:** L. **Rizik:** visok. **Zavisnost:** D-3, D-4, F2.1–F2.3.

---

## 5. Talas F3 — anomalije koje ne lažu

### F3.1 Baseline bez self-inclusion i bez look-ahead (A-01, B-110)
- **Fajlovi:** `heating.anomayl.checker.service.ts:110-136`.
- **Promjena:** `id: { not: event.id }` + `timestampStart: { lt: event.timestampStart }` (samo ciklusi **prije** provjeravanog).
- **Test-first:** historija 60/58/62 + event 70 → detektovano (danas nije).
- **Prihvat:** `formula_pipeline_repro`/golden dobija novi scenarij; dvije uzastopne provjere istog eventa daju isti rezultat.
- **Rollback:** revert.
- **Trud:** S. **Rizik:** nizak.

### F3.2 Zaštita pri σ = 0 (A-02, B-111)
- **Fajlovi:** `common/anomaly-detection.service.ts:72-81`, `heating.anomayl.checker.service.ts:136`.
- **Promjena:** `effectiveSigma = max(2σ, 10 min)`; uz `N < 5` koristiti MAD umjesto σ; ukloniti uslov koji propušta σ=0.
- **Test-first:** 61 min vs 60/60/60 → **nije** anomalija; 140 min → jeste; 70 min vs 60/58/62 → jeste.
- **Prihvat:** nijedan test ne zavisi od σ=0 degeneracije; postojeći `anomaly-detection.service.spec.ts` ažuriran svjesno.
- **Rollback:** revert.
- **Trud:** S.

### F3.3 Potvrda ne prepisuje stvarni kraj (A-06, F-11)
- **Fajlovi:** `heating.anomayl.checker.service.ts:253-323`.
- **Promjena:** ako event već ima `timestampEnd`, `confirm` ga **ne mijenja**; `proposedEndTime` se koristi samo kad kraja nema. Učenje se poziva samo sa **stvarnim** krajem; ako kraj nije izmjeren, uzorak se ne šalje.
- **Test-first:** stvarni kraj 11:00, `proposedEndTime` 08:30 → nakon `confirm` stoji 11:00 i učenje dobija 11:00.
- **Prihvat:** `formula_pipeline_repro` tvrdnja „storedEnd === forecastEnd" mijenja se u suprotnu.
- **Rollback:** revert; nema migracije.
- **Trud:** S. **Rizik:** nizak.

### F3.4 Proširenje kataloga (A-03, B-112)
- **Fajlovi:** novi `common/anomaly-catalog.ts` (čiste funkcije) + `checker` koji ga poziva; `heating-health.ts` ostaje izvor pragova.
- **Promjena:** dodati `target_not_reached`, `flow_not_followed`, `sensor_frozen`, `sensor_stale`, `weather_missing`, `frost_risk` iz §4.4 audita, svaki sa `minSamples`, cooldownom i porukom.
- **Test-first:** po jedan test scenarij za svaki kod; svaki vraća kod + mjerene brojeve, nikad uzrok.
- **Prihvat:** nijedna poruka ne sadrži interni enum; cooldown spriječi ponavljanje istog koda unutar X h.
- **Rollback:** katalog je aditivan; pojedini kod se gasi listom.
- **Trud:** L.

---

## 6. Talas F4 — instrukcije

### F4.1 Tip `HeatingInstruction` i jedno mjesto odluke
- **Fajlovi:** novi `backend/src/modules/HeatingRecommendation/heating-instruction.ts` (čista funkcija, bez DI), `recommendation-response.dto.ts`, `dashboard.service.ts`.
- **Promjena:** čista funkcija `buildInstruction(input): HeatingInstruction` iz §5.3 audita; polje `instruction` je **aditivno** uz postojeće.
- **Test-first:** svih 8 acceptance testova iz §5.6 audita; nijedan `targetFlowTemp` izvan 48–55; `weather=null` → `confidence: null`.
- **Prihvat:** DTO ugovor kompatibilan; stari klijenti ignorišu novo polje.
- **Rollback:** polje se prestaje slati; klijenti imaju fallback na staro.
- **Trud:** M. **Zavisnost:** D-1, F1.2, F3.4 (kodovi anomalija).

### F4.2 i18n paritet i mrtvi ključevi (B-115)
- **Fajlovi:** `mobile/src/locales/config.ts:1422-1437`, `frontend/src/locales/config.ts`, `heating-health.ts`.
- **Promjena:** backend vraća `code` + parametre, **ne** gotov bosanski tekst; klijent prevodi. 12 mrtvih `alerts.*` ključeva se povezuje kroz `code` ili uklanja.
- **Test-first:** engleski UI ne prikazuje nijedan bosanski tekst iz `message`; test gleda konačni render, ne ključ.
- **Prihvat:** paritet bs/en za sve kodove; nijedan ključ bez potrošača.
- **Rollback:** stari `message` ostaje kao fallback dok svi klijenti ne pređu.
- **Trud:** M.

### F4.3 Push poruke
- **Fajlovi:** `daily.recommendation.service.ts:116-126`, `heating.anomayl.checker.service.ts:201-217`.
- **Promjena:** dnevna preporuka nosi vrijednost **samo ako je unesiva** i uvijek nosi rok podataka; anomalija nosi mjerene brojeve i jednu konkretnu provjeru.
- **Test-first:** preporuka 46 → push ne sadrži „postavite na 46"; anomalija → tekst ne sadrži `weekday_`.
- **Prihvat:** poruke iz §5.4 audita.
- **Rollback:** revert teksta.
- **Trud:** S.

---

## 7. Talas F5 — backtest i canary

### F5.1 Backtest harness
- **Cilj:** novi motor i nova instrukcija nad odobrenim, deidentifikovanim snapshotom (`HeatingEvent` + `BoilerHistory` + prognoza dostupna **prije** događaja), vremenski split po domaćinstvu i sezoni.
- **Mjere:** vrijeme do cilja (p50/p90), overshoot, K·h izvan komfora, ciklusi/dan, udio dostignutih ciljeva, gas/m³ po stepen-danu.
- **Zabrana:** „poklapanje sa starom preporukom" nije mjera uspjeha.
- **Trud:** L. **Zavisnost:** odobrenje podataka, privatnost.

### F5.2 Shadow i canary
- Novi put se računa paralelno, loguje agregat bez identifikatora, korisnik vidi staro.
- Pragovi prihvata definisati **prije** uključivanja; canary po grupi korisnika; rollback je gašenje flaga, ne brisanje podataka.
- **Trud:** M. **Zavisnost:** F5.1, F2.4.

### F5.3 Oblik krivulje (odvojeno, tek nakon F5.1)
- Linearna `51 − 0,3·ext` sa prekidima na 10 °C i −15 °C zamijeniti ekvitermnom krivuljom po tipu ogrjevnih tijela i projektnoj vanjskoj temperaturi lokacije.
- **Uslov:** stručna validacija + backtest + odluka o tome da li 46 °C smije biti preporuka. **Ne prije toga.**

---

## 8. Definition of done (po talasu)

| Talas | Dokaz da je gotovo |
|---|---|
| F0 | `--check-golden` zelen u CI; `formula_pipeline_repro` zelen lokalno |
| F1 | frost test + actionable test + „nema 0 min" test + `personalized:false`; nijedan golden slučaj se nije promijenio |
| F2 | golden diff **samo** u očekivanim slučajevima uz tabelu prije/poslije; `samples` raste bez gubitka; confidence nije konstanta |
| F3 | 70-min false negative i σ=0 false positive su regresioni testovi; potvrda ne mijenja stvarni kraj |
| F4 | 8 acceptance testova, bs/en paritet, nijedan interni enum u tekstu |
| F5 | pragovi prihvata zapisani prije uključivanja; rollback vježban |

**Zajedničko:** nijedan korak ne uključuje automatsku komandu kotlu; nijedan korak ne gasi sigurnosnu zaštitu običnim korisničkim flagom; svaki korak ima revert put.

---

## 9. Šta svjesno **nije** u planu

- Prelazak na automatsko upravljanje kotlom — nema adaptera za pisanje (`thermostat-adapter.interface.ts:18-24`) i nema odobrenja.
- Popravka samo **znaka** korekcije bez F2.2 — obrnula bi pristrasnost, ne uklonila.
- Uvođenje `@@unique` indeksa prije mjerenja duplikata u produkciji.
- Popunjavanje starih `HeatingEvent` redova završnom temperaturom „unazad" — to bi izmislilo podatke.
- Bilo kakva tvrdnja o uštedi bez mjerenja gasa po stepen-danu.
- Redis/worker (vidi `07-redis-workers.md`) — nije preduslov za ovaj lanac.
