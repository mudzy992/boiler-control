# API katalog — statički inventar, radna verzija

## Pet početnih nalaza

1. **VERIFIKOVANO:** u 15 kontrolerskih fajlova nađeno je 69 HTTP dekoratora; tri u `home.profile.single.controller.ts` pripadaju zasebnoj kopiji koju `HomeProfileModule` ne registruje (`backend/src/modules/HomeProfile/home.profile.module.ts:2-11`). Broj 66 je statički zbroj ostalih deklaracija, ne rezultat runtime route mapiranja.
2. **VERIFIKOVANO:** `POST /api/notifications/:id/read` ne predaje korisnički ID servisu; pogledati B-006 u `04-findings.md`.
3. **VERIFIKOVANO:** ruta za testno pokretanje svih gas podsjetnika ima JWT guard, ali nema administratorski guard na kontroleru ili metodi; pogledati B-007.
4. **VERIFIKOVANO:** `POST /api/heating-events`, `GET /api/weather` i `GET /api/recommendations/today` su stubovi; pogledati B-001–B-003.
5. **VERIFIKOVANO:** globalni `ValidationPipe` konfiguriše whitelist, zabranu dodatnih polja i transformaciju (`backend/src/main.ts:28-38`); to samo po sebi ne dokazuje validaciju svake inline strukture, DTO polja, ID-a ili servisnog pravila.

## Otvorena pitanja

- Potrošači web/mobile nisu potvrđeni; ne proglašavati nijednu rutu nekorištenom. Njihovo detaljno mapiranje pripada narednim fazama nakon odobrenja.
- Za sve rute treba dovršiti tabelu DTO-a, konkretnih validacija, servisne provjere vlasništva, statusa, odgovora i kompatibilnosti.
- Eksterna proxy pravila, verzioniranje i stvarna dostupnost metrika/testnih ruta u produkciji nisu provjereni.

## Metod i ograničenja

**VERIFIKOVANO u izvoru:** tabela je statički popis deklariranih dekoratora, ne dinamički snimak stvarnih HTTP ruta. Referenca u zadnjoj koloni direktno označava dekorator. `JwtAuthGuard` oznaka je kontrolerska/metodna deklaracija; ostale zaštite i servisni autoritet još nisu potpuno pregledani. `Health` i `Metrics` nemaju deklarisani JWT guard, ali eventualna infrastrukturalna zaštita nije poznata. U `AppModule` se u ne-testnom režimu dodaje globalni throttler guard (`backend/src/app.module.ts:21-64`); proxy/rate limiting u produkciji nije potvrđen.

Globalni prefix/HTTP verzioniranje nije postavljeno u `backend/src/main.ts:8-57`; Swagger na `/api/docs` nije kontrolerski dekorator i nije u donjoj tabeli. Redovi duplikatnog fajla označeni su kao neregistrovana kopija u poznatom modulu.

| Metoda | Deklarisana putanja | Lokalni guard | Registracija | Dokaz |
|---|---|---|---|---|
| GET | `/health` | Nema deklarisanog JWT | Deklarisan u modulu* | <!-- route:backend/src/common/health.controller.ts:16 --> `backend/src/common/health.controller.ts:16` |
| GET | `/metrics` | Nema deklarisanog JWT | Deklarisan u modulu* | <!-- route:backend/src/common/metrics.controller.ts:23 --> `backend/src/common/metrics.controller.ts:23` |
| GET | `/metrics/json` | Nema deklarisanog JWT | Deklarisan u modulu* | <!-- route:backend/src/common/metrics.controller.ts:35 --> `backend/src/common/metrics.controller.ts:35` |
| GET | `/metrics/reporting` | Nema deklarisanog JWT | Deklarisan u modulu* | <!-- route:backend/src/common/metrics.controller.ts:46 --> `backend/src/common/metrics.controller.ts:46` |
| GET | `/metrics/reporting/json` | Nema deklarisanog JWT | Deklarisan u modulu* | <!-- route:backend/src/common/metrics.controller.ts:58 --> `backend/src/common/metrics.controller.ts:58` |
| POST | `/api/auth/register` | Nema deklarisanog JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Auth/auth.controller.ts:28 --> `backend/src/modules/Auth/auth.controller.ts:28` |
| POST | `/api/auth/login` | Nema deklarisanog JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Auth/auth.controller.ts:33 --> `backend/src/modules/Auth/auth.controller.ts:33` |
| GET | `/api/auth/me` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Auth/auth.controller.ts:41 --> `backend/src/modules/Auth/auth.controller.ts:41` |
| POST | `/api/auth/change-password` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Auth/auth.controller.ts:47 --> `backend/src/modules/Auth/auth.controller.ts:47` |
| GET | `/api/boiler/history` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Boiler/boiler.controller.ts:28 --> `backend/src/modules/Boiler/boiler.controller.ts:28` |
| POST | `/api/boiler/sync` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Boiler/boiler.controller.ts:44 --> `backend/src/modules/Boiler/boiler.controller.ts:44` |
| PATCH | `/api/boiler/current-temp` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Boiler/boiler.controller.ts:73 --> `backend/src/modules/Boiler/boiler.controller.ts:73` |
| GET | `/api/dashboard` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Dashboard/dashboard.controller.ts:24 --> `backend/src/modules/Dashboard/dashboard.controller.ts:24` |
| GET | `/api/dashboard/heating-events` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Dashboard/dashboard.controller.ts:34 --> `backend/src/modules/Dashboard/dashboard.controller.ts:34` |
| GET | `/api/dashboard/heating-status` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Dashboard/dashboard.controller.ts:39 --> `backend/src/modules/Dashboard/dashboard.controller.ts:39` |
| GET | `/api/dashboard/heating-summary` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Dashboard/dashboard.controller.ts:44 --> `backend/src/modules/Dashboard/dashboard.controller.ts:44` |
| GET | `/api/dashboard/heating-stats` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Dashboard/dashboard.controller.ts:49 --> `backend/src/modules/Dashboard/dashboard.controller.ts:49` |
| GET | `/api/dashboard/learning-trends` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Dashboard/dashboard.controller.ts:54 --> `backend/src/modules/Dashboard/dashboard.controller.ts:54` |
| GET | `/api/dashboard/export` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Dashboard/dashboard.controller.ts:59 --> `backend/src/modules/Dashboard/dashboard.controller.ts:59` |
| POST | `/api/gas/reading` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Gas/gas.reading.controller.ts:37 --> `backend/src/modules/Gas/gas.reading.controller.ts:37` |
| GET | `/api/gas/readings` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Gas/gas.reading.controller.ts:51 --> `backend/src/modules/Gas/gas.reading.controller.ts:51` |
| GET | `/api/gas/latest` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Gas/gas.reading.controller.ts:56 --> `backend/src/modules/Gas/gas.reading.controller.ts:56` |
| DELETE | `/api/gas/reading/:id` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Gas/gas.reading.controller.ts:61 --> `backend/src/modules/Gas/gas.reading.controller.ts:61` |
| PATCH | `/api/gas/reading/:id/reference` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Gas/gas.reading.controller.ts:66 --> `backend/src/modules/Gas/gas.reading.controller.ts:66` |
| POST | `/api/gas/reading/:id/meter-image` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Gas/gas.reading.controller.ts:75 --> `backend/src/modules/Gas/gas.reading.controller.ts:75` |
| POST | `/api/gas/reading/:id/invoice` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Gas/gas.reading.controller.ts:89 --> `backend/src/modules/Gas/gas.reading.controller.ts:89` |
| DELETE | `/api/gas/reading/:id/invoice` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Gas/gas.reading.controller.ts:104 --> `backend/src/modules/Gas/gas.reading.controller.ts:104` |
| GET | `/api/gas/reading/:id/meter-image` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Gas/gas.reading.controller.ts:109 --> `backend/src/modules/Gas/gas.reading.controller.ts:109` |
| GET | `/api/gas/reading/:id/invoice` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Gas/gas.reading.controller.ts:124 --> `backend/src/modules/Gas/gas.reading.controller.ts:124` |
| GET | `/api/gas/analysis` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Gas/gas.reading.controller.ts:139 --> `backend/src/modules/Gas/gas.reading.controller.ts:139` |
| POST | `/api/heating-events` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Heating/heating.controller.ts:20 --> `backend/src/modules/Heating/heating.controller.ts:20` |
| GET | `/api/heating-events` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Heating/heating.controller.ts:47 --> `backend/src/modules/Heating/heating.controller.ts:47` |
| GET | `/api/anomalies` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/HeatingAnomalyCheckerService/heating.anomaly.checker.controller.ts:24 --> `backend/src/modules/HeatingAnomalyCheckerService/heating.anomaly.checker.controller.ts:24` |
| PATCH | `/api/anomalies/:eventId` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/HeatingAnomalyCheckerService/heating.anomaly.checker.controller.ts:30 --> `backend/src/modules/HeatingAnomalyCheckerService/heating.anomaly.checker.controller.ts:30` |
| GET | `/api/recommendations` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/HeatingRecommendation/recommendations.controller.ts:20 --> `backend/src/modules/HeatingRecommendation/recommendations.controller.ts:20` |
| GET | `/api/recommendations/today` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/HeatingRecommendation/recommendations.controller.ts:28 --> `backend/src/modules/HeatingRecommendation/recommendations.controller.ts:28` |
| GET | `/api/home-profiles` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/HomeProfile/home.profile.controller.ts:22 --> `backend/src/modules/HomeProfile/home.profile.controller.ts:22` |
| GET | `/api/home-profiles/active` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/HomeProfile/home.profile.controller.ts:27 --> `backend/src/modules/HomeProfile/home.profile.controller.ts:27` |
| GET | `/api/home-profiles/:id` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/HomeProfile/home.profile.controller.ts:32 --> `backend/src/modules/HomeProfile/home.profile.controller.ts:32` |
| POST | `/api/home-profiles` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/HomeProfile/home.profile.controller.ts:37 --> `backend/src/modules/HomeProfile/home.profile.controller.ts:37` |
| PATCH | `/api/home-profiles/:id` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/HomeProfile/home.profile.controller.ts:42 --> `backend/src/modules/HomeProfile/home.profile.controller.ts:42` |
| DELETE | `/api/home-profiles/:id` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/HomeProfile/home.profile.controller.ts:51 --> `backend/src/modules/HomeProfile/home.profile.controller.ts:51` |
| PATCH | `/api/home-profiles/:id/activate` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/HomeProfile/home.profile.controller.ts:56 --> `backend/src/modules/HomeProfile/home.profile.controller.ts:56` |
| GET | `/api/home-profile` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/HomeProfile/home.profile.controller.ts:80 --> `backend/src/modules/HomeProfile/home.profile.controller.ts:80` |
| POST | `/api/home-profile` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/HomeProfile/home.profile.controller.ts:86 --> `backend/src/modules/HomeProfile/home.profile.controller.ts:86` |
| PATCH | `/api/home-profile/:id` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/HomeProfile/home.profile.controller.ts:93 --> `backend/src/modules/HomeProfile/home.profile.controller.ts:93` |
| GET | `/api/home-profile` | JWT | Neregistrovana kopija* | <!-- route:backend/src/modules/HomeProfile/home.profile.single.controller.ts:32 --> `backend/src/modules/HomeProfile/home.profile.single.controller.ts:32` |
| POST | `/api/home-profile` | JWT | Neregistrovana kopija* | <!-- route:backend/src/modules/HomeProfile/home.profile.single.controller.ts:38 --> `backend/src/modules/HomeProfile/home.profile.single.controller.ts:38` |
| PATCH | `/api/home-profile/:id` | JWT | Neregistrovana kopija* | <!-- route:backend/src/modules/HomeProfile/home.profile.single.controller.ts:45 --> `backend/src/modules/HomeProfile/home.profile.single.controller.ts:45` |
| POST | `/api/notifications/register-token` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Notification/notifications.controller.ts:36 --> `backend/src/modules/Notification/notifications.controller.ts:36` |
| POST | `/api/notifications/manual` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Notification/notifications.controller.ts:45 --> `backend/src/modules/Notification/notifications.controller.ts:45` |
| GET | `/api/notifications` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Notification/notifications.controller.ts:61 --> `backend/src/modules/Notification/notifications.controller.ts:61` |
| POST | `/api/notifications/:id/read` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Notification/notifications.controller.ts:67 --> `backend/src/modules/Notification/notifications.controller.ts:67` |
| POST | `/api/notifications/mark-all-read` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Notification/notifications.controller.ts:73 --> `backend/src/modules/Notification/notifications.controller.ts:73` |
| GET | `/api/notifications/types` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Notification/notifications.controller.ts:78 --> `backend/src/modules/Notification/notifications.controller.ts:78` |
| GET | `/api/notifications/preferences` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Notification/notifications.controller.ts:91 --> `backend/src/modules/Notification/notifications.controller.ts:91` |
| PATCH | `/api/notifications/preferences` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Notification/notifications.controller.ts:127 --> `backend/src/modules/Notification/notifications.controller.ts:127` |
| POST | `/api/notifications/test-gas-reminder` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Notification/notifications.controller.ts:154 --> `backend/src/modules/Notification/notifications.controller.ts:154` |
| POST | `/api/notifications/test-trigger-all-gas-reminders` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Notification/notifications.controller.ts:165 --> `backend/src/modules/Notification/notifications.controller.ts:165` |
| GET | `/api/devices` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/ThermostatDevice/thermostat.device.controller.ts:25 --> `backend/src/modules/ThermostatDevice/thermostat.device.controller.ts:25` |
| GET | `/api/devices/:id` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/ThermostatDevice/thermostat.device.controller.ts:30 --> `backend/src/modules/ThermostatDevice/thermostat.device.controller.ts:30` |
| GET | `/api/devices/:id/programs` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/ThermostatDevice/thermostat.device.controller.ts:35 --> `backend/src/modules/ThermostatDevice/thermostat.device.controller.ts:35` |
| POST | `/api/devices` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/ThermostatDevice/thermostat.device.controller.ts:40 --> `backend/src/modules/ThermostatDevice/thermostat.device.controller.ts:40` |
| PATCH | `/api/devices/:id` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/ThermostatDevice/thermostat.device.controller.ts:45 --> `backend/src/modules/ThermostatDevice/thermostat.device.controller.ts:45` |
| DELETE | `/api/devices/:id` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/ThermostatDevice/thermostat.device.controller.ts:54 --> `backend/src/modules/ThermostatDevice/thermostat.device.controller.ts:54` |
| GET | `/api/user` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/User/user.controller.ts:14 --> `backend/src/modules/User/user.controller.ts:14` |
| PUT | `/api/user` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/User/user.controller.ts:19 --> `backend/src/modules/User/user.controller.ts:19` |
| GET | `/api/weather` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Weather/weather.controller.ts:26 --> `backend/src/modules/Weather/weather.controller.ts:26` |
| GET | `/api/weather/current/:homeProfileId` | JWT | Deklarisan u modulu* | <!-- route:backend/src/modules/Weather/weather.controller.ts:36 --> `backend/src/modules/Weather/weather.controller.ts:36` |

* Registracija prema lokalnim `*.module.ts` i `backend/src/app.module.ts` / `backend/src/common/common.module.ts`, ne potvrda iz live procesa. Kod duplikata lokalni modul uvozi istoimenu klasu iz druge datoteke.

## Dalje potrebno

Dopuniti svaku rutu poljima DTO i efektivna validacija, role/plan, tačna provjera vlasništva i greške; dodati regresijske contract/IDOR testove i utvrditi potrošače kad faze budu odobrene. Sama pokrivenost markerima nije završetak API kataloga.
