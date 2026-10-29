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
