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

### [B-006] Označavanje tuđe notifikacije kao pročitane — Ozbiljnost: VISOKO — Pouzdanost: VERIFIKOVANO (izolovani HTTP i PostgreSQL)
- Gdje: `backend/src/modules/Notification/notifications.controller.ts:26-27,67-70`, `backend/src/modules/Notification/notifications.service.ts:103-111`.
- Šta nije u redu i zašto je bitno: kontroler zahtijeva JWT, ali ne predaje korisnički ID u `markAsRead`; servis traži i ažurira notifikaciju samo po ID-u. Autorizovani korisnik može promijeniti stanje tuđe notifikacije ako zna njen ID. Endpoint vraća ažurirani zapis, pa postoji i mogućnost otkrivanja sadržaja; stvarni incidenti nisu provjereni.
- Dokaz: upiti `findUnique` i `update` imaju samo `where: { id: notificationId }`. `node scripts/audit/http_security_repro.cjs` uz stvarni JWT guard, controller, notification servis i fake bazu: sintetički korisnik A dobije 201 i promijeni B-ovu notifikaciju; bez tokena 401. Potom [Actions run 40876239114](https://github.com/mudzy992/boiler-control/actions/runs/40876239114), `node scripts/audit/http_postgres_repro.cjs --ci`, potvrdio je isti HTTP rezultat i izmjenu B-ove notifikacije u stvarnom privremenom PostgreSQL-u korištenjem Prisma transakcije koja se namjerno rollbackuje. Nije pokrenut puni AppModule, production middleware/WAF/proxy ili produkcija.
- Preporuka: prioritetno ograničiti operaciju na `id` i autentifikovani `userId` u istoj atomskoj DB operaciji, uz jedinstven odgovor za nepostojeće i tuđe ID-ove; provjeriti logove bez izlaganja ličnih podataka. Do objave popravke procijeniti ograničavanje endpointa na rubnoj zaštiti, uz provjeru uticaja na klijente.
- Kako provjeriti da je riješeno: u izolovanom integracijskom testu korisnik A označi svoju notifikaciju, ne može mijenjati ni čitati odgovor za B-ovu, nepostojeći i tuđi ID daju isti dogovoreni status, neautentifikovani zahtjev je odbijen; `cd backend && npm run test:integration`.
- Trud: S — Zavisnosti: dogovoren kompatibilan status i sigurni regresijski testovi.

### [B-007] Svaki prijavljeni korisnik može pokrenuti masovni test podsjetnika — Ozbiljnost: VISOKO — Pouzdanost: VERIFIKOVANO (izolovani HTTP i fake servis)
- Gdje: `backend/src/modules/Notification/notifications.controller.ts:26-27,159-167`, `backend/src/modules/Schedule/gas.reminder.service.ts:144-180`, `backend/src/app.module.ts:53-63`.
- Šta nije u redu i zašto je bitno: komentar kaže „admin only“, ali ruta ima samo JWT guard na klasi i neposredno poziva funkciju za slanje korisnicima s uključenom preferencijom. U `AppModule` jedini globalni guard naveden je throttler izvan testa, ne role guard. Zloupotreba može izazvati neželjene notifikacije i potrošnju resursa; stvarni učinak zavisi od tokena, preferencija i debounce pravila.
- Dokaz: nema `RolesGuard` ni role metapodataka na ruti/kontroleru; servis prolazi kroz ciljane korisnike i poziva `notifyUser`. `node scripts/audit/http_security_repro.cjs`: sintetički obični korisnik s validnim JWT dobije 201 i pozove fake reminder servis jednom. Isti zaključak o fake reminder pozivu potvrđen je s realnim JWT korisnikom iz privremene PostgreSQL transakcije u runu 40876239114. Nema stvarnog slanja, pune AppModule konfiguracije niti produkcije; infrastrukturalne barijere nisu provjerene.
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

### [B-009] Nedostaje provjera vlasništva pri izmjeni anomalije — Ozbiljnost: VISOKO potencijalno — Pouzdanost: VERIFIKOVANO (servis), HIPOTEZA (HTTP iskoristivost)
- Gdje: `backend/src/modules/HeatingAnomalyCheckerService/heating.anomaly.checker.controller.ts:18-35`, `backend/src/modules/HeatingAnomalyCheckerService/heating.anomayl.checker.service.ts:252-302`.
- Šta nije u redu i zašto je bitno: kontroler zahtijeva JWT, ali kod PATCH-a u servis predaje samo `eventId` i DTO, ne prijavljenog korisnika. Servis dohvaća događaj po ID-u, a ažurira ga po ID-u i `isAnomaly` bez provjere korisnika termostata; servisna putanja može izmijeniti tuđi događaj ako joj neovlašten poziv prođe validaciju. Posredno može pokrenuti obradu preporuke vlasnika; ne tvrdi se da šalje fizičku komandu kotlu. **HTTP iskoristivost nije potvrđena:** `UpdateHeatingAnomalyDto` nema validator dekoratore i izolovani `ValidationPipe` s produkcijskim opcijama odbija `{confirm:true}` i `{}` s 400; punu HTTP putanju treba testirati prije tvrdnje o dostupnom napadu.
- Dokaz: `node scripts/audit/anomaly_ownership_repro.cjs` izvršava stvarni servis uz fake bazu i saradnike; za sintetički događaj vlasnika 200 bez ikakvog identiteta pozivaoca vraća uspjeh i update filter sadrži samo `id` i `isAnomaly`. Ovo nije HTTP/JWT test ni test produkcije; kontrolerski JWT guard u reprodukciji nije izvršen. `node scripts/audit/anomaly_validation_repro.cjs` provjerava zasebno produkcijske opcije ValidationPipe i syntetički DTO, ne cijeli HTTP pipeline.
- Preporuka: prioritetno preuzeti autentifikovani `userId` i obaviti vlasnički scope u istoj atomskoj uslovnoj DB izmjeni, npr. relacijom na termostat u `where`, uz dosljedan odgovor za tuđi i nepostojeći ID; naknadne side effecte vezati samo za potvrđenu operaciju. Do isporuke procijeniti privremeno isključenje rute na rubu uz procjenu uticaja na postojeće klijente.
- Kako provjeriti da je riješeno: izolovani HTTP integracijski test s uključenim JWT guardom, stvarnom izolovanom PostgreSQL bazom i dva korisnika: A može mijenjati vlastitu anomaliju, A ne može mijenjati B-ovu, nepostojeći i tuđi ID imaju isti dogovoreni odgovor, invalid ID/DTO i anonimni poziv se odbijaju, te nema recommendation side effecta za neovlaštenu izmjenu. `cd backend && npm run test:integration` nakon dodavanja namjenskog testa.
- Trud: S/M — Zavisnosti: dogovoreni kompatibilan response i testovi vlasništva/konkurentnosti.

### [B-010] DTO anomalije nema validator dekoratore — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (izolovani pipe i odabrani HTTP slučaj), HIPOTEZA (produkcijski put)
- Gdje: `backend/src/modules/HeatingAnomalyCheckerService/dto/heating-anomaly.dto.ts:2-5`, `backend/src/main.ts:28-38`, `backend/src/modules/HeatingAnomalyCheckerService/heating.anomaly.checker.controller.ts:30-35`.
- Šta nije u redu i zašto: klasa DTO ima dva polja bez `class-validator` dekoratora, dok globalni pipe koristi `whitelist` i `forbidNonWhitelisted`. Sintetička validacija odbija i očekivanu vrijednost `confirm`, pa klijent možda ne može koristiti endpoint u produkcijskom bootstrapu.
- Dokaz: `node scripts/audit/anomaly_validation_repro.cjs` učitava stvarnu DTO klasu i `ValidationPipe` s produkcijskim opcijama; `{confirm:true}`, `{}`, `null` i odsutna vrijednost vraćaju 400. `node scripts/audit/http_security_repro.cjs` dodatno izvršava lokalni Nest controller, stvarni JWT guard i isti pipe: `{confirm:true}` dobije 400 i mock anomaly servis nije pozvan. To nije puni AppModule ni produkcija, niti je svako moguće tijelo provjereno preko HTTP-a. Ovo ograničenje ne popravlja nedostajuću servisnu autorizaciju B-009.
- Preporuka: definisati validator dekoratore za boolean i ISO timestamp, transformaciju datuma i business pravila; prvo osigurati B-009, zatim popravljati DTO, da uklanjanje trenutne validacijske prepreke ne izloži neautorizovanu izmjenu.
- Kako provjeriti da je riješeno: HTTP test s identičnim globalnim pipeom, vlastitom i tuđom anomalijom, validnom potvrdom i datumom, lošim datumom, dodatnim poljem i praznim tijelom; `cd backend && npm run test:integration` nakon dodavanja testa.
- Trud: S/M — Zavisnosti: autorizacija B-009 i dogovor praznog/validnog requesta.

### [B-011] Docker kontekst isključuje migracije, a entrypoint nije priključen — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (fajlovi), HIPOTEZA (efekat u produkciji)
- Gdje: `backend/.dockerignore:45-47`, `backend/Dockerfile:34-38,58-65`, `backend/docker-entrypoint.sh:1-12`, `docker-compose.yml:2-20`, `backend/docker-compose.yml:2-23`.
- Šta nije u redu i zašto: `.dockerignore` isključuje sadržaj `prisma/migrations/*` osim lock fajla, a Dockerfile `COPY` radi iz tog build konteksta i završni stage kopira `prisma` iz builda. U prikazanim Dockerfile/Compose konfiguracijama nema priključenog `docker-entrypoint.sh`, niti poziva `migrate deploy`; sama skripta također ne pokreće migracije. Stvarna produkcijska deployment procedura nije pregledana i može migracije pokretati zasebno.
- Dokaz: statička pravila Docker konteksta i `CMD ["node", "dist/src/main.js"]`; `git grep -F docker-entrypoint.sh` u praćenom kodu, izvan audit dokumenata, nije našao referencu. Nije građen niti pokretan image.
- Preporuka: najprije utvrditi aktuelni deploy i produkcijsku Prisma historiju; odlučiti da li je migracijski image/poseban release job nosilac migracija, te eksplicitno uključiti potrebne SQL fajlove i kontrolisano pokretanje jednog migratora, bez automatskog resetovanja ili pokretanja više replika.
- Kako provjeriti: na izolovanoj PostgreSQL bazi izgraditi image i provjeriti samo prisustvo migracijskih putanja; odraditi odobreni `prisma migrate deploy`, restart i probni backup/restore, zatim potvrditi readiness i rollback aplikacije bez brisanja podataka. Ne ispisivati env/secret vrijednosti.
- Trud: M — Zavisnosti: produkcijski deployment inventory, schema diff i backup.

### [B-012] Testni naziv ne garantuje uspjeh API-ja ili stvarnu pohranu — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO
- Gdje: `backend/test/integration/heating-polling.integration.spec.ts:117-137,220-230,432-444`, `backend/src/modules/Heating/heating.controller.ts:20-42`, `backend/src/modules/Weather/weather.controller.ts:23-30`.
- Šta nije u redu i zašto: test kreiranja događaja provjerava tijelo samo kod statusa 200/201, ali nema `expect` za sam status ni provjeru DB upisa. Weather test ne zahtijeva da `current` postoji; recommendation test prihvata i prazni niz. Zato ti testovi mogu proći za stubove ili dio neočekivanih statusa i ne dokazuju ugovor iz naziva.
- Dokaz: navedene uslovne grane i stubovi; GitHub run `40865068767` je prošao, ali nije dokazao navedena svojstva.
- Preporuka: za dogovorene aktivne ugovore asertirati očekivani status i semantiku, pozitivan i negativan slučaj i DB side effect; za stvarno nepodržane rute testirati eksplicitan unsupported status ili verzionirani legacy ugovor.
- Kako provjeriti: namjerni fake 500/404 mora srušiti kreiranje testa; za podržano kreiranje insert + read-back, za weather fixture `current`/freshness, za recommendations zapis koji se mora vratiti; `cd backend && npm run test:integration` na izolovanoj bazi.
- Trud: M — Zavisnosti: odluka o proizvodnom API ugovoru, stare mobile verzije.

### [B-013] E2E skripta referencira nepostojeći Jest config — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (lokalno)
- Gdje: `backend/package.json:22`; `backend/test/jest-e2e.json` ne postoji u checkoutu.
- Šta nije u redu i zašto: namjenska komanda `npm run test:e2e` prekida se prije izvođenja suitea, pa je e2e provjera nedostupna; opći Jest prolaz nije dokaz e2e testiranja.
- Dokaz: lokalno `cd backend && npm run test:e2e` završio s exit 1 jer Jest ne može razriješiti config. Sirovi izlaz nije prepisivan u audit; rezultati se ne smiju sabirati s CI testovima.
- Preporuka: odlučiti da li održavati zaseban e2e config/okruženje ili ukloniti zastarjelu komandu uz pregled potrošača; za novu konfiguraciju ograničiti izolovane servise i zaštititi je od produkcijskih baza.
- Kako provjeriti: e2e komanda izvrši barem jednu namjensku auth/ownership i smoke provjeru s izolovanim PostgreSQL/Redis, vrati !=0 na namjerno pogrešan odgovor i 0 na prolaz, dokumentovati u branch-only CI.
- Trud: S/M — Zavisnosti: odluka o opsegu e2e i ugovorima.

### [B-014] Greške čitanja i pisanja predstavljene kao prazni ili uspješni HTTP odgovori — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (kontrolni tok)
- Gdje: `backend/src/modules/Heating/heating.service.ts:13-27`, `backend/src/modules/HeatingRecommendation/heating.recommendation.service.ts:201-211`, `backend/src/modules/Boiler/boiler.controller.ts:27-36,43-65,73-95`.
- Šta nije u redu i zašto: servisi pri grešci vraćaju `[]`, a neke boiler metode vraćaju `success:false` i sirovi `error.message` umjesto izuzetka. To zamagljuje razliku greške i praznih podataka i može otkriti detalje implementacije; stvarni HTTP status zavisi od Nest defaulta i nije dodatno reproduciran.
- Dokaz: catch grane u navedenim fajlovima. `POST` i `PATCH` nemaju eksplicitnu promjenu statusa u prikazanoj grani.
- Preporuka: centralni exception filter s korelacijskim ID-em, interni redigovani log i stabilan versionirani error DTO, bez sirovih poruka; migrirati legacy odgovore tek nakon consumer pregleda.
- Kako provjeriti: izolovano simulirati DB/provider grešku, dokazati ne-2xx i generičan error bez tajni te razlikovati prazan rezultat; contract test starog i novog API-ja. `cd backend && npm run test:integration`.
- Trud: M — Zavisnosti: DTO verzioniranje, observability i stari klijenti.

### [B-015] String `false` za gas referencu pretvara se u `true` — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (izolovani pipe), HIPOTEZA (stvarni HTTP učinak)
- Gdje: `backend/src/main.ts:28-38`, `backend/src/modules/Gas/dto/update-gas-reference.dto.ts:4-7`, `gas.reading.controller.ts:66-72`, `gas.reading.service.ts:140-178`.
- Šta nije u redu i zašto: `enableImplicitConversion` u stvarnom DTO-u s metapodatkom `boolean` pretvara neprazan string u `true` prije custom transformacije; sintetički `"false"` i `"not-a-boolean"` prolaze kao `true`, dok JSON boolean `false` ostaje `false`. Servis za `true` u transakciji uklanja referencu drugom očitanju istog mjeseca i postavlja ovo kao referencu. To može dati suprotan korisnički ishod ako klijent šalje string; upotreba takvog ulaza u produkciji nije provjerena.
- Dokaz: `node scripts/audit/gas_validation_repro.cjs` koristi stvarne DTO/ValidationPipe opcije i asertira transformisane vrijednosti. Nije izvršen HTTP, guard ili stvarna DB transakcija.
- Preporuka: strogi parser koji prihvata dogovorene oblike bez automatske `Boolean(string)` konverzije; po mogućnosti samo JSON boolean, ili eksplicitno podržati `true`/`false` za multipart. Nepoznate oblike odbiti. Prije isključenja implicitne konverzije globalno provjeriti uticaj na ostale API-je i legacy klijente.
- Kako provjeriti: HTTP integracijski test na izolovanoj bazi za boolean true/false, string `true`/`false` u podržanim content-typeovima, prazno/nesmisleno/missing/null, te provjeriti tačan referentni zapis nakon svakog zahtjeva. `cd backend && npm run test:integration` nakon implementacije.
- Trud: S/M — Zavisnosti: dogovoreni HTTP ugovor, klijenti i backfill postojećih neispravnih referenci tek nakon provjere.

### [B-016] Prazan i negativan unos brojila prolazi DTO; prvi negativan prolazi servis — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (izolovani pipe i servis/fake DB)
- Gdje: `backend/src/modules/Gas/dto/create-gas-reading.dto.ts:11-24`, `backend/src/modules/Gas/gas.reading.service.ts:22-67`.
- Šta nije u redu i zašto: `counterValue` nema `Min(0)`, a implicitna/eksplicitna Number konverzija pretvara `''` u 0 prije `IsNotEmpty`; servis odbija manju vrijednost od posljednje samo kada posljednje očitanje postoji. Prvi negativni unos prolazi servis i može pokvariti kasnije razlike/potrošnju. DTO također nudi `markAsReference`, ali servis pri kreiranju uvijek postavlja `isInvoiceReference:false`.
- Dokaz: `node scripts/audit/gas_validation_repro.cjs`: stvarni pipe prihvata sintetička `-1` i `'' → 0`; stvarni servis nad lažnom DB bez prethodnog očitanja šalje `-1` u create. Nema stvarne baze, HTTP-a, fajla ni produkcijskih podataka; DB shema nema deklarisan `CHECK` u Prisma modelu, stvarna produkcijska DB ograničenja nisu provjerena.
- Preporuka: eksplicitno provjeriti prisustvo, format, konačnost, nenegativnost i definisanu preciznost prije numeričke konverzije; servisno zaštititi pravilo i za direktne pozive. Uskladiti dokumentaciju/deprecirati ili implementirati `markAsReference` prema ugovoru i testirati migraciju klijenata.
- Kako provjeriti: HTTP + servis testovi za prazno/whitespace/null/nedostaje, `-1`, nulu, decimalni broj, NaN/Infinity, prvi i naredni unos, multipart i JSON, te stvarni DB read-back; analizirati postojeće podatke bez prikaza korisničkih vrijednosti.
- Trud: S/M — Zavisnosti: DTO/klijentski ugovor, policy korekcije brojila i postavljanje reference.

### [B-017] Dodavanje historijskog očitanja poredi se s globalno najnovijim očitanjem — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (servis i izolovani fake DB)
- Gdje: `backend/src/modules/Gas/gas.reading.service.ts:22-67,583-595`.
- Šta nije u redu i zašto: servis traži zadnje očitanje po datumu bez uslova `readingDate < novi datum`. Zato odbija ispravno manje historijsko očitanje ako već postoji kasnije veće, a eventualno prihvaćeno historijsko s višim stanjem ne provjerava se i prema neposrednom sljedećem očitanju. Postojeći `consumption` se ne preračunava za susjede; ponašanje pri zamjeni/resetu brojila treba proizvodnu odluku.
- Dokaz: `node scripts/audit/gas_validation_repro.cjs` nad stvarnim servisom i lažnom DB: kasnije očitanje 200, ranije 100 → 400, bez HTTP-a ili stvarne baze. `findReadingForSameDay` računa dan u UTC. Ne tvrditi da postoji greška ako poslovno pravilo namjerno zabranjuje historijske unose — ta politika nije utvrđena.
- Preporuka: eksplicitna politika monotonosti, historijskog unosa i promjene brojila; ako su historijski unosi dopušteni, porediti prethodnika i sljedbenika te atomarno ažurirati izvedene podatke, uz korisnikovu timezone/datumsku politiku.
- Kako provjeriti: izolovano kreirati prethodni/srednji/sljedeći zapis, testirati dozvoljene i zabranjene kombinacije, reset/rollover, različite zone/DST te obračun potrošnje prije i poslije inserta.
- Trud: M/L — Zavisnosti: domena, timezone, audit postojećih podataka i konkurentnost.

### [B-018] Provjera jednog gas očitanja po danu nije atomska — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (izvor), HIPOTEZA (stvarni race)
- Gdje: `backend/src/modules/Gas/gas.reading.service.ts:28-42,60-69,583-595`, `backend/prisma/schema.prisma:188-208`.
- Šta nije u redu i zašto: servis provjerava postojanje očitanja u UTC danu, a zatim zasebno radi create. Prisma model nema unique ključ za korisnika i dan očitanja; unique `(userId, referenceMonth)` nije dnevni ključ. Dva paralelna zahtjeva mogu obojica proći prethodnu provjeru i upisati zapise za isti dan. Race nije reproduciran protiv PostgreSQL-a, niti je produkcijska DB shema provjerena.
- Dokaz: statički kontrolni tok i Prisma model; nema tvrdnje da postoje duplikati ili da produkcijska DB nema dodatno ograničenje.
- Preporuka: nakon odluke o poslovnoj vremenskoj zoni i datumu obračuna, provesti deduplikacijski audit pa eksplicitni stabilni day key i DB unique/konkurentni upis, migracijom bez gubitka podataka; vratiti smislen conflict.
- Kako provjeriti: dvije konkurentne transakcije na izolovanoj PostgreSQL bazi i više API replika, oba startaju prije upisa; tačno jedan upis i jedan conflict. Testirati granicu UTC/lokalni dan, DST i postojeće duplikate prije migracije.
- Trud: M/L — Zavisnosti: produkcijska shema, integritet podataka i izbor vremenske zone.

### [B-019] Lista događaja koristi temperaturu prvog termostata za sve uređaje — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (izvor i fake DB servis)
- Gdje: `backend/src/modules/Dashboard/dashboard.service.ts:219-261`; GET `/api/dashboard/heating-events`, `backend/src/modules/Dashboard/dashboard.controller.ts:34-36`.
- Šta nije u redu i zašto: stranica može sadržavati događaje različitih uređaja, ali servis uzima `events[0].deviceId`, jednom učita taj termostat i istu `curretTempThermostat`/`targetTempThermostat` vrijednost daje svakom događaju. Takođe su to sadašnje, a ne historijske vrijednosti, što zahtijeva jasan naziv/podatkovni ugovor. Kada nema događaja, `if (thermostatDeviceIds)` je true za prazan niz te se ipak zadaje upit s `id: undefined`.
- Dokaz: `node scripts/audit/dashboard_repro.cjs` koristi stvarni servis i sintetički fake DB: dva uređaja dobijaju istu temperaturu prvog; prazan niz generiše poziv s undefined ID. Ponašanje stvarnog Prisma klijenta za undefined i eventualni HTTP odgovor nije testirano; prazan rezultat ne izlaže sam po sebi temperaturu jer nema redova. Nije dokaz cross-user curenja.
- Preporuka: jednom dohvatiti **samo tražene** vlasnički filtrirane uređaje i mapirati po `deviceId`, ili selektovati relaciju u prvom upitu; prazan rezultat mora preskočiti lookup. Odvojiti snapshot događaja od trenutnog stanja. Ispravku tipfelera `curretTempThermostat` tretirati kao verzioniranje, ne tiho uklanjanje legacy polja.
- Kako provjeriti: HTTP/JWT + izolovana DB, dva korisnikova uređaja s različitim temperaturama i stranica bez događaja; potvrditi svaki red, status, broj queryja i zaštitu drugog korisnika; contract test za stare i nove nazive.
- Trud: S/M — Zavisnosti: ugovor snapshot/live i frontend/mobile klijenti.

### [B-020] Satni dashboard bucket spaja iste sate različitih dana — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (kod i fake DB); UTICAJ ZAVISI OD UGOVORA
- Gdje: `backend/src/modules/Dashboard/dashboard.service.ts:320-340,436-441`; summary i stats dashboard.
- Šta nije u redu i zašto: za `hour` ključ je samo `HH:00`, bez datuma, te događaji u 10:00 na više dana postaju jedan bucket. Ovo može biti namjerni prosječni profil po satu dana; ako je ugovor vremenska serija, spaja nepovezane periode. Summary dnevni ključ koristi server-local `getFullYear/getMonth/getDate`, a stats dnevni `toISOString` (UTC), što može različito grupisati oko ponoći; ponašanje produkcijske vremenske zone nije provjereno.
- Dokaz: `node scripts/audit/dashboard_repro.cjs` u UTC, stvarni servis/fake DB, dva događaja u 10:00 različitih dana daju po jedan bucket s dva ciklusa i za stats i za summary. Nema HTTP/guarda ni realne baze. Različite zone i DST nisu reproducirani u ovoj skripti.
- Preporuka: potvrditi je li cilj hronološka serija ili profil sata dana; za seriju koristiti timezone-aware ključ s datumom i UTC instantom ili offsetom koji razlikuje DST ponovljeni sat; za profil eksplicitno označiti agregaciju i zonu. Ujednačiti dnevnu semantiku uz verzioniranje odgovora.
- Kako provjeriti: dva dana isti sat, lokalna/UTC ponoć, proljetni nedostajući i jesenji ponovljeni sat u IANA zoni, prazna/no-data grupa; uporediti stats, summary i export kroz HTTP/DB integraciju.
- Trud: M — Zavisnosti: ugovor grafova, timezone korisnika i kompatibilnost.

### [B-021] Seed i reset su destruktivni bez potvrde identiteta ciljne baze — Ozbiljnost: VISOKO — Pouzdanost: VERIFIKOVANO (izvor), utjecaj zavisi od konfiguracije
- Gdje: `backend/package.json:24-26`, `backend/prisma/seed.ts:1-39`.
- Šta nije u redu i zašto: `npm run db:seed` učitava env, sastavlja vezu iz `DATABASE_*` varijabli i bez provjere identiteta hosta/baze ili režima započinje niz `deleteMany()` nad korisnicima i drugim podacima; `db:reset` koristi `prisma migrate reset --force`. Ne postoji vidljiva potvrda/test-only guard prije brisanja. Stvarni uspjeh brisanja zavisi od kredencijala, sheme i referencijalnih ograničenja; ako greška prekine niz, ranije operacije mogu već biti izvršene jer prikazani niz nije obavijen zajedničkom transakcijom. `seed.ts:351,353` dodatno sadrži console output koji spominje testnu lozinku; audit ne prikazuje sadržaj.
- Dokaz: statički redoslijed i konfiguracija na navedenim linijama; skripte **nisu pokrenute**. Branch-only CI koristi privremeni PostgreSQL i `prisma migrate deploy` (`.github/workflows/backend-audit.yml:54-68`), ne pokreće seed/reset u prikazanom koraku.
- Preporuka: nikada ne izvršavati postojeći reset/seed na stvarnim bazama; odvojiti nedestruktivan seed od test-only reset alata, koristiti nezavisnu efemernu bazu i ograničene vjerodajnice koje nemaju pristup produkciji, provjeru odobrenog DSN/hosta/baze i eksplicitnu interaktivnu potvrdu ili CI-only test marker. Sam `NODE_ENV` ili naziv baze nisu dovoljna zaštita. Ukloniti ispis lozinki i generisati jednokratne vrijednosti samo za izolovane testove. Prije bilo koje destruktivne operacije osigurati i probno obnoviti backup.
- Kako provjeriti: test mock/izolovanog env-a bez konekcije da odbija realne/nepoznate ciljeve prije svake DB akcije; samo disposable DB sa test-only ulogom prolazi, dvije odvojene baze dokazuju da druga ostaje netaknuta, error injection i restore test; bez ispisa kredencijala. Automatizaciju reset/seed provoditi tek poslije zasebnog odobrenja.
- Trud: M — Zavisnosti: deploy vlasnik, izolacija baze/credentials i backup/restore procedura.

### [B-022] Stari timer cachea briše novu fallback vrijednost istog ključa — Ozbiljnost: SREDNJE potencijalno — Pouzdanost: VERIFIKOVANO (izolovani servis), HIPOTEZA (runtime uticaj)
- Gdje: `backend/src/common/fallback-strategy.service.ts:43-99,175-183`; testovi `backend/src/common/tests/fallback-strategy.service.spec.ts:112-136,196-225`.
- Šta nije u redu i zašto: svaki upis zakazuje bezuslovni `delete(key)` bez otkazivanja prethodnog timera ili provjere verzije. Nakon drugog upisa prvi timer može izbrisati još svježu zamjensku vrijednost; `getTuyaFallback` bez cachea i last-known vrijednosti vraća zadani broj 60 °C. Ta brojka nije potvrđena kao sigurna za određeni kotao i ne treba je primjenjivati kao komandu.
- Dokaz: `node scripts/audit/fallback_ttl_repro.cjs` izvršava stvarni servis s lažnim satom: vrijednosti upisane u 0. i 5. minuti, obje s TTL 10 min; u 10. minuti stariji timer briše vrijednost staru 5 minuta, pa se vraća 60. Statička pretraga `backend/src` našla je pozive tri fallback metode samo u njihovoj deklaraciji i testovima; **stvarni aktivni runtime caller, utjecaj na produkciju i fizička primjena nisu potvrđeni**. Postojeći testovi pokrivaju istek jednog upisa, ne osvježavanje istog ključa prije isteka.
- Preporuka: vezati timer za verziju zapisa ili poništiti prethodni timer; dodatno provjeravati `expiresAt` pri čitanju i ograničiti broj timera, te označiti default kao nepoznat/degradiran umjesto pretpostavljene fizičke sigurnosti. Prije bilo kakvog povezivanja fallbacka s engineom definisati stručne sigurnosne granice.
- Kako provjeriti: lažni sat: ponovni upis prije starog isteka, različiti TTL-ovi, clear i ponovni upis, tačna granica isteka i opterećenje mnogo ključeva; zatim potvrditi integracijske caller putanje ili dokumentovati da nema korisnika. `cd backend && npm test -- --runInBand` nakon dodavanja regresije.
- Trud: S/M — Zavisnosti: životni vijek servisa, policy fallbacka, sigurnost i potencijalni budući caller.
