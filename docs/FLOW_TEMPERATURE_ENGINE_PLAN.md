# Plan izmjena: FlowTemperatureEngine, dnevna preporuka i pametan poll

**Status:** DOGOVORENO — čeka implementaciju. Ovaj dokument je specifikacija,
ne implementacija. Ništa opisano ovdje još nije primijenjeno u kodu backend
servisa (izuzev MySQL→PostgreSQL migracije, koja je posebna, nezavisna
izmjena — vidi `docs/MYSQL_TO_POSTGRES_MIGRATION.md`).

**Datum:** 2026-08-26
**Kontekst:** Ovaj plan je proizašao iz detaljnog audita i naknadnog
"deep-dive"-a nad `FlowTemperatureEngine` / `HeatingRecommendationService` /
`ThermostatPollingService` / `DailyRecommendationService`, uz direktna
pojašnjenja produktne namjere od strane vlasnika proizvoda (vidi sažetak
namjere niže). Cilj ovog dokumenta je da bude **jedan izvor istine** za
narednu fazu implementacije, umjesto da se oslanjamo na chat historiju.

---

## 1. Sažetak namjere proizvoda (potvrđeno u razgovoru)

- Fizički gasni bojler **nije** povezan na internet. Korisnik ručno okreće
  ventil na bojleru. Aplikacija samo **predlaže** vrijednost.
- Polazna temperatura vode se namješta **jednom dnevno** (ne kontinuirano).
- Odluka se donosi **uveče/u ponoć**, za **sutrašnji** dan, na osnovu:
  - prognozirane vanjske temperature za sutra,
  - trenutno namještene temperature na bojleru,
  - prethodnog učenja (interval learning po dijelu dana × tip dana).
- Sistem korisniku treba reći **da li treba povećati/smanjiti** (delta u
  odnosu na trenutno stanje), ne samo apsolutan broj bez konteksta.
- Ako promjena nije potrebna (isto kao juče) → **ne treba potvrda korisnika**.
- Ako promjena jeste potrebna → šalje se push, pa **podsjetnik svakih 1h**,
  najviše **3 podsjetnika**; ako korisnik ne reaguje ni nakon 3., **4. se ne
  šalje** i sistem uzima **zadnju potvrđenu vrijednost** kao referencu.
- Kad korisnik potvrdi (i eventualno unese stanje brojčanika/račun), taj
  podatak kasnije ulazi u **analitiku** — poređenje "sličnih dana" (ista
  sezona, slična vanjska temperatura ±0.5°C, isti tip dana: radni/vikend) da
  se vidi da li je korekcija dovela do napretka ili pogoršanja u potrošnji.
- Kad je termostat u `OFF` modu (app-level polje, ne fizička nedostupnost):
  sistem **ne predlaže** temperaturu kotla i **ne uči** za taj dan, ali i
  dalje redovno prati stanje uređaja. Čim se mod vrati na `PROGRAM`/`MANUAL`,
  odmah (ne čekajući ponoć) se radi novi izračun.
- Poll mora ostati **maksimalno responzivan** (trenutni 60s/120s adaptivni
  interval se **ne mijenja** — dogovoreno da je fiksni spori interval za OFF
  neprihvatljiv zbog scenarija poput nestanka struje), ali se **eliminišu
  stvarno nepotrebni pozivi** (npr. polling uređaja neaktivnih korisnika).

---

## 2. Pregled svih identifikovanih problema (sa prioritetima)

| # | Problem | Lokacija | Prioritet |
|---|---|---|---|
| 1 | Interval learning se nikad ne perzistira za nove intervale (`id: 0` dummy + `updateMany` koji ne pogađa ništa) | `heating.recommendation.service.ts` | **P0** |
| 2 | "Overshoot" signal mjeri stanje na POČETKU grijanja, ne na KRAJU — pogrešan signal koji sistematski vuče preporuku naniže | `thermostat.polling.service.ts` → `handleHeatingEnd`, `heating.recommendation.service.ts` | **P0** |
| 3 | `getWeatherInput()` u dnevnom cronu ne forsira svjež weather fetch — može pokupiti jučerašnji cache | `daily.recommendation.service.ts` | **P0** |
| 4 | Weather modul nema koncept "sutra" — `forecast_days: 1` | `weather.service.ts` | **P0** |
| 5 | `ceilingHeight` — metri u bazi/frontend-u, centimetri pretpostavljeni u engine-u (~4.5°C greška) | `profile.strategy.ts` | **P1** |
| 6 | Diskontinuitet krive na ext=10°C (skok od 3°C) | `base.strategy.ts` | **P1** |
| 7 | Isti (pogrešan) overshoot signal duplo brojan (`offset` + `avgOvershoot*0.5`) | `full.strategy.ts` | **P1** (rješava se automatski popravkom #2, ali provjeriti da se ne dupla i nakon fixa) |
| 8 | Tri nezavisna, nekonzistentna puta izračuna flow temp-a (`BoilerService`, `HeatingRecommendationService`, `DailyRecommendationService`) sa duplikovanim `getIntervalKey()` | sva tri modula | **P1** |
| 9 | `actualFlowTemp` vs `suggestedFlowTemp` se nikad ne koristi kao feedback signal za učenje | `boiler.service.ts`, `heating.recommendation.service.ts` | **P1** |
| 10 | Dnevni cron uzima `homeProfiles[0]` umjesto aktivnog profila (`activeHomeProfileId`) | `daily.recommendation.service.ts` | **P1** |
| 11 | Dnevni cron šalje osiromašen `intervalLearning` (bez `avgOvershoot`/`avgReachTimeMin`) | `daily.recommendation.service.ts` | **P1** |
| 12 | Nema poređenja preporuke sa trenutnim stanjem (nema delte, nema poruke "povećaj/smanji") | `daily.recommendation.service.ts` | **P0** (nova funkcionalnost, srž dogovorenog workflow-a) |
| 13 | Nema mehanizma potvrde/podsjetnika (hourly ×3 → fallback) | novi modul | **P0** (nova funkcionalnost) |
| 14 | `ThermostatDevice.mode` (OFF) se ne koristi nigdje u odlučivanju/učenju | `thermostat.polling.service.ts`, `daily.recommendation.service.ts` | **P1** |
| 15 | Nema hook-a na promjenu mode-a (OFF→PROGRAM/MANUAL) koji bi odmah triggovao izračun | novi | **P1** |
| 16 | `ThermostatProgram` (stvarni intervali sa termostata) se ne koristi u bucketing-u za learning | `heating.recommendation.service.ts` | **P2/P3** — otvoreno pitanje dizajna, ne bug |
| 17 | `pollAll()` ne filtrira po `user.isActive` — nepotreban Tuya API trošak | `thermostat.polling.service.ts` | **P1** |
| 18 | `WeatherCache` nema index na `city` | `schema.prisma` | **P2** |
| 19 | Duplirani/nekorišteni enumi (`InsulationType` vs `HomeProfile_insulationType`, itd.) | `schema.prisma` | **P3** (kozmetičko) |
| 20 | "Slični dani" analitika (poređenje potrošnje po sličnim vanjskim temp.) ne postoji | novi modul | **P2** |

---

## 3. Detaljan plan izmjena po fazama

### FAZA 1 (P0) — Popraviti temelj: da sistem stvarno uči i da dnevni cron koristi ispravne podatke

**3.1. Popraviti perzistenciju interval learninga**
- `getOrCreateIntervalLearning()`: kada red ne postoji, uraditi pravi
  `prisma.heatingIntervalLearning.create(...)` (ne in-memory `id: 0` objekat).
- Nakon toga, `updateMany({ where: { id } })` će raditi ispravno jer `id`
  postoji.
- **Test koji ovo mora pokriti:** simulacija prvog heating eventa za
  potpuno nov `intervalKey` → provjeriti da red **postoji u bazi** nakon
  poziva, ne samo u memoriji.

**3.2. Popraviti overshoot signal da mjeri stvarni ishod grijanja**
- U `ThermostatPollingService.handleHeatingEnd()`, umjesto
  `lastEvent.roomCurrentTemp` (zamrznuto na start), koristiti **live**
  `device.roomCurrentTemp` (najnoviji poll, u trenutku gašenja grijanja).
- Razmotriti dodavanje kolone `roomCurrentTempAtEnd` na `HeatingEvent`
  (eksplicitno čuvati obje vrijednosti — start i end — radi transparentnosti
  i buduće analitike), umjesto da se samo prepiše postojeće polje.
- Nakon ovoga, ponovo provjeriti FullStrategy: `overshoot = end_temp - target`
  je sada ispravan predznak (pozitivno = pregrijano → treba niža temp;
  negativno = nedogrijano → treba viša temp). Provjeriti da li i dalje ima
  smisla dodavati `avgOvershoot * 0.5` odvojeno od `offset`, ili je to sad
  redundantno pojačavanje istog (ispravnog) signala — vjerovatno treba
  smanjiti težinu jednog od ta dva člana da se izbjegne pretjerana reakcija.

**3.3. Weather modul — dodati "sutra" kao eksplicitan koncept**
- Promijeniti Open-Meteo poziv na `forecast_days: 2`.
- `WeatherCache` (ili novi model, vidi ispod) mora razlikovati za koji
  **kalendarski datum** vrijedi zapis, ne samo "zadnji fetch". Predlažem
  dodati kolonu `forDate: DateTime` (datum na koji se prognoza odnosi) uz
  postojeći `fetchedAt` (kada je fetch izvršen). Trenutno postoji samo
  `fetchedAt`, što miješa "kad smo pitali" i "za koji dan važi".
- `getWeatherInput()`/ekvivalent u dnevnom cronu mora eksplicitno tražiti
  `forDate = sutra`, i ako ne postoji ili je zastario, **forsirati svjež
  fetch** prije nastavka — ne osloniti se na "zadnji red u tabeli".

**3.4. Dnevni cron — koristiti aktivan home profile**
- Zamijeniti `user.homeProfiles[0]` sa `user.activeHomeProfileId` lookup-om
  (ili `user.HomeProfile_User_activeHomeProfileIdToHomeProfile` relacijom
  koja već postoji u šemi).

**3.5. Dnevni cron — poređenje sa trenutnim stanjem + delta poruka**
- Nakon izračuna `finalTemp`, uporediti sa `user.currentBoilerFlowTemp`.
- Ako je razlika unutar tolerancije (predlažem ±0.5°C kao prag "nema
  promjene" — za potvrdu sa produktne strane), ne treba akcija korisnika →
  ne šalje se "potvrdi" notifikacija (može se poslati tiha/informativna, po
  želji, ali bez zahtjeva za potvrdom).
- Ako je razlika van tolerancije, formulisati poruku kao **smjer + iznos**
  (npr. "Smanji polaznu temperaturu za 1°C (sa 52°C na 51°C)"), ne apsolutan
  broj bez konteksta.

### FAZA 2 (P0/P1) — Novi modul: potvrda i podsjetnici

**3.6. Proširenje šeme**
Predlažem novi model (radni naziv `RecommendationConfirmation`, ili
proširenje `Recommendation` modela — treba odlučiti pri implementaciji):
- `recommendationId` (FK na `Recommendation`)
- `status`: enum `NO_ACTION_NEEDED | PENDING | CONFIRMED | EXPIRED_USED_LAST_KNOWN`
- `remindersSent`: Int, default 0
- `lastReminderAt`: DateTime?
- `confirmedAt`: DateTime?
- `confirmedFlowTemp`: Float? (šta je korisnik stvarno potvrdio — može se
  razlikovati od predložene vrijednosti)

**3.7. Novi cron (svakih 1h) — provjera nepotvrđenih preporuka**
- Za sve `Recommendation` sa `status = PENDING`:
  - ako je `remindersSent >= 3` → postaviti `status = EXPIRED_USED_LAST_KNOWN`,
    ne slati dalje notifikacije, sistem nastavlja sa zadnjom potvrđenom
    vrijednošću (`user.currentBoilerFlowTemp` ostaje kakav jeste).
  - inače → poslati podsjetnik (`FLOW_TEMP_CHANGED` notifikacija tipa
    "podsjetnik"), inkrementirati `remindersSent`, ažurirati `lastReminderAt`.
- `PATCH /api/boiler/current-temp` (postojeći endpoint) treba, pri potvrdi,
  pronaći odgovarajuću `PENDING` preporuku za taj dan i postaviti je na
  `CONFIRMED` (trenutno ovaj endpoint ne zna ništa o preporukama — treba
  dodati tu vezu).

### FAZA 3 (P1) — OFF mod i responzivnost na promjenu stanja

**3.8. OFF gating**
- U `DailyRecommendationService`: preskočiti generisanje preporuke (i
  ažuriranje interval learninga) za uređaje čiji je `mode === OFF` u
  trenutku izračuna.
- Dodati **hook na promjenu mode-a** (u `ThermostatDeviceService`, metoda
  koja mijenja `mode`): kad se mod promijeni **iz** `OFF` **u**
  `PROGRAM`/`MANUAL`, odmah pozvati isti izračun koji inače radi ponoćni
  cron (izdvojiti tu logiku u zajedničku, pozivnu metodu — ne duplirati kod
  crona).

**3.9. Poll optimizacija — `isActive` filter**
- U `pollAll()`, dodati `where: { user: { isActive: true } }` na upit koji
  dohvata uređaje. Jednostavna, niskorizična izmjena koja direktno štedi
  Tuya API budžet za deaktivirane naloge.
- **Eksplicitno NE mijenjati** adaptivni interval (60s/120s) niti uvoditi
  poseban spori interval za `mode === OFF` — dogovoreno da rizik kašnjenja
  u detekciji (npr. povratak napajanja) nije prihvatljiv trade-off.

### FAZA 4 (P1) — Konsolidacija tri puta izračuna

**3.10. Jedan izvor istine za `FlowTempInput`**
- Izdvojiti zajedničku funkciju/servis (npr. `FlowTempInputBuilderService`)
  koja gradi `FlowTempInput` (weather, homeProfile, intervalLearning,
  recentEvents, mode) na **jedan** konzistentan način.
- `BoilerService.calculateFlowTemp`, `HeatingRecommendationService.processHeatingEvent`
  i `DailyRecommendationService.generateDailyRecommendations` pozivaju taj
  isti builder, umjesto što svaki sastavlja input ručno i djelimično.
- Ukloniti duplirani `getIntervalKey()` — jedna implementacija, dijeljena.

**3.11. `actualFlowTemp` kao feedback signal**
- Kad korisnik potvrdi `actualFlowTemp` koji se razlikuje od
  `suggestedFlowTemp`, taj razmak treba postati dodatni ulaz u naredni
  `intervalLearning` update (npr. kao dodatni mali korekcioni faktor uz
  overshoot). Detaljna formula treba proći kroz isti pregled kakav smo
  upravo napravili za overshoot (P0 stavka #2) — **ne uvoditi novi signal
  bez razumijevanja njegovog predznaka i težine**, isti rizik kao #2.

### FAZA 5 (P2) — Analitika "sličnih dana"

**3.12. Definicija "sličnog dana"** (potvrđeno u razgovoru):
- ista sezona (zima/ljeto/prelazni period — koristiti postojeći
  `HomeProfile.seasonMode` ili izvesti iz mjeseca),
  - ista vanjska temperatura ±0.5°C (prosjek dana ili `temp_avg` iz
    `WeatherCache`),
  - isti `DayType` (radni dan vs. subota vs. nedjelja — već postoji enum).
- Upit: za dati dan X, naći prošle dane sa istim `DayType` i `temp_avg` u
  opsegu ±0.5°C, uporediti `GasReading.consumption` (ili izvedenu dnevnu
  potrošnju) i `actualFlowTemp` korišten tog dana → prikazati korisniku
  "ovog puta smo potrošili manje/više nego u sličnim uslovima ranije".
- Ovo je čisto **read/reporting** funkcionalnost — ne utiče na live
  preporuku, sigurno je raditi je posljednju.

### FAZA 6 (P2/P3) — Manje, niskorizične izmjene

- `ceilingHeight` jedinice — uskladiti (odlučiti: promijeniti engine da
  očekuje metre, ILI migrirati postojeće podatke u cm — preporuka: promijeniti
  engine, jer su metri prirodniji za unos i već tako postoji svuda u
  frontend/mobile).
- Kriva u `base.strategy.ts` — zagladiti prijelaz oko ext=10°C (npr. linearna
  interpolacija umjesto step-a, ili pomjeriti granicu tako da se formula i
  fiksna vrijednost poklope na granici).
- `WeatherCache` — dodati `@@index([city])`.
- `ThermostatProgram` u bucketing-u — **otvoreno pitanje**, treba posebna
  odluka: da li vrijedi kompleksnost prelaska sa 5 generičkih dijelova dana
  na stvarne, promjenjive intervale po uređaju. Predlažem odgoditi dok se
  ne vidi da li generički bucketing daje dovoljno dobre rezultate nakon što
  se P0 popravke primjene.
- Čišćenje dupliranih enuma (`InsulationType`, `WindowType`, `HeatingType`)
  iz `schema.prisma` — kozmetičko, uraditi u istoj migraciji kad god se
  sljedeći put dira šema, da se ne pravi posebna migracija samo za ovo.

---

## 4. Redoslijed implementacije (preporučen)

1. **FAZA 1** (3.1–3.5) — bez ovoga ništa drugo nema smisla, jer je ovo
   temelj tačnosti podataka na kojem sve ostalo gradi.
2. **FAZA 3, stavka 3.9** (`isActive` filter) — trivijalno, nezavisno,
   može ići paralelno s bilo čim.
3. **FAZA 2** (3.6–3.7) — novi modul, zavisi od toga da FAZA 1 već
   proizvodi ispravnu dnevnu preporuku sa delta porukom.
4. **FAZA 3, stavke 3.8/3.15** (OFF gating + hook) — zavisi od 3.5.
5. **FAZA 4** (konsolidacija) — poželjno prije nego se doda još logike na
   tri razdvojena mjesta; može ići i ranije ako se ispostavi da FAZA 1
   izmjene otkriju koliko je konsolidacija hitna.
6. **FAZA 5** (analitika) — poslije svega, čisto dodatna vrijednost.
7. **FAZA 6** — bilo kad, nema zavisnosti, raditi kad je zgodno (npr. uz
   neku drugu migraciju).

## 5. Otvorena pitanja za implementaciju (za potvrdu prije/tokom kodiranja)

- Tačan prag tolerancije za "nema potrebe za promjenom" (predložio sam
  ±0.5°C — treba potvrda).
- Tačna formula/težina za kombinovanje overshoot signala (nakon fixa #2) i
  eventualnog actual-vs-suggested signala (3.11) — treba se raditi pažljivo,
  po mogućnosti uz simulaciju na istorijskim podacima prije puštanja u
  produkciju, jer je ovo srž proizvoda.
- Da li `RecommendationConfirmation` treba biti novi model ili proširenje
  postojećeg `Recommendation` modela (arhitektonska odluka, ne mijenja
  funkcionalnost).

---

## 6. AI/n8n — napomena za budućnost (van trenutnog obima)

Nakon što FAZA 1–4 zatvore zatvoreni closed-loop (učenje stvarno radi,
signal je ispravan, tri puta izračuna su jedan), ima smisla razmotriti:
- eksterni model (ili n8n workflow) koji periodično analizira
  `HeatingIntervalLearning` + `GasReading` istoriju i predlaže podešavanje
  koeficijenata u `base.strategy.ts` (umjesto ručno kalibrisane krive),
- automatski sedmični/mjesečni izvještaj korisniku (n8n + postojeći
  notification sistem).

Ovo se **ne** radi prije FAZE 1–4, jer bi AI sloj učio na istom pogrešnom
signalu koji upravo popravljamo.
