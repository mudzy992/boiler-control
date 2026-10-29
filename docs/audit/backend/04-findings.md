# Backend nalazi — radna verzija

## Sažetak: pet početnih nalaza

1. `POST /api/heating-events` vraća objekt kao da je kreiran, ali ne sprema događaj (**VERIFIKOVANO**, B-001).
2. `GET /api/weather` vraća `{}`; druga weather ruta odvojeno čita stvarnu prognozu (**VERIFIKOVANO**, B-002).
3. `GET /api/recommendations/today` uvijek vraća `[]` (**VERIFIKOVANO**, B-003).
4. `BaseAdapter` koristi `Promise.race` bez proslijeđenog signala za otkazivanje; preklapanje stvarnih zahtjeva je hipoteza koju treba reproducirati (**VERIFIKOVANO/HIPOTEZA**, B-004).
5. Postoje dvije različite definicije jedninskog kontrolera profila, od kojih je jedna izričito registrirana u modulu (**VERIFIKOVANO**, B-005).

## Otvorena pitanja

- Da li postojeći klijenti oslanjaju na ugovor i status stubova, uključujući instalirane mobile verzije?
- Da li su simulirane ručne operacije grijanja namjeran proizvodni ugovor ili ih treba ugasiti uz verzioniranje?
- Koliko stvarnih timeouta i retry pokušaja ima u produkciji i postoji li dodatno otkazivanje unutar pojedinih HTTP biblioteka?

**Status:** ovo nije kompletan popis nalaza. Potrebni su preostali segmenti iz zadatka, pregled potrošača i dopuna dokaza.

### [B-001] Ručno kreiranje događaja vraća nepohranjen objekt — Ozbiljnost: VISOKO — Pouzdanost: VERIFIKOVANO
- Gdje: `backend/src/modules/Heating/heating.controller.ts:13-42`.
- Šta nije u redu i zašto je bitno: POST generiše slučajan ID i vraća ulazne vrijednosti bez poziva servisa za pohranu. Klijent može prikazati uspjeh za događaj koji ne postoji pri narednom čitanju.
- Dokaz: tijelo `createHeatingEvent` sadrži direktni `return` objekta i nema DB upisa; u `backend/test/integration/heating-polling.integration.spec.ts:117-138` provjeravaju se polja samo ako je status uspješan, bez provjere upisa.
- Preporuka: potvrditi stvarnu potrebu za ručnim kreiranjem. Ako je potrebna, uvesti DTO i transakcijski servis s provjerom vlasništva uređaja i pohranom; ako nije, uvesti jasno verzioniran odgovor o nepodržanoj operaciji. Ne mijenjati ugovor postojećim klijentima bez plana kompatibilnosti.
- Kako provjeriti da je riješeno: integracijski test s izolovanom PostgreSQL bazom kreira događaj za vlastiti uređaj, provjeri zapis i GET, odbije tuđi uređaj i neispravan DTO; test starih klijenata potvrđuje dogovoreno ponašanje. Pokrenuti `cd backend && npm run test:integration`.
- Trud: M — Zavisnosti: odluka vlasnika, API kompatibilnost i model događaja.

### [B-002] Prazna weather ruta skriva odsustvo podataka — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO
- Gdje: `backend/src/modules/Weather/weather.controller.ts:16-50`.
- Šta nije u redu i zašto je bitno: `GET /api/weather` uvijek vraća prazan objekt. To može klijentu izgledati kao uspješan odgovor bez prognoze; različita ruta `GET /api/weather/current/:homeProfileId` dohvaća profil po korisniku i poziva weather servis.
- Dokaz: `getWeatherData()` direktno vraća `{}`, dok `getCurrentWeather()` ima zaseban `findFirst` i poziv servisa. Ovdje nije utvrđeno koji klijenti koriste koju rutu.
- Preporuka: utvrditi potrošače, definisati verzionirani weather DTO i eksplicitan odgovor za nedostupne ili zastarjele podatke, uz kompatibilan prelaz za postojeće klijente; kompletan dizajn slijedi u `05-weather.md`.
- Kako provjeriti da je riješeno: contract test za obje rute, profil bez lokacije, tuđi profil i grešku providera; provjeriti oblik odgovora i HTTP status. Pokrenuti `cd backend && npm run test:integration` s izolovanom bazom.
- Trud: M — Zavisnosti: weather dizajn, sigurnost, dogovor o kompatibilnosti.

### [B-003] Današnje preporuke uvijek prazne — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO
- Gdje: `backend/src/modules/HeatingRecommendation/recommendations.controller.ts:20-32`.
- Šta nije u redu i zašto je bitno: `/today` vraća praznu listu nezavisno od podataka, pa se odsustvo implementacije ne razlikuje od dana bez preporuka.
- Dokaz: metoda `getTodayRecommendations()` direktno vraća `[]`; susjedni GET koristi servis.
- Preporuka: nakon provjere upotrebe definisati po korisniku i vremenskoj zoni šta predstavlja današnju preporuku, ili eksplicitno deprecirati stub uz kompatibilnost starih klijenata.
- Kako provjeriti da je riješeno: integracijski test unese preporuke dvaju korisnika oko ponoći u različitim zonama i provjeri izolaciju, vremenske granice i prazan slučaj; `cd backend && npm run test:integration`.
- Trud: M — Zavisnosti: definicija dana i korisnička vremenska zona, API ugovor.

### [B-004] Timeout utrka ne otkazuje osnovni zahtjev — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (mehanizam), HIPOTEZA (posljedica u radu)
- Gdje: `backend/src/common/adapters/base-adapter.ts:150-172,183-203`; `backend/src/modules/Weather/weather.service.ts:68-75,91-97`.
- Šta nije u redu i zašto je bitno: `Promise.race` vrati grešku po timeoutu, ali sam ne otkazuje `requestFn`; retry može započeti dok prethodni zahtjev još traje. Stvarna učestalost i ponašanje biblioteke nisu izmjereni.
- Dokaz: `executeWithTimeout` poziva `requestFn()` bez argumenta za abort i takmiči ga s timeout promiseom; vremenski timer se tu ne čisti nakon uspjeha. Weather pozivi prolaze kroz adapter, no abort pojedinog providera tek treba provjeriti.
- Preporuka: prenijeti `AbortSignal` do podržanih HTTP poziva, očistiti timeout po završetku i razlikovati klijentski timeout od potvrđenog otkazivanja; za operacije koje mijenjaju stanje koristiti idempotentnost i provjeru rezultata prije ponovnog pokušaja.
- Kako provjeriti da je riješeno: fake provider koji kasni duže od timeouta zabilježi abort i broj istovremenih zahtjeva; testirati uspjeh, grešku, timeout, retry i čišćenje timera. Dodati spec u `backend/src/common/tests/` i pokrenuti `cd backend && npm test -- --runInBand`.
- Trud: M — Zavisnosti: podrška providera za abort i definisana retry politika.

### [B-005] Duplikat jedninskog kontrolera profila — Ozbiljnost: NISKO — Pouzdanost: VERIFIKOVANO
- Gdje: `backend/src/modules/HomeProfile/home.profile.module.ts:2-11`, `backend/src/modules/HomeProfile/home.profile.controller.ts:63-100`, `backend/src/modules/HomeProfile/home.profile.single.controller.ts:17-52`.
- Šta nije u redu i zašto je bitno: dvije datoteke definišu istoimeni kontroler za istu putanju, ali modul uvozi klasu iz prve. Stara kopija može dovesti do izmjena pogrešne implementacije ili pogrešnog broja ruta.
- Dokaz: `HomeProfileModule` eksplicitno uvozi `HomeProfileSingleController` iz `./home.profile.controller`; pretraga `git grep -n -F 'home.profile.single.controller' -- backend` nije našla import u verzioniranim backend fajlovima.
- Preporuka: nakon provjere build/klijentskih ugovora ukloniti ili objediniti neregistrovani duplikat u samostalnom koraku, bez promjene aktivne rute i oblika odgovora.
- Kako provjeriti da je riješeno: test registracije ruta i contract test GET/POST/PATCH jedninskog profila, uz provjeru postojećeg response mappinga; `cd backend && npm run test:integration` i `npm run build`.
- Trud: S — Zavisnosti: potvrda da ne postoje vanjski importi/automatizacija izvan repozitorija.

### [B-006] Označavanje tuđe notifikacije kao pročitane — Ozbiljnost: VISOKO — Pouzdanost: VERIFIKOVANO (statički kod)
- Gdje: `backend/src/modules/Notification/notifications.controller.ts:26-27,67-70`, `backend/src/modules/Notification/notifications.service.ts:103-111`.
- Šta nije u redu i zašto je bitno: kontroler zahtijeva JWT, ali ne predaje korisnički ID u `markAsRead`; servis traži i ažurira notifikaciju samo po ID-u. Autorizovani korisnik može promijeniti stanje tuđe notifikacije ako zna njen ID. Endpoint vraća ažurirani zapis, pa postoji i mogućnost otkrivanja sadržaja; stvarni incidenti nisu provjereni.
- Dokaz: upiti `findUnique` i `update` imaju samo `where: { id: notificationId }`. Ovo je statički nalaz; nije slan zahtjev produkciji.
- Preporuka: prioritetno ograničiti operaciju na `id` i autentifikovani `userId` u istoj atomskoj DB operaciji, uz jedinstven odgovor za nepostojeće i tuđe ID-ove; provjeriti logove bez izlaganja ličnih podataka. Do objave popravke procijeniti ograničavanje endpointa na rubnoj zaštiti, uz provjeru uticaja na klijente.
- Kako provjeriti da je riješeno: u izolovanom integracijskom testu korisnik A označi svoju notifikaciju, ne može mijenjati ni čitati odgovor za B-ovu, nepostojeći i tuđi ID daju isti dogovoreni status, neautentifikovani zahtjev je odbijen; `cd backend && npm run test:integration`.
- Trud: S — Zavisnosti: dogovoren kompatibilan status i sigurni regresijski testovi.

### [B-007] Svaki prijavljeni korisnik može pokrenuti masovni test podsjetnika — Ozbiljnost: VISOKO — Pouzdanost: VERIFIKOVANO (statički kod)
- Gdje: `backend/src/modules/Notification/notifications.controller.ts:26-27,159-167`, `backend/src/modules/Schedule/gas.reminder.service.ts:144-180`, `backend/src/app.module.ts:53-63`.
- Šta nije u redu i zašto je bitno: komentar kaže „admin only“, ali ruta ima samo JWT guard na klasi i neposredno poziva funkciju za slanje korisnicima s uključenom preferencijom. U `AppModule` jedini globalni guard naveden je throttler izvan testa, ne role guard. Zloupotreba može izazvati neželjene notifikacije i potrošnju resursa; stvarni učinak zavisi od tokena, preferencija i debounce pravila.
- Dokaz: nema `RolesGuard` ni role metapodataka na ruti/kontroleru; servis prolazi kroz ciljane korisnike i poziva `notifyUser`. Nije isprobavano u produkciji.
- Preporuka: prioritetno onemogućiti testni endpoint u produkciji ili zahtijevati provjerenu administratorsku autorizaciju i zaseban restriktivni rate limit; pregledati i ostale testne rute. Ne oslanjati se na komentar.
- Kako provjeriti da je riješeno: integracijski test u produkcijskom konfiguracijskom profilu odbija običnog korisnika i anonimni zahtjev, a samo odobreni administrator ili isključivo neprodukcijsko okruženje dobije dozvoljen odgovor; mock push provjerava da neautorizovan zahtjev ne šalje ništa. `cd backend && npm run test:integration`.
- Trud: S — Zavisnosti: sigurnosna politika admina i deployment konfiguracija.

### [B-008] Weather iz drugog grada može ući u historiju i preporuku — Ozbiljnost: VISOKO — Pouzdanost: VERIFIKOVANO (upit), HIPOTEZA (stvarni uticaj u produkciji)
- Gdje: `backend/src/modules/ThermostatPoll/thermostat.polling.service.ts:224-235,250-254`, `backend/src/modules/HeatingRecommendation/heating.recommendation.service.ts:94-103`.
- Šta nije u redu i zašto je bitno: oba upita uzimaju najnoviji zapis čitave weather tabele bez filtera po lokaciji uređaja. Polling upisuje tu temperaturu u korisnikovu historiju, a servis preporuka uzima min/max iz istog globalnog skupa. Ako različiti korisnici pune cache za različite gradove, mogu se pripisati pogrešni vremenski podaci. Kada nema zapisa, polling bilježi `0` kao da je temperatura; ne tvrdi se da kod automatski upravlja kotlom.
- Dokaz: oba `findFirst` sadrže samo `orderBy: { fetchedAt: 'desc' }`, bez `where`; upis koristi `lastWeatherTemp?.temperature || 0`. Stvarna učestalost i produkcijski skup lokacija nisu mjereni.
- Preporuka: povezati dohvat i historiju s lokacijom profila/koordinatnim ključem, vremenskom zonom, vremenom mjerenja i kvalitetom; nedostupnost prikazati zasebno od legitimnih 0 °C. Budući da `BoilerHistory.externalTemp` nije nullable, promjena zahtijeva migracijski i backwards-compatible plan, bez automatskog mijenjanja postojećih mjerenja.
- Kako provjeriti da je riješeno: izolovani integracijski test s dva korisnika i različitim gradovima gdje je noviji tuđi cache; provjeriti historiju i oba ulaza preporuke za odgovarajući profil, nedostatak podataka i stvarnih 0 °C. `cd backend && npm run test:integration`; dodatno contract i shadow/backtest prije aktiviranja novih formula.
- Trud: M/L — Zavisnosti: weather ciljna shema, identitet lokacije, migracija i strategija odsutnih podataka.
