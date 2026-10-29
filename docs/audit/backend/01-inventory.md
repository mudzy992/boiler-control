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

Ovaj inventar nije završen. Marker za fajl ili modul dokazuje samo da red postoji, ne da je analiziran svaki javni metod, zavisnost, model, eksterni poziv ili test. API katalog i model podataka još nisu izrađeni; `backend_inventory.py` zato mora prijavljivati nedostajuće markere za te dokumente.
