# Weather — analiza i ciljni dizajn

## Sažetak: pet prioritetnih nalaza

1. **VERIFIKOVANO:** izbor lokacije nije jedinstven kroz aplikaciju: profil koristi tekstualni grad, legacy/fallback izračun kotla `User.homeLocation`, a dashboard fiksni Visoko. Prije `747048b` polling i dio preporuka također su čitali najnoviji cache bilo kojeg grada; taj wrong-city cache-scope dio je zatvoren, dok jedinstven identitet lokacije i profile-aware Dashboard ostaju otvoreni (B-008/W-001).
2. **VERIFIKOVANO:** više polja koristi zadnji, ne trenutni sat; `feelslike` zavisi od `getHours()` i ručno dodanog offseta. Offline test stvarne metode nad sintetičkim SDK odgovorom reproducira izbor pogrešnog uzorka (W-002).
3. **VERIFIKOVANO:** zastarjeli cache briše se prije osvježavanja, a neuspjeh dovodi do greške (W-003); u offline reprodukciji brisanje je prethodilo simuliranom padu providera.
4. **VERIFIKOVANO:** samo jedan dan prognoze i fiksna zona Sarajevo, bez izbora rezultata geokodiranja; `GET /api/weather` je stub (`weather.service.ts:68-97`, `weather.controller.ts:23-30`).
5. **VERIFIKOVANO:** weather pozivi prolaze adapterovu timeout/retry/circuit-breaker logiku, ali ne prolaze weather-specifičnu metodu `get`, pa ona ne broji te pozive (`weather.service.ts:69,91`, `weather-http.adapter.ts:36-57`, `base-adapter.ts:78-112`). Timeout ne dokazuje otkazivanje stvarnog zahtjeva.

## Otvorena pitanja

- Produkcijska konfiguracija, stvarna raspodjela gradova, tačan ugovor klijenata, broj zahtjeva i stvarne greške nisu pregledani. Nije bilo poziva produkciji ni live Open-Meteo API-ju.
- Stvarni SDK FlatBuffers zapis `sunrise/sunset`, pogotovo oko DST prijelaza, mora se potvrditi snimljenim odgovorem i dokumentacijom verzije SDK-a: sintetički test dokazuje transformaciju pod eksplicitnom pretpostavkom UTC epohe, ne dokaz realnog API odgovora.
- Je li projekat komercijalan i koji Open-Meteo ugovor/key/atribucija stvarno vrijedi? Provjeriti s vlasnikom i providerom prije rollouta; ne zaključivati iz postojanja planova u kodu.
- Imaju li drugi provideri odgovarajuću licencu, dostupnost lokacija, kvote i dozvolu pohrane/redistribucije? MET Norway je kandidat, ne odobren niti integrisan provider.

## Postojeći tok i granice dokaza

- **VERIFIKOVANO:** `HomeProfile.location` je opcionalni tekst (`backend/prisma/schema.prisma:45-74`); korisnikov `homeLocation` je drugi tekst (`schema.prisma:20`). `GET /api/weather/current/:homeProfileId` traži profil po ID-u i korisniku, pa koristi njegovu lokaciju (`backend/src/modules/Weather/weather.controller.ts:36-50`).
- **VERIFIKOVANO:** `WeatherService.getTodayWeather(city)` traži najnoviji cache po identičnom tekstu `city`, prihvata ga 10 minuta, u suprotnom briše taj najnoviji zapis pa geokodira i upisuje novi (`backend/src/modules/Weather/weather.service.ts:15-57`). Isti tekst se dakle može dijeliti između korisnika; tvrdnja da cache nije dijeljen između korisnika iste tekstualne lokacije bila bi netačna. Nema normalizacije ključa ni koordinatne jedinstvenosti.
- **VERIFIKOVANO:** geokodiranje `count=1` uzima prvi rezultat, prognoza se poziva za dobijene koordinate, sa `Europe/Sarajevo` i `forecast_days: 1` (`weather.service.ts:68-97`). Nema korisničke potvrde geokodiranog rezultata.
- **VERIFIKOVANO:** legacy/fallback `BoilerService` put traži `User.homeLocation` ili anonimni grad, ne `HomeProfile.location`. Od `bb9658f` opt-in `WEATHER_BOILER_V2` uz `WEATHER_LOCATION_V2` čita samo v2 cache istog prvog `HomeProfile` zapisa koji Boiler već koristi za proračun; `null` vraća taj legacy put. Nakon `747048b` Dashboard fallback koristi samo cache njegovog postojećeg fiksnog grada, HeatingRecommendation koristi `HomeProfile.location`, a Poll `externalTemp` i legacy Boiler fallback koriste `User.homeLocation`; dnevni job je i ranije filtrirao po gradu. To zatvara wrong-city cache čitanja u tim putanjama, ali ne uvodi jedinstven identitet aktivnog profila niti profile-aware Dashboard. Višestruki profili i vlasništvo lokacije i dalje treba obuhvatiti dizajnom.
- **VERIFIKOVANO:** Open-Meteo se zove kombinacijom sirovog `fetch` za geokodiranje i `openmeteo` SDK-a za prognozu, oba unutar `executeWithCircuitBreaker` (`weather.service.ts:69-75,91-126`). `BaseAdapter` radi do dva pokušaja za `retryAttempts: 1` i štiti `Promise.race` timeoutom (`weather-http.adapter.ts:19-26`, `base-adapter.ts:103-112,183-203`). Sirovi `fetch` je dakle obuhvaćen vremenskim ograničenjem wrappera, ali bez `AbortSignal` nastavak originalnog zahtjeva nakon isteka nije isključen; HTTP status prije `r.json()` se ne provjerava. SDK-ova vlastita interna ponašanja nisu provjerena.
- **VERIFIKOVANO:** `WEATHER_API_KEY` je dokumentovan, npr. `backend/env.md:34`; pretraga `backend/src` nije našla korištenje tog naziva. To nije dokaz da nijedan deployment ili vanjski alat ne koristi varijablu; vrijednost nije čitana ni prikazana.

## Nalazi

### [W-001] Nejedinstven identitet lokacije i prekratka prognoza — Ozbiljnost: VISOKO — Pouzdanost: VERIFIKOVANO (kod), HIPOTEZA (učestalost uticaja)
- Gdje: `backend/src/modules/Weather/weather.service.ts:68-97`, `backend/src/modules/Boiler/boiler.service.ts:59-70`, `backend/src/modules/Dashboard/dashboard.service.ts:15,568-579`, te B-008 u `04-findings.md`.
- Šta nije u redu i zašto je bitno: `count=1` ne razrješava dvosmislene nazive; različiti potrošači biraju različite gradove, uključujući globalni cache. Jedan dan nije 48–72 sata prognoze. Pogrešna lokacija može proizvesti netačnu preporuku i historiju; fizička primjena nije dokazana.
- Dokaz: navedeni pozivi i `forecast_days: 1`; ne postoje koordinate na profilu u `backend/prisma/schema.prisma:45-75`.
- Preporuka: odabrati i potvrditi rezultat geokodiranja za svaki profil, čuvati koordinatu i IANA zonu; svi potrošači moraju primiti eksplicitan identitet profila. Koristiti satnu 72 h i dnevnu 7 dana gdje provider podržava; jasno razlikovati forecast od mjerenja.
- Kako provjeriti da je riješeno: dva profila s istim nazivom grada i različitim koordinatama, promjena aktivnog profila, nedostajuća lokacija, 0 °C i timezone van Sarajeva; provjeriti izbor svih potrošača i broj uzoraka. `cd backend && npm test -- --runInBand`, zatim `npm run test:integration` s izolovanom bazom.
- Trud: L — Zavisnosti: migracija profila, UX izbora grada, kompatibilnost.

### [W-002] Neskladan sat i oblik vremenskih vrijednosti — Ozbiljnost: VISOKO — Pouzdanost: VERIFIKOVANO (mapiranje i sintetička reprodukcija), HIPOTEZA (realni provider/DST obim)
- Gdje: `backend/src/modules/Weather/weather.service.ts:129-177,182-220`.
- Šta nije u redu i zašto je bitno: `wind_kph`, gust, smjer, pritisak i oblačnost uzimaju `.at(-1)`; `feelslike` bira sat poređenjem `getHours()` na vještački pomjerenim datumima i na trenutnom server datumu. `temp_avg` uzima samo sate 06–15. Sunrise/sunset vrijednosti dodaju `utcOffset` i zatim ih označavaju kao UTC preko `toISOString()`. WMO kod se vraća kao tekst `WMO_<kod>`, polja mjeseca su prazna. Nule zamjenjuju neke nedostajuće vrijednosti, pa se gubitak podataka može zamijeniti stvarnim mjerenjem.
- Dokaz: `node scripts/audit/weather_repro.cjs` pokreće stvarni `WeatherService` offline. Za sintetički niz epoha s offsetom +01:00 i serverom UTC izabrao je `feelslike=112` umjesto uzorka `113` na tekućem UTC instantu, vjetar `223` umjesto `213`, te `07:00Z` umjesto ulaznog sunrise instant-a `06:00Z`. Podaci su sintetički; ovo ne dokazuje semantiku stvarnog SDK sunrise polja. Nije dokazano da API „već vraća lokalno vrijeme“ za ovaj SDK format; to treba provjeriti fixtureom.
- Preporuka: čuvati i porediti UTC instants, izabrati interval po vremenu opažanja; za prikaz formatirati pomoću IANA timezone, bez ručnog predstavljanja pomjerenog vremena kao `Z`. Označiti vrstu agregata, jedinice, nepoznate vrijednosti kao `null`, i WMO mapirati u stabilan kod + i18n ključ.
- Kako provjeriti da je riješeno: snimljeni/anonimizirani SDK fixtures, poznati referentni instanti i round-trip; testirati server UTC/Sarajevo/različita zona, DST proljeće/jesen, prazne nizove, različite dužine i prave nule. `node scripts/audit/weather_repro.cjs` sada je **reprodukcija postojećeg ponašanja**, ne budući regresijski kriterij bez izmjene očekivanja; nakon popravke dodati posebne Jest testove (`cd backend && npm test -- --runInBand`).
- Trud: M/L — Zavisnosti: fixture stvarnog SDK-a, normalizirani DTO, proizvodi/agregati.

### [W-003] Brisanje cachea prije uspješnog osvježavanja — Ozbiljnost: VISOKO — Pouzdanost: VERIFIKOVANO (kod i reprodukcija)
- Gdje: `backend/src/modules/Weather/weather.service.ts:23-57`.
- Šta nije u redu i zašto je bitno: prethodni najnoviji zapis briše se prije dohvata. Ako provider padne, servis baca generičku grešku i taj primjerak više ne može služiti kao posljednja poznata vrijednost. Drugi stariji zapisi mogu postojati, ali se ovdje ne koriste kao fallback.
- Dokaz: offline `node scripts/audit/weather_repro.cjs` na fake bazi pokazuje jedinu operaciju `delete`, izuzetak i bez preostalog sintetičkog zapisa. Bez `HttpException`, Nest podrazumijevano tretira neobrađenu generičku grešku kao 500; stvarni HTTP odziv nije pokrenut u ovoj reprodukciji.
- Preporuka: atomarno upisati novo tek po uspjehu; servirati posljednji valjani zapis s `stale`, dobi, izvorom i ograničenjem maksimalne starosti. Negativno keširati provjerene privremene greške ograničeno, a odsustvo svih podataka iskazati eksplicitnim DTO-om/statusom.
- Kako provjeriti da je riješeno: cold miss, fresh hit, istek + uspjeh/neuspjeh, više istovremenih poziva, provider timeout, max stale age, nepoklapanje lokacije; integracijski test s izolovanom bazom i `cd backend && npm run test:integration`.
- Trud: M — Zavisnosti: Redis/worker dizajn, pogodba DTO-a, politika maksimalne starosti.

### [W-004] Nedostaju reprezentativne weather metrike — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (put poziva)
- Gdje: `backend/src/modules/Weather/weather.service.ts:69,91`, `backend/src/modules/Weather/weather-http.adapter.ts:36-57`, `backend/src/common/adapters/base-adapter.ts:78-121`.
- Šta nije u redu i zašto je bitno: counteri `weather_requests_*` ažuriraju se samo u overrideu `get`, dok servis zove direktno `executeWithCircuitBreaker`; graf na osnovu tih countera zato ne mora odražavati stvarne Open-Meteo pozive. Opći adapter brojači timeouta/breakera postoje. Stanje metrika je procesno; nije izmjerena produkcija.
- Dokaz: nema poziva `weatherAdapter.get` u `weather.service.ts`; brojači su unutar `get` overridea.
- Preporuka: instrumentirati zajedničku izvršnu tačku za geokodiranje i forecast, definisati broj logičkih poziva naspram pokušaja, greške, trajanje, starost podataka, stale/fallback i kvote; ne stavljati preciznu lokaciju/user ID u label.
- Kako provjeriti da je riješeno: fake provider za uspjeh, retry, timeout, circuit-open i stale; provjeriti inkrement jednom po definisanoj semantici i više replika. `cd backend && npm test -- --runInBand`.
- Trud: S/M — Zavisnosti: metrika/observability backend, privatnost i definicija SLO-a.

### [W-005] Nejasna komercijalna i licencna upotreba providera — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (objavljeni uslovi), NEPOZNATO (status projekta)
- Gdje: [Open-Meteo Terms](https://open-meteo.com/en/terms), provjereno 2026-10-29; API poziv `backend/src/modules/Weather/weather.service.ts:91-126`.
- Šta nije u redu i zašto je bitno: objavljeni uslovi besplatnog API-ja ograničavaju ga na nekomercijalnu upotrebu, propisuju CC BY 4.0 i kvote, a pretplata predviđa komercijalnu upotrebu. Nije utvrđeno da li je ovaj projekat komercijalan niti kakav ugovor ima.
- Dokaz: providerova stranica navodi primjere nekomercijalne i komercijalne upotrebe i uslove; uslovi se mogu promijeniti.
- Preporuka: vlasnik provjerava aktuelnu licencu, atribuciju, tržišni model, ugovor i očekivane kvote sa providerom prije lansiranja/promjene providera. Ne uklanjati niti izlagati API ključ na osnovu statičke pretrage.
- Kako provjeriti da je riješeno: dokumentovana odluka vlasnika i provjeren ugovor; test integracije attribution i alarma kvota; ovo nije zamjena za pravni savjet.
- Trud: S/M — Zavisnosti: vlasnik proizvoda i pravna/komercijalna procjena.

## Ciljni ugovor i arhitektura — prijedlog, ne implementacija

1. **Identitet lokacije:** proširiti `HomeProfile` nullable koordinatama WGS84, IANA `timezone`, provider ID-om, prikaznim nazivom i verzijom/potvrdom lokacije. Geokodiranje izlistava više kandidata s regijom/državom; korisnik potvrđuje izbor. Validirati raspon širine/dužine i timezone, provjeriti vlasništvo profila. Ne geokodirati nejasne stare tekstove automatski kao definitivne. Legacy lokacija ostaje dostupna dok korisnik ne potvrdi ili dok vlasnik ne odobri kontrolisani backfill.
2. **Normalizacija i cache:** predloženi ključ uključuje verziju DTO-a, providera, zaokruženu širinu/dužinu na 0,1°, IANA zonu, tip i horizonte; validirati grešku zaokruživanja u planinskom području prije upotrebe (moguća razlika nadmorske visine). Razdvojiti identitet ključa od originalnih koordinata profila. Shared Redis i single-flight (`SET NX PX`, slučajni ownership token i sigurno otpuštanje, TTL i zaštita od stale vlasnika) smanjuju stampede; baza/snapshot je last-known-good. Redis nije trenutno dokazan kao aplikacijski cache.
3. **SWR:** npr. fresh do 10 min, stale 10–60 min, dalje eksplicitno unavailable; vrijednosti su prijedlog i traže odobrenje. Fresh vratiti odmah; stale vratiti s dobi i zakazati jedinstveni refresh; ne blokirati na padu Redisa. Dati policy za negative cache kratkog TTL-a i ne skrivati greške validacije. Poslije max stale dobi ne predstavljati prognozu kao svježu.
4. **Provider/fallback:** provider adapter normalizuje jedinice i instants, podržava abort/timeout/retry s bounded backoffom, limit i breaker; sekundarni provider samo ako su licenca i semantika potvrđene. Pri padu: svjež/stale podatak ispravne lokacije, zatim odobreni drugi provider i last-known-good prema definisanoj starosti; nikada fallback na drugi grad niti sintetičku nulu. Redoslijed se može prilagoditi odlukom o svježini.
5. **DTO:** verzionirani endpoint npr. `GET /api/v1/home-profiles/:id/weather` za JWT vlasnika, uz eksplicitnu odluku da li anonimizovana prognoza po koordinatama treba biti javna, odvojena ruta s rate limitom. Predloženi izlaz: `location {id, latitude, longitude, timezone}`, `source`, `observedAt`, `fetchedAt`, `ageSeconds`, `freshness: fresh|stale|unavailable`, `current {temperatureC, apparentTemperatureC, humidityPercent, windKph, gustKph, pressureHpa, cloudPercent, conditionCode, conditionKey}`, `hourly[]` s UTC `at`, `daily[]` s lokalnim datumom i UTC sunrise/sunset instantima. Nepoznato je `null`, ne nula. `current` iz odgovarajućeg trenutnog bloka ili intervala u UTC; dokumentovati prognozirano naspram opaženog.
6. **WMO/i18n:** tablica svih WMO kodova koje provider navodi, stabilni tehnički kod i generički `weather.unknown` za nepoznat kod; prevodi u klijentima, mapiranje dana/noći eksplicitno. Mjesečeva polja ostaju nullable/unsupported dok ne postoji provjerljiv izvor.
7. **Forecast vs opažanje:** zasebne tabele/objekti prognoze s `issuedAt`, `validAt`, providerom, lokacijom i mjernim jedinicama te stvarnog mjerenja s `observedAt`, izvorom i kvalitetom. Opažanje iz prognoznog `current` ne nazivati stvarnim mjerenjem senzora. Politike retencije, agregacije i deduplikacije po vlasništvu i pravnim zahtjevima; očuvati historijsku porijeklo.
8. **Metrike:** stope uspjeha i grešaka po provideru/tipu, latencija, pokušaji, cache hit/miss, starost na posluženju, stale i fallback, breaker i kvote; alarme bazirati na stopi i minimalnom broju uzoraka. Izbjegavati user ID, grad i koordinate u labelama/logovima.

## Migracija, kompatibilnost i rollout/rollback

- **Expand:** nullable nova polja i nove tabele/indeksi, bez uklanjanja tekstualne lokacije ili postojećih polja. Napraviti backup i test obnove te uporediti produkcijsku shemu/migracije u read-only režimu prije migracije; CI baseline nije dokaz produkcijskog stanja. Svaku migraciju zasebno testirati na kopiji i imati reverzibilan SQL za nove strukture bez brisanja postojeće historije.
- **Backfill:** tekst normalizirati kao kandidat, a ne potvrđenu koordinatu; višeznačne/missing vrijednosti zahtijevaju izbor korisnika. Izmjene profilnih lokacija rade se tek nakon odobrenja i migracijskog plana. Stare mobile verzije nastavljaju koristiti stare rute/oblik podataka; dodatni metapodaci smiju se uvoditi samo gdje su klijenti tolerantni.
- **Shadow:** nova putanja u pozadini prikuplja forecast za eksplicitnu lokaciju i računa razlike bez mijenjanja preporuke ili upravljanja. Feature flagovi odvojeni za ingestion, čitanje API-ja i preporuke; testirati po korisnicima/profilima, prateći age, greške, poklapanje lokacije i razlike temperature bez osjetljivih labela.
- **Canary:** prvo mali broj odobrenih profila, zatim postepeni rollout uz prag grešaka/freshness i plan dežurstva. DTO ugovor i vrijeme podrške za stare klijente odobriti prije prebacivanja. `GET /api/weather` stub ne zamijeniti neočekivano bez provjere klijenata.
- **Rollback:** ugasiti čitanje novog API-ja i korištenje novih podataka za preporuke, zadržati shemu i podatke radi sigurne analize; vratiti prethodni deployment i provjeriti old-route contract i zdravlje providera. Ne koristiti poznati globalni cache kao sigurni fallback; ako nije moguće dobiti podatak odgovarajuće lokacije, prikazati unavailable i zadržati sigurno prethodno ponašanje prema odobrenoj politici, bez komandi kotlu. Tek nakon prestanka svih starih čitanja i isteka rollback prozora zasebno planirati contract migracije.

## Testna matrica i skripte

| Test | Ulaz / očekivanje | Pokretanje / status |
|---|---|---|
| Legacy timeline regression guard | Sintetički SDK i baza, poznati UTC instant, lokalni 06–15 prosjek, sunrise/sunset i bounded stale fallback. | `node scripts/audit/weather_repro.cjs --help` i `node scripts/audit/weather_repro.cjs`; nakon ispravke izlaz 0, uz actual=expected i zadržan stale red. Bez mreže i stvarnog upisa. |
| Stvarni snimljeni provider fixture | Anonimiziran FlatBuffers odgovor za UTC i DST, posebno `valuesInt64` sunrise/sunset, dogovorene jedinice. | **NIJE URAĐENO**: budući `scripts/record-weather-fixtures.ts --help` mora ukloniti tajne i identifikatore, imati offline replay i eksplicitno odobrenje mrežnog snimanja. |
| Jedinice/konverzija | C, hPa, km/h, mm/cm; 0 kao vrijednost, null kao odsustvo; različite dužine satnih nizova, unknown WMO. | Budući Jest spec; `cd backend && npm test -- --runInBand`. |
| Timezone/DST i geokodiranje | UTC, Sarajevo, zona van regije, DST prijelazi, dvosmisleni nazivi i korisnikova potvrda. | Budući deterministic Jest + provider fixtures; ista komanda. |
| SWR i konkurentnost | Cold/fresh/stale/expired; pad provider-a/Redis-a; dva refresh-a i lock expiry/ownership. | Budući testovi s privremenim PostgreSQL/Redis; `cd backend && npm run test:integration`; provjeriti ponašanje stvarne Redis biblioteke, ne samo ping. |
| API/compatibility | Stari i novi klijenti, tuđi profil, invalid ID, nedostajuća lokacija, provider outage, max stale i status. | Budući contract i integration testovi; `cd backend && npm run test:integration`. |
| Shadow i kvalitet | Snimiti forecast s valid time, upariti opažanja, grešku i starost; bez primjene. | Budući backtest harness i nadgledani canary; pragove definisati prije rollouta. |

**Status:** dizajn je prijedlog, ne izvršena implementacija. Potrebni su stvarni provider fixture, verifikacija uslova/produkcije i povezivanje s planovima formula, sigurnosti i workera.

### Naknadni javni upstream fixture: šta potvrđuje, a šta ne

**VERIFIKOVANO (offline, stvarni instalirani SDK):** pronađen je javni Open-Meteo SDK [testni fixture u izvornom repozitoriju](https://github.com/open-meteo/sdk/blob/7a3c6097fe803f55670b1da1411f6095a9ac0ee0/swift/Tests/OpenMeteoSdkTests/ApiTests.swift), na kojem upstream test provjerava dvije lokacije i satnu temperaturu. Bajtovi i MIT licenca uz navođenje porijekla su u `scripts/audit/fixtures/`; SHA-256 i ograničenja u tamošnjem README-u. Upstream ima komentarisani primjer provider URL-a, ali stvarne okolnosti nastanka fixturea nisu potvrđene: ne nazivati ga vlastitim svježim snimkom produkcijskog API-ja.

`node scripts/audit/openmeteo_fixture_replay.cjs` pokreće stvarni instalirani `openmeteo` 1.2.3 `fetchWeatherApi` uz lokalni `fetch` stub: dva size-prefixed odgovora, po 168 satnih vrijednosti, prve približno 10,6455/22,45, prva lokalna satna oznaka s offsetom kako je očekuje upstream test. `daily()` je null. Skripta provjerava integritet SHA-256 i ne zove mrežu. Ovo **ne potvrđuje** `valuesInt64` za sunrise/sunset, runtime DST, mapping svih varijabli ni oblik produkcijskog `forecast_days=1` odgovora. Direktna reprodukcija aplikacijskog mapiranja u `weather_repro.cjs` ostaje sintetička; snimljeni/odobreni dnevni provider fixture i dalje nedostaje. Direktni pristup hostu providera iz ovog sandboxa nije dozvoljen, pa nije pokretan live fetch.

## Implementacija odobrenog weather v2 opsega — 2026-11-02

**Status: implementirano u kodu, uz lokalne dokaze ispod. Ovo nije tvrdnja da su svi stari weather potrošači prebačeni na v2 niti da je produkcijski rollout završen.**

- `HomeProfile` je expand-only proširen nullable potvrdom koordinata, IANA zonom, provider identitetom, prikaznim nazivom i vremenom potvrde. Migracija `20261102100000_weather_v2_expand` dodaje i `WeatherV2Cache`; nema backfilla, `UPDATE` postojećih redova, `DROP` ni brisanja legacy cachea.
- Novi JWT/owner-scoped ugovor je `GET /api/weather/v2/current/:homeProfileId`, `GET /api/weather/v2/locations/:homeProfileId?query=...` i `POST /api/weather/v2/locations/:homeProfileId/confirm`. Geocoder vraća najviše pet kandidata; potvrda ponovo traži svježe rezultate i prihvata samo eksplicitno poslani `candidateId`. Stari tekst grada nikada nije automatski potvrđen. Stvarna izmjena teksta poništava potvrdu, dok nepromijenjena vrijednost u PATCH-u ne poništava.
- `WEATHER_LOCATION_V2=off` i `WEATHER_SWR_ENABLED=off` su zadani. Stale prag je 15 minuta, a current se skriva nakon 60 minuta; oba su podesiva. Provider outage zadržava last-good za istu potvrđenu lokaciju, bez fallbacka na drugi grad. SWR single-flight je **po procesu**, ne distribuiran lock.
- Open-Meteo v2 provider koristi stvarni `AbortSignal`, SDK bez duplih internih retryja, UTC instante, 72 sata i 7 dana, numeričku nulu i `null` za nepoznato. WMO kod postaje stabilan `conditionKey` i i18n ključ. Satni uzorak iza kraja prognoze više se ne vraća na prvi sat.
- `WeatherHttpAdapter` broji jedan logički poziv na zajedničkoj `executeWithCircuitBreaker` tački za legacy i v2, bez user/lokacija labela. Prilikom dodavanja regresije otkriven je i popravljen pre-postojeći `BaseAdapter` bug: metrics getter wrapper je na failure grani rekurzivno pozivao sam sebe; sada čuva originalnu vezanu metodu.
- Mobile `EXPO_PUBLIC_WEATHER_UI_V2=off` zadržava stari `WeatherCard`. V2 kartica ima eksplicitni izbor kandidata, 72 sata/7 dana, bs/en WMO prijevode i uvijek vidljiv apsolutni `fetchedAt` u potvrđenoj IANA zoni. Stale i current-hidden imaju tekstualne oznake; hourly/daily ostaju vidljivi. Legacy `/api/weather`, dashboard fiksni grad, boiler i plan preporuke nisu mijenjani.

**Lokalni dokazi:** backend ciljani Weather/HomeProfile/OpenAPI/stub prolaz je 8 suiteova / 73 testa; CI-ekvivalentni ESLint ima 0 errors i 2 postojeća warnings. Mobile je 23 suiteova / 123 testa / 32 snapshotova, TypeScript prolazi, lint ima 0 errors i 75 postojećih warnings. OpenAPI artefakt je additive i runtime-vs-committed Weather fragment je jednak. Puni lokalni backend Jest ne može učitati 15 suiteova bez generisanog Prisma klijenta, pa su CI type-check, build, migracija i PostgreSQL integracija i dalje obavezni.

**CI povratna sprega i ispravke:** run `41428012580` na `aa921fe` završio je kao failure. Backend Jest je prošao 53 suitea / 593 testa i lint je imao 0 errors, ali Type-check/Build su prijavili pet grešaka: `Response.json()` kao `unknown`, optional SDK options i dva nepotpuna fetch mocka. `5627eb0` uvodi eksplicitno sužavanje geocoder odgovora, optional pristup i stvarne `Response` objekte u testovima. Frontend je na istom runu stao na OpenAPI types sync; regenerisani tipovi dodani su u `5627eb0` i lokalni check prolazi. Mobile TypeScript/lint su u CI prošli, Unit tests korak je pao bez uzroka u annotations; identična CI komanda lokalno prolazi 23 suitea / 123 testa / 32 snapshota, pa uzrok nije utvrđen. Novi CI rezultat za ispravke ostaje obavezan.

**Drugi run `41431564721`:** backend TypeScript, lint i Build sada prolaze, uz 56 suiteova / 608 testova i 5 integration suiteova / 60 testova. OpenAPI sync je zatim pao zbog razlike u rekurzivno sortiranoj serializaciji, ne zbog semantičke promjene; `ab040ab` poravnava deep-sort i dodaje byte-stabilni test. Frontend je pao samo na poznatom FE2-7 compose koraku nakon prolaznih OpenAPI/type/test provjera. Mobile Unit tests su ponovo pali bez detalja, pa `ab040ab` u CI dodaje postojeći sigurni Jest JSON reporter koji čuva originalni exit code i prijavljuje naziv failing testa. Konačan novi run i dalje treba pročitati.

**Raniji stabilni code CI `41432499480` (`309d95e`):** backend i mobile jobovi su success. Backend ima `tsc: 0`, `eslint: 0`, prolazne Build/OpenAPI korake, 56 suiteova / 608 testova i 5 integration suiteova / 60 testova. Mobile ima 23 suitea / 123 testa; dva ranija weather async testa sada prolaze uz real timers u testu i bounded formatter cache za 72h/7d render. Frontend OpenAPI/type/lint/test koraci prolaze, a job je crven samo na poznatom FE2-7 compose koraku. Time je implementirani weather v2 code CI-verificiran, uz ograničenja ispod.

**Finalni code CI `41442409308` (`efd20c9`):** nakon cold-start timeouta u runovima `41438917708` i `41439567029`, `344f6e4` memoizira `ForecastContent`, a `efd20c9` mountuje location modal tek kad je otvoren. Nisu mijenjani timeout, asserti, real timers ni paralelizam. Backend i mobile su success; backend zadržava 56 suiteova / 608 testova i 5 integration suiteova / 60 testova, a mobile sada ima 24 suitea / 136 testova zbog zasebnog PRIV-1B toka. Frontend i dalje pada samo na FE2-7.

### Generisani combined SDK/DST replay — 2026-11-02

**VERIFIKOVANO OFFLINE:** `scripts/audit/openmeteo_combined_fixture.cjs` deterministic gradi dva mala FlatBuffers fixturea s current+hourly+daily blokovima. Bajtovi su u `scripts/audit/fixtures/`, uz SHA-256 i provenance u tamošnjem README-u. To su **sintetički SDK ulazi**, ne snimci živog providera; generator i test ne rade mrežne pozive.

`backend/src/modules/Weather/tests/openmeteo-v2.fixture.spec.ts` čita komitovane bajtove, provjerava hash i byte-identičnost s generatorom, zatim ih kroz stubovani `fetch` prosljeđuje stvarnom `openmeteo` 1.2.3 / `@openmeteo/sdk` 1.28.0 parseru i stvarnom `OpenMeteoV2Provider` mapiranju. Proljetni scenario dokazuje preskok 02:00 → 03:00, a jesenji zadržava oba 01:00 s EDT/EST ofsetom. Oba pokrivaju 72 sata/7 dana, prave nule, `NaN` → `null`, sunrise/sunset kroz `valuesInt64` i `INT64_MAX` kao `null`.

**Dokazi:** novi suite 4/4; zajedno s postojećim provider suiteom 2 suitea / 9 testova; svi Weather suiteovi 5/26. Generator prijavljuje `in_sync`, a tri mutacije sa jedinstvenim sidrima potvrđuju da promjena vremena ruši byte-sync, pomjeren sunrise ruši replay, a pomjeren hourly UTC instant ruši DST asserte. CI-ekvivalentni backend ESLint ima 0 errors i dva postojeća warnings. Prettier check prolazi. CI run `41449372725` na `223193d` je potpuno zelen: backend `tsc: 0`, `eslint: 0`, 57 suiteova / 612 testova i 5 integration suiteova / 60 testova; mobile i frontend su success, bez failure annotations.

**Granica dokaza:** ovo zatvara generisani schema/parser/application replay, ali ne i stvarni provider capture. Ne dokazuje da Open-Meteo u produkciji šalje iste vrijednosti, niti zamjenjuje odobren snimak stvarnog current+hourly+daily odgovora.

### Legacy WeatherService transport i cache — 2026-11-02

**Prijavljeni produkcijski simptom:** za Visoko legacy `WeatherService` prijavljuje `Open-Meteo response missing required blocks`, nakon čega boiler polling pada. Stack potvrđuje da taj poziv ide kroz stari `WeatherService`, ne kroz `OpenMeteoV2Provider`.

**Reproducirana klasa uzroka:** instalirani `openmeteo` 1.2.3 posebno obrađuje 400/429 i retry za 500/502/504, ali ostale neuspješne statuse može proslijediti FlatBuffers parseru. Lokalni stub sa JSON tijelom na 200/401/403/404/503 vratio je objekat bez sva tri forecast bloka, dakle isti generički simptom. Ovo ne utvrđuje koji je stvarni status ili tijelo stiglo u produkciji; live provider odgovor nije snimljen.

**Ispravka:** legacy forecast transport sada provjerava HTTP status i size-prefix okvire prije čitanja kroz stvarni `@openmeteo/sdk` reader. HTTP greška prijavljuje status i ograničeni provider `reason`, a nevažeće tijelo se razlikuje od stvarno nepotpunih blokova. Postojeći `WeatherHttpAdapter` ostaje jedina retry/circuit-breaker kontrola. Ako blokovi i dalje nedostaju, log sada navodi prisutnost current/hourly/daily bloka.

Cache se više ne briše prije fetcha. Neuspješan refresh može vratiti postojeći red samo do ukupne starosti od 60 minuta; stariji red ostaje u bazi, ali ne služi za novi boiler proračun. Bez prihvatljivog cachea greška se i dalje propagira. Uspješan refresh ažurira postojeći red umjesto `delete` pa `create`; nema migracije, novog flaga ni promjene API ugovora.

**Dokazi:** na neizmijenjenom kodu novi suite je dao 2 prolaza / 6 očekivanih padova za HTTP/JSON dijagnostiku i cache ponašanje. Nakon ispravke suite prolazi 8/8, a svi Weather testovi prolaze 6 suiteova / 34 testa. Validni generated fixture prolazi kroz stvarni SDK reader, generator ostaje `in_sync`, Prettier prolazi, a tačna CI ESLint naredba ima 0 errors i dva postojeća warnings. Potpuni lokalni Jest ne može učitati generisani Prisma klijent za 16 suiteova. CI run `41453819055` na `cd0db32` je potpuno zelen: backend `tsc: 0`, `eslint: 0`, Build/OpenAPI success, 58 suiteova / 620 testova i 5 integration suiteova / 60 testova; mobile i frontend su success, bez failure annotations.

**Granica dokaza:** ovo je offline regresija za legacy transport i cache, ne dokaz da je produkcijski Open-Meteo za Visoko ponovo dostupan. V2 provider nije mijenjan, a stvarni provider status/tijelo i dalje treba potvrditi kroz naredne produkcijske logove nakon rollouta.

### V2 transport usklađivanje — 2026-11-02

Nakon legacy ispravke, ista SDK klasa greške potvrđena je i na `OpenMeteoV2Provider`: stubovani 503 JSON na neizmijenjenom kodu završavao je kao `Open-Meteo response is missing forecast blocks`. Nova regresija je zato prvo pala na očekivanom HTTP assertu, dok su postojeća četiri fixture/DST testa prolazila.

V2 forecast sada koristi isti `fetchOpenMeteoFlatbuffers` kao legacy servis. Zadržani su stvarni `AbortSignal`, postojeći `WeatherHttpAdapter`, 72 sata/7 dana, UTC/DST mapiranje i svi postojeći flagovi. Nema migracije, API promjene ni uključivanja v2 u produkciji.

**Dokazi:** v2 fixture suite sada prolazi 5/5; provider+fixture+legacy suiteovi prolaze 3 suitea / 18 testova, a svi Weather testovi 6 suiteova / 35 testova. Generator ostaje `in_sync`, Prettier prolazi, a tačna CI ESLint naredba ima 0 errors i dva postojeća warnings. CI run `41457554020` na `34b0024` je potpuno zelen: backend `tsc: 0`, `eslint: 0`, Build/OpenAPI success, 58 suiteova / 621 test i 5 integration suiteova / 60 testova; mobile i frontend su success, bez failure annotations.

**Granica dokaza:** 503 i validni FlatBuffers odgovori su stubovani/generated ulazi. Ovo ne predstavlja live provider capture, produkcijski rollout ni dokaz da Open-Meteo trenutno vraća određeni status.

### Legacy WeatherService vremensko mapiranje — 2026-11-02

**Reprodukcija prije ispravke:** synthetic SDK odgovor s 24 sata, offsetom +01:00 i poznatim `current.time()` pokrenut je kroz stvarni legacy servis u zasebnim server `TZ` procesima. Na neizmijenjenom production kodu početni regression suite davao je 8 prolaza / 2 očekivana pada u svakoj zoni. Pod UTC je `feelslike` bio 112 umjesto 113, vjetar 223 umjesto 213, a sunrise 07:00Z umjesto 06:00Z. `temp_avg` je za isti ulaz bio 10.5 pod UTC, 9.5 pod `Europe/Sarajevo` i 15.5 pod `America/New_York`, čime je potvrđena zavisnost od serverske zone. `INT64_MAX` sunrise je obarao cijeli refresh umjesto da postane odsutna vrijednost.

**Ispravka:** `2444a7b` bira hourly uzorak iz providerovog `current.time()` i UTC starta/intervala, bez serverskog `new Date().getHours()` i bez `.at(-1)`. Lokalni 06–15 prosjek koristi eksplicitni offset i `getUTCHours()`. Sunrise/sunset Unix sekunde više se ne pomiču za offset; `INT64_MAX`, `null` i nevažeći timestamp postaju `null`, u skladu s nullable `WeatherCache` poljima i postojećim v2 ponašanjem. Striktni transport, adapter, bounded 60-min fallback i update postojećeg reda ostaju nepromijenjeni. Nema migracije, flag/API/compose/mobile promjene ni produkcijskog uključivanja.

**Dokazi nakon ispravke:** legacy suite prolazi 11/11 u svakom od tri stvarna `TZ` procesa, a svi Weather testovi prolaze 6 suiteova / 38 testova. `weather_repro.cjs` je ažuriran sa zastarjelog SDK/cache stub-a na regression guard: actual=expected za current uzorke, prosjek i sunrise/sunset, uz `retainedStale=true` i nula DB operacija na neuspjelom refreshu. Combined fixture generator ostaje `in_sync`, Prettier prolazi, a tačna CI ESLint naredba ima 0 errors i dva postojeća warnings.

Prvi CI run `41461115757` na `2444a7b` zaustavljen je samo na test-only `TS2740` za djelimični synthetic SDK response; `1747bc0` ispravlja taj test double bez production izmjene. Finalni CI run `41461729530` je potpuno zelen: backend `tsc: 0`, `eslint: 0`, Build/OpenAPI success, 58 suiteova / 624 testa i 5 integration suiteova / 60 testova; mobile 24 suitea / 136 testova, frontend 4/4 E2E, a sva tri joba imaju nula failure annotations.

**Granica dokaza:** ovo su synthetic SDK i server-timezone dokazi, ne live provider capture. Produkcijski rollout, stvarni provider sunrise/sunset odgovor i stvarna DST provjera i dalje nisu dokazani.

### Legacy cache izolacija lokacije — 2026-11-02

**Reprodukcija prije ispravke:** na neizmijenjenom production kodu fake-DB regresije su poštivale argumente upita i imale zaseban red za Visoko i Mostar. Kombinovani baseline je dao 4 očekivana pada i 4 kontrolna prolaza od ukupno 8 testova: Dashboard je vratio temperaturu 14 iz cachea drugog grada, HeatingRecommendation je engineu dao Mostar `tempMin=8` i `tempMax=12`, a ThermostatPoll je upisao `externalTemp=9` u oba pagination režima. Matching-city kontrole su prolazile, pa padovi nisu posljedica onemogućenog cijelog cachea.

**Ispravka `747048b`:** Dashboard fallback sada traži najnoviji cache samo za svoj postojeći `DEFAULT_CITY`; HeatingRecommendation koristi `HomeProfile.location` bez globalnog fallbacka; ThermostatPoll koristi isti `User.homeLocation` izbor kao BoilerService, a paginated device `select` eksplicitno uključuje to polje. DailyRecommendation je već bio gradski ograničen i nije mijenjan. Source pretraga nije našla preostali neograničeni globalni najnoviji `weatherCache.findFirst` production read.

**Dokazi:** isti focused skup nakon ispravke prolazi 3 suitea / 8 testova; širi Dashboard/Recommendation/ThermostatPoll skup prolazi 12 suiteova / 82 testa, a svi Weather testovi 6 suiteova / 38 testova. Prettier i `git diff --check` prolaze, a tačna CI ESLint naredba ima 0 errors i dva pre-postojeća warnings. CI run `41482048206` je potpuno zelen: backend `tsc: 0`, `eslint: 0`, Build/OpenAPI success, 60 suiteova / 630 testova i 5 integration suiteova / 60 testova; mobile 24 suitea / 136 testova, frontend 4/4 E2E, a sva tri joba imaju nula failure annotations.

**Granica opsega:** nisu mijenjane formule, recommendation persistence, postojeće missing-weather ponašanje, instalirani API ugovor, flagovi, compose ili mobile. Nema migracije, novog flaga, produkcijskog rollouta ni v2 consumer enablementa. Dashboard i dalje koristi fiksni Visoko; ovo nije potpuni profile-aware routing, koordinatni identitet lokacije ni dokaz live providera ili produkcijskog stanja.

### Recommendation v2 read-only routing — 2026-11-02

**Test-first polazak:** na neizmijenjenom production kodu dva nova delegation testa su pala, a tri postojeće kontrole su prošle (**2 fail / 3 pass**). To dokazuje da v2 delegation path tada nije postojao; nije riječ o novom regressionu u već zelenom legacy ponašanju.

**Implementacija `df980c5`:** zaseban `WEATHER_RECOMMENDATION_V2`, zadano `off`, vrijedi samo zajedno s postojećim `WEATHER_LOCATION_V2=on`. `RecommendationWeatherService` poziva isključivo `WeatherV2Service.getCachedWeather` za potvrđeni `homeProfileId`. Timezone, tekst grada i korisnikov dan dolaze iz tog profila; ne koristi se Dashboard/global mapping niti default grad. Resolver nema provider refresh niti cache upsert, pa ih ni recommendation event/cron ne mogu pokrenuti, uključujući slučaj kad je SWR omogućen.

V2 uspjeh prihvaća prave nule i mapira `tempMin`/`tempMax` u postojeći consumer input. Nedostajuća potvrda lokacije, cache red ili nullable v2 vrijednost daju `null`; `HeatingRecommendationService` i `DailyRecommendationService` tada izvode svoje neizmijenjene legacy grad-scoped fallback grane. Zadržane su različite nullable semantike potrošača (`temp_min!`/`temp_max!` naspram `?? 0`), formule, persistencija, missing-weather ponašanje, API ugovor i instalirani mobile klijent. U tom recommendation inkrementu Boiler, Dashboard i ThermostatPoll nisu prebačeni na v2.

**DI povratna sprega:** prvi CI `41485977639` za `df980c5` prošao je lint/type/build, ali je pao na OpenAPI, unit i integration koracima. Lokalni compile-only `AppModule` reproducirao je nedostajući `RecommendationWeatherService` u `HeatingAnomalyModule`, koji direktno pruža `HeatingRecommendationService`. Fix `be248ab` dodaje `WeatherModule` import i trajnu AppModule compile regresiju s mockovanim Prisma/FileStorage boundaryjima; test ne izvodi aplikacijske DB/filesystem/mrežne/provider operacije.

**Dokazi nakon ispravke:** fokusirani skup prolazi **7 suiteova / 32 testa**, širi Weather/recommendation/Dashboard/ThermostatPoll skup **22 suitea / 134 testa**. Oba offline helpera prolaze, Prettier i diff-check su čisti, a tačna CI ESLint naredba ima **0 errors / 2 postojeće warnings**. Konačni CI `41487067378` je potpuno zelen: backend **64 suitea / 644 testa + 5/60 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136**, frontend **4/4**, nula failure annotations.

**Operativna granica:** `WEATHER_RECOMMENDATION_V2` nije produkcijski uključen. Ako potvrđeni profil nema upotrebljiv v2 cache zapis za svoj tekući dan, ovaj read-only put ne puni cache i zadržava legacy fallback. Nema migracije/backfilla, compose izmjene, automatske potvrde tekstualne lokacije, OpenAPI promjene, rollouta ni live-provider/produkcijskog dokaza. Rollback je `WEATHER_RECOMMENDATION_V2=off`.

### Boiler v2 read-only routing — 2026-11-02

**Test-first polazak:** na neizmijenjenom `734ae42` novi Boiler delegation test je pao, dok su legacy fallback, korisnik bez profila i anonimni `Visoko` put prošli (**1 fail / 3 pass**). To dokazuje da v2 delegation path nije postojao; nije riječ o regressionu u već zelenom legacy ponašanju.

**Implementacija `bb9658f`:** zaseban `WEATHER_BOILER_V2`, zadano `off`, vrijedi samo zajedno s `WEATHER_LOCATION_V2=on` i ne zavisi od recommendation flaga. `BoilerService` jednom učitava isti prvi `HomeProfile` koji je i ranije koristio za proračun. `BoilerWeatherService` za taj profil poziva samo `WeatherV2Service.getCachedWeather`; nema provider refresha, cache upserta, automatskog activate/write ni izbora drugog profila.

Recommendation i Boiler sada dijele isti v2 daily mapper za profile-local datum, prave nule i nullable podatke, bez promjene njihovih legacy semantika. Ako resolver vrati `null` zbog flaga, potvrde, cachea, dana ili temperature, Boiler izvodi neizmijenjeni `User.homeLocation` odnosno anonimni `Visoko` fallback. Formule, sezonalnost, learning, persistence i API odgovor nisu mijenjani.

**Dokazi:** fokusirani skup prolazi **9 suiteova / 43 testa**, a širi Weather/Boiler/recommendation/Dashboard/ThermostatPoll skup **25 suiteova / 163 testa**. Oba offline helpera prolaze, Prettier i diff-check su čisti, a tačna CI ESLint naredba ima **0 errors / 2 postojeće warnings**. CI `41490920044` je potpuno zelen: backend **66 suiteova / 655 testova + 5/60 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136**, frontend **4/4**, nula failure annotations.

**Granica opsega:** Poll može indirektno koristiti Boiler flow rezultat pod ovim flagom, ali njegov zaseban `externalTemp` upis i dalje čita legacy city cache. Dashboard nije mijenjan. `WEATHER_BOILER_V2` nije produkcijski uključen; hladan v2 cache ne pokreće njegovo punjenje. Nema migracije/backfilla, OpenAPI/mobile/compose promjene, rollouta ni live-provider/produkcijskog dokaza. Rollback je `WEATHER_BOILER_V2=off`.

**I dalje otvoreno:** stvarno snimljeni/anonimizirani provider fixture s current+hourly+daily i sunrise/sunset, stvarna DST potvrda nad takvim fixtureom, produkcijska migracija/obnova, višeprocesni SWR, provider licence/kvote, fizički mobile vizuelni QA, jedinstven identitet lokacije te kontrolisano povezivanje Dashboard weather prikaza i zasebnog Poll `externalTemp` upisa na v2. Postojeći hourly-only upstream fixture i generisani combined fixture nisu dokaz live provider ponašanja.
