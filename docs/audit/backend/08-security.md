# Backend sigurnost — radna verzija

## Sažetak: pet početnih nalaza

1. **VISOKO, VERIFIKOVANO u izvoru:** označavanje pojedinačne notifikacije ne provjerava korisnika (B-006, `04-findings.md`).
2. **VISOKO, VERIFIKOVANO u izvoru:** testni endpoint za masovni gas podsjetnik nema provjeru administratorske uloge (B-007, `04-findings.md`).
3. **VISOKO, VERIFIKOVANO u izolovanom storageu:** TTL globalnog throttlera postavljen je na 60 ms umjesto komentarisane minute (R-004, `07-redis-workers.md`); testni CI isključuje guard.
4. **SREDNJE, VERIFIKOVANO u izvoru:** `GET /metrics` i njegove reporting varijante nemaju JWT guard na kontroleru (`backend/src/common/metrics.controller.ts:1-12,23-59`, `backend/src/common/common.module.ts:12`); vanjska mrežna zaštita nije provjerena. Osjetljivost sadržaja i realna izloženost zahtijevaju zaseban pregled.
5. **SREDNJE, VERIFIKOVANO u izvoru:** globalni `ValidationPipe` postoji (`backend/src/main.ts:28-38`), ali dio endpointa koristi inline ili interface body tipove, npr. `ManualNotificationDTO` interface (`backend/src/modules/Notification/notifications.controller.ts:18-24,45-49`); sama TypeScript interface definicija ne postoji kao runtime class-validator metapodatak. Stvarni HTTP odziv i svaka ruta nisu provjereni.

## Otvorena pitanja i ograničenja

- Ovaj dokument je **početna radna verzija, nije puni sigurnosni audit**. Nisu završeni pregled svih ruta/IDOR-a, JWT konfiguracije i lifecycle-a, CORS/proxyja, upload-a, dependency ranjivosti, logova, retencije, baza, CI permissions i deploy konfiguracije.
- Produkcija, njena WAF/proxy pravila, broj instanci, stvarni kredencijali, logovi i podaci nisu pregledani niti su slani testni zahtjevi produkciji. Ne tvrditi da je ruta javno izložena bez provjere infrastrukturne granice.
- Vrijednosti tajni se ne prikupljaju niti prikazuju. Kandidatne probleme i plan hitnog ublažavanja treba uskladiti s vlasnikom bez neodobrenog mijenjanja aplikacije.

## Prioritetni registar

**B-009 — VISOKO potencijalno, VERIFIKOVANO u servisu; HTTP iskoristivost HIPOTEZA:** `PATCH /api/anomalies/:eventId` ne predaje user ID servisu; servis ne provjerava vlasnika pri pretrazi ili izmjeni događaja. Izolovana offline reprodukcija stvarnog servisa s fake bazom: `node scripts/audit/anomaly_ownership_repro.cjs`. Odvojena reprodukcija pokazuje da globalni ValidationPipe odbija sintetička DTO tijela. Nije HTTP ni produkcijski test; vidjeti B-009 u [04-findings.md](04-findings.md).


Detaljni nalazi i test-first koraci su u [04-findings.md](04-findings.md) B-006 i B-007 te [07-redis-workers.md](07-redis-workers.md) R-004. Za prva dva potreban je izolovani multi-user integracijski test, za TTL test s uključenim guardom i kontrolisanim vremenom, uključujući odvojenu provjeru pouzdane proxy konfiguracije. Skripta `node scripts/audit/throttle_repro.cjs` reproducira samo lokalni storage i ne predstavlja test pune HTTP putanje ili produkcije.

### [S-001] Metrike bez deklarisanog JWT guarda — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (kod), HIPOTEZA (izloženost i uticaj)
- Gdje: `backend/src/common/metrics.controller.ts:1-12,23-59`, `backend/src/common/common.module.ts:10-13`, `backend/src/common/reporting.service.ts:450-459`.
- Šta nije u redu i zašto: metrika kontroler nema deklarisani JWT guard; reporting Prometheus izvoz sadrži identifikatore uređaja i korisnika. Mogućnost pristupa izvana zavisi od neprovjerenih mrežnih pravila i globalnih/infrastrukturnih zaštita.
- Dokaz: na kontroleru nema `@UseGuards(JwtAuthGuard)`; `CommonModule` ga registruje; reporting izvoz uključuje `deviceId` i `userId` kao labels. Globalni throttler nije autentifikacija.
- Preporuka: potvrditi da li endpoint mrežno dostupan, odvojiti privatni scrape port/mrežu, autentifikovati scraper i ukloniti osjetljive/high-cardinality labele; ne prekinuti postojeći monitoring bez plana i dogovora.
- Kako provjeriti: izolovani HTTP test iz nedozvoljene/dozvoljene mrežne perspektive, authentication i pregled sadržaja bez ispisivanja ličnih podataka; u deployment testu potvrditi da Prometheus i dalje radi.
- Trud: M — Zavisnosti: monitoring konfiguracija, infrastrukturna topologija i kompatibilnost scrape-a.

### [S-002] Interface nije runtime DTO validacija — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (tip u izvoru), HIPOTEZA (konkretan HTTP uticaj)
- Gdje: `backend/src/modules/Notification/notifications.controller.ts:18-24,45-49`, `backend/src/main.ts:28-38`.
- Šta nije u redu i zašto: `ManualNotificationDTO` je TypeScript interface bez validator-dekoratora; nestaje pri kompajliranju, tako da sama ova definicija ne daje klasnu runtime validaciju. Pogrešan oblik može doći do servisa; tačni statusi i krajnji efekti zahtijevaju HTTP test.
- Dokaz: kod deklarira `interface` i koristi ga u `@Body()`, dok globalni pipe zahtijeva runtime metapodatke za klasnu validaciju. Ne zaključuje se da svaki DTO u aplikaciji ima isti problem.
- Preporuka: inventarisati sve inline/interfejsne ulaze i prevesti u klasne DTO-ove s eksplicitnim granicama i dozvoljenim poljima; testirati kompatibilnost i primijeniti ograničenja sadržaja i broja slanja.
- Kako provjeriti: HTTP test s uključenim globalnim `ValidationPipe` za pogrešan enum, nedostajuće polje, neočekivano polje i predug tekst, te regresija valjanog poziva; `cd backend && npm run test:integration` nakon što testni bootstrap uključuje isti pipe kao produkcijski.
- Trud: M — Zavisnosti: potpuni katalog DTO-a i odobren API ugovor.

## Sljedeće

Dopuniti dokazima za svaki zahtjev, vlasništvo i odgovor, rizike upload-a i fajlova, token lifecycle i autentifikaciju, konfiguraciju deploy-a, dependency audit bez izlaganja tajni, testove autorizacije i prioritetni rollout/rollback. Ne proglašavati sigurnosni audit ili Fazu 1 završenim.

### [S-003] Zamjena lozinke kroz profil bez ponovne potvrde — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (kod)
- Gdje: `backend/src/modules/User/user.controller.ts:19-21`, `backend/src/modules/User/dto/update-user.dto.ts:40-44`, `backend/src/modules/User/user.service.ts:51-59,105-107`; zaštitni alternativni tok `backend/src/modules/Auth/auth.service.ts:136-168`.
- Šta nije u redu i zašto: autentifikovani korisnik može proslijediti novu lozinku kroz profilni PUT, gdje se hashira i sprema bez potvrde prethodne lozinke. Odvojena ruta za promjenu lozinke traži staru lozinku. Validan ukradeni token bi na ovaj način mogao omogućiti promjenu lozinke bez poznavanja stare; stvarni kompromis nije utvrđen.
- Dokaz: `UpdateUserDto.password` je dozvoljeno polje, `updateMe` nema argument niti provjeru stare lozinke. JWT guard provjerava potpis i postojanje korisnika (`backend/src/modules/Auth/jwt-auth.guard.ts:37-56`).
- Preporuka: objediniti promjenu lozinke iza potvrde trenutne lozinke ili drugog odobrenog step-up mehanizma, ukloniti ili verzionirati profilno polje uz tranziciju instaliranih klijenata. Potrebna je zasebna politika revokacije i sesija da promjena ne ostavi ukradeni token valjanim.
- Kako provjeriti: izolovani HTTP test za profilni update bez/sa lozinkom, tačnu/netačnu staru lozinku u namjenskoj ruti i ponašanje starih tokena prema odobrenom ugovoru; `cd backend && npm run test:integration` nakon dodavanja testova.
- Trud: M — Zavisnosti: autentifikacijska politika, klijentska kompatibilnost i plan revokacije.

### [S-004] Provjeravati aktivnost i revokaciju JWT sesija — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (izvor), HIPOTEZA (produkcijski rizik)
- Gdje: `backend/src/modules/Auth/auth.module.ts:10-13`, `backend/src/modules/Auth/auth.service.ts:165-176`, `backend/src/modules/Auth/jwt-auth.guard.ts:37-56`, `backend/prisma/schema.prisma:21`.
- Šta nije u redu i zašto: izdaju se tokeni s 24-satnim rokom; guard provjerava korisnikovo postojanje, ulogu i plan, ali ne učitava `isActive` niti verziju sesije. Prikazani postupak promjene lozinke ne mijenja sesijsku verziju. Potrebno je odrediti da li deaktivacija ili promjena lozinke trebaju opozvati postojeće tokene.
- Dokaz: `select` guarda i update u `AuthService` ne sadrže stanje sesije/aktivnosti; ovo ne isključuje eventualnu vanjsku zaštitu koju nismo pregledali.
- Preporuka: definisati sesijski model i politiku (isActive provjera, verzija tokena ili sesije, refresh rotation, opoziv pri osjetljivom događaju), kompatibilnost starih tokena i oporavak pri incidentu; tajne ne logovati.
- Kako provjeriti: izdati sintetički token, deaktivirati korisnika/promijeniti lozinku i provjeriti dopuštenje prema odobrenoj politici; izolovani PostgreSQL i JWT testovi bez produkcijskih kredencijala.
- Trud: M/L — Zavisnosti: politika sesija, mobilne/web verzije i migracija.

### [S-005] Praćena env datoteka s postavljenim osjetljivim poljima — Ozbiljnost: VISOKO — Pouzdanost: VERIFIKOVANO (postojanje i tipovi), HIPOTEZA (stvarna upotrebljivost)
- Gdje: Gitom praćena `backend/.env:24,31,34,36-37`; `backend/.dockerignore:14-18`, `backend/Dockerfile:34-35`. Vrijednosti nisu zapisane u audit.
- Šta nije u redu i zašto: praćena datoteka ima neprazna polja za DB lozinku, JWT tajnu, weather ključ i Tuya identifikator/tajnu; `backend/.dockerignore` ne isključuje baš `.env`, a Docker build radi `COPY . .` u build stage. Stvarna vrijednost može biti primjer ili aktivna vjerodajnica; autentičnost, povijesna izloženost i produkcijska upotreba nisu potvrđene. Pošto je datoteka praćena, treba tretirati moguće aktivne vrijednosti kao kompromitovane dok vlasnik ne provjeri.
- Dokaz: metadata-only pregled prijavljuje samo nazive polja, linije i da su vrijednosti postavljene; `git ls-files -- backend/.env` potvrđuje praćenje. Datoteka se pojavljuje u historiji najkasnije na početnom commitu ove sesije, ali potpuna historija svih grana i vanjski image/cache nisu pregledani. Build stage dobija cijeli dozvoljeni kontekst; nismo tvrdili da se `.env` kopira u završni image niti izvršili image build.
- Preporuka: vlasnik treba hitno utvrditi jesu li vrijednosti stvarne, rotirati/revokovati sve pogođene aktivne kredencijale i sesije prema provider postupku, zamijeniti ih secret manager referencama i provjeriti audit pristupa. Zatim odobrenom zasebnom promjenom ukloniti datoteku iz praćenja, isključiti `.env` iz Docker build konteksta i koristiti neosjetljiv primjer; uklanjanje iz HEAD-a ne uklanja historiju ili image cache. O eventualnoj sanaciji historije/imageova odlučuje vlasnik; ne izvoditi je automatski.
- Kako provjeriti: provjeravati samo lokacije/tipove i istek starih kredencijala bez ispisa vrijednosti; `git ls-files`, Docker context test s canary vrijednošću u izolovanom testnom env-u, CI secret scanning s redigovanim nalazima, test autentifikacije novim secret managerom i incident runbook. Prije rotacije odobriti plan kompatibilnosti korisničkih JWT sesija i operativnog pristupa bazi/Tuya servisu.
- Trud: M/L — Zavisnosti: vlasnik kredencijala, deploy/incident procedura, planirani downtime i provider dozvole.
