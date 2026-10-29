# Plan implementacije backenda — radna verzija

## Sažetak: pet prioriteta

1. Najprije vlasništvo notifikacija i anomalija, throttler i ograničavanje masovnog testnog endpointa (`04-findings.md` B-006/B-007/B-009/B-010, `07-redis-workers.md` R-004).
2. Za weather najprije osigurati ispravan identitet lokacije i zadržavanje stale podataka, potom razdvojiti stari i novi ugovor (`05-weather.md`).
3. Formule prvo replay i shadow, bez komandi i bez promjene prikazane preporuke, uz stručnu potvrdu ograničenja (`06-formulas.md`).
4. Redis/worker tek nakon DB idempotentnosti, outboxa i kontrolisanog isključivog cutovera (`07-redis-workers.md`).
5. Svaki korak je mala povratljiva promjena na aktivnoj grani; zeleni testovi i eksplicitni kriteriji potrebni su prije napredovanja. **Ovaj plan nije odobrenje za aplikacijske izmjene.**

## Otvorena pitanja

- Koji su dogovoreni statusi starih klijenata, minimalna podržana mobile verzija i rollout prozor? Nije rađen frontend/mobile audit.
- Produkcijska shema i historija migracija nisu upoređene; ručni CI baseline na praznoj bazi nije dokaz produkcijske usklađenosti. Potreban odobren read-only pregled, backup i probni restore.
- Odluka o pravilnoj rate-limit politici, step-up autorizaciji, uvjetima providera, zoni/koordinatama, fizičkim granicama i SLA-u ostaje vlasniku/stručnjaku.
- Potpuna API/DTO/IDOR, DevOps i formula analiza nisu gotove. Plan se mora dopuniti kad se ti nalazi potvrde i **nije konačan**.

## Zajednička pravila svakog koraka

- Test-first: prvo regresijski test koji demonstrira poznato ponašanje, zatim mala promjena i dokaz prolaza. `CI` ovdje znači postojeći `.github/workflows/backend-audit.yml` na aktivnoj grani `arena/94541967-boiler-control`, sa izolovanim PostgreSQL/Redis servisima, bez `pull_request`/`main` triggera. Sadašnji CI pokriva lint, type-check, build, 167 općih i 49 integracijskih testova koji se preklapaju (run `40865068767` na ranijem commitu); noviji lokalni audit commitovi nisu pushani niti je za njih pokrenut CI. Redis ping nije aplikacijski integration test, `NODE_ENV=test` isključuje postojeće cronove i throttler, pa su potrebni posebni testovi.
- Obavezne komande: `cd backend && npx eslint 'src/**/*.ts' 'test/**/*.ts' --ignore-pattern 'src/generated/**'` (bez `--fix`), `npx tsc --noEmit --incremental false --declaration false --types node,jest`, `npm run build`, `npm test -- --runInBand` i `npm run test:integration` uz izolovanu DB. Za specifične integracije koristiti servise iz CI ili odobrenu izolovanu okolinu. Nikada ne pokretati postojeći `npm run db:reset` ili `npm run db:seed` nad stvarnom bazom: oba su destruktivna, seed bez provjere cilja (B-021). Za testnu DB najprije dodati i odobriti sigurnosne barijere i izolovanu test-only ulogu.
- **Prihvat za sve korake:** navedeni ciljani testovi, obavezne komande i branch-only CI zeleni, testni podaci bez tajni, starim klijentima održan ugovor ili odobren verzionirani prelaz, ažuriran dokaz u auditu. Nijedan korak ne podrazumijeva spajanje u `main`, PR, push bez korisničkog zahtjeva ili automatske komande kotlu.
- Migracije: prvo porediti stvarnu shemu u odobrenom read-only pristupu, backup i restore provjera. Expand-only kada je moguće; povrat aplikacije na staro ponašanje prije povratne migracije. Skidanje stupaca/podataka, rollback s gubitkom podataka i `migrate reset` nad produkcijom zabranjeni; destruktivni contract tek zaseban odobren korak nakon rollback prozora.
- Flagovi navedeni dolje su prijedlog, ne postojeće funkcije. Ako korak nema flag, rollback je revert/deploy prethodne kompatibilne verzije; sigurnosna zaštita ne smije biti ugašena običnim korisničkim flagom. Troškovi S/M/L su gruba relativna procjena.

## Talas 0 — hitna sigurnost i higijena

### 0.0 Incident: provjera i rotacija mogućih tajni (SEC-0)
- **Cilj/fajlovi:** `backend/.env`, `backend/.dockerignore`, praćeni backend testni logovi (S-008), deployment secret manager i incident evidencija. Vlasnik povjerljivo provjerava jesu li postojeća polja ili kandidati u logovima stvarni i aktivni; vrijednosti se ne bilježe. Prije koda koordinisati revokaciju/rotaciju DB, JWT, Tuya i drugih stvarno korištenih ključeva i sesija, uz plan kontinuiteta.
- **Migracija/rollback, flag:** nema DB schema migracije ni flag-a; rotirani kompromitovani ključ ne vraćati kao rollback. Najprije omogućiti novi secret manager i test pristupa, zatim deaktivirati stari prema provider proceduri. Čišćenje Git historije/image cache samo odvojeno i uz odobrenje; HEAD uklanjanje nije brisanje historije.
- **Testovi:** izolovani testni canary potvrđuje da `.env` nije u build kontekstu i logovima, provjeriti DB/Tuya rad i JWT tranziciju bez prikazivanja vrijednosti, provjeriti da stari aktivni kredencijali više ne rade; zajednički CI. **Skripte:** postojeći siguran `scripts/audit/ci_diagnostics.cjs --help`, planirani `scripts/smoke.sh --help`, `scripts/test-all.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** L; dogovoriti način i vrijeme isteka prethodnih sesija kod postojećih mobile klijenata, vlasnik/provider/operacije moraju odobriti i provesti rotaciju. Ovaj korak ne predstavlja odobrenje za promjene ili korištenje kredencijala.

### 0.1 Notifikacije: vlasništvo (SEC-1)
- **Cilj/fajlovi:** `backend/src/modules/Notification/notifications.controller.ts`, `notifications.service.ts`, novi integracijski spec; atomski ograničiti update na korisnika i ID.
- **Migracija/rollback, flag:** DB migracija nije potrebna; bez flag-a. Revert je tehnički moguć, ali vraća sigurnosni problem, zato privremeno isključiti rutu/rubni pristup po odobrenoj politici umjesto izlaganja ranjive verzije.
- **Testovi:** korisnici A/B, A→A uspjeh, A→B odbijeno i bez promjene/podataka, nepostojeći ID isti odgovor, bez tokena 401; `npm run test:integration` uz servise i zajedničke provjere. **Skripte:** postojeći CI, budući `scripts/test-all.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** S; stari klijent s vlastitim ID-om radi, uskladiti odgovor za tuđi/nepostojeći; nema druge aplikacijske zavisnosti. Prihvat uključuje zajednička pravila.

### 0.2 Anomaly owner, zatim DTO (SEC-2)
- **Cilj/fajlovi:** `HeatingAnomalyCheckerService/heating.anomaly.checker.controller.ts`, `heating.anomayl.checker.service.ts`, `dto/heating-anomaly.dto.ts`; prvo atomski owner scope i test, tek zatim validacija datuma/booleana. HTTP iskoristivost prethodnog stanja nije potvrđena.
- **Migracija/rollback, flag:** bez DB migracije; bez flag-a za owner provjeru. Pri rollbacku validatora zadržati owner zaštitu; ako to nije moguće, isključiti rutu.
- **Testovi:** A/B anomalije, vremenske granice, malformed/extra i prazan body, anonimni, ponovljena potvrda, nema recommendation side effecta za tuđi ID; `npm run test:integration`. **Skripte:** `node scripts/audit/anomaly_ownership_repro.cjs`, `node scripts/audit/anomaly_validation_repro.cjs` prikazuju staro ponašanje i nakon popravke moraju biti prilagođene, ne koristiti stare assertione kao dokaz novog.
- **Prihvat/trud/kompatibilnost/zavisnosti:** M; stari request oblik zadržati gdje je siguran; zavisi od 0.1 samo po redoslijedu prioriteta; owner provjera prije DTO promjene.

### 0.3 Throttle i testni gas endpoint (SEC-3)
- **Cilj/fajlovi:** `backend/src/app.module.ts`, `Notification/notifications.controller.ts`, auth/test config; dogovoriti window i klijentski IP, popraviti ms, zabraniti masovni testni endpoint ili striktno ovlastiti admina.
- **Migracija/rollback, flag:** bez DB migracije; no security bypass flag. Rollback najprije zamijeniti rubnim odobrenim zaštitama i verifikovati legitimni pristup.
- **Testovi:** HTTP test s uključenim stvarnim guardom (ne `NODE_ENV=test` konfiguracija koja ga isključuje), 101 zahtjev unutar odobrenog prozora i istek, obični/admin/anonimni korisnik i mock push da nema poziva; komanda budućeg namjenskog speca plus zajednički CI. **Skripte:** `node scripts/audit/throttle_repro.cjs` reprodukuje sadašnji default storage, poslije promjene provjeriti novi HTTP test; `scripts/test-all.sh --help` planiran.
- **Prihvat/trud/kompatibilnost/zavisnosti:** M; zaštita ne blokira normalan saobraćaj, administrativna putanja ima dogovoreni odgovor. Zavisi od politike i proxy konfiguracije, ne od Redis migracije.

### 0.4 Auth/session i privatni monitoring (SEC-4, SEC-6)
- **Cilj/fajlovi:** `Auth/auth.module.ts`, `jwt-auth.guard.ts`, `User/dto/update-user.dto.ts`, `user.service.ts`, `common/metrics.controller.ts`, deployment monitoring nakon pregleda; step-up za promjenu lozinke, aktivnost/revokacija, mrežna zaštita metrika i PII labele.
- **Migracija/rollback, flag:** eventualna additive `sessionVersion`/session tabela, unaprijed testirana i bez rušenja starih tokena; rollback starog čitanja zadržava novu kolonu, ne briše sessije. Operativni flag za postepeno uvođenje sesija ne smije ugasiti owner zaštitu.
- **Testovi:** token prije/poslije promjene lozinke i deaktivacije, nevažeći credentials, old-client tranzicija, scraper radi iz dozvoljene mreže i nije dostupan nedozvoljenom; zajednički CI. **Skripte:** `scripts/smoke.sh --help` (planiran), `scripts/test-all.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** L; odluka o isteku starih sesija i najava klijentima; zavisi od auth politike i konfiguracije monitoringa.

### 0.5 Sigurnosne nadogradnje zavisnosti (SEC-7)
- **Cilj/fajlovi:** `backend/package.json`, `backend/package-lock.json`, testovi upload/proxy/Tuya i potencijalno `backend/Dockerfile`. S-007: prvo provjeriti advisory preduvjete i backend image/production deploy; grupisati kompatibilne zakrpe u odvojene male promjene i ponovo procijeniti tranzitivni graf, bez automatskog `npm audit fix --force`.
- **Migracija/rollback, flag:** same bibliotečke nadogradnje ne zahtijevaju schema migraciju ni flag; Prisma promjenu izdvojiti i testirati migracije na praznoj i reprezentativnoj izolovanoj kopiji uz backup/restore proceduru. Rollback na prethodni image/lockfile nosi poznate advisories i prihvata se samo kao vremenski ograničen incidentni korak s odobrenom rubnom zaštitom.
- **Testovi:** version-resolved `npm ls`, ponovljeni `npm audit --omit=dev --json` s redigovanim sažetkom, test multipart limita/abort-a, proxy/trusted subnet i auth throttling, Tuya HTTP ugovor, generisanje Prisma klijenta/migracija na privremenoj DB te zajednički lint/type-check/build/unit/integration CI. **Skripte:** postojeća `node scripts/audit/npm_audit_summary.cjs --help` i `node scripts/audit/upload_validation_repro.cjs --help`; CI branch-only workflow.
- **Prihvat/trud/kompatibilnost/zavisnosti:** M/L; poznati relevantni advisories zakrpljeni ili dokumentovano prihvaćeni s rokom, testovi zeleni, stare API/mobile integracije nepromijenjene. Zavisnosti: owner proxy/deploya, upgrade matrica i licence; prisustvo MySQL tranzitiva ne dokazuje da se koristi.

## Talas 1 — weather

### 1.1 Location expand i potvrđivanje (FEAT-1)
- **Cilj/fajlovi:** `prisma/schema.prisma`, nova migracija, `HomeProfile` DTO/service i weather geocoder; nullable koordinate, IANA tz, status potvrde i izbor među kandidatima.
- **Migracija/rollback, flag:** additive nullable kolone/indeksi nakon schema-diff/backup; `WEATHER_LOCATION_V2` default off. Rollback ugasi čitanje novih polja, sačuvaj ih; bez automatskog brisanja.
- **Testovi:** dvosmislen grad, dvije lokacije istog imena, tuđi profil, invalid koordinate/tz i staro polje location; `npm run test:integration`. **Skripte:** `scripts/record-weather-fixtures.ts --help` i `scripts/dev-up.sh --help` planirane, audit `node scripts/audit/weather_repro.cjs`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** L; stara mobile ruta i tekst se ne mijenjaju, nema automatske potvrde backfilla. Prije aktivacije odluka vlasnika o provideru.

### 1.2 Weather adapter i cache sigurnost (REL-1)
- **Cilj/fajlovi:** `Weather/weather.service.ts`, `weather-http.adapter.ts`, nova provider/normalization komponenta; ispravni vremenski instanti i jedinice, 72 h/7 dana, SWR, last-good ispravne lokacije, abort i metrike.
- **Migracija/rollback, flag:** po potrebi additive forecast tablice i indeksi; `WEATHER_SWR_ENABLED` default off; rollback odabire staru stabilnu verziju ili unavailable bez tuđeg grada, čuva novu shemu.
- **Testovi:** snimljeni DST fixture/realna SDK semantika, sati/0/null, timeout/abort, concurrent refresh, stale/miss/expired i dvije lokacije; `npm test -- --runInBand` i integration. **Skripte:** `scripts/record-weather-fixtures.ts --help`, postojeća `weather_repro.cjs` (očekivanja promijeniti nakon popravke).
- **Prihvat/trud/kompatibilnost/zavisnosti:** L; legacy shape stabilan/kontrakt test, nova meta u verzioniranom DTO; 1.1, provider/licenca i odobreni fixture.

### 1.3 Verzija API i routing potrošača (API-1/API-2)
- **Cilj/fajlovi:** `Weather/weather.controller.ts`, Boiler, Dashboard, Recommendation, Poll i OpenAPI; svi zahtjevi nose pravi profil, nova verzionirana ruta, stubovi se ne uklanjaju bez plana.
- **Migracija/rollback, flag:** ako se traži snapshot tabela expand-only; `WEATHER_V1_READ` default off; rollback vrati dogovoreni legacy contract bez globalnog tuđeg cache fallbacka.
- **Testovi:** dva korisnika/gradovi, 0 °C, nepovezani profil, no-data i greška; contract za staru i novu rutu; integration i zajednički CI. **Skripte:** planirani `scripts/smoke.sh --help`, `scripts/test-all.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** L; stari mobile klijenti ostaju na starom obliku do eksplicitnog roka; zavisi od 1.1–1.2 i consumer odluke.

## Talas 2 — formule u shadow modu

### 2.1 Replay, units i podaci bez promjene izlaza
- **Cilj/fajlovi:** `Heating/engine`, `Heating/strategies`, test fixtures i predloženi `scripts/backtest-formulas.ts`; dogovor m/cm, snapshot inputa/izvora i offline baseline/candidate.
- **Migracija/rollback, flag:** additive tabela snapshot/quality samo uz odobren retention; `FORMULA_SHADOW_ENABLED` default off. Rollback ugasi shadow i zadrži podatke u prozoru.
- **Testovi:** golden ±epsilon na −15/10, monotonicnost, finite/NaN, 0/null, dvije visine, overshoot i izolovani replay bez budućih podataka; `npm test -- --runInBand` i integration. **Skripte:** `node scripts/audit/formula_table.cjs --json`, `python3 scripts/audit/backtest_sketch.py --demo`, budući `scripts/backtest-formulas.ts --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** L; nijedna korisniku vidljiva preporuka ni uređaj nisu promijenjeni; zavisi od 1.3, odobrenih anonymiziranih podataka, stručne validacije.

### 2.2 Učenje i stručna kalibracija
- **Cilj/fajlovi:** `HeatingRecommendation/heating.recommendation.service.ts`, `Heating/strategies/full.strategy.ts`, nova shadow verzija; popraviti prvi interval, idempotentne uzorke, confidence, porijeklo signala i post-event stanje (FORM-1, F-005/F-006), a smjer tek nakon definisanja semantike.
- **Migracija/rollback, flag:** additive stabilni sample/event key i eventualna tabela modela; `LEARNING_V2_SHADOW` default off. Rollback isključi novo računanje, ostavi podatke; stare i nove statistike ne miješati.
- **Testovi:** prvi uzorak, duplikat, dva konkurentna eventa, varijansa, početna/završna/vršna temperatura, promjena cilja, odsutni/stale snapshot, post-event stanje preporuke, brz/spor/overshoot sign, minimalni sample, drift/outlier; izolovani DB integration. **Skripte:** `scripts/backtest-formulas.ts --help`, postojeća `backtest_sketch.py --demo` i `node scripts/audit/learning_end_repro.cjs --help` (reprodukuje stari tok).
- **Prihvat/trud/kompatibilnost/zavisnosti:** L; samo paralelno računanje, stari response ne mijenjati; zavisi od 2.1 i stručne potvrde.

## Talas 3 — Redis i worker

### 3.1 DB idempotency i outbox
- **Cilj/fajlovi:** Prisma schema/migracije, polling i notification servisi; unique poslovni ključevi, atomsko preuzimanje, transakcijski outbox. Ne dodavati unique constraint prije pregleda postojećih duplikata.
- **Migracija/rollback, flag:** expand, backfill s izvještajem i validate, pa indeks; `OUTBOX_WRITE_ENABLED` kontrolisan. U rollbacku isključiti proizvođač/dispatcher i zadržati outbox, ne izgubiti neriješene evente.
- **Testovi:** konkurentni start, crash poslije commita prije ack, dva korisnika, ponovljeni outbox; `npm run test:integration`. **Skripte:** `scripts/dev-up.sh --help`, `scripts/db-reset-seed.sh --help` samo uz sigurnosne barijere, `scripts/test-all.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** L; nema izmjene API odgovora; zavisi od DB diff/backup i definicije poslovnih ključeva.

### 3.2 Worker, Redis i strangler migracija

- **Dopuna R-007:** prije migracije izmjeriti trajanje i procijeniti privremeni lokalni `waitForCompletion` samo uz freshness alarm i test preskočenih tickova. `node scripts/audit/poll_overlap_repro.cjs` potvrđuje trenutno preklapanje ručnih tickova; budući testovi moraju obuhvatiti duži stvarni rad i dvije instance. Lokalni flag/guard nije zamjena za DB ključ iz 3.1. Rollback isključuje guard uz pojačan nadzor, ne dopušta dvostruki executor; nema DB migracije ni promjene HTTP ugovora za samu instrumentaciju. Prihvat: test potvrdi dogovoreno nepreklapanje unutar instance i otkrivanje stale snapshot-a, zasebno dokazani međuinstancijski gate i zeleni testovi. Trud S/M za lokalno, L za distribuirano; zavisi od budžeta svježine i 3.1.
- **Cilj/fajlovi:** predloženi `backend/src/worker.ts`, `WorkerModule`, `docker-compose.yml`, queue providers i cron registracija; fan-out per device, granice, retry/DLQ i graceful shutdown.
- **Migracija/rollback, flag:** nad 3.1; `WORKER_ENABLED`, `LEGACY_SCHEDULER_ENABLED`, početno samo shadow. Prije aktivnih jobova dokazati da oba puta poštuju isti DB gate; inače ekskluzivno ugasiti stari scheduler i dovršiti in-flight. Rollback zaustavlja novi executor, reconcile outbox, tek onda eventualno pali legacy; bez paralelnih side effecta.
- **Testovi:** dvije API i dvije worker instance, lease expiry/fencing, Redis restart/outage, DB restart, kill -9, per-account rate i DLQ replay; `npm run test:integration` s Redis klijentom, ne samo ping. **Skripte:** `scripts/dev-up.sh --help`, `scripts/smoke.sh --help`, `scripts/test-all.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** L; HTTP DTO ostaje nepromijenjen, stale stanje eksplicitno; zavisi od 3.1 i Redis TLS/ACL/RPO odluke.

### 3.3 Push receipt i kontrolisani cache

- **Dopuna REL-6 / R-006:** najprije usaglasiti semantiku `isActive` i identitet instalacije, te ponašanje logouta i više uređaja. Test-first dvije instalacije iste platforme, inactive, reaktivacija, transfer, istovremene registracije i globalni unique token u privremenoj PostgreSQL bazi, uz fake Expo; `node scripts/audit/push_registration_repro.cjs` pokazuje sadašnje ponašanje. Expand migracija samo po odobrenju, prije uvođenja novog unique ključa analizirati duplikate bez ispisa tokena; kompatibilni legacy endpoint i flag za novu registraciju. Rollback ugasi novi put uz očuvanje redova i mapiranja, bez brisanja aktivnih tokena; tek nakon provjere stare verzije klijenata. Prihvat: testirane dvije instalacije, odobreni lifecycle i zeleni unit/integration/CI; trud M/L, zavisi od politike vlasnika i migracije.
- **Cilj/fajlovi:** `ExpoPush/expo.push.notification.service.ts`, Notification, queue i Weather/Tuya cache moduli; ticket/receipt, state `unknown`, bounded retry, zaseban cache Redis bez queue eviction.
- **Migracija/rollback, flag:** additive delivery/outbox state; `PUSH_QUEUE_ENABLED`, `WEATHER_SWR_ENABLED` off do testova. Rollback obustavi dispatcher uz očuvanje neisporučenih redova; nema garancije exactly-once prema provideru.
- **Testovi:** fake provider djelimični neuspjeh, ambiguous timeout, invalid token, TTL/cache tenant isolation i queue outage; integration. **Skripte:** `scripts/dev-up.sh --help`, `scripts/test-all.sh --help`, `scripts/smoke.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** L; zadržati postojeći prikaz kroz mapping statusa; zavisi od 3.1–3.2 i Expo pravila.

## Talas 4 — eventualno prebacivanje formula

### 4.1 Canary samo po odobrenju stručnjaka
- **Cilj/fajlovi:** `Heating/engine`, servis preporuka, feature flag komponenta; odobreni kandidat prvo prikazivati maloj grupi kao preporuku, bez slanja komandi.
- **Migracija/rollback, flag:** nikakvo destruktivno mijenjanje historije; `FORMULA_V2_DISPLAY` default off po kohorti. Rollback momentalno isključuje prikaz novog modela, čuva shadow/version evidence; ne vraća nesigurne fizičke komande.
- **Testovi:** granice proizvođača i emiter tipa, missing model/profile, feature flag, monotonicnost, realni backtest, odobreni canary i alert threshold, stari client; unit/integration i branch CI. **Skripte:** `scripts/backtest-formulas.ts --help`, `scripts/smoke.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** L; odobrene granice/safety review, neškodljiv shadow, prethodno definisani metrics i korisničko odobrenje, zavisi 2.1–2.2 i kvalitet weather-a. Bez ovih dokaza korak je BLOKIRAN.

## Talas 5 — ostalo

### 5.0 Gas unos, referenca i vremenski redoslijed (FEAT-7)
- **Cilj/fajlovi:** `backend/src/modules/Gas/dto/create-gas-reading.dto.ts`, `update-gas-reference.dto.ts`, `gas.reading.service.ts`, integracijski testovi i po potrebi Prisma migracija. Uskladiti strogo parsiranje broja i booleana, rukovanje historijskim očitanjima i odluku o `markAsReference` (B-015–B-018).
- **Migracija/rollback, flag:** DTO dio može bez schema migracije, uz verzioniran ugovor; jedinstveni dan samo poslije revizije duplikata, politike UTC/lokalni dan i additive backfilla. Planirati unaprijed `GAS_STRICT_VALIDATION_ENABLED` (ne postoji), rollback pisanja ugovora bez odbacivanja podataka, reverzibilne migracije i backup; ne uključivati staro ponašanje tiho kao sigurnosnu zaštitu.
- **Testovi:** prvo negativni HTTP testovi boolean/string `false`, nepoznati boolean, nedostaje/prazno/null/negativno i decimalno brojilo; stvarna izolovana DB testira vremenske susjede, dva konkurentna upisa, DST i postojeće duplikate. `cd backend && npm run test:integration`. **Skripte:** sadašnja offline `node scripts/audit/gas_validation_repro.cjs --help`; planirane `scripts/test-all.sh --help`, `scripts/db-reset-seed.sh --help` (ne postoje).
- **Prihvat/trud/kompatibilnost/zavisnosti:** M/L, stari klijenti moraju imati dokumentovanu tranziciju; zavisi od poslovnog dogovora o historiji, resetu brojila i timezoneu. Offline audit reprodukcija pokazuje sadašnju grešku i namjerno će pasti nakon njenog ispravljanja: ažurirati je uz dokaz novog ponašanja.

### 5.1 Gas preciznost, retention i privatni fajlovi
- **Cilj/fajlovi:** `Gas/gas.reading.service.ts`, `common/file-storage.service.ts`, Prisma schema i account delete/export; Decimal/mjerna politika, content signature, politika brisanja i file reconciliation.
- **Migracija/rollback, flag:** additive decimal kolone, dual-read/write i validiran backfill; `GAS_DECIMAL_ENABLED` off. Rollback na staro čitanje uz zadržane nove kolone/fajlove; destructive cleanup tek nakon provjere backupa i retention politike.
- **Testovi:** golden cijene/PDV na promjeni tarife, brojilo rollover/out-of-order, tuđi fajl i lažni MIME, djelimični failure i restore; integration i contract. **Skripte:** `scripts/db-reset-seed.sh --help`, `scripts/test-all.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** L; stari JSON broj/ugovor ili verzionirani prelaz, zavisi tarife, pravna odluka i podaci.

### 5.1b Identitet boiler historije (FEAT-4 / B-024)
- **Cilj/fajlovi:** `backend/prisma/schema.prisma`, polling end/start i analitički čitaoci; definisati da li više uređaja dijele jedan kotao, te dodati eksplicitni identitet ciklusa prije ciljanog zatvaranja. Bez promjene komandi uređaja.
- **Migracija/rollback, flag:** nullable expand za eksplicitnu vezu; prethodno backup, izolovana schema provjera, statistički pregled i kontrolisan backfill isključivo nedvosmislenih redova, ostale označiti nepoznatim. `HISTORY_EVENT_LINK_ENABLED` default off; dual-write s provjerom, ali bez dvostrukog zatvaranja. Rollback gasi novi put i zadržava vezu/podatke; legacy zatvaranje samo nakon dogovorene procjene rizika B-024 i nadzora, bez automatskog brisanja redova.
- **Testovi:** najprije dva istovremena eventa istog korisnika na različitim uređajima, nepoznat i odsutan start, drugi korisnik, idempotentni end, eventualno zajednički kotao i konkurentni end; zatim migration/rollback/replay u izolovanom PostgreSQL-u i `cd backend && npm run test:integration`. **Skripte:** postojeća `node scripts/audit/history_close_repro.cjs --help` pokazuje sadašnji tok s fake DB; planirane `scripts/dev-up.sh --help` i `scripts/test-all.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** M/L; zatvaranje tačno odgovara odobrenoj semantici i ne dira tuđe/nepovezane redove, nerešene stare veze ostaju označene, CI zelen; očuvati stari response oblik za instalirane klijente. Zavisno od modela kotla/uređaja, DB backupa i provjerenog expand/contract plana.

### 5.1a Dashboard stanje i vremenski bucket (FEAT-8)
- **Cilj/fajlovi:** `backend/src/modules/Dashboard/dashboard.service.ts`, dashboard DTO/controller i contract/integracijski testovi. Mapirati trenutno stanje po uređaju i preskočiti secondary lookup kad nema redova; dogovoriti jesu li satne grupe hronološke ili profil sata dana i timezone (B-019/B-020).
- **Migracija/rollback, flag:** schema migracija nije nužna; novi ugovor u verzioniranom API-ju ili predloženi `DASHBOARD_BUCKET_V2_ENABLED` (ne postoji), ne ukloniti stari `curretTempThermostat` bez pregleda potrošača. Rollback je na prethodnu verziju čitanja, uz jasno dokumentovan poznati problem pogrešnog uređaja.
- **Testovi:** dva uređaja različitih vlasnika i dva vlastita uređaja s različitim temperaturama, nula rezultata, datumi preko ponoći, dva dana isti sat i oba DST prelaza; HTTP + izolovani PostgreSQL, `cd backend && npm run test:integration`. **Skripte:** postojeća `node scripts/audit/dashboard_repro.cjs --help` je reprodukcija stare greške i zahtijeva ažuriranje pri popravci; `scripts/test-all.sh` je planiran, ne postoji.
- **Prihvat/trud/kompatibilnost/zavisnosti:** M, svaki događaj prikazuje stanje svojeg uređaja, query ima owner scope, novi bucket ugovor je dokazan s DST; zadržati legacy polja dok ne budu poznati web/mobile potrošači.

### 5.2 OpenAPI, health i održavanje

- **Dopuna OBS-1 / B-023:** prije izmjene metrika inventarisati postojeće scrape/dashboards; instrumentirati per-device ishode agregatno, ne kao ID label, te zasebno freshness posljednjeg valjanog snapshot-a. Zadržati kompatibilne stare metrike tokom tranzicije uz jasno značenje. Test-first: dva neuspješna uređaja, miješani uspjeh/greška, skip, bez snapshot-a, prazna lista i greška listanja; `node scripts/audit/poll_metrics_repro.cjs` je audit dokaz postojećeg ponašanja, a budući regresijski Jest test potvrđuje novi ugovor (`cd backend && npm test -- --runInBand`). Prihvatanje: nijedan neuspjeh nije prikazan kao uspješna obrada i ostali uređaji nastavljaju; cijeli CI zelen. Trud S/M; bez migracije DB; rollback na staru instrumentaciju uz privremeni alert za stale podatke, ne obustavljati polling. Klijentski HTTP ugovor se ne mijenja.
- **Cilj/fajlovi:** `backend/src/main.ts`, DTO/kontroleri, `common/health.controller.ts`, Dockerfile/Compose; versionirani `/api/v1`, publicirani OpenAPI kao izvor tipova, liveness/readiness, odvojena migracija/deploy.
- **Migracija/rollback, flag:** eventualna schema samo u odvojenom commitu; `API_V1_ENABLED` off i zaseban readiness rollout. Rollback ugasi novu rutu/readiness, stari API ostaje do definisanog roka.
- **Testovi:** spec diff, legacy/mobile contract fixture, DB outage razlikuje alive/not-ready, Docker smoke; integration i branch CI. **Skripte:** `scripts/smoke.sh --help`, `scripts/test-all.sh --help`.
- **Prihvat/trud/kompatibilnost/zavisnosti:** L; stari klijenti zadržavaju podršku, vlasnik odobrava rok deprecijacije; zavisi od kompletne API matrice i deployment inventara.

## Katalog pomoćnih skripti

**Postojeće audit skripte su read-only, osim privremenih runtime podataka u memoriji. Planirane skripte ne postoje i komande su njihove buduće specifikacije, ne tvrdnja da rade.** Sve nove skripte moraju imati `--help`, determinističke exit kodove, bez ugrađenih ili ispisanih tajni, te jasno označene ulaze/izlaze. Destruktivne radnje samo u eksplicitno izolovanom testnom okruženju uz višestruku potvrdu i provjeru cilja.

| Skripta | Status, svrha, ulaz → izlaz i sigurnost | Način / korak |
|---|---|---|
| `scripts/audit/backend_inventory.py` | Postoji; Git fajlovi i dokumentni markeri → pokrivenost markera, ne semantička potpunost. | `python3 scripts/audit/backend_inventory.py --help`; sve faze audita. |
| `scripts/audit/weather_repro.cjs` | Postoji; sintetički provider/DB → postojeći weather rezultat, offline. | `node scripts/audit/weather_repro.cjs --help`; 1.2. |
| `scripts/audit/formula_table.cjs` | Postoji; sintetički motor input → tabela/JSON, bez uređaja. | `node scripts/audit/formula_table.cjs --help`; 2.1. |
| `scripts/audit/backtest_sketch.py` | Postoji; demo ili eksplicitni JSON → agregati poravnanja, nije potpuni backtest. | `python3 scripts/audit/backtest_sketch.py --help`; 2.1–2.2. |
| `scripts/audit/throttle_repro.cjs`, `anomaly_ownership_repro.cjs`, `anomaly_validation_repro.cjs` | Postoje; sintetički storage/servis/DTO → reprodukcija prethodnih grešaka, ne produkcijski HTTP test. | `node scripts/audit/<ime>.cjs --help`; 0.2–0.3. |
| `scripts/audit/http_security_repro.cjs`, `http_postgres_repro.cjs` | Postoje; sintetički HTTP/JWT, prva fake DB, druga CI-only privremeni PostgreSQL i rollback; oba reproduciraju postojeći propust, ne provjeravaju popravak. | `node scripts/audit/http_security_repro.cjs --help`; `node scripts/audit/http_postgres_repro.cjs --help`; 0.1–0.3. |
| `scripts/audit/gas_validation_repro.cjs`, `dashboard_repro.cjs`, `reminder_delivery_repro.cjs`, `upload_validation_repro.cjs` | Postoje; izolovani sintetički DTO/servisi/storage; prethodne greške i ograničenja navedeni u audit dokumentima. | `node scripts/audit/<ime>.cjs --help`; 3.3, 5.0–5.1a. |
| `scripts/audit/engine_replay.cjs`, `openmeteo_fixture_replay.cjs` | Postoje; ograničeni postojeći-engine replay i javni SDK fixture, nisu puni backtest ni provjera sunrise/DST. | `node scripts/audit/engine_replay.cjs --help`; `node scripts/audit/openmeteo_fixture_replay.cjs --help`; 1.2 i 2.1. |
| `scripts/audit/redis_lease_ci.cjs` | Postoji; CI-only primitivi na disposable Redis servisu; ne testira aplikacijski worker/BullMQ. | `node scripts/audit/redis_lease_ci.cjs --help`; 3.1–3.2. |
| `scripts/audit/history_close_repro.cjs` | Postoji; pravi poll end handler i sintetička fake DB, bez DB transakcija ili stvarnih događaja. | `node scripts/audit/history_close_repro.cjs --help`; 5.1b. |
| `scripts/audit/learning_end_repro.cjs` | Postoji; pravi poll end handler, preporuka i engine, sintetička fake DB/push; bez uređaja. | `node scripts/audit/learning_end_repro.cjs --help`; 2.2. |
| `scripts/audit/poll_metrics_repro.cjs`, `poll_overlap_repro.cjs`, `push_registration_repro.cjs` | Postoje; offline fake DB/push/scheduler reprodukcije, bez stvarne dostave ili produkcije. | `node scripts/audit/poll_metrics_repro.cjs --help`, `node scripts/audit/poll_overlap_repro.cjs --help`, `node scripts/audit/push_registration_repro.cjs --help`; 3.2–3.3, 5.2. |
| `scripts/audit/cron_registration_repro.cjs` | Postoji; sintetička Nest topologija sa stvarnim gas scheduler providerom, lažnom bazom i jednim ručnim tickom; ne testira produkciju ili više replika. | `node scripts/audit/cron_registration_repro.cjs --help`; 3.2–3.3. |
| `scripts/audit/fallback_ttl_repro.cjs` | Postoji; fallback servis s lažnim satom, pokazuje preuranjeno brisanje osvježenog ključa. Nema dokazanog runtime callera. | `node scripts/audit/fallback_ttl_repro.cjs --help`; 3.3. |
| `scripts/audit/auth_session_repro.cjs` | Postoji; lokalni HTTP s fake DB i stvarnim JWT/auth servisima pokazuje postojeće ponašanje sesija, ne popravak. | `node scripts/audit/auth_session_repro.cjs --help`; 0.4. |
| `scripts/audit/npm_audit_summary.cjs` | Postoji; siguran sažetak postojećeg `npm audit` JSON-a, ne mijenja pakete. | `node scripts/audit/npm_audit_summary.cjs --help`; 0.5. |
| `scripts/audit/module_graph.py` | Postoji; statički graf importova i direktnih Prisma markera, bez dinamičkog DI. | `python3 scripts/audit/module_graph.py --help`; inventar i samoprovjera. |
| `scripts/test-all.sh` | PLAN: nepopravljajući lint, type-check, build, test i audit izvještaj; bez izvora/tajni u izvještaju; izlazni kod !=0 na padu. | `scripts/test-all.sh --help`; svaki korak. |
| `scripts/dev-up.sh` | PLAN: pokrenuti isključivo namjenske test PostgreSQL/Redis servise sa izolovanim prefiksom/profilom; idempotentno, ispis statusa bez URL credentiala. | `scripts/dev-up.sh --help`; 1.1, 3.1–3.3. |
| `scripts/db-reset-seed.sh` | PLAN (ne omotavati postojeći destruktivni seed bez stvarne DB izolacije i zaštita B-021): samo eksplicitno test DB, allowlist imena/hosta, potvrda i odbijanje production/proizvoljne baze; seed sintetički i repeatable; izlaz sa brojevima, ne vrijednostima. | `scripts/db-reset-seed.sh --help`; 3.1, 5.1. Ne izvoditi na produkciji. |
| `scripts/record-weather-fixtures.ts` | PLAN: eksplicitno odobren provider call ili offline fixture, anonimizacija koordinata/tajni i pregled licence; izlaz verzionirani fixture bez PII. | `scripts/record-weather-fixtures.ts --help`; 1.1–1.2. |
| `scripts/backtest-formulas.ts` | PLAN: verzionirani/anonimni input snapshot ili seed → golden diff, kvalitet ulaza i metrike bez ID-a; nikad komande uređaju. | `scripts/backtest-formulas.ts --help`; 2.1–2.2, 4.1. |
| `scripts/smoke.sh` | PLAN: eksplicitna test base URL/okruženje i sintetički korisnik → status i contract rezultat, bez produkcijskog slanja push/komandi. | `scripts/smoke.sh --help`; 0.4, 1.3, 3.2–4.1, 5.2. |

## Registar rizika i rollout/rollback

| Rizik | Vjerovatnoća/uticaj | Kontrola i rollback |
|---|---|---|
| Dupla obrada ili push u cutoveru | **HIPOTEZA:** zavisi od broja replika; visok uticaj. | Zajednički DB gate ili ekskluzivni cutover, transactional outbox, incident runbook i kontrolisani drain; nikad pretpostaviti da Redis lock štiti legacy koji ga ne koristi. |
| Pogrešna lokacija/raspon temperature | **VERIFIKOVANO:** postoje globalni cache upiti i neusaglašene granice (B-008, F-001); realni ishod nepoznat. | Verzija lokacije i quality, shadow, stručna verifikacija, nezavisne hard zaštite, bez komandi; ugasiti flag i zadržati dokaz. |
| Prekid starih mobile verzija | **HIPOTEZA:** zavisi od postojećih consumer ugovora. | Contract fixtures, paralelne rute i objavljen rok podrške; revert adaptera bez brisanja podataka. |
| Pogrešna produkcijska migracija ili rollback | **VERIFIKOVANO:** CI baseline nije potvrđen kao produkcijski (`03-data-model.md`). | Read-only schema diff, backup i restore drill, expand/backfill/validate, nema reset/bez destruktivnog rollbacka. |
| Redis ili provider outage | **HIPOTEZA:** učestalost nepoznata. | Outbox u DB, bounded stale/age i odlaganje side effecta, noeviction queue, alert/restore; rollback na isključivi executor. |
| Tokeni/tajni podaci u logovima/fixtureima | **HIPOTEZA:** stvarni rizik curenja treba sigurnosnu procjenu; token se obrađuje u `Tuya/tuya.auth.service.ts`. | Synthetic fixtures, sanitizacija, private storage/ACL, rotacija po incident proceduri bez ispisivanja vrijednosti. |

**Status:** svi koraci su prijedlog i čekaju dovršetak Faze 1, odluke vlasnika i odobrenje za implementaciju. Ne tvrditi da su predložene skripte, flagovi, migracije ili testovi već implementirani.
