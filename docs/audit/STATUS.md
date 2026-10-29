# Status audita

## Sažetak i otvorena pitanja

- Aktivna grana provjerena komandom `git branch --show-current`: `arena/94541967-boiler-control`.
- Faza 1 **nije završena**; faze 2–4 nisu započete.
- Korak čišćenja je završen uz konzervativno zadržane kandidate: pedeset šest zastarjelih izvještaja uklonjeno je nakon pregleda i provjere referenci; navedeni su u `00-cleanup-log.md`. Spisak kandidata i moguće reference su početni snimak u `cleanup-candidates.tsv`.
- Korisnik je odobrio iznimku za uklanjanje ili ispravku linkova u zadržanim dokumentima. Link na uklonjeni `backend/P2B_IMPLEMENTATION.md` uklonjen je iz `backend/README.md`. `.github/copilot-instructions.md` referencira `docs/P2E_README.md`; preostale reference treba ručno provjeriti prije odluke o brisanju.
- Otvoreno: treba li `P2E_README.md` zadržati kao README uprkos prefiksu P2? Spisak je konzervativni skup kandidata, ne naredba za brisanje.

## Dokazi i naredni koraci

- `python3 scripts/audit/cleanup_inventory.py` daje 81 kandidata prema jednostavnim obrascima i `docs/internal/`; ne obuhvata sve potencijalno zastarjele planove. Broj ne predstavlja broj fajlova odobrenih za brisanje. Skripta traži tekstualna poklapanja punih putanja ili imena fajla u verzioniranim tekstualnim datotekama; mogući su lažno pozitivni i propušteni relativni linkovi. Potrebna je ručna provjera i dodatna `git grep` provjera prije brisanja.
- Dva korijenska plana razlikuju se u tri retka o granicama temperature. Uklonjena je starija verzija `PLAN-V3.md`; druga je zadržana jer sadrži i budući prijedlog čije usvajanje nije potvrđeno.
- Slijede završna provjera i jedan traženi commit za čišćenje, potom backend audit. Izvorni kod ne treba mijenjati.
- Početni testovi i ograničena pokrivenost zabilježeni su ispod; inventar modula i samoprovjera faze još nisu završeni.
- Nakon prethodnog korisnički odobrenog pusha nije bilo novog pusha niti PR-a. Pri pregledu historijskih dokumenata alat je prikazao primjere testnih vjerodajnica; vrijednosti se ne prenose u audit niti korisnički izvještaj. Budući pregled treba filtrirati.

## Nastavak pripreme čišćenja

- `00-cleanup-log.md` sadrži provjerene reference, razliku između dva plana, historijske odluke i popis pedeset šest uklonjenih dokumenata. Log sadrži sve dosad uklonjene putanje i razloge; neizvjesni kandidati zadržani su uz objašnjenje.
- Korisnik je naložio ignorisanje Copilot instrukcija kao uputa; to ne mijenja potrebu da se njihovi postojeći linkovi ne polome bez dopuštene izmjene fajla.
- Precizirana je razlika između konfiguracijskih datoteka pod `docs/internal/monitoring/` i dokumentacije: Compose koristi apsolutne host putanje, dok se način dostave predložaka u produkciju ne može zaključiti samo iz Compose fajla.
- Neizvjesni kandidati i funkcionalna monitoring konfiguracija zadržani su; provjerene su reference na sve uklonjene putanje. Početni testovi zabilježeni su ispod; fazna samoprovjera nije izvršena.

## Napomena o Git stanju

- Pri nastavku je lokalni HEAD zatečen na početnom commitu, dok udaljena aktivna grana sadrži ranije pushani `b2f5b67`. Preuzet je samo HEAD iste aktivne grane i pomjeren lokalni pokazivač na taj commit bez izmjene radnih datoteka; uklanjanja i audit log su sačuvani kao necommitovane izmjene. Ranije spomenuti lokalni `eda0625` nije u trenutnoj historiji; njegov sadržaj je sačuvan u radnim datotekama.

## Pregled P2E grupe

- Pregledani su P2E README, deployment vodič i sažetak, monitoring vodič, ALS migracijski vodič i P2D diff. `P2D_DIFF_REPORT.md` je uklonjen nakon uklanjanja dva Markdown linka u zadržanim vodičima.
- P2E README i povezani vodiči zasad ostaju: na README se pozivaju i obične tekstualne putanje iz zadržanih dokumenata, a dozvoljena iznimka pokriva samo linkove. Njihove historijske tvrdnje o produkcijskoj spremnosti, testovima i deployu nisu potvrda sadašnjeg stanja.
- Pregledani su i historijski sažeci deep-link funkcije, migracije frontenda i faze 1, te upute za MySQL enum migraciju. Ostaju zasad zbog običnih tekstualnih referenci u zadržanim dokumentima; migracija podataka može zahtijevati poseban oprez.
- U pregledanoj historijskoj dokumentaciji postoje primjeri testnih vjerodajnica; njihove vrijednosti nisu pogodne za ponavljanje, a lokacije i vrstu treba uključiti u sigurnosni audit uz provjeru aktuelnosti i historije.

## Backend audit — početni rezultati testova (nezavršeno)

- Korak čišćenja lokalno je commitovan kao `7197a03` (`docs: remove obsolete documentation`); nije pushan. Zadržani kandidati i ograničenja opisani su u cleanup logu.
- Node v22.22.3, npm 10.9.8; `npm ci --ignore-scripts --no-audit --no-fund` u `backend/` je uspio (898 paketa). Instalacijske skripte su namjerno preskočene.
- `npm run generate:prisma`, uz privremeni testni URL usmjeren na lokalnu nepostojeću bazu, nije uspio: preuzimanje Prisma schema engine-a s `binaries.prisma.sh` blokirano je mrežnim ograničenjem. Generisani `backend/src/generated/prisma/client` nedostaje. `backend/.env.test` ne postoji; nije korištena produkcijska baza.
- `npm test -- --runInBand --coverage` (uz `NODE_ENV=test` i privremeni lokalni testni URL): Jest je prijavio 2 uspjele i 8 neuspjelih suiteova, 71 uspješan i 2 neuspjela testa od 73 izvršena. Šest suiteova se nije pokrenulo zbog nedostajućeg Prisma klijenta. Jedan pad je `src/common/tests/reporting.service.spec.ts:191` (očekivani score <50, dobijeno 60.8333); drugi je `FallbackStrategyService Integration: Sensor failure scenario should fallback to safe default when cache expired` u `src/common/tests/fallback-strategy.service.spec.ts`. Proces se nije sam ugasio nakon Jest izvještaja zbog otvorenih asinkronih resursa, pa je zaustavljen. Uz `--forceExit` ponovljeno su prijavljeni isti brojevi i exit 1; to ne dokazuje da su testovi stabilni.
- Iz djelimične instrumentacije: statements 9,46%, branches 6,74%, functions 10,36%; ovi procenti nisu pouzdana pokrivenost kompletne aplikacije jer se šest suiteova nije učitalo. Generisani izvještaj uklonjen je iz radnog stabla.
- `npm run test:integration` s istom izolovanom testnom konfiguracijom: exit 1, 2 suitea nisu učitana zbog nedostajućeg Prisma klijenta, 0 izvršenih testova. Nije izvršen stvarni test integracije s PostgreSQL-om. Neophodno je ponoviti u okruženju sa schema engine-om i izolovanom testnom bazom.
- Testovi nisu popravljani. Faza 1 nije završena: inventar, API katalog, tematske analize, ostatak testiranja i samoprovjera tek slijede.

## Privremena GitHub infrastruktura za testiranje

- Po izričitom odobrenju korisnika dodan je `.github/workflows/backend-audit.yml` kao uska iznimka izvan prvobitnog opsega audita. Pokreće se samo na push ove aktivne grane; `workflow_dispatch` job dodatno provjerava istu granu (GitHub zahtijeva workflow i na podrazumijevanoj grani za ručno pokretanje). Ne koristi `pull_request` niti push prema `main`.
- Svako pokretanje dobija jednokratne PostgreSQL 16 i Redis 7 servise; podaci nestaju nakon joba. Testni PostgreSQL koristi `trust` isključivo unutar privremenog GitHub runnera; testne vrijednosti se generišu tokom joba i maskiraju. Ne koristiti ovaj obrazac u produkciji. Migracija se primjenjuje samo na praznu testnu bazu.
- Workflow generiše Prisma klijent, primjenjuje postojeću migraciju, provjerava Redis te pokreće postojeće testove i integracijske testove; Redis nije dokaz da ga aplikacija koristi. Nijedan rezultat GitHub pokretanja nije potvrđen dok se ne pregledaju stvarni logovi i status.
- Aplikacija u produkciji nije dokaz prolaznosti testova niti zamjenjuje nedovršene isporuke audita. Faza 1 ostaje nezavršena; nedostaju backend inventar, analize, planovi i samoprovjera.
- GitHub pokretanje [40856400715](https://github.com/mudzy992/boiler-control/actions/runs/40856400715), commit `1a3dc83`: servisi su inicijalizovani, instalacija, generisanje Prisma klijenta, migracija testne baze i provjera Redis-a prošli su; koraci postojećih testova i integracijskih testova su pali (exit 1). Pojedinačni rezultati i uzroci na GitHubu nisu još potvrđeni: preuzimanje punih logova iz ovog okruženja nije uspjelo zbog ograničenog pristupa hostu za GitHub Actions logove. Rezultate treba pregledati u GitHub sučelju, bez nagađanja uzroka.
- Naknadno je dodan `scripts/audit/jest_report.cjs` i workflow koristi Jest JSON rezultate za objavu brojeva i naziva neuspjelih testova kao GitHub anotacija. Sirove poruke grešaka i vrijednosti se ne objavljuju u anotacijama; neuspjeh testa i dalje daje neuspješan korak. Skripta je provjerena nad lokalnim JSON rezultatom (`node scripts/audit/jest_report.cjs --help` i `node scripts/audit/jest_report.cjs <rezultat>`). Pravi GitHub rezultat treba provjeriti nakon pusha.
- GitHub anotacije su potvrđene za [40858933946](https://github.com/mudzy992/boiler-control/actions/runs/40858933946): opći Jest korak prijavio je 3 uspješne i 7 neuspjelih suiteova, 81 uspješan i 2 neuspjela testa; pet suiteova nije izvršilo testove. Zasebni integracijski korak prijavio je 0 uspješnih i 2 neuspjela suitea, 15 uspješnih i 34 neuspjela testa. Anotacije navode imena, ali ne i detaljne uzroke: oni ostaju za analizu; CI ispravno ostaje neuspješan. Testovi nisu popravljani.

## Popravak CI-ja uz naknadno odobrenje

- Korisnik je odobrio potrebne izmjene backend koda i testova za popravak CI-ja; izričito nema PR-a ni mergea prema `main`.
- Lokalno je potvrđeno 32/32 testa u `fallback-strategy.service.spec.ts` i `reporting.service.spec.ts`: deterministički sat provjerava keš neposredno prije i poslije isteka, a ulazi za kritični rezultat odgovaraju postojećoj formuli.
- Ispravljeni su Jest alias `src/`, obavezni username u registracijskim fixtureima, putanje metrika u contract testovima i dva Tuya testa koja su prethodno mockirala metodu čije su metrike provjeravala.
- Posljednji provjereni GitHub run [40860848203](https://github.com/mudzy992/boiler-control/actions/runs/40860848203), commit `45bb434`: opći Jest korak 6 suiteova prošlo, 4 pala; 137 testova prošlo, 30 palo. Redis, Prisma generisanje i migracija testne baze su uspješni. Među neuspjelima su integracijski scenariji i dodatni Tuya testovi; njihovi uzroci još zahtijevaju provjeru. CI nije zelen i Faza 1 nije završena.
- GitHub run [40862982525](https://github.com/mudzy992/boiler-control/actions/runs/40862982525), commit `4e05963`: 10/10 Jest suiteova i 167/167 testova prošlo; zasebni integracijski korak 2/2 suitea i 49/49 testova prošlo (integracijski testovi su uključeni i u opći Jest broj). Izolovani direktorij za upload riješio je `EACCES` u CI okruženju. Popravljen je Tuya cache koji je keširani snapshot pogrešno tumačio kao sirovi status; regresijski test pokriva vrijednosti i istek od 5 sekundi.
- Testni workflow je naknadno proširen na lint bez `--fix`, provjeru tipova i build; treba pregledati novo pokretanje prije ocjene kompletnog CI-ja. Lokalni read-only lint prijavio je 123 greške i 2 upozorenja; ništa nije automatski popravljano.
- Nakon proširenja workflowa na lint, type-check i build, posljednje potvrđeno pokretanje [40864022853](https://github.com/mudzy992/boiler-control/actions/runs/40864022853), commit `e544bce`: Prisma, Redis, type-check, build i oba testna koraka prolaze (167/167 opći i 49/49 integracijski, uz preklapanje). CI ostaje crven zbog 69 ESLint grešaka; nakon automatskih formatnih ispravki ranijih 121. Lint ne pregledava generisani Prisma klijent i ne mijenja kod u CI-u. Nije uklanjano niti isključivano pokriće testova. Potrebno je pojedinačno riješiti preostale nalaze bez slabljenja pravila.
- **GitHub CI zelen:** [40865068767](https://github.com/mudzy992/boiler-control/actions/runs/40865068767), commit `e0dc116`. Lint: 0 grešaka (upozorenja nisu postavljena kao greške); type-check: 0 grešaka; build uspješan; opći Jest 10/10 suiteova i 167/167 testova, posebni integracijski korak 2/2 suitea i 49/49 testova (brojevi se preklapaju). PostgreSQL i Redis su privremeni GitHub servisi; Redis provjera ne znači da aplikacija koristi Redis. Workflow nije izvršio e2e ni analizu pokrivenosti svih zahtjeva projekta.
- Odobrene izmjene koda za CI uključuju ispravku Tuya snapshot cachea i lint popravke; Faza 1 audita ostaje nezavršena. Treba nastaviti inventarom backend modula, ruta i modela, a zatim ostalim obaveznim analizama, skriptama i samoprovjerom. Nije rađen PR ni merge prema `main`.

## Nastavak backend audita

- Kreirana je početna radna verzija `backend/01-inventory.md` i `backend/04-findings.md` s pet dokazima potkrijepljenih početnih nalaza; nijedan dokument još nije kompletan.
- Dodana je read-only `scripts/audit/backend_inventory.py` (`--help`, `--json`) za popis praćenih modula, common fajlova, deklariranih ruta/cronova i Prisma definicija te upoređivanje oznaka s audit dokumentima. Trenutna provjera: 16/16 modula i 14/14 common fajlova imaju red; 0/69 deklaracija ruta i 0/27 modela/enuma dokumentovano pomoću markera, exit 1 očekivan jer katalozi još nisu izrađeni. Marker ne dokazuje detaljnost opisa niti registraciju kontrolera.
- Primijećeno je pet cron deklaracija i duplikat jedninskog HomeProfile kontrolera; tri dekoratora duplikata ne znače da su aktivne dodatne rute. Nastaviti katalogom stvarno registriranih ruta, modelom podataka, pregledom koda, detaljima testne pokrivenosti i tematskim analizama.

### Nastavak: početni API katalog i model podataka

- Kreirani su radni `backend/02-api-catalog.md` (69 statičkih HTTP dekoratora, od čega 3 u duplikatnoj neregistrovanoj kopiji) i `backend/03-data-model.md` (15 modela i 12 enuma, indeksne hipoteze, relacije i oprez u vezi s migracijama). Ni ovi dokumenti nisu kompletni: DTO/validacija/vlasništvo/klijenti, produkcijska shema i mjerenja ostaju otvoreni.
- Dopunjeni `backend/04-findings.md`: B-006 tuđa notifikacija, B-007 neautorizirano pokretanje masovnih podsjetnika, B-008 upotreba globalno najnovijeg weather zapisa u historiji i preporukama. Nalazi su statički; produkcija nije testirana niti mijenjana.
- `python3 scripts/audit/backend_inventory.py` sada prijavljuje prisutne sve markere: 16/16 modula, 14/14 common fajlova, 69/69 ruta-dekoratora i 27/27 Prisma definicija. To nije dokaz da je sadržaj audita potpun, niti da je 69 ruta stvarno aktivno. `ima_marker` zamjenjuje prethodni dvosmisleni izraz `dokumentovano`.
- Nastaviti detaljnim mapiranjem DTO/vlasništva, punim auditom sigurnosti, weather/formula/Redis-worker analizama, planom i samoprovjerom prije završetka Faze 1.

### Weather analiza

- Dodan `backend/05-weather.md`: pregled protoka i stvarnih potrošača, pet početnih nalaza, vremensko mapiranje i cache, prijedlog lokacija i DTO-a, SWR/provider fallback, testna matrica, kompatibilnost i rollout/rollback. Analiza nije potvrđena stvarnim provider fixtureom niti produkcijskim podacima; komercijalni status i ugovor s Open-Meteom su otvoreni.
- Dodan `scripts/audit/weather_repro.cjs`: offline izvršava stvarni `WeatherService` uz sintetički SDK odgovor, fake bazu i isključen stvarni provider. `--help` i dva uzastopna pokretanja su prošli, deterministički JSON pokazuje pogrešan sat za `feelslike`, zadnji sat za vjetar, pomjeranje sintetičkog sunrise instanta i gubitak jedinog fake stale zapisa pri padu osvježavanja. Reprodukcija ne dokazuje semantiku stvarnog SDK sunrise polja.
- Utvrđeno da timeout/retry wrapper zaista obuhvata sirovi `fetch`, iako ne osigurava njegovo otkazivanje; weather-specifični brojači u `WeatherHttpAdapter.get` ne obuhvataju pozive koji idu direktno kroz `executeWithCircuitBreaker`. Marker provjera inventara i `git diff --check` prolaze; ne znače da su svi opisi završeni.
- Faza 1 ostaje otvorena: inventar/DTO/IDOR detalji, sigurnost, formule i backtest, Redis/worker, backlog, implementacijski plan, stvarni fixture i samoprovjera nisu završeni.

### Početna analiza formula i backtest skica

- Dodan radni `backend/06-formulas.md` s inventarom izraza i ograničenja, tabelom izvršenih scenarija, početnim nalazima F-001–F-004, kandidatnim dizajnom, sigurnosnim granicama koje zahtijevaju potvrdu proizvođača/stručnjaka i shadow/backtest planom. To nije potpuna analiza niti validirana formula za uređaj.
- Dodan `scripts/audit/formula_table.cjs`, offline izvršava stvarni `FlowTemperatureEngine` s 15 sintetičkih slučajeva i zamjenskim Prisma enumima; `--help` i dvije identične JSON izvedbe prošle, pet provjera očekivanih rezultata uspješno. Potvrđen skok finalne krivulje 48→46 na 10 °C i razlika direktnog unosa visine 2,5 naspram 250. Sva tri pregledana stvarna proizvođača ulaza ne prosljeđuju visinu, pa se produkcijski efekat jedinice ne tvrdi.
- Dodana skica `scripts/audit/backtest_sketch.py` s `--help`, sintetičkim `--demo` i čitanjem eksplicitno zadane JSON datoteke bez baze/mreže/upisa; dva identična demo izlaza i četiri rubne provjere prošli. Samo poravnava event/uređaj/historiju sa unaprijed dostavljenom predikcijom; nije puni backtest, ne izračunava motor, ne dokazuje ishod ili uštedu. Podaci iz produkcije nisu čitani.
- Uočeno da novi learning interval koristi dummy ID i `updateMany`, ne kreira red; zasebno su opisani razlika confidence-a i offseta i nedokazana semantika overshoot signala. Ostaju potpuni pregled formula i call siteova, stvarni/odobreni podaci, dodatne senzitivnosti, Redis/worker analiza, sigurnost, backlog/plan i samoprovjera.

### Redis/workeri i početak sigurnosnog audita

- Dodan `backend/07-redis-workers.md`: statički popis cronova, potvrđeno neatomarno polling provjeravanje, Expo send/receipt stanje, procesni cache, predloženi BullMQ fan-out, outbox i DB idempotency, TTL/lock/fencing, Redis outage politike, zasebni queue/cache, sigurnost konfiguracije, testni plan i konzervativan cutover/rollback. Sve su prijedlozi; Redis/worker nisu uvedeni u aplikaciju. Posebno je navedeno da paralelni legacy/new side-effecti nisu sigurni bez zajedničkog DB gatea.
- U R-004 potvrđeno da lokalno zaključani `@nestjs/throttler` 6.5.0 tumači `ttl: 60` kao 60 ms, suprotno komentaru u `backend/src/app.module.ts`; globalni guard se u `NODE_ENV=test` isključuje. `node scripts/audit/throttle_repro.cjs --help` i više determinističkih pokretanja prošli; reprodukcija koristi stvarni storage s fake satom, nije HTTP/produkcijski test. Prioritet je izolovani HTTP test s uključenim guardom, zatim usaglašena korekcija, uz proxy/rate-limit procjenu. Bez izmjene aplikacijskog koda.
- Dodan početni `backend/08-security.md`, uključuje prethodne IDOR/admin nalaze, TTL problem, izloženost metrika uslovljenu mrežom i interface DTO bez runtime metapodataka. Potpuni sigurnosni pregled, DTO/IDOR matrica, odobreni produkcijski fixture i puna samoprovjera još nisu gotovi. Marker provjera i `git diff --check` prolaze.

### API vlasništvo i anomaly reprodukcije

- `backend/02-api-catalog.md` dopunjen grupnim pregledom DTO/query ulaza i vlasništva nad resursima s referencama u kontroleru i servisu. Dio upita, polja, puni HTTP odgovori i potrošači još nisu provjereni; frontend/mobile faze nisu počete.
- B-009: servis za potvrdu anomalije ne prima korisnički ID niti filtrira vlasnika. `scripts/audit/anomaly_ownership_repro.cjs` stvarni servis pokreće uz lažnu bazu i demonstrira izmjenu bez caller konteksta; nema HTTP/JWT/produkcijskog poziva. Iskoristivost preko HTTP-a ostaje hipoteza.
- B-010: `UpdateHeatingAnomalyDto` nema validator dekoratore; `scripts/audit/anomaly_validation_repro.cjs` izvršava izolovani `ValidationPipe` s produkcijskim opcijama i stvarni DTO. Sintetička tijela `{confirm:true}`, `{}`, `null` i odsutno tijelo odbijena su 400 u ovoj verziji. Puni HTTP put nije provjeren. Potrebno je prvo popraviti autorizaciju B-009, prije uklanjanja validacijske prepreke.
- Sigurnosni audit dopunjen S-003 (profilni PUT prihvata novu lozinku bez potvrde stare, za razliku od namjenskog toka) i S-004 (guard ne provjerava `isActive`/verziju sesije; politika revokacije otvorena). Obje reprodukcijske skripte imaju `--help`, `node --check` i po dva identična uspješna pokretanja; backend testni suite nije ponovo pokretan, jer aplikacija nije mijenjana. Marker provjera i `git diff --check` prolaze.
- Faza 1 i dalje otvorena: potpuni API field-level i security pregled, realni weather fixture/backtest, Redis/worker provjera, dokumenti 09–10 i samoprovjera nisu završeni.

### Početni backlog i implementacijski plan

- Dodan radni `backend/09-improvements-backlog.md` s grupama sigurnosti/privatnosti, funkcionalnosti, performansi/pouzdanosti, API-ja i održavanja; stavke imaju problem/dokaz, prijedlog/korist, trud, rizik/zavisnosti i kriterije prihvatanja. Predložene koristi nisu izvršene izmjene niti odobrenje implementacije.
- Dodan radni `backend/10-implementation-plan.md`: talasi 0–5 i mali koraci sa test-first scenarijima, konkretnim mjestima, test komandama, planiranim/pstojećim skriptama, migracijama/rollbackom, flagovima, procjenama i kompatibilnošću. Sadrži registar rizika i uslov da legacy i novi worker ne rade paralelno bez zajedničkog DB gatea. Predložene skripte/flagovi označeni su kao nepostojeći. CI plan koristi postojeći branch-only workflow; zeleni run je za raniji commit, a Redis ping nije aplikacijski test.
- Izvršene sve dostupne offline reprodukcije weather/formula/throttle/anomaly i backtest demo te provjera inventarskih markera; sve izašle 0. Ovi testovi nisu zamjena za produkcijski fixture, HTTP ili novi backend CI. `git diff --check` prolazi; backend aplikacijski kod nije mijenjan u ovom nastavku.
- Faza 1 **nije završena**: potrebni su preostali detaljni sigurnosni i DevOps pregled, semantički potpuni inventar/test coverage i API field-level/IDOR pregled, stvarni weather fixture i puniji backtest prema dostupnosti/odobrenju, konsolidacija nalaza i samoprovjera. Prisutnost svih 10 dokumenata nije dokaz završetka.

### Sigurnost, DevOps i testni inventar

- U `backend/08-security.md` dodan S-005: Gitom praćen `backend/.env` s postavljenim osjetljivim poljima (zabilježeni samo putanja, linije i tipovi, bez vrijednosti). Autentičnost/aktivnost nije potvrđena. `backend/.dockerignore` ga eksplicitno ne isključuje, dok Dockerfile kopira dozvoljeni build kontekst u build stage. Preporuka vlasniku da provjeri i rotira stvarne aktivne kredencijale i sesije; izbacivanje iz HEAD-a samo po sebi ne čisti historiju/cache. Datoteka nije mijenjana niti su testirani stvarni kredencijali.
- B-011: Docker kontekst isključuje migracijski sadržaj osim locka; pokazani Dockerfile/Compose ne priključuju shell entrypoint niti izvršavaju migracije. Produkcijska procedura nije pregledana. B-012: neke integracijske asertacije su uslovne i stubovi mogu proći; B-013: lokalni `npm run test:e2e` exit 1 jer config ne postoji; B-014: neke catch grane prikazuju prazne podatke ili `success:false` umjesto jasne greške.
- `backend/01-inventory.md` dopunjen sa svih 10 testnih fajlova, njihovim direktnim okvirnim opsegom i prazninama; zeleni broj 167 i 49 se preklapa, uspješni coverage procenti i flaky stopa nisu potvrđeni. E2E pokušaj nije mijenjao aplikacijski kod niti je pozivao produkciju.
- Faza 1 ostaje otvorena: detaljni modul/API/field-level inventar, sigurnost/DevOps i potpuna samoprovjera još nisu završeni.

### DTO polja i gas ispravnost ulaza

- `backend/02-api-catalog.md` ima field-level tabelu za svih 18 `modules/*/dto/*.ts` fajlova, uključujući više Dashboard klasa, validatore, izostale granice i inline/interface ulaze. To je statički popis deklaracija, ne potpuni runtime contract; preostaju HTTP status/response i negativni testovi svih ruta te pregled sekundarnih upita.
- Nova offline reprodukcija `scripts/audit/gas_validation_repro.cjs` izvodi stvarni `ValidationPipe` sa `main.ts` opcijama i DTO-e; `false` kao string i nepoznati neprazni string postaju boolean `true`, dok JSON `false` ostaje `false` (B-015). Prazan string brojila prolazi kao 0 i `-1` kao -1; stvarni gas servis nad fake DB upiše sintetičko prvo negativno očitanje (B-016). Pri kasnijem očitanju 200, ranije 100 servis odbija sa 400 (B-017). Nema HTTP/guarda, stvarne DB ili provider poziva.
- B-018 dokumentuje neatomsku provjeru jednog očitanja po UTC danu i odsustvo dnevnog unique ključa u Prisma modelu; stvarni PostgreSQL race i produkcijska shema nisu potvrđeni. `06-formulas.md`, backlog i plan dopunjeni su zavisnostima domena/validacije. Nova skripta koristi fake DB i presreće samo učitavanje Prisma/storage saradnika; ne tvrditi da je persistencija stvarna.
- Faza 1 ostaje otvorena: potrebni su preostali runtime HTTP/ownership i DevOps/security pregled, stvarni provider fixture ili dokumentovan razlog nedostupnosti, detaljniji backtest i samoprovjera.

### Upload reprodukcija

- `scripts/audit/upload_validation_repro.cjs` koristi stvarni `FileStorageService` i samo sintetičke bajtove u novom privremenom direktoriju koji uklanja. Potvrđeno da se ne-PDF bajtovi čuvaju ako je deklarisani MIME PDF; neprihvatljivi MIME, prevelika deklarisana veličina i `../` putanja u izolovanim slučajevima odbijeni sa 400. Detalji/ograničenja S-006 u `backend/08-security.md`; nije pokrenut HTTP, guard, stvarna baza niti produkcijski storage, a stvarna iskoristivost i symlink prijetnja nisu dokazani.
