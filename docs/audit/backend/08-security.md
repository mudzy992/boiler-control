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
