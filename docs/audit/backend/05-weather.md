# Weather — analiza i ciljni dizajn

## Sažetak: pet prioritetnih nalaza

1. **VERIFIKOVANO:** izbor lokacije nije jedinstven kroz aplikaciju: profil koristi tekstualni grad, izračun kotla `User.homeLocation`, dashboard fiksni Visoko, a polling i dio preporuka najnoviji cache bilo kojeg grada (`weather.controller.ts:36-50`, `boiler.service.ts:59-70`, `dashboard.service.ts:15,568-579`, `thermostat.polling.service.ts:233-235`, `heating.recommendation.service.ts:98-100`). To može dati vremenske podatke pogrešne lokacije (B-008).
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
- **VERIFIKOVANO:** `BoilerService` traži `User.homeLocation` ili anonimni grad, ne `HomeProfile.location` (`backend/src/modules/Boiler/boiler.service.ts:48-74`); dashboard koristi stalni grad i fallback na globalni najnoviji cache (`backend/src/modules/Dashboard/dashboard.service.ts:15,568-579`). Dnevni job filtrira po gradu (`backend/src/modules/Schedule/daily.recommendation.service.ts:134-142`), dok polling i drugi servis preporuka ne filtriraju (B-008). Aktivni profil, višestruki profili i vlasništvo lokacije treba obuhvatiti dizajnom.
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
| Sintetička reprodukcija postojećih grešaka | Lažni SDK i baza, poznati UTC instant, zadnji sat, pad osvježavanja. | `node scripts/audit/weather_repro.cjs --help` i `node scripts/audit/weather_repro.cjs`; pokrenuto lokalno, izlaz 0. Bez mreže i upisa. |
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
