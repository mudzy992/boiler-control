# Backend inventar — radna verzija

## Sažetak: pet početnih nalaza

1. **VERIFIKOVANO:** statički popis sadrži 16 direktorija modula i 14 ne-testnih TypeScript fajlova u `common`, uključujući četiri fajla adaptera (`python3 scripts/audit/backend_inventory.py --json`). Direktorij nije nužno Nest modul; registracija se mora zasebno provjeriti.
2. **VERIFIKOVANO:** deklarisano je pet cron dekoratora: polling, dvije provjere anomalija, dnevna preporuka i gas reminder (`backend/src/modules/ThermostatPoll/thermostat.polling.service.ts:35`, `backend/src/modules/HeatingAnomalyCheckerService/heating.anomayl.checker.service.ts:49,69`, `backend/src/modules/Schedule/daily.recommendation.service.ts:21`, `backend/src/modules/Schedule/gas.reminder.service.ts:21`). Njihovo izvršavanje zavisi od registracije i okruženja.
3. **VERIFIKOVANO:** `POST /api/heating-events` vraća generisani objekat bez upisa u bazu (`backend/src/modules/Heating/heating.controller.ts:20-44`); odgovor se ne smije tumačiti kao sačuvan događaj.
4. **VERIFIKOVANO:** `GET /api/weather` i `GET /api/recommendations/today` trenutno vraćaju prazne vrijednosti (`backend/src/modules/Weather/weather.controller.ts:26-30`, `backend/src/modules/HeatingRecommendation/recommendations.controller.ts:28-33`). Druga weather ruta postoji i zahtijeva zasebnu analizu.
5. **VERIFIKOVANO:** dvije različite datoteke definišu `HomeProfileSingleController`; `HomeProfileModule` registruje klasu iz `home.profile.controller.ts`, ne istoimenu klasu iz `home.profile.single.controller.ts` (`backend/src/modules/HomeProfile/home.profile.module.ts:2-11`, `backend/src/modules/HomeProfile/home.profile.controller.ts:63-64`, `backend/src/modules/HomeProfile/home.profile.single.controller.ts:17-18`). Nije utvrđeno da li drugi fajl ima neku drugu upotrebu.

## Otvorena pitanja

- Koji ugovori i stare mobile verzije stvarno koriste stub rute i jedninski profil?
- Koje su instance, intervali i broj uređaja u produkciji? Statički pregled ne dokazuje raspored ni opterećenje.
- Za svaki modul treba dopuniti zavisnosti, potpune DB pristupe uključujući transakcijske klijente, eksternu komunikaciju, stvarne potrošače i mapu testova. Ovaj dokument je radna verzija, ne potvrđuje punu pokrivenost audita.

## Metod i ograničenja

Skripta `scripts/audit/backend_inventory.py --json` nabraja Gitom praćene TypeScript fajlove, deklaracije ruta, poslove, modele i testove. `python3 scripts/audit/backend_inventory.py` upoređuje audit markere s popisom; izostanak markera prijavljuje kao grešku. Broj 69 predstavlja **dekoratore** u kontroler datotekama, uključujući tri u neregistrovanoj duplikatnoj datoteci, ne broj aktivnih ruta. Regex ne dokazuje stvarnu registraciju, guardove, potrošače, transakcije niti ponašanje. Analize ispod su početne i zahtijevaju dopunu. Testovi: GitHub run 40865068767 prošao je 167 testova, uključujući integracijske; zaseban integracijski korak prošao je 49, koji se preklapaju. Zeleni status ne dokazuje da je svaki modul ili grana pokrivena.

## Direktoriji modula — početna mapa

Svi redovi su **VERIFIKOVANO kao postojanje izvora i navedene ulazne tačke**, a ne potvrda potpune funkcionalnosti ili vlasništva. Dodatna granularna mapa testova i zavisnosti tek slijedi.

| Modul | Namjena / ulaz i dokaz | Poznate DB ili vanjske tačke — potrebna dopuna |
|---|---|---|
| <!-- module:Auth --> Auth | Prijava/registracija i guardovi: `backend/src/modules/Auth/auth.controller.ts`, `auth.service.ts`, `jwt-auth.guard.ts` | `user`; tokeni/guardovi, revokacija i testovi zahtijevaju detaljan pregled. |
| <!-- module:Boiler --> Boiler | Historija, sinhronizacija i ručna temperatura: `backend/src/modules/Boiler/boiler.controller.ts`, `boiler.service.ts` | `boilerHistory`, `user`, `heatingEvent`, `heatingIntervalLearning`, `homeProfile`; Tuya adapter i program sync. |
| <!-- module:Dashboard --> Dashboard | Agregirani prikaz: `backend/src/modules/Dashboard/dashboard.controller.ts`, `dashboard.service.ts` | Više upita nad `heatingEvent`, `boilerHistory`, `homeProfile`, uređajima, preporukama i weather cacheom. |
| <!-- module:ExpoPush --> ExpoPush | Slanje push poruka: `backend/src/modules/ExpoPush/expo.push.notification.service.ts` | Eksterni Expo servis; ponašanje grešaka i receipt-a provjeriti. |
| <!-- module:Gas --> Gas | Očitanja, analize i fajlovi: `backend/src/modules/Gas/gas.reading.controller.ts`, `gas.reading.service.ts` | `gasReading`, `gasPriceHistory`, `user`, `boilerHistory`; `FileStorageService`. |
| <!-- module:Heating --> Heating | Događaji i strategije temperature: `backend/src/modules/Heating/heating.controller.ts`, `engine/flow-temperature.engine.ts`, `strategies/` | `HeatingService` koristi `heatingEvent`; POST je stub, kao što je navedeno iznad. |
| <!-- module:HeatingAnomalyCheckerService --> HeatingAnomalyCheckerService | Provjera anomalija i API: `backend/src/modules/HeatingAnomalyCheckerService/heating.anomayl.checker.service.ts`, `heating.anomaly.checker.controller.ts` | Dva petominutna cron-a; `heatingEvent`, `boilerHistory`, notifikacije i rekomendacije. |
| <!-- module:HeatingRecommendation --> HeatingRecommendation | Obrada i čitanje preporuka: `backend/src/modules/HeatingRecommendation/heating.recommendation.service.ts`, `recommendations.controller.ts` | `heatingIntervalLearning`, `recommendation`, `thermostatDevice`, `weatherCache`; današnja ruta je stub. |
| <!-- module:HomeProfile --> HomeProfile | Profili doma i aktivni profil: `backend/src/modules/HomeProfile/home.profile.module.ts`, `home.profile.service.ts` | `homeProfile`, `user`; dva izvora istoimenog kontrolera, registracija opisana iznad. |
| <!-- module:Notification --> Notification | Preferencije i notifikacije: `backend/src/modules/Notification/notifications.controller.ts`, `notifications.service.ts` | `notification`, `notificationPreference`, `userDevice`; Expo push. |
| <!-- module:Schedule --> Schedule | Sastavljanje raspoređenih servisa: `backend/src/modules/Schedule/schedule.module.ts`, `daily.recommendation.service.ts`, `gas.reminder.service.ts` | Dnevna preporuka i podsjetnik; deklaracije cron-ova i `NODE_ENV=test` granice treba provjeriti sa stvarnim schedulerom. |
| <!-- module:ThermostatDevice --> ThermostatDevice | API uređaja i programa: `backend/src/modules/ThermostatDevice/thermostat.device.controller.ts`, `thermostat.device.service.ts` | `thermostatDevice`, `thermostatProgram`, `homeProfile`; vlasništvo pojedinačno pregledati. |
| <!-- module:ThermostatPoll --> ThermostatPoll | Periodični polling i lifecycle: `backend/src/modules/ThermostatPoll/thermostat.polling.service.ts` | `thermostatDevice`, `heatingEvent`, `boilerHistory`, `user`, `weatherCache`; vanjski adapter i cron. |
| <!-- module:Tuya --> Tuya | Autorizacija i HTTP adapter: `backend/src/modules/Tuya/tuya.auth.service.ts`, `tuya-http.adapter.ts` | `tuyaToken`, vanjski API; cache tokena, timeout i tok vjerodajnica zahtijevaju pregled bez ispisa vrijednosti. |
| <!-- module:User --> User | Korisnički profil: `backend/src/modules/User/user.controller.ts`, `user.service.ts` | `user`, čitanje povezanih podataka; upload slike i sigurnost provjeriti. |
| <!-- module:Weather --> Weather | Vanjska prognoza i cache: `backend/src/modules/Weather/weather.service.ts:68-93`, `weather.controller.ts` | Open-Meteo geokodiranje i forecast, `weatherCache`; vremenske zone i fallback analizirati u `05-weather.md`. |

## Common fajlovi — početni popis

Svaki red: **VERIFIKOVANO** ime i izvoz/ulazna tačka iz navedenog fajla. Zavisnosti i pokrivenost pojedinačnih grana tek treba dokazati.

| Fajl | Uloga |
|---|---|
| <!-- common:backend/src/common/adapters/base-adapter.ts --> `backend/src/common/adapters/base-adapter.ts` | `BaseAdapter`, osnovne greške i izvršavanje poziva. |
| <!-- common:backend/src/common/adapters/circuit-breaker.ts --> `backend/src/common/adapters/circuit-breaker.ts` | Stanja, brojanje i oporavak circuit breakera. |
| <!-- common:backend/src/common/adapters/http-adapter.ts --> `backend/src/common/adapters/http-adapter.ts` | HTTP adapter nad osnovnim adapterom. |
| <!-- common:backend/src/common/adapters/index.ts --> `backend/src/common/adapters/index.ts` | Re-export adaptera i tipova. |
| <!-- common:backend/src/common/anomaly-detection.service.ts --> `backend/src/common/anomaly-detection.service.ts` | Detekcija i izračun pouzdanosti anomalija. |
| <!-- common:backend/src/common/app-config.controller.ts --> `backend/src/common/app-config.controller.ts` | Javni version-gate endpoint `GET /api/app/config` (MO2-2); `@Public()`, bez guard-a. |
| <!-- common:backend/src/common/app-config.service.ts --> `backend/src/common/app-config.service.ts` | Čita `MOBILE_MIN_SUPPORTED_VERSION`/`MOBILE_LATEST_VERSION`/`APP_VERSION_GATE_ENABLED` iz env-a; fail-safe, nikad ne baca. |
| <!-- common:backend/src/common/common.module.ts --> `backend/src/common/common.module.ts` | Registruje/izvozi common servise i kontrolere. |
| <!-- common:backend/src/common/correlation-id.service.ts --> `backend/src/common/correlation-id.service.ts` | Korelacijski kontekst i `AsyncLocalStorage`. |
| <!-- common:backend/src/common/fallback-strategy.service.ts --> `backend/src/common/fallback-strategy.service.ts` | Fallback i memorijski cache; sigurnost vrijednosti nije potvrđena za konkretan kotao. |
| <!-- common:backend/src/common/file-storage.service.ts --> `backend/src/common/file-storage.service.ts` | Smještaj i privatno čitanje fajlova; validaciju i granice treba detaljno pregledati. |
| <!-- common:backend/src/common/health.controller.ts --> `backend/src/common/health.controller.ts` | Health kontroler. |
| <!-- common:backend/src/common/metrics.controller.ts --> `backend/src/common/metrics.controller.ts` | HTTP izvoz metrika i izvještaja. |
| <!-- common:backend/src/common/metrics.service.ts --> `backend/src/common/metrics.service.ts` | Procesni brojači i Prometheus izvoz. |
| <!-- common:backend/src/common/reporting.service.ts --> `backend/src/common/reporting.service.ts` | Izvještaji, health score i alerti. |
| <!-- common:backend/src/common/structured-logger.ts --> `backend/src/common/structured-logger.ts` | Strukturiranje log konteksta. |

## Status pokrivenosti

Ovaj inventar nije završen. Marker za fajl ili modul dokazuje samo da red postoji, ne da je analiziran svaki javni metod, zavisnost, model, eksterni poziv ili test. API katalog i model podataka su u međuvremenu izrađeni; provjera markera prolazi. Međutim, marker ne potvrđuje sadržaj ni runtime registraciju, a inventar ostaje radna verzija dok se ne dopune zavisnosti i opseg testova.

## Pregled testova — direktna veza i poznate praznine

**VERIFIKOVANO:** Git prati deset backend `*.spec.ts` fajlova, u nastavku navedene tačke su na osnovu uvoza i opisa testova, a ne rezultat precizne instrumentirane pokrivenosti svake grane. Opći Jest `backend/jest.config.js` pretražuje `src` i `test`, pa obuhvata i integracijske suiteove; zasebni `backend/jest-integration.config.js` obuhvata samo `test/integration`. Stoga se 167 općih i 49 zasebnih integracijskih testova iz [CI runa 40865068767](https://github.com/mudzy992/boiler-control/actions/runs/40865068767) preklapa, nije 216 nezavisnih testova. Run je za `e0dc116`, ne za ove naknadne lokalne audit commitove. CI anotira broj testova (`scripts/audit/jest_report.cjs:22-25`), a novi reporter objavljuje i zbirne coverage procentе. U [runu 40878022861](https://github.com/mudzy992/boiler-control/actions/runs/40878022861) zbirno: statements 3320/15150 (21,91%), branches 1450/11311 (12,81%), functions 700/3447 (20,30%), lines 1431/2984 (47,95%). To se odnosi na Jest konfigurirani skup fajlova, koji uključuje generisane fajlove i jednu testnu skriptu; razgradnja po grupama prikazana je ispod. Nije semantička pokrivenost ili e2e test. Lokalni raniji parcijalni coverage zbog Prisma greške ne predstavlja pokrivenost cijelog projekta (detalji `docs/audit/STATUS.md`).

| Testni fajl | Šta se može potvrditi iz uvoza i naziva | Šta se ovim ne dokazuje |
|---|---|---|
| `backend/src/common/tests/anomaly-detection.service.spec.ts` | `AnomalyDetectionService`, minimum uzoraka i različite vrste anomalija. | Stvarno trajanje ciklusa u produkciji, distribucija i kvalitet kalibracije; nije ownership test anomalija. |
| `backend/src/common/tests/correlation-id.service.spec.ts` | Sinhroni i asinhroni `CorrelationIdService` konteksti. | Puni request → cron/worker → vanjski provider tracing, log redakcija. |
| `backend/src/common/tests/fallback-strategy.service.spec.ts` | Common fallback/cache scenariji. | Da je fallback vrijednost sigurna za specifični kotao; da je cache međuprocesan. |
| `backend/src/common/tests/reporting.service.spec.ts` | Report, health score i upozorenja. | Da heuristika mjeri sigurnost sistema ili da podaci bez uzoraka znače zdravo stanje. |
| `backend/test/unit/prisma-safe-updates.spec.ts` | Mockirani Prisma update obrasci i slučaj nepostojeće notifikacije. | Cross-user IDOR: testira mock obrazac, ne JWT + stvarnu DB vlasničku izolaciju. |
| `backend/test/unit/transactional-integrity.spec.ts` | Mockirani poll start/end, transakcijski obrasci i minutni ključ. | Race s dvije stvarne transakcije/procesa ili Redis outage/lease; mock nije dokaz DB idempotentnosti. |
| `backend/test/unit/tuya-adapter.spec.ts` | Mockirani adapter/snapshot, cache, breaker i metrike. | Ugovor stvarnog Tuya uređaja/API-ja, provider timeout i rate budžet u produkciji. |
| `backend/test/contract/api-contract.spec.ts` | HTTP contract scenariji za auth, boiler i dashboard kroz `AppModule`. | Kompletni contract svih 66 deklaracija, verzije klijenata ili produkcijska infrastruktura; B-025: 11/14 slučajeva ima sve direktne `expect` unutar `if`, a više testnih putanja ne odgovara deklarisanim rutama. |
| `backend/test/integration/api.integration.spec.ts` | API integracija nad AppModule/Prisma, auth i profilni slučajevi. | Sve kombinacije dva korisnika, fajl storage outage, ili revokacija JWT tokena. |
| `backend/test/integration/heating-polling.integration.spec.ts` | API scenariji grijanja, preporuke, anomalije, uređaja, historije i weather-a. | Neki testovi imaju uslovne asertacije i prihvataju prazne odgovore: B-012. Ne dokazuje rad stvarnog poll cron-a ili stvarnog providera. |

**VERIFIKOVANO:** `cd backend && npm run test:e2e` lokalno izlazi 1 prije suitea jer `backend/test/jest-e2e.json` nedostaje (B-013). `test:smoke` postoji kao skripta (`backend/package.json:23`), ali ovdje nije pokretan; može zahtijevati dostupnu aplikaciju i konfiguraciju. Sadašnje GitHub testno okruženje (`.github/workflows/backend-audit.yml:40`) postavlja `NODE_ENV=test`: `AppModule` ne registruje ThrottlerGuard (`backend/src/app.module.ts:21-33,53-64`), a cronovi su disabled ili polling provider izostavljen (`backend/src/modules/Schedule/schedule.module.ts:15-43`, `ThermostatPoll/thermostat.polling.service.ts:35-38`). Sam zeleni CI ne potvrđuje runtime raspored ili throttling.

Nedostaje semantičko mapiranje funkcija na testove, broj nedeterminističkih neuspjeha na ponovljenim izolovanim runovima, e2e servisni bootstrap i pobrojane direktne veze test → svaki DTO/metoda. Lokalna početna testiranja su nailazila na ograničenje preuzimanja Prisma enginea; raniji popravljeni testovi opisani su u `STATUS.md` i ne treba ih smatrati dokazom sveobuhvatnosti.

## Dopuna: statički graf uvoza i direktnih Prisma pristupa

Sljedeća tabela generisana je `python3 scripts/audit/module_graph.py` iz **Gitom praćenih** `backend/src/modules/**/*.ts`; `common` i `prisma` su interni segmenti, ne tvrdnja da je sve DI-modul. Graf je usmjeren od vlasnika fajla ka direktno importovanom segmentu. Modeli su samo regex prepoznati kao `prisma.<model>.…` ili `tx.<model>.…`; pozivi kroz druge varijable, skriveni dinamički importi, naslijeđeni servisi i runtime DI nisu obuhvaćeni. Komentari/TS-only importi mogu biti uključeni; broj fajlova uključuje DTO/kontrolere i ne znači broj servisa. Tabela nije dokaz stvarnih SQL poziva ni autorizacije.

| Modul | Praćenih TS | Direktni interni importi | Prisma nazivi u direktnom `prisma`/`tx` pristupu | Deklarisani jobovi |
|---|---:|---|---|---|
| `Auth` | 11 | `User`, `prisma` | `user` | — |
| `Boiler` | 9 | `Auth`, `Heating`, `Notification`, `Tuya`, `Weather`, `common`, `prisma` | `boilerHistory`, `heatingEvent`, `heatingIntervalLearning`, `homeProfile`, `thermostatDevice`, `thermostatProgram`, `user` | — |
| `Dashboard` | 4 | `Auth`, `Boiler`, `Notification`, `Tuya`, `Weather`, `common`, `prisma` | `boilerHistory`, `heatingEvent`, `heatingIntervalLearning`, `homeProfile`, `recommendation`, `thermostatDevice`, `weatherCache` | — |
| `ExpoPush` | 2 | `Notification` | — | — |
| `Gas` | 6 | `Auth`, `common`, `prisma` | `boilerHistory`, `gasPriceHistory`, `gasReading`, `user` | — |
| `Heating` | 10 | `Auth`, `prisma` | `heatingEvent` | — |
| `HeatingAnomalyCheckerService` | 4 | `Auth`, `ExpoPush`, `HeatingRecommendation`, `Notification`, `common`, `prisma` | `boilerHistory`, `heatingEvent` | `backend/src/modules/HeatingAnomalyCheckerService/heating.anomayl.checker.service.ts:49`, `backend/src/modules/HeatingAnomalyCheckerService/heating.anomayl.checker.service.ts:69` |
| `HeatingRecommendation` | 3 | `Auth`, `Heating`, `prisma` | `heatingIntervalLearning`, `recommendation`, `thermostatDevice`, `weatherCache` | — |
| `HomeProfile` | 6 | `Auth`, `prisma` | `homeProfile`, `user` | — |
| `Notification` | 6 | `Auth`, `ExpoPush`, `Schedule`, `prisma` | `notification`, `notificationPreference`, `userDevice` | — |
| `Schedule` | 3 | `Boiler`, `Heating`, `HeatingRecommendation`, `Notification`, `ThermostatPoll`, `Tuya`, `common`, `prisma` | `heatingIntervalLearning`, `notification`, `recommendation`, `user`, `weatherCache` | `backend/src/modules/Schedule/daily.recommendation.service.ts:21`, `backend/src/modules/Schedule/gas.reminder.service.ts:21` |
| `ThermostatDevice` | 5 | `Auth`, `prisma` | `homeProfile`, `thermostatDevice`, `thermostatProgram` | — |
| `ThermostatPoll` | 1 | `Boiler`, `HeatingRecommendation`, `Notification`, `common`, `prisma` | `boilerHistory`, `heatingEvent`, `thermostatDevice`, `user`, `weatherCache` | `backend/src/modules/ThermostatPoll/thermostat.polling.service.ts:35` |
| `Tuya` | 3 | `common`, `prisma` | `tuyaToken` | — |
| `User` | 6 | `Auth`, `prisma` | `gasPriceHistory`, `user` | — |
| `Weather` | 4 | `Auth`, `common`, `prisma` | `homeProfile`, `weatherCache` | — |

Samo statički hintovi; tranzitivni DI, aliasi, transakcije drugih naziva, runtime registracija i semantički opseg nisu dokazani.

### Pokrivenost razdvojena od generisanog koda

[Run 40879591615](https://github.com/mudzy992/boiler-control/actions/runs/40879591615), commit `a75d02a`, koristeći isti Jest `collectCoverageFrom`, anotira grupe po putanji bez izlistavanja imena fajlova:

| Grupa | Fajlova | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|---:|
| `backend/src` bez `src/generated` | 97 | 1479/2877 (51,41%) | 603/1720 (35,06%) | 187/455 (41,10%) | 1337/2612 (51,19%) |
| `backend/src/generated` | 16 | 1841/12175 (15,12%) | 847/9535 (8,88%) | 513/2974 (17,25%) | 94/277 (33,94%) |
| `backend/test` | 1 | 0/98 (0%) | 0/56 (0%) | 0/18 (0%) | 0/95 (0%) |
| Ostalo | 0 | 0/0 | 0/0 | 0/0 | 0/0 |

Grupisanje koristi dostupne putanje u Istanbul summaryju (`scripts/audit/coverage_summary.cjs`), nije novi Jest filter i ne mijenja imenilac zbirnog izvještaja. Brojke se zasnivaju na TypeScript/ts-jest instrumentaciji i source-mapovima; različiti nazivnici po metrici su mogući. Instrumentacija ne dokazuje sve rubne slučajeve, HTTP ugovor, stvarni runtime provider, pouzdanost ili odsustvo defekata. `backend_source` uključuje sve obuhvaćene ne-generisane fajlove u `src`, ne samo module; ne tvrditi da je svaka datoteka ili grana pokrivena.

## Matrica modula → provjere → poznate praznine

**VERIFIKOVANO u izvoru testova i audit skriptama:** sljedeća mapa opisuje direktno navedene suite/scenarije ili izolovane reprodukcije, ne stvarni line-by-line coverage. Naziv testa, učitavanje `AppModule` ili mock ne dokazuje da je poslovna grana uspješno izvršena. Posebno B-012 i B-025 pokazuju da neke asertacije mogu biti preskočene. Opći Jest i zasebni integracijski suite se preklapaju; skripte `scripts/audit/` nisu dio broja 167 Jest testova. Testovi/skripte koje navode stvarni servis s fake DB ne zamjenjuju stvarnu bazu, kompletan DI ni produkciju.

Skraćenice: `A` = `backend/test/integration/api.integration.spec.ts`; `H` = `backend/test/integration/heating-polling.integration.spec.ts`; `C` = `backend/test/contract/api-contract.spec.ts`; `T` = `backend/test/unit/transactional-integrity.spec.ts`; `U` = `backend/test/unit/tuya-adapter.spec.ts`. Reference tačnih grupa su u navedenim fajlovima, a rezultati CI-ja i uslovi okruženja gore.

| Modul | Provjere / ulaz → izlaz koji se može pripisati izvoru | Konkretna nepokrivena ili nedovoljno potvrđena grana |
|---|---|---|
| Auth | `A:56-196` registracija/login; `C:37-75`; `auth_session_repro.cjs` sintetički HTTP/JWT i fake DB. | Deaktivacija/poništavanje tokena i sesije nakon promjene lozinke u punom AppModule + stvarni PostgreSQL (S-003/S-004). |
| Boiler | `H:335-413` historija i ručni unos; `C:78-108` ima uslovne asertacije; `formula_table.cjs` motor, ne čitav servis. | Prava provjera da ručni unos ne šalje uređajnu komandu, multi-device veza historije (B-024), DB greške i timeout providera. |
| Dashboard | `A:342-395`, `C:111-121`; `dashboard_repro.cjs` stvarni servis/fake DB za dva uređaja i grupisanje. | HTTP+DB kontrakt dva različita uređaja/vlasnika i DST bucket, pravi provider i cijeli izlaz B-019/B-020. |
| ExpoPush | `reminder_delivery_repro.cjs` koristi fake push, ne stvarni adapter. | Expo SDK ticket/receipt, partial failure i timeout ne potvrđuju se fake pushom; R-002. |
| Gas | `gas_validation_repro.cjs` DTO/servis s lažnom DB; `upload_validation_repro.cjs` privremeni filesystem. | Konkretni HTTP multipart i stvarna PostgreSQL konkurentnost dnevnih unosa, vlasništvo i lifecycle fajlova (B-015–B-018, S-006). |
| Heating | `H:66-170` POST/GET scenariji, uslovni i stub ograničenja B-001/B-012; `formula_table.cjs` pravi engine/sintetički input. | Upis stvarnog eventa kroz POST nije implementiran; golden/property test svih modela i stručna/fizička sigurnost nisu potvrđeni. |
| HeatingAnomalyCheckerService | `H:235-284` GET; `anomaly_ownership_repro.cjs` i `anomaly_validation_repro.cjs` izolovani servis/pipe. | Negativni HTTP owner test nakon popravke DTO-a, konkurentni claim i stvarni raspored obrade (B-009/B-010, R-001). |
| HeatingRecommendation | `H:171-234` GET i today stub; `learning_end_repro.cjs` stvarni servis/engine sa fake DB. | Prvi interval, idempotentan ponovljeni event i konkurentni PostgreSQL update; stvarni završni/vršni senzor (F-003/F-005/F-006). |
| HomeProfile | `H:87-105` i `H:474-493` kreiraju profile direktno kroz Prisma kao testni setup, ne dokazuju HTTP CRUD. | Create/update/activate/delete kroz JWT, dva vlasnika, IANA zone i anomalije postojećeg `activeHomeProfileId`. |
| Notification | `prisma-safe-updates.spec.ts` testira mock obrazac, a ne stvarnu autorizaciju; `http_postgres_repro.cjs` stvarni guard/kontroler/servis i disposable DB; `push_registration_repro.cjs` fake DB/push. | Sve IDOR varijante i puni AppModule, validirani token lifecycle/više uređaja i stvarni Expo receipt (B-006, R-006). |
| Schedule | `cron_registration_repro.cjs` pravi gas servis/scheduler u sintetičkim modulima i ručni tick; `reminder_delivery_repro.cjs` fake DB/push. | Realni timer, puni AppModule, više replika, IANA DST i provider receipti nisu testirani. |
| ThermostatDevice | `H:285-334`; `C:192-208` koristi drugačiju deklarisanu putanju i uslovne asertacije (B-025). | Vlastiti/tuđi/nepostojeći ID, tuđi `homeProfileId`, sve mutacije i dva uređaja uz stvarnu DB. |
| ThermostatPoll | `T` direktno uvozi servis ali opisuje/mockira obrasce; `poll_metrics_repro.cjs`, `poll_overlap_repro.cjs`, `history_close_repro.cjs` izolovani stvarni servis. | Scheduler stvarnim vremenom, dva procesa i PostgreSQL race/rollback, stvarni status providera, promjene historije i idempotentnost side effecta (R-001/R-007/B-024). |
| Tuya | `U` testira `TuyaAdapter` uz mock auth/program; `tuya_missing_fields_repro.cjs` i `program_sync_partial_repro.cjs` sintetički status/fake DB. | Stvarni DP ugovor, dvije konkurentne verzije rasporeda, partial DB failure na PostgreSQL-u i retry s redakcijom tajni (B-026/B-027). |
| User | `A:197-267` GET/PUT; `auth_session_repro.cjs` testira stvarni profilni put i bcrypt s fake DB. | Efektivna revokacija svih sesija, promjena lozinke i username race u stvarnoj DB; politike deaktivacije i recovery. |
| Weather | `H:414-453` ispituje stub, ne punu prognozu (B-012); `weather_repro.cjs` fake SDK, `openmeteo_fixture_replay.cjs` javni hourly fixture sa stvarnim SDK parserom. | Dnevni FlatBuffers sunrise/sunset i DST fixture, HTTP profil/two-location/owner, stvarni provider outage i licencni ugovor (W-001–W-005). |

Kada je test naveden kao `H` ili `C`, to označava postojanje te testne grupe u izvoru, ne da svaka očekivana asertacija radi; redovi inventara nisu brojevi pokrivenih grana. CI run [40888715069](https://github.com/mudzy992/boiler-control/actions/runs/40888715069) za `14e2524` završio je uspješno, ali ne mjeri spomenute nepostojeće provjere.

## Common: javne ulazne tačke, saradnici i testne praznine

**VERIFIKOVANO u izvoru**, ne pretpostaviti da je svaki helper aktivan u produkciji. Common nema deklarisane cronove ili Prisma modele; HTTP adapteri i file storage obavljaju mrežni odnosno lokalni I/O samo kada se pozovu.

| Common fajl | Izloženo / zavisnost | Direktna provjera ili konkretna praznina |
|---|---|---|
| `adapters/base-adapter.ts` | Timeout/retry/breaker wrapper; `CircuitBreaker`, `MetricsService`, logger. | B-004: timeout race ne abortira request; fake delayed HTTP + abort test nedostaje. |
| `adapters/circuit-breaker.ts` | `canAttempt`, `recordFailure`, `recordSuccess`, `reset` i metrike; memorijsko stanje. | Testirati OPEN/HALF_OPEN s konkurentnim pokušajima i fake satom; Tuya adapter ima i zasebni breaker, `U` nije direktan test ove klase. |
| `adapters/http-adapter.ts` | HTTP metode i podešavanje URL/headera preko `BaseAdapter`; axios. | Test timeout/retry/abort, statusi i redakcija bez pravog providera; ne tretirati mock kao mrežni test. |
| `adapters/index.ts` | Re-export adaptera/tipova, nema zasebnog runtime I/O. | Uvozi/kompatibilnost izvoza provjeriti pri promjeni. |
| `anomaly-detection.service.ts` | `detectAnomalies`, `calculateConfidence`, logovanje; `MetricsService`. | `common/tests/anomaly-detection.service.spec.ts` pokriva sintetičke scenarije; distribuciju stvarnih ciklusa i owner zaštitu ne potvrđuje. |
| `app-config.controller.ts` | `GET /api/app/config`, `@Public()`, bez `@UseGuards`. | `common/tests/app-config.service.spec.ts` (supertest) potvrđuje 200 bez Authorization headera, tačan oblik odgovora i 404 na `/app/config`; ponašanje pod stvarnim `JwtAuthGuard`-om nije testirano jer guard ovisi o Prismi. |
| `app-config.service.ts` | `getAppConfig`, env čitanje, stroga semver validacija, kill switch. | `common/tests/app-config.service.spec.ts` — 19 testova (zadano, override, kill switch, fail-safe na neispravan env); negativnim testom (`DEFAULT_MIN_SUPPORTED_VERSION`→9.9.9) potvrđeno da test hvata regresiju. |
| `common.module.ts` | Registracija 3 kontrolera i 7 providera/izvoza (`common.module.ts:14-33`); MO2-2 dodao `AppConfigController`/`AppConfigService`. | Testovi kroz `AppModule` ne dokazuju svaku DI topologiju; test duplih instanci i shutdown po potrebi. |
| `correlation-id.service.ts` | `AsyncLocalStorage`, run ID i asinhroni kontekst. | `common/tests/correlation-id.service.spec.ts` testira sinkroni, async i paralelni kontekst; request-to-worker/provider propagacija nije dokazana. |
| `fallback-strategy.service.ts` | Lokalni fallback/cache i metrike. | `common/tests/fallback-strategy.service.spec.ts`; dodatni fake-clock dokaz preuranjenog TTL brisanja B-022; runtime caller i fizička sigurnost nisu potvrđeni. |
| `file-storage.service.ts` | Lokalni write/read/delete slika/PDF; konfigurirani direktorij i filesystem. | `upload_validation_repro.cjs` provjerava fake MIME i putanju u disposable temp; HTTP upload, symlink konkurencija, virus scan i recovery nisu dokazani. |
| `health.controller.ts` | `GET /health`, statički odgovor, `@Public`. | `A:396-405`; ne testira DB readiness ili provider dostupnost. |
| `metrics.controller.ts` | Javne `/metrics` i `/metrics/reporting` JSON/text varijante, metrics/reporting servisi. | `A:268-341`, `C:212-233` provjeravaju oblike; mrežna izolacija i redakcija labela nisu potvrđene (S-001). |
| `metrics.service.ts` | Procesni brojači i Prometheus izvoz/reset. | Direktno se koristi u common i API testovima; B-023 pokazuje da success brojač ne dokazuje uspjeh svakog uređaja. |
| `reporting.service.ts` | Procesni izvještaj/alerti/score; `MetricsService`. | `common/tests/reporting.service.spec.ts` testira izvještaje i alerte; F-004 i nedostatak distribuisane agregacije ostaju. |
| `structured-logger.ts` | Nest logger formatira kontekst i opcionalni correlation service. | Testirati redakciju providera/greške i injection/newline; postojanje strukturiranog konteksta ne dokazuje da tajne nisu logovane. |
