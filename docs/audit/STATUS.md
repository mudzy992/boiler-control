# Status audita

## Sažetak i otvorena pitanja

- Aktivna grana provjerena komandom `git branch --show-current`: `arena/94541967-boiler-control`.
- Faza 1 **nije završena**; faze 2–4 nisu započete. Dokumenti i provjere navedeni su u nastavku; starije stavke su hronološki dnevnik, ne trenutni status.
- Korak čišćenja je završen uz konzervativno zadržane kandidate: pedeset šest zastarjelih izvještaja uklonjeno je nakon pregleda i provjere referenci; navedeni su u `00-cleanup-log.md`. Spisak kandidata i moguće reference su početni snimak u `cleanup-candidates.tsv`.
- Korisnik je odobrio iznimku za uklanjanje ili ispravku linkova u zadržanim dokumentima. Link na uklonjeni `backend/P2B_IMPLEMENTATION.md` uklonjen je iz `backend/README.md`. `.github/copilot-instructions.md` referencira `docs/P2E_README.md`; preostale reference treba ručno provjeriti prije odluke o brisanju.
- Otvoreno: treba li `P2E_README.md` zadržati kao README uprkos prefiksu P2? Spisak je konzervativni skup kandidata, ne naredba za brisanje.

## Historijski dnevnik pripreme (tvrdnje o "sljedećem koraku" ispod vrijede za vrijeme zapisa)

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
- Offline reprodukcija `scripts/audit/gas_validation_repro.cjs` izvodi stvarni `ValidationPipe` sa `main.ts` opcijama i DTO-e. **Ažurirana u FEAT-7**: prije toga asertirala je pogrešno ponašanje (dokaz za B-015/B-016/B-017), a sada asertira ispravljeno — string `false` daje `false`, nepoznati neprazni string/`0`/prazan/negativan unos daju 400, a historijski unos 100 pored kasnijeg 200 se prihvata jer je niz hronološki ispravan. Isti prolaz pod `GAS_STRICT_VALIDATION=off` dokazuje da rollback put vraća staro ponašanje. Nema HTTP/guarda, stvarne DB ili provider poziva.
- B-018 dokumentuje neatomsku provjeru jednog očitanja po UTC danu i odsustvo dnevnog unique ključa u Prisma modelu; stvarni PostgreSQL race i produkcijska shema nisu potvrđeni. `06-formulas.md`, backlog i plan dopunjeni su zavisnostima domena/validacije. Nova skripta koristi fake DB i presreće samo učitavanje Prisma/storage saradnika; ne tvrditi da je persistencija stvarna.
- Faza 1 ostaje otvorena: potrebni su preostali runtime HTTP/ownership i DevOps/security pregled, stvarni provider fixture ili dokumentovan razlog nedostupnosti, detaljniji backtest i samoprovjera.

### Upload reprodukcija

- `scripts/audit/upload_validation_repro.cjs` koristi stvarni `FileStorageService` i samo sintetičke bajtove u novom privremenom direktoriju koji uklanja. Potvrđeno da se ne-PDF bajtovi čuvaju ako je deklarisani MIME PDF; neprihvatljivi MIME, prevelika deklarisana veličina i `../` putanja u izolovanim slučajevima odbijeni sa 400. Detalji/ograničenja S-006 u `backend/08-security.md`; nije pokrenut HTTP, guard, stvarna baza niti produkcijski storage, a stvarna iskoristivost i symlink prijetnja nisu dokazani.

### Ponovna CI provjera audit grane

- Nakon pusha audit commitova do `c37c1de`, branch-only GitHub Actions [run 40873918268](https://github.com/mudzy992/boiler-control/actions/runs/40873918268) je uspješan: ESLint 0, TypeScript 0, build, 10 suiteova/167 općih testova i 2 suitea/49 integracijskih; dva skupa se preklapaju. Ovo potvrđuje taj commit, ne automatski buduće commitove. Brojčani coverage nije pročitan iz dostupnih anotacija; e2e skripta i dalje nema config, a ovaj CI run ne dokazuje stvarne providere, production deploy, rad aplikacije s Redisom ni produkcijski ownership.
- GitHub je prijavio upozorenje o runtime prelasku checkout/setup-node actiona s Node 20 na Node 24 i migraciji `ubuntu-latest` na Ubuntu 26; kompatibilnost pratiti u idućim CI runovima, bez tvrdnje da je sadašnja aplikacija migrirana na Node 24 (verziju aplikacijskog Nodea konfigurira workflow zasebno).

### Dashboard: sekundarni upit i bucket semantika

- `node scripts/audit/dashboard_repro.cjs` izvršava stvarni servis s fake DB i sintetičkim redovima. **Ažurirana u FEAT-8**: prije toga asertirala je pogrešno ponašanje (dokaz za B-019/B-020), a sada asertira ispravljeno — svaki događaj nosi temperaturu svog uređaja, tačno jedan vlasnički filtriran upit, prazna stranica bez lookupa — te uz `DASHBOARD_BUCKET_V2_ENABLED=on` dokazuje hronološke satne bucket-e. Legacy v1 semantika bucket-a ostaje zadana i skripta je također asertira. Ne dokazuje cross-user pristup niti ponašanje pravog Prisma klijenta.
- Isti test s dva različita dana u UTC pokazuje spajanje istog sata u jedan bucket u summary/stats (B-020). Je li riječ o grešci ili namjernom profilu sata dana zavisi od ugovora. Korištenje server-local datuma naspram UTC dodatno treba DST integracijski test.

### Ograničeni replay i destruktivni seed

- `node scripts/audit/engine_replay.cjs --demo` izvršava stvarni postojeći engine nad tri sintetička unaprijed poravnata snapshota, odbacuje jedan future timestamp; dva prihvaćena daju mean delta 0 i mean absolute delta 1 °C naspram sintetičkih baseline vrijednosti. Poseban sintetički `--input` test potvrdio je odbacivanje budućeg vremena i nedostajuće zone/provenance; izlaz su samo agregati. To nije puni backtest, ne provjerava stvarnu provenance, ne ocjenjuje kandidata, udobnost ili potrošnju i ne dokazuje sigurnost/uštedu.
- B-021: postojeći `npm run db:seed` koristi konfiguriranu DB i radi niz `deleteMany` bez vidljive zaštite cilja; `db:reset` je također destruktivan. Nije pokretan. Seed kod ima i console tekst s testnom lozinkom; vrijednost nije uključena u audit. Test/seed raditi samo nakon odobrenja sigurnog izolovanog alata, ne nad produkcijom.
- [CI run 40874183279](https://github.com/mudzy992/boiler-control/actions/runs/40874183279) za `1558937` uspješan; ne potvrđuje naknadne lokalne promjene niti vanjske providere.

### Javni upstream weather fixture

- Pronađen je i uz MIT licencu/porijeklo sačuvan javni Open-Meteo SDK FlatBuffers testni fixture (`scripts/audit/fixtures/`), ne privatni podatak niti svjež snimak iz produkcije. `node scripts/audit/openmeteo_fixture_replay.cjs` izvršava stvarni instalirani parser s offline stubom `fetch`, potvrđuje 2 odgovora i 168 satnih temperatura po odgovoru, prema upstream asercijama. Nema daily/sunrise/sunset sekcije, te W-002 stvarna sunrise semantika, puni response shape i DST test **ostaju otvoreni**. Sandbox ne dozvoljava direktni provider host; live API nije pozvan.

### Lokalni HTTP sigurnosni test s lažnom bazom

- `node scripts/audit/http_security_repro.cjs` pokreće lokalni Nest/Supertest app sa stvarnim `JwtAuthGuard`, stvarnim notification kontrolerom i servisom, stvarnim anomaly kontrolerom i pipeom iz `main.ts`, sintetičkim korisnicima i JWT potpisom te lažnom bazom. Nema produkcijskog pristupa, vanjske mreže ili stvarnog slanja.
- B-006 je podignut sa statičkog nalaza: neautentifikovan pristup vraća 401, sintetički korisnik A dobije 201 i promijeni fake notifikaciju vlasnika B. B-007: obični sintetički USER pozove fake masovni reminder i dobije 201, ali stvarni scheduler/Expo nisu pokrenuti. B-010: `PATCH` sa `{confirm:true}` dobije 400 prije poziva mock anomaly servisa. B-009 stvarna HTTP iskoristivost nije potvrđena; ne uklanjati DTO prepreku prije owner provjere.
- Ovaj izolovani app nije puni `AppModule`: ne provjerava stvarni PostgreSQL, globalni throttler, produkcijski proxy/WAF, konfiguraciju deploya, sve uloge ili sve inpute. Potrebni su zasebni multi-user PostgreSQL integracijski regresijski testovi.
- Pripremljen je dodatni `scripts/audit/http_postgres_repro.cjs --ci` za stvarni privremeni Actions PostgreSQL i stvarne Prisma upite, sa sintetičkim računima unutar transakcije koja se namjerno rollbackuje; eksplicitno odbija lokalni/nenamjenski poziv. U workflow je dodat branch-only korak. **Rezultat tek treba potvrditi u GitHub Actions**; sigurnosne provjere env-a nisu same po sebi dokaz izolacije bez servisne konfiguracije workflowa. Ovo je test trenutnog propusta, ne test da je propust popravljen.
- Actions [run 40876239114](https://github.com/mudzy992/boiler-control/actions/runs/40876239114) na `d5aa7e3` je uspješan: sintetički korisnik A preko stvarnog JWT guarda, kontrolera, servisa i Prisma upita mijenja B-ovu notifikaciju u privremenom PostgreSQL-u. Obični korisnik poziva mock reminder, bez stvarnog slanja. Transakcija se namjerno rollbackuje; puni AppModule/proxy i produkcija nisu testirani. Lint, type-check, build, 167 općih i 49 preklapajućih integracijskih testova također su zeleni.
- Prethodni runovi `40875573152` i `40875916363` pali su na bootstrapu nove audit provjere; drugi run prijavio je `TypeError` u `nest-bootstrap`; nakon zamjene Nest-injektovanog Prisma transaction proxya običnim objektom s realnim transakcijskim delegatima naredni run je prošao. Tačan mehanizam greške nije potvrđen. Nisu pali standardni testovi; Redis korak je preskočen po default uslovu nakon ranog pada. Naknadno je dodana eksplicitna provjera odsustva sintetičkih redova nakon rollbacka, čiji novi CI rezultat tek treba potvrditi.
- Naknadna provjera odsustva sintetičkih korisnika i notifikacije poslije rollbacka prošla je na [runu 40876565807](https://github.com/mudzy992/boiler-control/actions/runs/40876565807) za `db56ed5`; CI anotacija potvrđuje i reprodukciju B-006/B-007 i odsustvo testnih redova nakon rollbacka. Taj run je zelen i za lint, type-check, build te postojeće testove (167 općih, 49 preklapajućih integracijskih).

### Redis primitiv i izvještavanje podsjetnika

- `scripts/audit/reminder_delivery_repro.cjs` pokreće stvarni gas reminder i notification servis s fake bazom i pushom: masovni summary broji korisnika bez tokena kao poslanog, a pojedinačni test vraća uspjeh i uz isključenu preferencu; nula push poziva i DB upisa. Dokumentovano kao R-005; nema stvarnog slanja, HTTP-a ni produkcijskih podataka.
- Dodan CI-only `scripts/audit/redis_lease_ci.cjs` i korak u postojećem branch-only workflowu. Lokalno provjeren sintaksni check, help i očekivana zabrana izvršavanja izvan izolovanog CI-ja. Planirani test na privremenom Redis servisu provjerava dva konkurentna `SET NX PX`, deterministički prisilni istek, compare-delete starog vlasnika i mogućnost nepovezanog side effecta nakon gubitka leasea. Koristi samo slučajne testne ključeve i briše ih; nema FLUSHDB. **Rezultat tek treba potvrditi u Actions**. Ovo je provjera Redis primitiva, ne postojećeg aplikacijskog Redis klijenta/workera, queue, realnog TTL čekanja, failovera, fencing implementacije ili exactly-once.
- [Actions run 40877308896](https://github.com/mudzy992/boiler-control/actions/runs/40877308896) za `505233c` je uspješan. Audit primitiv test je stvarno izvršen na privremenom Redis 7: jedan konkurentni NX vlasnik, compare-delete štiti novog vlasnika, sintetička nepovezana radnja i dalje prolazi nakon prisilnog isteka. Ne dokazuje aplikacijski worker, prirodni TTL, failover ni exactly-once. PostgreSQL authorization reprodukcija, lint/type-check/build i 167 općih / 49 preklapajućih integracijskih testova takođe su prošli.
- Workflow je proširen Jest `json-summary` reporterom i `scripts/audit/coverage_summary.cjs`, koji anotira samo ukupne pokrivene/ukupne statements, branches, functions i lines, bez putanja i sirovih logova. Lokalni sintetički test parsera i sintaksni check su prošli; stvarne vrijednosti i uspješnost workflowa treba potvrditi u sljedećem GitHub runu. Dodavanje reportera ne dokazuje semantičku pokrivenost ni e2e i ne mijenja opseg testova.
- [Actions run 40877693950](https://github.com/mudzy992/boiler-control/actions/runs/40877693950) na `fda28d5` završio je uspješno (`gh run watch --exit-status` 0); korak testova s novim coverage summary reporterom i svi ostali prikazani koraci su prošli. Konkretni coverage procenti nisu dohvaćeni: GitHub API je pri preuzimanju anotacija vratio HTTP 403 **rate limit exceeded**, što nije autentifikacijska greška. Brojeve ne izmišljati; nakon obnove API kvote pročitati isključivo zbirnu `Jest coverage aggregate` anotaciju ili je vlasnik može pogledati u linkovanom runu. CI anotacija sadrži samo zbirne brojke, bez fajlova i sirovih logova.

### Zbirni coverage i preostala razgradnja

- GitHub API kvota ponovo je dostupna. [Run 40878022861](https://github.com/mudzy992/boiler-control/actions/runs/40878022861), commit `2b10b66`, završio je uspješno. Jest zbirno anotira **statements 3320/15150 (21,91%)**, **branches 1450/11311 (12,81%)**, **functions 700/3447 (20,30%)** i **lines 1431/2984 (47,95%)**. To je instrumentacija iz postojeće konfiguracije `backend/jest.config.js`, ne dokaz semantičke pokrivenosti, e2e ili produkcije; opseg generisanog koda i ostalih fajlova u imenitelju tek treba utvrditi. Testovi 167 općih / 49 preklapajućih integracijskih su prošli, kao i PostgreSQL/Redis audit koraci.
- `scripts/audit/coverage_summary.cjs` dopunjen je sigurnim zbirnim grupama backend source / generated / test / ostalo bez ispisa pojedinačnih putanja; zbirne brojke su međusobno kontrolisane. Sintetički lokalni test grupisanja je prošao; novi Actions run još nije izvršen. Raniju netačnu radnu tvrdnju da API/model dokumenti ne postoje ispravljen je u `01-inventory.md`.
- B-022: **TTL dio ispravljen u REL-5.** `cacheSensorReading` sada drži po jedan timer po ključu i otkazuje prethodni prije novog, zapis nosi `version` i `expiresAt`, a `clearCache()` otkazuje timere; `getCacheStats()` dokazuje da ponovljeni upisi ne gomilaju timere. Poštivanje stvarnog TTL-a pri čitanju je iza `FALLBACK_STRICT_TTL_ENABLED` (zadano `off`) jer mijenja efektivni životni vijek cachea. Mapa callera je precizirana: servis JESTE injektovan u `HeatingAnomalyCheckerService:41`, ali se nijedna njegova metoda tamo ne poziva — injekcija je mrtva, produkcijski efekt ostaje nedokazan. Zadani 60 °C nije mijenjan (nema stručne osnove), ali je označen sa `safeDefaultValidated: false`. Verificirano sa 14 novih fake-clock testova (prije izmjene 9 padova) uz netaknut postojeći spec. PERF-2 polling listing i PERF-1 `HeatingEvent` indeks su riješeni 2026-11-01; weather indeks je odgođen nakon sintetičkog CI mjerenja, a produkcijsko p95 mjerenje ostaje otvoreno.
- PERF-1: **`579e58c` + `d9831c9`**, CI run **`41303090502`**. Dodan je samo `HeatingEvent(deviceId, timestampStart DESC)` indeks nakon sintetičkog benchmarka; legacy `deviceId` indeks je zadržan. Weather `(city, fetchedAt DESC)` kandidat nije migriran jer normalni mali cache nije prošao prag, iako stressni dataset jest. Backend/mobile success; frontend samo pre-existing FE2-7. Detalji: `backend/15-perf1-index-benchmark.md`.
- SEC-6: **`6845060`**, CI run **`41323254765`**. Svih četiri `/metrics*` rute štiti dedicated `METRICS_AUTH_TOKEN` Bearer guard (503 bez konfiguracije, 401 za pogrešan token, 200 s validnim tokenom, `Cache-Control: no-store`). Reporting izvoz koristi worst-case agregate bez ID labela, a reporting logovi/alert tekst ne sadrže sirove ID-eve. Prometheus/Grafana stack artefakti obrisani iz repoa; root/app compose nisu mijenjani. Backend/mobile success; frontend samo pre-existing FE2-7. Produkcijska mrežna izolacija i stvarni scraper tok ostaju za server provjeru. Detalji: `backend/16-sec6-metrics-auth.md`.
- FE2-10: **`ab08519` + `c9fe88c`**, CI run **`41339126329`**. Dodat je aditivni `Recommendation.breakdown` JSONB snapshot (`version: 1`) koji samo kopira već izračunate engine vrijednosti; formula i preporuka nisu mijenjani. `GET /api/recommendations` ima tipiziran `RecommendationResponseDto[]` odgovor, a web prikazuje read-only „Razlog preporuke“ karticu/proširive redove samo kad backend pošalje breakdown. Stari redovi ostaju `null`; nema novog env flaga. Backend/mobile success; frontend samo pre-existing FE2-7. FORM-1 stručna validacija formule ostaje otvorena. Detalji: `frontend/09-fe2-10-recommendation-breakdown.md`.
- FE2-3: **`29ce3c7`**, CI run **`41343423105`**. Web koristi shared `QueryClient` i query key-ove; dashboard drawer i stranica notifikacija dijele isti cache, gas stranice ne dupliciraju očitanja, a dashboard heating polling više nije `window.setInterval` nego React Query interval koji pauzira kad je tab skriven. Nema API/DB promjene ni novog flaga. Backend/mobile success; frontend samo pre-existing FE2-7. Detalji: `frontend/10-fe2-3-react-query.md`.
- MO2-12: **`5914c9f`**, CI run **`41347741131`**. Mobilni dashboard čita health score i upozorenja iz postojećeg `GET /api/dashboard/health`; lokalna health formula i alert pragovi su uklonjeni, a `AlertsCard` renderuje backend upozorenja bez conditional hookova. Nema backend/DB promjene ni novog flaga. Backend/mobile success; frontend samo pre-existing FE2-7. Detalji: `mobile/08-mo2-12-health-alerts.md`.
- MO2-13: **`07acc30`**, CI run **`41351779085`**. Mobilna lista očitanja plina koristi `FlatList`, dashboard kartice su memoizirane, Dashboard/Heating dijele `['dashboard']` cache, a polling se zaustavlja kad aplikacija nije aktivna. Sintetički benchmark bilježi 500 legacy redova naspram 10 inicijalnih FlatList redova; FPS na uređuje ostaje za mjerenje. Backend/mobile success; frontend samo pre-existing FE2-7. Detalji: `mobile/09-mo2-13-lists-polling.md`.
- MO2-15: **`d21a8a4`**, CI run **`41353900211`**. Mobilni dashboard prikazuje „razlog preporuke“ iz backend breakdown snapshota, bez lokalne rekonstrukcije formule; kartica se renderuje samo kad backend pošalje breakdown. Granice unosa trenutne temperature centralizirane su i usklađene s backendom 48–55 °C. Backend/mobile success; frontend samo pre-existing FE2-7. FORM-1 validacija formule ostaje otvorena. Detalji: `mobile/10-mo2-15-recommendation-breakdown.md`.
- MO2-20: **`0b0c25d`**, CI run **`41356375190`**. `GET /api/home-profiles` više ne upisuje `user.activeHomeProfileId` (integration test tvrdi `null` prije i poslije), a `name`/`location` vraćaju `null` umjesto `'Unnamed Home'`/`'No location set'`. Mobilna forma koristi novi `homeProfileToForm()` s `??`, pa `numberOfResidents: 0`, `hasFloorHeating: false` i prazni stringovi ostaju svoje vrijednosti. Nema DB migracije ni novog flaga; legacy alias `name`/`thermostats` zadržan radi instaliranih klijenata. Backend/mobile success; frontend samo pre-existing FE2-7. Duplikat `name`/`homeName` i generisani tipovi ostaju otvoreni. Detalji: `mobile/11-mo2-20-home-profile-contract.md`.
- `scripts/audit/module_graph.py` generiše read-only tabelu direktnih statičkih importova po 16 direktorija, `prisma`/`tx` pristupa modelima i lokacija pet job dekoratora; tabela dopunjava `01-inventory.md`. Ne dokazuje tranzitivni DI, stvarno izvršavanje, vlasništvo ni potpunost regexa. I dalje su potrebni semantički pregled i ažuriranje opisa pokrivenosti.
- [Run 40879591615](https://github.com/mudzy992/boiler-control/actions/runs/40879591615) na `a75d02a` zelen; grouping summary potvrđuje da zbirni coverage uključuje generisani Prisma kod i jedan `backend/test` fajl. Ne-generisani `backend/src`: 97 fajlova, statements 1479/2877 (51,41%), branches 603/1720 (35,06%), functions 187/455 (41,10%), lines 1337/2612 (51,19%). Generisano: 16 fajlova, statements 1841/12175 (15,12%), branches 847/9535 (8,88%), functions 513/2974 (17,25%), lines 94/277 (33,94%). Ove brojke nisu dokaz ispravnosti niti promjena konfiguracije coveragea. Tabela u `01-inventory.md` sadrži i testnu grupu, zbir se podudara s ukupnim brojevima.
- `scripts/audit/cron_registration_repro.cjs` koristi stvarni `GasReminderService`, instalirani `@nestjs/schedule` 6.1.3 i dvije sintetičke Nest modul registracije s lažnom bazom bez korisnika: dvije su različite instance, ali postoji jedan imenovani cron i jedan ručni tick poziva fake bazu jednom. Scheduler job se zaustavlja i kontekst zatvara. Ovo ne testira puni `AppModule`, prirodni raspored, DST, više procesa, push ni produkciju; rizik dupliranja među replikama i dalje postoji kao hipoteza.

### Autentifikacija: lokalni HTTP s neaktivnim sintetičkim računom

- `scripts/audit/auth_session_repro.cjs` izvodi stvarne auth/user kontrolere, servise, bcrypt, JWT guard i globalni pipe sa fake bazom. Sintetički `isActive:false` korisnik prijavi se s ispravnom lozinkom i dobije 200; njegov stari token ostaje valjan nakon stvarnog toka promjene lozinke; profilni PUT mijenja lozinku bez stare. Neautentifikovan `GET /api/auth/me` vraća 401. Testne lozinke, hash i token nasumični su i ne ispisuju se. S-003 i S-004 dopunjeni su dokazom.
- Ovo nije puni AppModule, stvarni PostgreSQL, produkcijski proxy/WAF ili produkcija. Značenje `isActive` i politika revokacije/kompatibilnosti moraju se potvrditi s vlasnikom; sintetički test ne dokazuje kompromis stvarnog korisnika.

### npm dependency audit — 2026-10-29

- Pokrenuti stvarni `cd backend && npm audit --omit=dev --json` i `npm audit --json`; oba vratila exit 1. Produkcijski graf: 14 označenih paketa (1 critical, 10 high, 3 moderate); puni graf: 24 paketa (2 critical, 12 high, 2 moderate, 8 low). Riječ je o npm klasifikaciji paketa i transitive propagation, ne dokazu produkcijskog exploita; skupovi/ozbiljnosti nisu aditivni. S-007 opisuje advisory identifikatore, poznate verzije, potencijalne entrypointove, otvoreni proxy kontekst i plan popravke. Zavisnosti i lockfile nisu mijenjani.
- `scripts/audit/npm_audit_summary.cjs` sigurno izvlači samo brojke, nazive paketa, direktnost i GHSA ID iz privremenog JSON-a; ne ispisuje sirove npm logove. `node --check`, `--help` i parsing stvarnog JSON-a uspješni. Prvi pokušaj pokretanja iz `backend/` s putanjom za repo root nije pronašao skriptu; ponovljeno iz repozitorijskog korijena uspješno. Privremeni npm JSON nije dio repozitorija.
- Metadata-only pregled tri Gitom praćena backend loga: `backend/p2b-test-run.log` i `backend/test-run.log` sadrže tekstualne obrasce nalik dodjeli polja `JWT_SECRET`/`password`, zabilježene samo putanje, linije i tip, bez vrijednosti; autentičnost/aktivnost i mogući false positive nisu provjereni. `backend/start-dev.log` pregledan istim ograničenim obrascima. S-008 daje preporuku povjerljivog owner pregleda i rotacije ako su stvarni; nijedan log ni historija nisu brisani ili mijenjani. Regex nije potpun secret scanner i negativni rezultat ne dokazuje odsustvo tajni.
- GitHub Actions run [40880928939](https://github.com/mudzy992/boiler-control/actions/runs/40880928939) za `7915ea8` završen uspješno: lint/type-check, build, testovi i izolovane CI reprodukcije prošli. Samoprovjera statičkog inventara nakon S-008 i dalje nalazi 16/16 modula, 14/14 common fajlova, 69/69 route markera i 27/27 schema definicija; marker-poklapanje ne potvrđuje semantiku.
- B-023: **ispravljeno u OBS-1.** `pollDevice` sada vraća eksplicitan ishod (`success/failed/skipped/no_snapshot/incomplete`), a `pollAll` broji ishode po uređaju u nove brojače `poll_devices_*` i pomjera gauge `poll_last_success_timestamp_seconds` samo kad je barem jedan uređaj stvarno obrađen. Inventar prije preimenovanja pokazao je da `prometheus-alert-rules.yml` (19 izraza) ne koristi `poll_runs_*`, dok ih Grafana dashboard koristi, pa su stari nazivi i značenje zadržani a nove metrike dodane uz njih; panel o završetku ciklusa preimenovan, a dodani paneli za uspješnost obrade, razbijanje ishoda i svježinu. Verificirano sa 12 unit testova stvarnog servisa i prepisanom `node scripts/audit/poll_metrics_repro.cjs` (prije je asertirala pogrešno ponašanje). Nije testiran cron, stvarni provider ili produkcijski alert. Dopuna 2026-11-02: liveness/readiness split je naknadno implementiran i CI-verificiran; detalji i preostala ograničenja su u zasebnom OBS-1/MAINT-3 zapisu ispod.
- R-006: dva prolaza `node scripts/audit/push_registration_repro.cjs` sa stvarnim notification servisom i fake DB/pushom potvrdila su zamjenu tokena druge instalacije iste platforme te prosljeđivanje sintetički neaktivnog tokena fake pushu; tokeni nisu ispisani. Nema testa stvarnog PostgreSQL-a, HTTP-a, Expo-a, klijenata ili produkcije; značenje `isActive` i policy više uređaja nisu utvrđeni. Dopunjeni model, backlog i plan.
- R-007: `node scripts/audit/poll_overlap_repro.cjs` dvaput u sintetičkom Nest kontekstu sa stvarnim polling servisom i instaliranim schedulerom potvrdio je istovremeni ulazak dva ručno okinuta ticka u blokiranu fake DB (`waitForCompletion=false`). Nisu testirani prirodni prolazak vremena, AppModule, DB upisi, provideri, više procesa ni produkcija. Dopunjeni Redis/worker analiza, REL-2 i plan. GitHub Actions [40881850195](https://github.com/mudzy992/boiler-control/actions/runs/40881850195) za `7d4dd56` završen uspješno.
- F-005/F-006: `node scripts/audit/learning_end_repro.cjs` dva prolaza sa stvarnim poll end handlerom, recommendation servisom i engineom te fake DB/pushom potvrđuju ulaz pohranjenog ranijeg očitanja u signal nazvan overshoot i korištenje prethodnog intervalnog prosjeka u neposrednoj preporuci. Nisu mjerene završna/vršna temperatura, stvarni uređaj, DB ili produkcija; fizička semantika i uticaj ostaju za stručnu potvrdu. Dopunjeni formule, FORM-1, plan i katalog skripti. CI [40882395658](https://github.com/mudzy992/boiler-control/actions/runs/40882395658) za `71af02d` završio uspješno.
- B-024: dva prolaza `node scripts/audit/history_close_repro.cjs` sa stvarnim poll end handlerom i fake DB potvrđuju filter po korisniku i null kraju: zatvoren jedan sintetički event, drugi ostaje otvoren, ali tri historije istog korisnika dobiju kraj; drugi korisnik nije diran. Red bez početka je sintetički i šema ga dozvoljava, nije potvrđeno njegovo postojanje u produkciji. Nema stvarne DB/transakcije/schedulera. Dopunjeni data model, FEAT-4 i korak 5.1b. CI [40883144063](https://github.com/mudzy992/boiler-control/actions/runs/40883144063) za `bd4501d` uspješan.
- B-025: `node scripts/audit/contract_assertions_repro.cjs` dvaput statički našao 14 contract testova, od kojih 11 ima sve direktne expect pozive sintaktički unutar if; odvojeni sintetički Jest slučaj s 404 prolazi bez asertacije, dok obavezni status pada. To nije izvršavanje originalne suite ni dokaz runtime statusa. Neke testne putanje ne odgovaraju deklarisanim rutama; dokumentovano uz MAINT-4 i plan. CI [40884583447](https://github.com/mudzy992/boiler-control/actions/runs/40884583447) za `eb5ae68` uspješan.
- B-026: dvaput `node scripts/audit/tuya_missing_fields_repro.cjs` koristi stvarni Tuya snapshot i poll odluku s fake provider statusom i DB; odsutno očitanje/Power/cilj postaje 0/false/0 i dovodi do start/end odluke. Start/end su mock brojači; stvarni provider, DB, scheduler, side effecti i fizički uređaji nisu testirani. Dodani REL-7, korak 0.6 i ograničeni statički pregled read-only putanja u formulama. CI [40886266245](https://github.com/mudzy992/boiler-control/actions/runs/40886266245) za `fa77297` uspješan.
- B-027: `node scripts/audit/program_sync_partial_repro.cjs` dvaput pokreće stvarni ProgramSyncService s fake DB, sintetički prekine drugi upsert i potvrdi da retry zbog hasha prvog reda preskače preostali upis/cleanup; kontrola bez prekida dosljedno ažurira i briše. Nema stvarne DB, providera ili uređaja; produkcijska učestalost nije utvrđena. Dopunjen REL-8 i plan 0.7. GitHub Actions [40887153204](https://github.com/mudzy992/boiler-control/actions/runs/40887153204) za `3089611` zelen.
- Inventar dopunjen eksplicitnom matricom svih 16 modula prema nazivima testnih grupa i izolovanim reprodukcijama, s konkretnim nepokrivenim scenarijima, te tabelom svih 14 common fajlova s API/zavisnostima i testnim prazninama. To su statički tragovi, ne granularni coverage ili puni runtime DI. CI [40888715069](https://github.com/mudzy992/boiler-control/actions/runs/40888715069) za `14e2524` završio uspješno.
- Početna formalna samoprovjera `python3 scripts/audit/document_selfcheck.py --json`: svih 10 backend dokumenata postoji, 53 zaglavlja nalaza i 22 koraka plana imaju tražene osnovne tekstualne markere; prvo su nađena i ispravljena dva nedostajuća eksplicitna markera `Skripte` u planu. Sintetički negativni test potvrđuje prijavu nedostajućeg dokumenta, nalaza i plan polja. Skripta provjerava samo sintaksu, ne istinitost dokaza, sadržaj, kompletnost ruta/testova ili odsustvo tajni; Faza 1 nije zatvorena.
- API katalog sada za svih 69 deklaracija sadrži u istom redu ulaz/DTO, poznati vlasnički filter, lokalni guard, registraciju i potrošača označenog kao nepotvrđen; detalji validacije su u zasebnoj DTO tabeli. 3 reda su neregistrovani duplikat. `backend_inventory.py` dodatno provjerava 69 nepraznih osam-kolonskih redova i duplikate; sintetički negativni test je prošao. Ovo nije dokaz runtime ponašanja, potpunih owner/DTO provjera ili klijentske upotrebe. CI [40889305593](https://github.com/mudzy992/boiler-control/actions/runs/40889305593) za `8c8f66d` završen uspješno.
- Dopunjen offline `backtest_events_engine.cjs`: stvarni engine + sintetički `HeatingEvent`/uređaj/historija i datirani snapshoti; dva demo prolaza, zaseban negativni test buduće kreirane historije, nedostajućih veza i duplikata. Odbacuje višestruke uređaje i vremenski nejednoznačne historije, ali čak ni jedini uređaj ne dokazuje stvarnu vezu ni porijeklo. Seed je samo statički pregledan: nasumične historije/eventi nisu povezani i seed se ne smije izvršavati nad stvarnim podacima. Nije pravi mjerni ili fizički backtest. CI [40889727657](https://github.com/mudzy992/boiler-control/actions/runs/40889727657) za `73a794b` zelen.
- Implementacijski plan dopunjen koracima 5.3–5.6 za savjetodavni mraz/potrošnju, privatni export/audit, sigurno testiranje i mjerene performanse; uz postojeće korake dodana je tabela sljedivosti svih 36 backlog ID-eva. Sintaktičko poređenje ID skupova nema nedostajućih/viška; samoprovjera prijavljuje 26 koraka s formalnim markerima, ne dokazuje izvedivost. Ispravljene zastarjele tvrdnje o push/CI i komande `--help`. CI [40890674043](https://github.com/mudzy992/boiler-control/actions/runs/40890674043) za `bfb572c` uspješan.
- Novi offline alat `scripts/audit/cors_headers_repro.cjs`: izolovana lokalna Nest HTTP reprodukcija identičnog middleware lanca iz `backend/src/main.ts` (`helmet` + `enableCors` s istim vrijednostima) uz statičke probere `trust proxy` i per-route `@Throttle` po `backend/src` i dokaz deploy konteksta iz komitovanih compose fajlova. Rezultat: CORS nije open (strani origin ne dobija refleksiju; string origin emituje fiksnu dozvoljenu vrijednost na svakom odgovoru — sigurno, ali implicitno), `credentials` ostaje isključen, preflight 204 s svih 6 deklariranih metoda i headerima `Content-Type, Authorization`, svih 9 helmet default headera prisutno; `trust proxy` nema u izvoru ni runtime defaultu, per-route `@Throttle` 0 pogođaka, backend u compose nema healthcheck a frontend ga ima, `expose` bez portova i traefik strip-prefix. Bez vanjske mreže, baze ili vjerodajnica; `--help` i determinističan exit.
- Nova nalaza: **S-009** (throttling bez per-route limita + podijeljeni klijentski IP iza proxyja — VERIFIKOVANO konfiguracija/izolovana HTTP, HIPOTEZA produkcijska topologija), **B-028** (produkcijski image radi kao root i kopira development `node_modules` — VERIFIKOVANO Dockerfile), **B-029** (backend bez healthcheck/resource limita/backup runbooka, entrypoint s fiksnim `sleep 10` nije priključen — VERIFIKOVANO fajlovi, HIPOTEZA operativni uticaj), **B-030** (58 `any` anotacija u 28 fajlova, `anomayl` tipokratski naziv, 5 mrtvih tekst/log artefakata u Gitu — VERIFIKOVANO statički). Dopunjeni `04-findings.md`, `08-security.md` (uključujući status „nije završen CORS/proxy“ i S-006 helmet napomenu), plan koraci 0.3/5.2/5.5, katalog skripti i otvorena pitanja plana.
- Formalna samoprovjera: 10 dokumenata, 57 nalaza, 26 koraka, 0 formalnih praznina; `backend_inventory.py` i `git diff --check` prolaze. CI [40891227131](https://github.com/mudzy992/boiler-control/actions/runs/40891227131) za `1fba83e` uspješan. Faza 1 ostaje otvorena: preostaju odluke vlasnika (produkcija, retencija, rate-limit politika) i novi CI za ovaj commit; aplikacijski kod i dalje nije izmijenjen u ovom radu.

## Faza 1 — završna samoprovjera (sekcija 8 prompta) i izvještaj

### Potvrde s dokazima

- **Svaki modul/ruta ima red u inventaru:** 16/16 modula, 14/14 common fajlova, 69/69 deklaracija API ruta (tabela `02-api-catalog.md`), 15 modela i 5 cronova (`01-inventory.md`, `03-data-model.md`); `python3 scripts/audit/backend_inventory.py` prolazi i provjerava marker-poklapanje. Poklapanje markera ne potvrđuje semantiku niti sve dinamičke rute.
- **Svaki nalaz ima lokaciju, dokaz i oznaku pouzdanosti:** 57 nalaza (B-001–B-030, S-001–S-009, W-001–W-005, F-001–F-006, R-001–R-007), format po sekciji 7 prompta; `python3 scripts/audit/document_selfcheck.py` → 10 dokumenata, 57 nalaza, 26 koraka, 0 formalnih praznina.
- **Weather, formule, Redis/worker imaju kompletan dizajn, testni plan i rollback:** `05-weather.md` (ciljni dizajn, fixture/contract test plan, migracije/compat), `06-formulas.md` (svaka formula, sensitivity, shadow mode, backtest harness, metrički uspjeh), `07-redis-workers.md` (svaka stavka usvojeno/odgođeno/ne, degradacija, konfiguracija, metrike, strangler migracija i test plan).
- **Svaka stavka plana ima kriterij prihvatanja i procjenu truda:** 26 koraka u `10-implementation-plan.md` s obavezna test polja, plus „Registar rizika i rollout/rollback“ i tabela sljedivosti svih 36 backlog ID-eva (sintaktički: nema nedostajućih ni viška).
- **Izvorni kod aplikacije nije izmijenjen u auditu:** izuzetak su **korisničkim odobrenje** izmjene za dovođenje CI-ja na zeleno (PostgreSQL/Redis servisi, jest/Prisma konfiguracije, TTL/alias/fixture popravci i testovi), dokumentovane u historijskim zapispima ovog fajla; ovaj zadnji rad (CORS/DevOps/kvalitet nalazi) nije mijenjao aplikacijski kod. `git status` pri zatvaranju pokazuje samo `docs/audit/**` i `scripts/audit/**`.
- **Nigdje nije ispisana vrijednost tajni:** tajne su tretirane samo kao lokacija + tip (S-005, S-008, SEC-0); skripte ne ispisuju vjerodajnice; jedan stari nesrećan ispisan primjer iz ranijeg rada nije ponovljen ni reprodukovao.
- **Zastarjela dokumentacija je obrisana i opisana:** `docs/audit/00-cleanup-log.md` (56 putanja + povijesne odluke).
- **Rad isključivo na aktivnoj grani:** `arena/94541967-boiler-control`; nema PR-a, nema pusha ni mergea prema `main`.
- **Postojeći testovi su pokrenuti i stanje zapisano:** 167/167 općih i 49/49 integracijskih u branch CI (izolovani PostgreSQL/Redis), coverage sažeci i `npm audit` rezultati u `04-findings.md`/`08-security.md` i historijskim zapispima ovdje.
- **Svaki korak plana ima obavezne testove i popis pomoćnih skripti:** markeri `Testovi` i `Skripte` u svakom koraku (provjera selfcheck-om); katalog skripti na kraju plana.
- **Predloženi CI se pokreće samo na aktivnoj grani:** `.github/workflows/backend-audit.yml` ima `on.push.branches` s jednom aktivnom granom i `workflow_dispatch`, bez `pull_request`/`main`.

### Broj nalaza po ozbiljnosti (57)

- KRITIČNO: 0
- VISOKO (uključujući „VISOKO potencijalno“): 19
- SREDNJE: 36
- NISKO: 2

### Top 10 prioriteta (redoslijed iz plana, talas 0)

1. **S-005/S-008/SEC-0** — provjera i rotacija stvarno aktivnih kredencijala (praćeni `.env`, log kandidati); incident korak prije bilo čega drugog.
2. **B-006** — IDOR: označavanje tuđe notifikacije kao pročitane (korak 0.1).
3. **B-007** — masovni testni gas endpoint dostupan običnom korisniku (korak 0.3).
4. **B-009/B-010** — anomaly PATCH bez provjere vlasništva i bez DTO validacije (korak 0.2).
5. **R-004 + S-009** — throttler TTL 60 ms, podijeljeni klijentski IP iza proxyja i odsustvo per-route limita (korak 0.3).
6. **S-007** — 1 critical / 10 high u produkcijskom npm grafu; kompatibilne zakrpe (korak 0.5).
7. **B-026** — nedostajuća Tuya polja postaju 0/false i mijenjaju lifecycle odluku (korak 0.6).
8. **B-027** — prekinuta program sinkronizacija ostavlja mješavinu intervala (korak 0.7).
9. **B-021 + S-008** — destruktivni seed/reset i praćeni logovi (korak 5.5 uz vlasničko odobrenje).
10. **B-011/B-028/B-029** — Docker bez migracija/entrypointa, root image s dev zavisnostima, bez healthcheck/limita/backupa (korak 5.2).

### Odluke koje trebaju korisnika

1. **Incident/rotacija:** da li su vrijednosti iz `backend/.env` i log kandidata stvarne i aktivne; rotacija/revokacija (korak 0.0).
2. **Produkcija:** odobren read-only pregled produkcijske baze/deploya (topologija proxyja, shema, backup/restore) — potrebno za B-011, 03-data-model, S-009 i sve migracijske korake.
3. **Rate-limit politika i izvor klijentskog IP-a** (korak 0.3/S-009).
4. **Retention/GDPR politika** (PRIV-1) i odobrenje brisanja/redakcije mrtvih artefakata i logova (MAINT-1/2, B-030).
5. **Odobrenje plana:** talasi i feature flagovi su prijedlog; nijedan korak nije odobren za izvođenje dok vlasnik ne potvrdi.

FAZA 1 ZAVRŠENA — čekam odobrenje za fazu 2

## Faza 2 — Frontend audit (početak)

Korisnik je 2026-10-29 rekao „nastavi dalje" nakon izjave o završetku Faze 1; shvaćeno je kao odobrenje za Fazu 2 prema protokolu iz prompta.

- Pregled `frontend/`: 28 fajlova u `src`, 10 ruta/stranica, 5 komponenti, 2 konteksta, 2 servisa, 1 hook, inline i18n (en-US/bs-BS u `locales/config.ts`). Nema test skripte, nema test direktorija.
- Stvarno izvođenje (2026-10-29): `npm ci` uspjeh (531 paket); **`npm run type-check` lažno zeleno** — korenski `tsconfig.json` je solution-format (`"files": []`) pa `tsc --noEmit` ne kompajlira ništa; stvarna `tsc -p tsconfig.app.json` daje **12 grešaka** (DashboardPage 215/870/1058/1060, HomeProfilePage 16, notification.api.ts 5×); `npm run build` uspijeva: **jedan JS čip 2.972 kB / gzip 905 kB** (vite upozorenje >500 kB); `npm run lint` ne radi (nema ESLint konfiguracije, exit 2).
- Nova nalaza FE-001–FE-021 (21): VISOKO 3 (lažni type-check + 12 grešaka; JWT u localStorage bez refresha; nemoguć unos lokacije + dvostruki weather izvor), SREDNJE 8 (bundle bez splitinga; i18n u 5/14 fajlova; mešoviti dohvati + setInterval bez visibility; gas analitika swallowa greške; nginx bez headera/gzip; tri suprotne deploy konfiguracije; klijentska poslovna logika + obrnut overshoot; nema testova), NISKO 10 (mrtav notification.api.ts; delete bez onError; a11y modala; slomljen lint; defanzivni shape-ovi; home-profile forma bez location/seasonMode; index.html bez CSP/lang; range/limit 500; VAT 1.17 hardcoded; tabele bez horizontalnog skrolovanja + dark mode FOUC).
- Novi dokumenti: `docs/audit/frontend/01-inventory.md` (uključujući mapu ekran→API→backend ruta), `02-architecture-findings.md`, `03-security-build.md`, `04-ux-quality.md`, `05-backend-plan-integration.md` (weather/formule/admin/realtime/OpenAPI/6-temski ukrštaj s backend planom), `06-improvements-backlog.md` (16 stavki FE2-1–FE2-16), `07-implementation-plan.md` (16 koraka u 5 talasa, crosswalk, katalog skripti, registar rizika i rollout/rollback).
- Novi skripte: `scripts/audit/frontend_selfcheck.py` (7 dokumenata, 21 nalaz s markerima, 16 koraka, 16 backlog ID-eva, crosswalk backlog↔plan; negativni test s oduzetim markerom detektovan i povratak green) i `scripts/audit/frontend_inventory.py` (10/10 stranica, 5/5 komponenti, 11/11 ruta u inventaru; read-only).
- Nijedan aplikacijski fajl nije izmijenjen u Fazi 2; frontendski `dist/` i `node_modules` nisu u repozitoriju. Faza 2 ostaje otvorena.

## Faza 2 — završna samoprovjera (sekcija 8 prompta) i izvještaj

### Potvrde s dokazima

- **Svaki ekran/ruta/fajl ima red u inventaru:** 10/10 stranica, 5/5 komponenti, 11/11 ruta (`python3 scripts/audit/frontend_inventory.py` → OK), plus mapa ekran→API→backend ruta u `01-inventory.md`. Poklapanje imena nije semantička potvrda potpunosti opisa.
- **Svaki nalaz ima lokaciju, dokaz i oznaku pouzdanosti:** 21 nalaz (FE-001–FE-021) u formatu sekcije 7; `python3 scripts/audit/frontend_selfcheck.py` → 7 dokumenata, 21 nalaz, 16 koraka, 16 backlog ID-eva, 0 formalnih praznina; negativni test (oduzeo marker → detektovan; povratak → green).
- **Svaka stavka plana ima kriterij prihvatanja i procjenu truda:** 16 koraka u `07-implementation-plan.md` s markerima `Cilj/fajlovi`, `Migracija/rollback, flag`, `Testovi`, `Skripte`, `Prihvat/trud/kompatibilnost/zavisnosti`; crosswalk 16 FE2 ID-eva s backlogom; registar rizika i rollout/rollback prisutni.
- **Izvorni kod aplikacije nije izmijenjen:** `git status` pokazuje samo `docs/audit/**` i `scripts/audit/**`; frontend `dist/` i `node_modules` nisu u repozitoriju.
- **Nigdje nije ispisana vrijednost tajni:** token se u nalazima opisuje samo na nivou mehanizma (putanja/linija), bez vrijednosti.
- **Rad isključivo na aktivnoj grani:** `arena/94541967-boiler-control`; bez PR-a i pusha prema `main`.
- **Postojeći testovi su pokrenuti i stanje zapisano:** frontend nema testova (FE-014); stvarno izvođenje `npm ci` (531 paket), `npm run type-check` (lažno zeleno — solution tsconfig), `npx tsc --noEmit -p tsconfig.app.json` (**12 grešaka**, FE-001), `npm run build` (uspijeva, 2.972 kB / gzip 905 kB, FE-004), `npm run lint` (ne radi — nema konfiguracije, FE-015) — sve u tabeli u `01-inventory.md`.
- **Svaki korak plana ima obavezne testove i popis pomoćnih skripti:** markeri u svakom koraku; katalog skripti (2 postoje + 3 planirane).
- **CI se pokreće samo na aktivnoj grani:** postojeći `.github/workflows/backend-audit.yml` (push aktivna grana + workflow_dispatch); predloženi frontend workflow (FE2-7) u istom branch-only obrazcu.

### Broj nalaza po ozbiljnosti (21)

- KRITIČNO: 0
- VISOKO: 3 (FE-001 lažni type-check + 12 grešaka; FE-002 JWT u localStorage; FE-003 lokacija nedostupna + dvostruki weather izvor)
- SREDNJE: 8 (FE-004 bundle 2.972 kB; FE-005 i18n 5/14 fajlova; FE-006 mešoviti dohvati + setInterval; FE-007 progutane greške + console.log; FE-008 nginx bez headera/gzip; FE-009 tri suprotne deploy konfiguracije; FE-010 klijentska poslovna logika; FE-014 nema testova)
- NISKO: 10 (FE-011 mrtav notification.api.ts; FE-012 delete bez onError; FE-013 a11y modala; FE-015 slomljen lint; FE-016 defanzivni shape-ovi; FE-017 home-profile forma; FE-018 index.html; FE-019 range/limit 500; FE-020 VAT hardcoded; FE-021 tabele + dark FOUC)

### Top 10 prioriteta (redoslijed iz plana)

1. **FE2-1** — pravi type-check (`tsc -p tsconfig.app.json`) + popravka 12 grešaka (korak 0.1).
2. **FE2-16** — ESLint flat config + lint skripta (0.2).
3. **FE2-12** — brisanje mrtvog `notification.api.ts` i nepozvanih metoda; `onError` na mutacije (0.3).
4. **FE2-7** — jedna mjerodavna deploy konfiguracija + branch-only frontend CI (type-check, lint, build, e2e smoke) (1.1).
5. **FE2-8** — OpenAPI codegen + contract testovi; zamjena ručnih tipova (1.2).
6. **FE2-2** — httpOnly cookie + rotirani refresh, usklađeno s backend 0.4/SEC-4 (2.1).
7. **FE2-6** — security headeri + gzip (+ `lang` iz i18next) (2.2).
8. **FE2-3** — React Query ujedinjenje s globalnim defaultima i visibility pauzom (3.1) — **riješeno `29ce3c7`**.
9. **FE2-4** — code-splitting/lazy rute + mjerena LCP (3.2).
10. **FE2-9/FE2-5** — weather ekran v2 (lokacija u formi, starost, WMO) usklađeno s backend 1.1/1.2; i18n kompletnost s jezikim selektorom (4.1/3.3).

### Odluke koje trebaju korisnika

1. **Deploy topologija:** koja od tri compose varijante je produkcija; tko postavlja TLS/ivične header-e (FE-009; isto otvoreno pitanje iz Faze 1 B-029/S-009).
2. **Auth migracija:** odobrenje httpOnly cookie + refresh i rok prelaza postojećih Bearer sesija (FE2-2, s backend 0.4).
3. **Performanse:** ciljni LCP/veličinski pragovi i minimalni preglednici (FE2-4).
4. **Poslovna logika:** je li health/alerts/granice 46–55 vs 48–55 jedan izvor u backendu ili shared modul; GEMINI paritet s mobile (FE2-14).
5. **Admin ekran:** radi li se u ovom ciklusu i s kojim podacima (FE2-15, backend 5.2/OBS-1).
6. **Weather layout:** da li weather dobija posvećenu stranicu ili ostaje dashboard kartica (FE2-9).

FAZA 2 ZAVRŠENA — čekam odobrenje za fazu 3

## Faza 3 — Mobile audit (početak)

Korisnik je 2026-10-29 rekao „nastavi dalje sa Fazu 3 (mobile audit) unutar `docs/audit/`"; shvaćeno je kao odobrenje za Fazu 3 prema protokolu iz prompta. Rad na grani `arena/1bfee051-boiler-control` (HEAD `c0131ff`); prethodne sekcije ovog fajla spominju `arena/94541967-boiler-control` jer su pisane u ranijoj sesiji.

- Pregled `mobile/`: **78 fajlova** (bez `node_modules`/`.expo`) — 14 ekrana, 12 komponenti, 4 navigatora, 8 servisa, 13 ostalih `src` fajlova, 15 root dokumenata, 12 asseta. **55 API metoda**: 40 u `services/api/client.ts`, 7 u `homeProfile.api.ts`, 4 u `thermostat.api.ts`, 4 u `src/api/dashboard.api.ts` (drugi API direktorij, bez 401 interceptora).
- Stvarno izvođenje u `mobile/` (2026-10-29): `npm ci --ignore-scripts` **exit 0** (977 paketa, 474 MB; peer warning `native-base`↔`react` 19.1.0); `npm run type-check` **exit 0** (stvaran — `include: [src, App.tsx, index.js]`, `strict`, `noUnusedLocals`); `npm run lint` **exit 2** (`couldn't find the config "expo"`); `npm test` **exit 127** (`jest: not found`) → **0 testova** (MO-012). `npx expo config --type public`: verzija **1.0.0** (dok `package.json` kaže 2.0.0), scheme **`myapp`**, `android.package com.boilercontrol.app`, versionCode 1; `--type introspect`: `android.permissions = [RECORD_AUDIO, READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE, INTERNET]`, `react-native-web` nije instaliran.
- Tipki dokaz za MO-001: `scripts/audit/mobile-probe/filesystem_api_probe.ts` + `tsconfig.json` — `npx tsc --noEmit -p ../scripts/audit/mobile-probe/tsconfig.json` → **exit 0**. Potvrđeno da `expo-file-system` 19.x (instalirano **19.0.22**, `package.json` traži `~19.0.21`) **ne izvozi** `documentDirectory`/`cacheDirectory`/`temporaryDirectory` kao modulske konstante (samo statički getteri klase `Paths`), dok `makeDirectoryAsync` postoji kao **throwing stub** iz `legacyWarnings`. Zbog toga je CSV export u **`AnalyticsScreen.tsx:138` (`handleExport`)** slomljen (MO-001, VISOKO) — modul se importuje top-level (`AnalyticsScreen.tsx:3`), a `const fileSystem = FileSystem as any` (linija 125) potiskuje TS provjeru. **Ispravka vlastite greške (2026-10-29):** ovdje je ranije pisalo `GasReadingsScreen.tsx:308-386`; taj fajl koristi **ispravnu** podputanju `expo-file-system/legacy` (linija 6) i ne sadrži CSV export. Linije 308-386 tog fajla su `openProtectedFile` (preuzimanje u cache) i pripadaju MO2-20.
- Novi nalazi **MO-001–MO-027 (27)**: VISOKO 6 (MO-001 slomljen CSV export; MO-002 deep link + cold-start; MO-004 bez min-version/force-update uz 3 izvora verzije; MO-005 tri API hosta s dev fallbackom na produkciju; MO-008 Settings prekidači bez efekta; MO-018 centralni handler grešaka samo `console.error`), SREDNJE 10 (MO-003 push token bez deregistracije; MO-009 `ProfileScreen` bez i18n/React Query + PDV 17 % hardcoded; MO-010 SecureStorage web/Android fallback; MO-011 NativeBase↔React 19 + dva sistema stilizacije bez `tailwind.config.js`; MO-012 mrtav lint/test; MO-014 tri axios instance; MO-015 health score i pragovi u klijentu; MO-016 fiktivne „12 %/18 %" komparacije; MO-017 a11y — 3 `accessibilityLabel`, 0 `accessible`, 0 `testID`; MO-021 tri ekrana bez `t()`), NISKO 11 (MO-006 `BottomSheetModal` vraća `null` + `title` nekorišten; MO-007 splash fiksno 2500 ms bez `expo-splash-screen`; MO-013 mrtav kod; MO-019 4 akcije = `console.log`; MO-020 dokumenti u nešifriranom cacheu; MO-022 25 bosanskih ključeva u `enUS.gas.*`; MO-023 liste bez virtualizacije/memoizacije; MO-024 `scheme:'myapp'` + duplikat `app.json`/`app.config.js`; MO-025 `RECORD_AUDIO` + legacy storage; MO-026 backend `findAll` s upisom u GET; MO-027 polling bez `AppState` + dupli `/dashboard` ključ).
- Novi dokumenti (7): `docs/audit/mobile/01-inventory.md` (inventar + mapa ekran→API→backend ruta + tabela svih 55 metoda + paritet web↔mobile), `02-architecture-findings.md`, `03-security-build.md`, `04-ux-quality.md`, `05-backend-plan-integration.md` (8 sekcija ukrštanja s backend i frontend planom), `06-improvements-backlog.md` (**22 stavke MO2-1–MO2-22**), `07-implementation-plan.md` (**22 koraka u 5 talasa**, crosswalk, katalog skripti, registar rizika i rollout/rollback).
- Nove skripte: `scripts/audit/mobile_inventory.py` (read-only; 14/14 ekrana, 12/12 komponenti, 4/4 navigatora, 8/8 servisa, 55/55 API metoda imaju red u inventaru; markeri `mob:screens|components|navigators|services|apimethods` usklađeni; samostalno potvrđuje da deep link cilj `GasReadings` **nije registrovan** i da 3 ekrana nemaju i18n) i `scripts/audit/mobile_selfcheck.py` (7 dokumenata, 27 nalaza s obaveznim markerima, 22 plan koraka, 21 backlog ID, crosswalk backlog↔plan; 0 formalnih praznina). Obje imaju `--help` i `--json`, idempotentne su i **ne mijenjaju nijedan fajl** (potvrđeno: identičan izlaz u dva uzastopna pokretanja i nepromijenjeno radno stablo).
- Negativni testovi (tri ubačena defekta, svi detektovani i vraćeni): oduzet marker `**Dokaz:**` iz MO-001 → `formalnih praznina: 1`, **exit 1**; preimenovan `MO2-5` → `MO2-99` → prijavljena `crosswalk: razlika backlog/plan ['MO2-5','MO2-99']`, **exit 1**; `mob:screens:14` → `mob:screens:99` → inventory prijavio nedostajući marker, **exit 1**. Nakon vraćanja obje skripte opet **exit 0**.
- Ispravka vlastitih ranijih tvrdnji u ovoj fazi: (a) „nema virtualizovanih lista" **nije tačno** — `SectionList` postoji (`NotificationsScreen.tsx:2`), `FlatList` 0, `ScrollView` 12; (b) „25 ključeva razlike je parser artefakt" **nije tačno** — `grep -n` s granicama blokova pokazuje stvarne bosanske vrijednosti u `enUS.gas.*` (`config.ts:483-515`, MO-022); (c) „`makeDirectoryAsync` ne postoji" **nije tačno** — postoji kao throwing stub; (d) naivni/regex parseri nad `src/locales/config.ts` daju lažne rezultate (zbog `'{{value}} / m³'` i višelinijskih vrijednosti) — jedini pouzdan je string-aware tokenizator; ispravni brojevi: **en 550 / bs 525** ključeva, svih 374 statički korištenih ključeva postoji u oba jezika, 176 `en` ključeva nikad korišteno.
- Nijedan aplikacijski fajl nije izmijenjen u Fazi 3; `mobile/node_modules` nije u repozitoriju.

### Odluke koje trebaju korisnika (Faza 3)

1. **Settings prekidači:** trebaju li biti stvarni (vezani na `NotificationPreference`) ili ih ukloniti? (MO-008)
2. **Verzionisanje:** koji je mjerodavni izvor verzije i uvodi li se min-version gate / force-update prije backend promjena ugovora? (MO-004, MO2-2)
3. **API host:** koji od tri hosta je produkcija i smije li dev fallback pokazivati na nju? (MO-005)
4. **PDV i cijene:** stvarna stopa i treba li backend vraćati umjesto hardcoded 17 %? (MO-009)
5. **Fiktivne metrike:** smiju li „AI Insights" i komparacije s drugim domovima ostati bez stvarnih podataka? (MO-016)
6. **A11y prag:** minimalni zahtjevi za TalkBack/VoiceOver u ovom izdanju? (MO-017)
7. **Mobile nadogradnje:** prioritet widgeta/lock screena, lokalnih notifikacija, offline unosa plina, prognoze upozorenja i biometrijske prijave? (MO2-13, MO2-14, MO2-16, MO2-17, MO2-18)


## Faza 3 — završna samoprovjera (sekcija 8 prompta) i izvještaj

### Potvrde s dokazima

- **Svaki ekran/komponenta/fajl ima red u inventaru:** 14/14 ekrana, 12/12 komponenti, 4/4 navigatora, 8/8 servisa, **55/55 API metoda** (`python3 scripts/audit/mobile_inventory.py` → „Redova koji nedostaju u inventaru: nema", „Metode bez reda u inventaru: nema", exit 0), plus mapa ekran→API→backend ruta i tabela svih 55 metoda u `01-inventory.md`. Poklapanje imena nije semantička potvrda potpunosti opisa.
- **Svaki nalaz ima lokaciju, dokaz i oznaku pouzdanosti:** 27 nalaza (MO-001–MO-027, bez praznina u numeraciji) u formatu sekcije 7; `python3 scripts/audit/mobile_selfcheck.py` → 7 dokumenata, 27 nalaza, 22 koraka, 21 backlog ID, **0 formalnih praznina**, exit 0. Tri negativna testa (oduzeo `**Dokaz:**` iz MO-001; `MO2-5`→`MO2-99`; `mob:screens:14`→`mob:screens:99`) → svi detektovani s **exit 1**, nakon vraćanja opet exit 0.
- **Svaka stavka plana ima kriterij prihvatanja i procjenu truda:** 22 koraka u `07-implementation-plan.md` s markerima `Cilj/fajlovi`, `Migracija/rollback, flag`, `Testovi`, `Skripte`, `Prihvat/trud/kompatibilnost/zavisnosti`; crosswalk 21 MO2 ID s backlogom (razlika prazna); registar rizika i rollout/rollback prisutni.
- **Izvorni kod aplikacije nije izmijenjen:** `git status --porcelain` → ` M docs/audit/STATUS.md`, `?? docs/audit/mobile/`, `?? scripts/audit/mobile-probe/`, `?? scripts/audit/mobile_inventory.py`, `?? scripts/audit/mobile_selfcheck.py` — nijedan aplikacijski fajl; `git ls-files mobile/node_modules` → **0** (nije u repozitoriju).
- **Nigdje nije ispisana vrijednost tajni:** `grep -rE "eyJ[A-Za-z0-9_-]{10,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN"` nad svim Faza 3 artefaktima → **0 pogodaka**; `assets/google-services.json` je opisan samo strukturno (`01-inventory.md:113`), bez vrijednosti.
- **Rad isključivo na aktivnoj grani:** `git rev-parse --abbrev-ref HEAD` → `arena/1bfee051-boiler-control`; bez PR-a i pusha prema `main`.
- **Postojeći testovi su pokrenuti i stanje zapisano:** `npm ci --ignore-scripts` exit 0; `npm run type-check` **exit 0**; `npm run lint` **exit 2**; `npm test` **exit 127** → **0 testova, nema jest konfiguracije** (MO-012); `npx tsc --noEmit -p ../scripts/audit/mobile-probe/tsconfig.json` **exit 0** (MO-001). Ništa od toga nije popravljano (zabrana izmjene koda).
- **Svaki korak plana ima obavezne testove i popis pomoćnih skripti:** markeri u svakom koraku; katalog skripti (3 postoje — `mobile_inventory.py`, `mobile_selfcheck.py`, `mobile-probe/filesystem_api_probe.ts` — i 4 planirane).
- **CI se pokreće samo na aktivnoj grani — OTVORENO:** jedini postojeći workflow `.github/workflows/backend-audit.yml` je branch-only, ali na **staroj** grani `branches: [arena/94541967-boiler-control]` (linija 5), ne na `arena/1bfee051-boiler-control`. Nije izmijenjen jer `.github/workflows/**` **nije** među dozvoljenim putanjama (`docs/audit/**`, `scripts/audit/**`); potrebna je izričita odluka korisnika.

### Broj nalaza po ozbiljnosti (27)

- KRITIČNO: 0
- VISOKO: 6 (MO-001 slomljen CSV export — `expo-file-system` 19.x bez direktorijskih konstanti; MO-002 deep link + cold-start; MO-004 bez min-version/force-update uz 3 izvora verzije; MO-005 tri API hosta, dev fallback na produkciju; MO-008 Settings prekidači bez efekta; MO-018 centralni handler grešaka samo `console.error`)
- SREDNJE: 10 (MO-003 push token bez deregistracije; MO-009 `ProfileScreen` bez i18n/RQ + PDV 17 %; MO-010 SecureStorage fallback; MO-011 NativeBase↔React 19 + dva sistema stilizacije; MO-012 mrtav lint/test; MO-014 tri axios instance; MO-015 health score u klijentu; MO-016 fiktivne komparacije; MO-017 a11y; MO-021 tri ekrana bez `t()`)
- NISKO: 11 (MO-006 `BottomSheetModal`; MO-007 splash 2500 ms; MO-013 mrtav kod; MO-019 akcije = `console.log`; MO-020 dokumenti u cacheu; MO-022 25 bosanskih ključeva u `enUS.gas.*`; MO-023 liste bez virtualizacije; MO-024 scheme/duplikat konfiguracije; MO-025 `RECORD_AUDIO` + legacy storage; MO-026 backend upis u GET; MO-027 polling bez `AppState`)

### Top 10 prioriteta (redoslijed iz plana)

1. **MO2-22** — ispraviti CSV export na `File`/`Paths` API (korak 0.1; tipki dokaz već postoji).
2. **MO2-2** — jedan izvor verzije + min-version gate / force-update **prije** backend promjena ugovora (0.2).
3. **MO2-5** — jedan API host + okruženje bez dev fallbacka na produkciju (0.3).
4. **MO2-4** — centralni error handler koji stvarno prikazuje grešku; `onError` na mutacije (0.4).
5. **MO2-3** — Settings prekidači vezani na `NotificationPreference` + perzistencija (0.2/0.4).
6. **MO2-6** — deep link registracija + cold-start (`getLastNotificationResponseAsync`) (0.5).
7. **MO2-7** — SecureStorage bez tihih fallbackova + obnova tokena (0.6, s backend SEC-4).
8. **MO2-8** — lint + jest konfiguracija i prvi testovi (1.3) — preduslov za MO2-12 i MO2-14.
9. **MO2-13** — performanse listi: virtualizacija + memoizacija (3.1) — **riješeno `07acc30`**.
10. **MO2-15/MO2-17** — preporuke i weather v2 usklađeni s backend FEAT planom (4.2/4.3, s FE2-10/FE2-9) — **MO2-15 riješen `d21a8a4`**.
11. **MO2-20** — čist home-profile ugovor: GET bez side effecta, `null` umjesto placeholdera, `??` u formi (4.4) — **riješeno `0b0c25d`**.

### Odluke koje trebaju korisnika

1. **CI grana:** smijem li ažurirati `.github/workflows/backend-audit.yml` na aktivnu granu (putanja je izvan dozvoljenih)?
2. **Settings prekidači:** stvarni (vezani na `NotificationPreference`) ili ih ukloniti? (MO-008)
3. **Verzionisanje:** mjerodavni izvor verzije i uvođenje min-version gatea prije promjena ugovora? (MO-004, MO2-2)
4. **API host:** koji od tri hosta je produkcija i smije li dev fallback pokazivati na nju? (MO-005)
5. **PDV i cijene:** stvarna stopa i da li backend treba vraćati umjesto hardcoded 17 %? (MO-009)
6. **Fiktivne metrike:** smiju li „AI Insights" i komparacije s drugim domovima ostati bez stvarnih podataka? (MO-016)
7. **A11y prag:** minimalni zahtjevi za TalkBack/VoiceOver u ovom izdanju? (MO-017)
8. **Mobile nadogradnje:** prioritet widgeta/lock screena, lokalnih notifikacija, offline unosa plina, prognoze upozorenja i biometrijske prijave? (MO2-13, MO2-14, MO2-16, MO2-17, MO2-18)

FAZA 3 ZAVRŠENA — čekam odobrenje za fazu 4

## Faza 4 — Objedinjeni plan (početak)

Korisnik je 2026-10-29 rekao „nastavi dalje" nakon izjave o završetku Faze 3; shvaćeno je kao odobrenje za Fazu 4 prema istom obrascu kao u prethodnim fazama.

- Isporuka: **`docs/audit/MASTER-ROADMAP.md`** (282 linije, 15 sekcija) — jedan prioritizirani roadmap za backend + frontend + mobile: talasi A–E, zavisnosti u 6 lanaca, kritični put, procjene u danima po talasu i po tracku, registar rizika, ključne odluke, „Quick wins (< 1 dan)" i „Šta NE raditi".
- **74 stavke** iz tri backloga (36 backend, 16 frontend, 22 mobile). Prioritet je **izračunat, a ne procijenjen na oko**: `ICE = Impact × Confidence ÷ Effort`, pri čemu se Effort i Confidence **čitaju iz backlog tablica** (Confidence: `VERIFIKOVANO`→1.0, `HIPOTEZA`→0.5, bez oznake→0.7), a Impact je eksplicitno dodijeljen po stavci s obrazloženjem u `IMPACT_TABLA`. Rezultat: **72 VERIFIKOVANO, 2 HIPOTEZA** (`PRIV-2`, `FEAT-2`), 0 bez oznake.
- Talasi: **A** 9 stavki / 11.75–19.5 dana (sigurnost + slomljena funkcionalnost), **B** 7 / 12.75–20.5 (preduslovi: test infra, version gate, ugovor API-ja), **C** 16 / 31.25–48.5 (ispravnost podataka, observability), **D** 16 / 37–57 (pouzdanost, performanse, auth migracija), **E** 26 / 86–137 (funkcionalnosti i preostali dug). Ukupno **179–282 dana** sekvencijalno, odnosno zid-sat ≈ najduži track (**backend 113–180 dana**) uz tri paralelna tracka.
- **Kritični put** je LANAC 2: `MO2-1 → MO2-2 → API-1 → API-2 → FE2-8 + mobilni tipovi`, **12.25–19.5 dana**. Dok on nije gotov, nijedna promjena oblika API odgovora ne smije u produkciju jer instalirane mobilne verzije nemaju prisilno ažuriranje.
- **10 quick wins** (< 1 dan, ukupno 2.5–5 dana): `SEC-1`, `FE2-1`, `FE2-6`, `MO2-1`, `MO2-19`, `MO2-22`, `MO2-5`, `FE2-12`, `FE2-16`, `MO2-3`.
- **6 stavki s nadjačanim ICE-om**, jer čisti omjer koristi i cijene daje pogrešan signal kod ireverzibilnih posljedica: `SEC-0` (D→A, curenje tajni), `SEC-4` (D→A, token bez revokacije), `MO2-2` (ostaje B, ali je kapija), `API-1` (C→B, preduslov ugovora), `API-2` (E→B, preduslov za `FE2-8` i mobilne tipove), `FORM-1` (D→C, pogrešna preporuka košta stvarnog novca).
- Nova skripta: **`scripts/audit/master_roadmap.py`** — read-only, idempotentna, `--help`/`--json`/`--top`. Effort i Confidence čita iz backloga (ne prepisuje ih), pa se poredak može reproducirati i revidirati. Negativni testovi (četiri ubačena defekta, svi detektovani i vraćeni): (1) oduzet Impact za `SEC-1` → `PROBLEM: SEC-1: nema dodijeljen Impact`, **exit 1**; (2) nepoznata oznaka truda u backlogu → `PROBLEM: MO2-3: effort None nije prepoznat`, **exit 1**; (3) oduzet `IMPACT_TABLA` unos za `API-2` → `PROBLEM: API-2: nema dodijeljen Impact`, **exit 1**; (4) oduzet `ICE_OVERRIDE` unos za `API-2` → skripta ostaje **exit 0** ali se `API-2` vraća u **Talas E**, čime je potvrđeno da override zaista mijenja talas, a ne samo ispis. Nakon vraćanja svih: **exit 0**, `API-2` u Talasu B, `problems: []`.

  Napomena o vlastitoj grešci: prvi pokušaj testa (3) bio je loše konstruisan — zamjena stringa `"    'API-2': ('Talas B',"` pogodila je unos u `ICE_OVERRIDE`, a ne u `IMPACT_TABLA`, pa je test prošao (exit 0) iako nije testirao ono što je trebao. Ispravljen je ciljanjem pune linije `'API-2': (4, 'OpenAPI kao izvor tipova'),` i tek tada pao s exit 1.
- Nijedan aplikacijski fajl nije izmijenjen u Fazi 4.

## Faza 4 — završna samoprovjera (sekcija 8 prompta) i izvještaj

### Potvrde s dokazima

- **Prioritet je obrazložen, ne nagađan:** formula, skala i svaka ulazna vrijednost su u `scripts/audit/master_roadmap.py`; `python3 scripts/audit/master_roadmap.py --json` reprodukuje cijeli poredak. Impact ima pisano obrazloženje za svih 74 stavki (`PROBLEM: <id>: nema dodijeljen Impact` ako neka nedostaje — negativni test to potvrđuje).
- **Svih 74 ID-jeva iz tri backloga prisutno je u roadmapu:** provjereno skriptom koji čita `--json` izlaz i traži svaki ID u `MASTER-ROADMAP.md` → **0 nedostajućih**; broj redova u svakoj talasnoj tabeli odgovara broju stavki tog talasa (A 9, B 6, C 16, D 16, E 27).
- **Sve brojčane tvrdnje u dokumentu su izračunate, ne prepisane:** provjereno 13/13 (dani po talasu, dane po tracku, Talas A+B 16 stavki / 24.5–40 dana, quick wins 2.5–5 dana, ukupno 179–282 dana, kritični put 12.25–19.5 dana, 72/2 VERIFIKOVANO/HIPOTEZA). **Dvije greške su uhvaćene i ispravljene tijekom ove provjere** (v. „Ispravke vlastitih tvrdnji").
- **Svaki korak ima kriterij prihvatanja i procjenu truda:** roadmap određuje samo **redoslijed**; kriteriji prihvatanja ostaju u faznim planovima (`backend/10-`, `frontend/07-`, `mobile/07-implementation-plan.md`) — sva tri fajla postoje i njihove selfcheck skripte prolaze.
- **Izvorni kod aplikacije nije izmijenjen:** `git status --porcelain` → ` M docs/audit/STATUS.md`, `?? docs/audit/MASTER-ROADMAP.md`, `?? docs/audit/mobile/`, `?? scripts/audit/master_roadmap.py`, `?? scripts/audit/mobile-probe/`, `?? scripts/audit/mobile_inventory.py`, `?? scripts/audit/mobile_selfcheck.py` — nijedan aplikacijski fajl.
- **Nigdje nije ispisana vrijednost tajni:** `grep -rE "eyJ[A-Za-z0-9_-]{10,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN|password *= *["'][^"']{6,}"` nad `MASTER-ROADMAP.md` i `master_roadmap.py` → **0 pogodaka**.
- **Rad isključivo na aktivnoj grani:** `arena/1bfee051-boiler-control`; bez PR-a i pusha prema `main`.
- **Postojeći testovi su pokrenuti i stanje zapisano:** backend (Faza 1), frontend (Faza 2 — 0 testova, `type-check` lažno zelen), mobile (Faza 3 — `npm test` exit 127, `npm run lint` exit 2, `npm run type-check` exit 0). U Fazi 4 nije pokretan novi test jer nije mijenjan nijedan aplikacijski fajl.
- **Sve skripte na koje se roadmap poziva postoje i rade:** `document_selfcheck.py` (exit 0, 10 dokumenata / 57 nalaza / 26 koraka), `backend_inventory.py` (exit 0, 69 API redova), `frontend_selfcheck.py` (exit 0, 21 nalaz / 16 koraka), `mobile_selfcheck.py` (exit 0, 27 nalaza / 22 koraka / 22 backlog stavke), `mobile_inventory.py` (exit 0), `master_roadmap.py` (exit 0) — **6/6 zeleno**.
- **CI se pokreće samo na aktivnoj grani — OTVORENO (nepromijenjeno iz Faze 3):** `.github/workflows/backend-audit.yml:5` je i dalje `branches: [arena/94541967-boiler-control]`. Putanja je izvan dozvoljenih, pa traži izričitu odluku vlasnika (otvoreno pitanje 1 u Fazi 3).

### Ispravke vlastitih tvrdnji u ovoj fazi

1. **Kritični put:** napisao sam „8.5–14.5 dana" napamet; stvarni zbir raspona po oznakama truda je **12.25–19.5 dana**. Ispravljeno.
2. **Pouzdanost:** napisao sam „71 VERIFIKOVANO ... 1 bez oznake"; nakon dodavanja `MO2-22` stvarno stanje je **72 VERIFIKOVANO, 2 HIPOTEZA, 0 bez oznake**. Ispravljeno na dva mjesta.
3. **Referenca na nepostojeću skriptu:** roadmap je navodio `scripts/audit/backend_selfcheck.py` koji ne postoji; stvarne skripte su `document_selfcheck.py` i `backend_inventory.py`. Ispravljeno.
4. **Defekt naslijeđen iz Faze 3 (ispravljen na početku Faze 4):** `MO2-1` je bio mapiran na **dva različita koraka** — `0.1` (CSV export) i `1.1` (API host), a u backlogu `MO2-1` označava API host. CSV export (`MO-001`) nije imao vlastitu backlog stavku. Dodata **`MO2-22`**, korak `0.1` premapiran, crosswalk i `STATUS.md` usklađeni; `mobile_selfcheck.py` ponovno **exit 0** (22 backlog stavke / 22 koraka).
5. **Kontradikcija o kritičnom putu:** sažetak roadmapa navodio je `SEC-0/SEC-4 → MO2-2 → API-1 → API-2 → FE2-8`, dok su detaljna sekcija i procjena od 12.25–19.5 dana računali `MO2-1` kao početak lanca. `SEC-0`/`SEC-4` pripadaju sigurnosnom lancu i **ne blokiraju** ugovor API-ja. Sažetak ispravljen na `MO2-1 → MO2-2 → API-1 → API-2 → FE2-8`.
6. **Poredak talasa je kršio vlastitu zavisnost:** `API-2` (OpenAPI codegen) je po čistom ICE-u (1.333, trud L) pao u **Talas E**, dok `FE2-8` koji od njega zavisi stoji u **Talu C** — potrošač bi se radio prije svog izvora. Dodato kao šesti override (`API-2`: E→B). Provjera zavisnosti sada javlja **0 lanaca koji krše poredak talasa**. Posljedica: Talas B 6→**7** stavki (12.75–20.5 dana), Talas E 27→**26** (86–137 dana), Talas A+B 15→**16** stavki (24.5–40 dana), override 5→**6** — sve reference u oba fajla usklađene.

### Broj nalaza po ozbiljnosti (kumulativno, sve faze)

- Faza 1 backend: 57 nalaza u 10 dokumenata (35 backlog stavki)
- Faza 2 frontend: 21 nalaz (FE-001–FE-021; 16 backlog stavki FE2-1–FE2-16)
- Faza 3 mobile: 27 nalaza (MO-001–MO-027: 6 VISOKO / 10 SREDNJE / 11 NISKO; 22 backlog stavke MO2-1–MO2-22)
- **Faza 4 ne dodaje nove nalaze** — objedinjuje 74 backlog stavke u jedan izvršni redoslijed.

### Top 10 prioriteta (po izračunatom ICE-u)

1. **SEC-1** (ICE 5.0, S) — IDOR: čitanje tuđih zapisa; atomski `id+userId`.
2. **FE2-1** (4.0, S) — pravi type-check (`tsc -p tsconfig.app.json`) + 12 grešaka.
3. **FE2-6** (4.0, S) — security headeri + gzip u nginx-u.
4. **MO2-1** (4.0, S) — jedan API host; dev fallback ne smije na produkciju.
5. **MO2-19** (4.0, S) — ukloniti fiktivne „12 %/18 %" metrike.
6. **MO2-22** (4.0, S) — popraviti CSV export na `File`/`Paths` API.
7. **MO2-5** (4.0, S) — centralni handler grešaka koji stvarno prikazuje grešku.
8. **SEC-0** (1.667, L — **override u Talas A**) — rotacija stvarnih kredencijala; vlasnikova akcija.
9. **SEC-4** (1.667, L — **override u Talas A**) — auth s revokacijom i rotiranim refreshom.
10. **FE2-12 / FE2-16 / MO2-3** (3.0, S) — mrtav kod + `onError`, ESLint konfiguracija, ispravan deep link.

### Odluke koje trebaju korisnika

1. **Kredencijali (SEC-0):** tko rotira/revokuje stvarne aktivne ključeve i do kada? Jedina stavka koja ne čeka inženjera.
2. **Deploy topologija (FE2-7, MO2-1):** koji host je produkcija — `api.boiler-control.ba101.top/api`, `boiler.ba101.top/backend/api` ili treći? Bez toga nijedna konfiguracija okruženja nije konačna.
3. **Version gate (MO2-2):** uvodimo li `expo-updates` + min-version endpoint prije bilo koje promjene API ugovora? Ako ne, mobile izdanja moraju ostati zaključana na starom ugovoru.
4. **Auth migracija (SEC-4, FE2-2):** rok prelaska s Bearer u `localStorage` na httpOnly cookie + rotirani refresh i način gašenja postojećih sesija.
5. **Mjerodavna formula (FORM-1, FEAT-7):** postoji li referentna vrijednost s kojom se smije uporediti postojeći izračun potrošnje i preporuka?
6. **Obim ciklusa:** ide li Talas E (26 stavki, 86–137 dana) u ovaj ciklus ili se planira zasebno?
7. **CI grana:** smijem li ažurirati `.github/workflows/backend-audit.yml` na aktivnu granu (putanja je izvan dozvoljenih)?

FAZA 4 ZAVRŠENA — audit je kompletan (Faze 1–4); čekam odluke po sedam otvorenih pitanja iznad prije bilo koje implementacije

## Odluke vlasnika (2026-10-29) i priprema implementacije

Korisnik je odobrio commit i push na aktivnu granu i izričito naredio: **nikad ne otvarati PR na ovoj grani — vlasnik ručno radi pull i merge.**

Od sedam otvorenih pitanja, vlasnik je odgovorio na četiri koja blokiraju Talas A:

| # | Pitanje | Odluka | Posljedica za plan |
|---|---|---|---|
| 2 | Deploy topologija | **`api.boiler-control.ba101.top/api`** je produkcija | `MO2-1` deblokiran: dev fallback (`boiler.ba101.top/backend/api`) se uklanja i zamjenjuje greškom; `.env.example` bez privatnog LAN IP-a; `docs/API_CONFIG.md` (`10.0.2.2`/`localhost`) uskladiti. |
| 1 | Kredencijali (SEC-0) | **Agent priprema runbook + secret manager konfiguraciju; vlasnik odobrava prije izvršenja** | Agent **ne izvršava** rotaciju i **ne ispisuje** vrijednosti tajni — samo lokaciju i tip. Izlaz je dokument + konfiguracija, ne izvršena akcija. |
| 4 | Auth migracija | **httpOnly cookie + rotirani refresh** | `SEC-4` + `FE2-2` idu u tom pravcu, uz dual-mode prelaz da postojeće Bearer sesije ne padnu odmah. |
| 7 | CI grana | **Odobreno ažuriranje na aktivnu granu** | Izvršeno: `.github/workflows/backend-audit.yml` — obje reference (linija 5 `on.push.branches`, linija 14 `if:` guard) prebačene na `arena/1bfee051-boiler-control`; YAML validiran parserom (`on.push.branches`, `workflow_dispatch` i jedan job `test` potvrđeni). |

**Još otvoreno (ne blokira Talas A):** version gate (`MO2-2`), mjerodavna formula (`FORM-1`/`FEAT-7`), obim ciklusa (Talas E). — **riješeno u drugom krugu, v. ispod.**

### Drugi krug odluka (2026-10-29)

| Pitanje | Odluka | Posljedica za plan |
|---|---|---|
| Version gate (`MO2-2`) | **Da — prije prve promjene API ugovora** | `MO2-2` je tvrdi preduslov za `API-1`, `API-2`, `SEC-4` i `FEAT-7`. Nijedan API shape se ne mijenja dok backend `minSupportedVersion` + mobilni „update required" ekran ne postoje. |
| Mjerodavna formula (`FORM-1` / `FEAT-7`) | **Sad samo `FEAT-7`; `FORM-1` odgoditi** | `FEAT-7` (string `false`→`true`, prazan/negativan broj, odbijanje manjeg historijskog očitanja) ide jer je očigledno pogrešno. `FORM-1` (porijeklo overshoot signala, staro učenje) **ne dirati** dok vlasnik ne nađe referentne senzorske uzorke — bez reference nema dokaza da je nova preporuka bolja. |
| Obim ciklusa | **Sve, uključujući Talas E** | 74 stavke, 179–282 dana. Radi se inkrementalno po talasima; Talas E nije izdvojen u zaseban ciklus. |
| Početak implementacije | **Quick wins** | Kreće se s 10 quick wins (2.5–5 dana ukupno). |

**Ispravka vlastite greške:** u pitanju o početku implementacije napisao sam „Svi quick wins odjednom (**7** stavki)", a scoring stvarno vraća **10** (`SEC-1`, `FE2-1`, `FE2-6`, `MO2-1`, `MO2-19`, `MO2-22`, `MO2-5`, `FE2-12`, `FE2-16`, `MO2-3`). Popis u ovom zapisu je mjerodavan.

### Stanje isporuke

- Commit `80670ed` push-an na `arena/1bfee051-boiler-control` (14 fajlova, 2040 insertions); `git rev-parse HEAD` i `git rev-parse origin/arena/1bfee051-boiler-control` se poklapaju.
- **PR nije otvoren** — remote je ponudio link, nije korišten. Provjereno: `gh pr list --head arena/1bfee051-boiler-control --state all` → prazan izlaz.
- Iz commit-a izbačen `scripts/audit/__pycache__/` (artefakt lokalne provjere). `.gitignore` **nema** pravila za `__pycache__`/`*.pyc`, a `.gitignore` je izvan dozvoljenog opsega — preporuka vlasniku da ga doda pri merge-u.

## Implementacija — 10 quick wins ZAVRŠENO (2026-10-29)

Svih 10 quick wins iz `master_roadmap.py` (ključ `quick_wins`, verificirano 10/10) je implementirano, commitovano i push-ano na `arena/1bfee051-boiler-control`. **PR nije otvoren** — vlasnik ručno radi pull i merge (trajna uputa).

| # | ID | Commit | Šta je urađeno | Verifikacija |
|---|----|--------|----------------|--------------|
| 1 | `SEC-1` | `4be40fb` | Zatvoren IDOR na `POST /api/notifications/:id/read` — atomski `id + userId` | 4/4 jest PASS (uz `jest.mock`, jer `prisma generate` blokira `binaries.prisma.sh`); **negativni test**: vraćen ranjivi kod → 4/4 FAIL → ponovno ispravljeno → PASS |
| 2 | `MO2-1` | `d8b06c6` | Jedan API host, uklonjen hardkodovani dev fallback | `tsc --noEmit` exit 0; `npx expo config --json` → `https://api.boiler-control.ba101.top/api` |
| 3 | `MO2-22` | `cd5ad51` | CSV export prebačen na `expo-file-system/legacy` | `tsc --noEmit` exit 0 |
| 4 | `MO2-3` | `895c48c` | Deep link cilja registrovanu rutu + cold-start notifikacija | `mobile_inventory.py` exit 0; **negativni test** `screen: 'GasReadings'` → exit 1 |
| 5 | `MO2-5` | `3614967` | `showError` stvarno prikazuje toast korisniku (ranije 0 pozivalaca) | `tsc --noEmit` exit 0 |
| 6 | `MO2-19` | `f10529b` | Uklonjene izmišljene „12 %/18 %" komparacije iz analitike | `tsc --noEmit` exit 0; `grep "percent: '"` → 0; i18n paritet **en 485 / bs 485** |
| 7 | `FE2-1` | `5a2aa16` | `type-check` više nije lažno zelen (`tsconfig` `files: []`); 12 grešaka popravljeno | `type-check` exit 0; `--listFiles` → 26 fajlova iz `src`; **negativni test** → exit 2; `build` exit 0 |
| 8 | `FE2-6` | `0179355` | Sigurnosni headeri + gzip + ispravljene 3 mrtve favicon reference + `theme-color` + dinamički `<html lang>` | `type-check` exit 0; `build` exit 0; strukturna provjera nginx.conf |
| 9 | `FE2-12` | `3ad87e9` | Obrisano 5 mrtvih API metoda; 8/8 mutacija dobilo `onError` poruku | `type-check` exit 0; `build` exit 0; 4 nova i18n ključa u oba jezika |
| 10 | `FE2-16` | `68c6a5d` | Dodana ESLint flat konfiguracija + `frontend` CI job | `lint` exit 0 (0 grešaka, 12 upozorenja); **negativni test** → exit 1; `type-check` exit 0; `build` exit 0 |

### Ispravke vlastitih tvrdnji tokom implementacije

- **FE2-12:** backlog (`frontend/06-improvements-backlog.md:64`) zapisuje **4** nepozvane API metode; pojedinačnim grep-om verificirano je da ih je stvarno **5** (`getBoilerStatus`, `getHeatingAnomalies`, `getWeather`, `addGasReadingPayload`, `generateReport`). Jedini repo-wide pogodak za `addGasReadingPayload` je `mobile/src/services/api/client.ts:141` — mobilna vlastita metoda, ne potrošač.
- **FE2-16:** frontend je bio na **ESLint 8.57.1** s `@typescript-eslint` v6, dok backend već koristi ESLint 9 + `typescript-eslint` v8 flat config. Frontend je usklađen s backendom umjesto oslanjanja na eksperimentalnu flat podršku u v8.
- **FE2-16:** `no-const-assign` je u ESLint-u **isključeno namjerno** (isključuje ga `tseslint.configs.recommended` jer TypeScript to već pokriva) — verificirano da `tsc` javlja **TS2588** na mutaciju konstante.

### Šta NIJE verificirano (iskreno)

- **`nginx -t` nije pokrenut** — u sandboxu nema ni `nginx` ni `docker`. `frontend/nginx.conf` je provjeren samo strukturno (zagrade, `add_header` sa `;`, `gzip on`); `curl -I` i e2e provjera headera nisu izvedeni.
- **CSP je u `Content-Security-Policy-Report-Only`**, ne u enforce načinu. Razlog: antd 5 CSS-in-JS i `@ant-design/plots` canvas se nisu mogli e2e provjeriti u browseru iz sandboxa. Prebacivanje u enforce zahtijeva stvarnu browser provjeru.
- **Frontend i mobile nemaju automatizovane testove** (`mobile`: `npm test` exit 127 — MO-012). Verifikacija je stoga `tsc --noEmit` + `build` + audit skripte, ne testovi.
- **Backend baseline testova je i dalje 4 failed / 0 testova** (`npx jest test/unit/`) — naslijeđeno stanje, nije dirano u ovim quick wins.
- CI `frontend` job je dodan i YAML je validiran, ali **njegov prvi stvarni run u Actions tek treba potvrditi**.

### Preostalo

**64 od 74 stavke** (Talas A 9 preostalih, B 7, C 16, D 16, E 26). Sljedeći po kritičnom putu (LANAC 2): `MO2-2` version gate → `API-1` → `API-2` → `FE2-8` + mobilni tipovi = **12.25–19.5 dana**.

## Implementacija — SEC-0 priprema ZAVRŠENA, rotacija ČEKA VLASNIKA (2026-10-30)

**Važno: repozitorij je JAVAN** (`gh api repos/mudzy992/boiler-control` → `"private": false`),
a canary je utvrdio da su **stvarne vrijednosti tajni bile ispisane u dokumentaciji**
`env.md` (6 polja) i `backend/env.md` (7 polja) — 13 pojava. Prethodni audit to
**nije zabilježio**; S-005 i S-008 govore samo o `.env` i logovima. Novi nalaz je
**S-010, KRITIČNO**.

### Šta je agent uradio (verificirano)

- **Maskirao 13 curenja** u `env.md` i `backend/env.md` — vrijednosti zamijenjene
  placeholderima `<KEY: vrijednost iz secret managera>`, oba fajla dobila upozorenje
  na vrhu. Vrijednosti nigdje nisu ispisane.
- **`backend/.dockerignore`** sada izrijekom isključuje goli `.env` i `.env.*` uz
  `!.env.example`. Prije toga su bila navedena samo `.env.local/.development/.test`,
  što **ne** pokriva goli `.env` — cijela datoteka s tajnama ulazila je u Docker
  build kontekst (S-005 potvrđen, ne hipotetski).
- **Nova skripta `scripts/audit/env_leak_canary.cjs`** — read-only, idempotentna,
  `--help`, stroga provjera argumenata, **bez ispisa vrijednosti**. Provjerava build
  kontekst, curenje stvarnih vrijednosti u svih 478 Gitom praćenih fajlova, paritet
  `.env` ↔ `.env.example` i praćenje. Prije ispravki: **EXIT 1, 13 curenja**;
  poslije: **EXIT 0, `leaks: []`, `findings: []`**.
- **Runbook `docs/audit/backend/11-secret-rotation-runbook.md`** — postupak po
  provideru, redoslijed (prvo novo, onda staro), dual-mode za JWT, kriterij
  prihvatanja, evidencija.
- **Precizirano gdje se koja tajna koristi:** `JWT_SECRET` → `auth.module.ts:11`;
  `DATABASE_PASSWORD` → `prisma.service.ts:18,30`; `TUYA_CLIENT_*` → HMAC potpis u
  `tuya.adapter.ts:152-158`. **`DATABASE_URL` i `WEATHER_API_KEY` se ne čitaju ni u
  jednom `.ts` fajlu u `src/`** → kandidati za revokaciju bez zamjene.
- **Preciziran S-008:** canary je usporedio stvarne vrijednosti iz `.env` sa sva tri
  praćena loga i **nijedna se ne pojavljuje** — logovi imaju samo imena polja s
  placeholderom. Dakle S-008 nije curenje trenutnih tajni i nije razlog za hitnu
  rotaciju; razlozi su S-005 i S-010.

### Šta agent NIJE uradio (namjerno, izvan ovlasti)

- Nije rotirao ni revokovao nijedan kredencijal.
- Nije uklonio `backend/.env` iz Git praćenja — to se radi **tek nakon rotacije**, jer
  uklanjanje iz HEAD-a ne briše historiju.
- Nije čistio Git historiju.
- Nije ispisao nijednu vrijednost tajne.

### Odluka vlasnika (2026-10-30)

- **`TUYA_CLIENT_ID` / `TUYA_CLIENT_SECRET` se NE DIRAJU** — trajna uputa.
- Rotacija ostalih polja je moguća, ali **nije potrebna** i ne izvršava se.
- Posljedica: `backend/.env` ostaje praćen Gitom. Ispravke koje su provedene
  (maskirana dokumentacija, `.dockerignore`) ne ovise o toj odluci i ostaju.
- SEC-0 je time **zatvoren po vlasnikovoj odluci**, ne provedenom rotacijom.

### SEC-4 — Faza 1 (backend) implementirana, 2026-10-30

Rotirani refresh token i httpOnly cookie, **iza zastavice
`AUTH_COOKIE_REFRESH_ENABLED` (zadano `off`)**:

- Model `RefreshToken` + migracija `20261030000000_auth_refresh_token`
  (dodatak samo; reverzibilno kroz `DROP TABLE`).
- `RefreshTokenService` — `issue`/`rotate`/`revoke`/`revokeAllForUser`; token se
  u bazi čuva kao SHA-256, **reuse detection** opoziva sve sesije korisnika.
- `POST /api/auth/refresh` (rotacija) i `POST /api/auth/logout` (opoziv);
  login/register postavljaju httpOnly cookie kad je zastavica uključena.
- **`JwtAuthGuard` je nepromijenjen** — i dalje čita samo `Authorization:
  Bearer`, pa instalirane mobilne verzije rade bez ijedne promjene.
- `main.ts`: `credentials: authCookieEnabled()`; `cors_headers_repro.cjs` sada
  dokazuje da `origin` ostaje fiksna vrijednost i s uključenim `credentials`.
- Testovi **18/18** (`npx jest src/modules/Auth/tests/ --runInBand`).

Detalji, dizajnerska odluka i šta ova faza NE radi:
`docs/audit/backend/12-sec4-refresh-token.md`.

### SEC-4 — faze 2 i 3 (frontend + mobile) implementirane, 2026-10-30

- Backend je **jedini izvor istine** o zastavici: `AppConfig.authRefreshEnabled`.
- **Frontend:** `detectAuthMode()`, `refreshSession()`, `withCredentials` po
  zahtjevu, 401 → refresh → retry, `logout()` sada opoziva sesiju na serveru.
- **Mobile:** Android nema browser cookie jar, pa je uveden `refreshTransport:
  'body'` — refresh token ide u Android Keystore (`expo-secure-store`).
  Backend vraća token u tijelu **samo** na taj eksplicitni zahtjev, pa web
  httpOnly zaštita ostaje netaknuta. `/auth/refresh` i `/auth/logout` prihvataju
  token iz cookie-ja ILI tijela; cookie ima prednost.
- Testovi **48/48**; tipizacija backend/frontend/mobile EXIT=0.
- **Nije verificirano ponašanjem:** frontend nema test runner u repou, a
  emulator za Android nije dostupan.

### SEC-2 — IDOR i DTO validacija anomalija, 2026-10-30

Riješeno u dva koraka, kako plan (`10-implementation-plan.md` 0.2) traži —
**prvo vlasništvo, tek zatim validacija**:

1. **Owner scope (B-009).** `confirmOrUpdateAnomaly` sada prima `userId` iz
   JWT-a i filtrira i `findFirst` i `updateMany` po `thermostat.userId`, pa je
   provjera **atomska** (bez TOCTOU). Prije toga je svaki prijavljeni korisnik
   mogao zatvoriti tuđu anomaliju **i pokrenuti `processHeatingEvent` za tuđeg
   korisnika**. Nedostajući `userId` se odbija prije bilo kakvog upita, jer
   Prisma u `where`-u **ignoriše** `undefined`. Tuđi i nepostojeći ID daju isti
   odgovor.
2. **DTO validacija (B-010).** `UpdateHeatingAnomalyDto` nije imao nijedan
   dekorator, pa je uz `whitelist: true` **svaki** legitimni zahtjev dobijao
   400 — endpoint je bio neupotrebljiv. Dodati `@IsDate`/`@IsBoolean` +
   `@ApiPropertyOptional`.

Testovi **14/14** (7 owner + 7 DTO), oba TDD. Repro skripte
`anomaly_ownership_repro.cjs` i `anomaly_validation_repro.cjs` su **prepisane**
da asertiraju novo stanje (plan izričito zabranjuje stare asertije kao dokaz).

**NOVI NALAZ B-023:** `main.ts` ima `enableImplicitConversion: true`, a
class-transformer konvertuje **prije** `@Transform`, pa `Boolean('false') ===
true`. String `'false'` u boolean polju dakle postaje `true` i `@IsBoolean()`
prolazi. Utječe na **svaki** boolean DTO u API-ju, ne samo na ovaj; empirijski
potvrđeno sondom. Ne može se popraviti unutar jednog DTO-a bez globalne
promjene `ValidationPipe`, pa je izdvojeno kao zaseban nalaz.

### SEC-3 — Throttler TTL i admin guard na masovnom testnom endpointu, 2026-10-30

Nalaz (`09-improvements-backlog.md:29`) imao je **dva** dijela, i oba su bila
stvarno otvorena:

1. **TTL (R-004) — bio je i dalje 60 milisekundi.** `app.module.ts` je nosio
   komentar „Throttler expects `ttl` in seconds … Converted from previous
   milliseconds value", ali vrijednost je ostala `ttl: 60`. Iz README-a paketa
   `@nestjs/throttler@6.5.0`: *„The `ttl` is now in **milliseconds**. … use the
   `seconds` helper … It just multiplies the ttl by 1000."* Dakle 100 zahtjeva
   je bilo dopušteno unutar **60 milisekundi** — ograničenje praktično nije
   postojalo. Ispravljeno na `ttl: seconds(60)` (= 60000 ms).
   **Ispravka vlastite tvrdnje:** ranije je zabilježeno da je TTL dio „već
   riješen" na osnovu komentara u kodu; komentar je bio netačan, a mjerenje je
   pokazalo da svih 105 zahtjeva prolazi.
2. **Admin guard (B-007).** `POST /api/notifications/test-trigger-all-gas-reminders`
   poziva `triggerDailyReminders()`, koji šalje push **svim** registrovanim
   korisnicima, a bio je zaštićen samo `JwtAuthGuard`-om. Dodat
   `@Roles(UserRole.ADMIN)` + `@UseGuards(RolesGuard)`. Mehanizam
   (`RolesGuard`, `Roles()`) je već postojao u `src/modules/Auth/`, ali ga
   **nijedan** kontroler nije koristio; `req.user.role` već postavlja
   `JwtAuthGuard` (`jwt-auth.guard.ts:52-54`), pa guard ne treba nove podatke.
   `SUPPORT` namjerno **nema** pristup — masovni push je administrativna akcija.

**Testovi 6/6** u dva nova fajla (`sec3-admin-guard.spec.ts`,
`sec3-throttler.spec.ts`), oba TDD. Throttler test je morao u zaseban fajl i s
**pravom** klasom kontrolera: ručno primijenjeni dekoratori na `prototype` ne
registruju guard (izmjereno — svih 105 zahtjeva je prolazilo), a
`Test.createTestingModule` s `NotificationsController` u istoj datoteci također
spriječava registraciju. HTTP test dokazuje 403 za `USER` i 201 za `ADMIN`, te
da `triggerDailyReminders` **nije** pozvan za običnog korisnika.

Ugovor se nije mijenjao (`openapi:generate --check` EXIT=0), jer
`@Roles`/`@UseGuards` ne utječu na šemu. Puni jest: **39 failed / 346 passed /
385** — isto 39 pre-postojećih padova, +6 novih prolaznih.

### REL-4 — Izolacija destruktivnog seeda (B-021), 2026-10-30

`prisma/seed.ts` je radio `deleteMany()` nad **14 tabela** i na kraju ispisivao
`Password: password123` na stdout. Između pogrešnog `.env`-a i brisanja
stvarnih podataka nije stajao nijedan uslov: `DATABASE_HOST`/`DATABASE_NAME`
su se čitali i odmah koristili.

**Guard.** Novi `src/common/seed-target-guard.ts` je **čista funkcija nad env
objektom** — bez Prisme, bez mreže — pa se odbijanje desi prije prvog paketa
prema bazi. Politika, od najstrožije:

1. `NODE_ENV=production` → uvijek ODBIJ; **nijedan** override to ne zaobilazi
   (test to izričito pokriva).
2. Nedostaje `DATABASE_NAME` → ODBIJ.
3. Baza na `SEED_ALLOWED_DATABASES` → DOZVOLI (bilo koji host).
4. `SEED_ALLOW_ANY_TARGET=on` **i** testno ime → DOZVOLI (disposable CI baza).
5. Lokalan host **i** testno ime → DOZVOLI.
6. Sve ostalo → ODBIJ.

`SEED_ALLOW_ANY_TARGET` prima **isključivo** `on`; `1`/`true`/`yes`/`ON` su
neaktivni (testirano). `reason` nikad ne sadrži tajne — test to asertira
ubacivanjem `DATABASE_PASSWORD` u ulaz.

**Integracija.** `seed.ts` zove `assertSeedTargetAllowed(process.env)` prije
`new PrismaClient`, traži `SEED_TEST_PASSWORD` (bez defaulta) i više ne ispisuje
lozinku. `db:reset` sada ide preko `npm run db:check-target`
(`scripts/require-safe-target.ts`, izlazi 0/1/2, `--help`), pa je i
`prisma migrate reset --force` zaštićen istim pravilima — jedan izvor istine,
bez dupliranja logike.

**Testovi 11/11** (`src/common/tests/seed-target-guard.spec.ts`), TDD. CI dobija
novi korak `seed_isolation_repro.cjs` koji nad disposable PostgreSQL-om dokazuje
tri stvari: nepoznat cilj se odbija, **canary redak preživi** odbijeni pokušaj
(restore test — dokaz da nijedan `DELETE` nije izvršen), te dozvoljeni cilj
prolazi (pozitivna kontrola).

Puni jest: **39 failed / 357 passed / 396** — istih 39 pre-postojećih padova,
+11 novih prolaznih. `openapi:generate --check` EXIT=0, sve 4 inventarske
skripte EXIT=0, eslint 0 errors, tsc 1 pre-postojeća greška.

### MAINT-4 — Ugovorni testovi bez uslovnih asertacija (B-025), 2026-10-30

`test/contract/api-contract.spec.ts` je imao **16 uslovnih asertacija** oblika
`if (response.status === 200) { ...expect... }` i gađao je **pet ruta koje ne
postoje**. Deklarisane rute su `api/heating-events`, `api/anomalies`,
`api/recommendations`, `api/devices`; test je zvao `/api/heating/events`,
`/api/heating/anomalies`, `/api/recommendation/today`, `/api/thermostat/devices`.

**Mjerenje prije popravke.** Bez lokalnog PostgreSQL-a nisam mogao znati šta
endpointi stvarno vraćaju, pa sam prvo push-ao privremeni dijagnostički fajl
koji je u CI-ju (run `41058112404`) izmjerio sve statuse i ispao ih u
`::notice`. Rezultat:

| Ruta | Status | Napomena |
|---|---|---|
| `/api/heating/events` | **404** | stvarno: `/api/heating-events` |
| `/api/heating/anomalies` | **404** | stvarno: `/api/anomalies` |
| `/api/recommendation/today` | **404** | stvarno: `/api/recommendations/today` |
| `/api/thermostat/devices` | **404** | stvarno: `/api/devices` |
| `/api/recommendations/today` | **501** | API-1 stub, `reject` režim |
| `/api/devices/999999` | **404** | negativna kontrola |
| duplikat `register` | **400** | negativna kontrola |
| ostale ispravne rute | 200 | `array(0)` / dashboard objekat |

Dakle **13 od 14 testova je "prolazilo" za 2–5 ms** na 404 odgovoru, a da se
nijedna asertcija nije izvršila. Dijagnostički fajl je obrisan nakon mjerenja.

**Novi test.** Sve rute su kopirane iz `@Controller`/`@Get` dekoratora; nema
`if` oko `expect`; `beforeAll` registruje korisnika i koristi **važeći JWT**, pa
pozitivni testovi dokazuju ugovor tijela a ne samo 401. Dodano **7 negativnih
mutation provjera** (duplikat register 400, pogrešna lozinka 401,
`/api/devices/999999` 404, bez tokena 401, nevažeći token 401, nevalidno tijelo
400) te regresijski `it.each` koji asertira da se četiri zastarjele rute i dalje
vraćaju 404 — da se pogrešne putanje ne mogu tiho vratiti.
`/api/recommendations/today` asertira **501** s `endpoint`/`reason`/`alternative`
umjesto da se pravim da vraća 200.

CI (run `41058760713`): **405 testova, 0 pada**, tsc 0, eslint 0.
Lokalno contract suite pada jer nema PostgreSQL-a (kao `test/integration/`):
61 failed / 344 passed / 405.

### MAINT-2 — CI workflowi: guard/scheduler i stvarne Redis komande, 2026-10-30

CI je imao PostgreSQL **i** Redis (`backend-audit.yml:29-35`) te izvozio
`REDIS_URL` (l.46), ali test env gasi dio aplikacije, pa je zelen CI dokazivao
manje nego što je izgledalo.

**Nalazi (svi VERIFIKOVANI, `file:linija`):**

| Lokacija | Ponašanje u `NODE_ENV=test` |
| --- | --- |
| `app.module.ts:22` | preskače `ThrottlerModule.forRoot({ ttl: seconds(60), limit: 100 })` |
| `app.module.ts:56` | preskače `{ provide: APP_GUARD, useClass: ThrottlerGuard }` |
| `app.module.ts:42` | `SchedulerModule` je **uvijek** importovan (nije uslovljen) |
| `schedule.module.ts:15,24-43,44` | `IS_TEST` izbacuje `ThermostatPollingService` iz `providers` **i** `exports` |
| `daily.recommendation.service.ts:21-25` | `@Cron('0 0 * * *', { disabled: ... })` |
| `gas.reminder.service.ts:21-25` | `@Cron(GAS_REMINDER_CRON, zadano '30 6 * * *', { disabled: ... })` |

Branch-only trigger **nije** trebalo mijenjati — već je bio ispravan
(`backend-audit.yml:4-5` + `if: github.ref == 'refs/heads/arena/1bfee051-boiler-control'`).

**Redis rupa.** Aplikacija **nije imala Redis klijenta**: `package.json` bez
`ioredis`/`bull`/`cache-manager`, `src/` bez `REDIS_URL` i `createClient`, a
`fallback-strategy.service.ts:70` je samo komentar „can be extended to Redis".
`scripts/audit/redis_lease_ci.cjs` koristi `docker exec … redis-cli`, tj. radi
**izvan** aplikacije. Kriterij MAINT-2 traži „stvarna Redis komanda iz
aplikacije", što bez nove infrastrukture nije bilo ispunjivo — vlasnik je
odobrio opt-in health servis.

**Urađeno (3 commita):**

1. `cd7a15f` — `maint2-nontest-guard.spec.ts`: modul se učitava s
   `NODE_ENV≠test` pa se `@Module` dekoratori i `const IS_TEST` evaluiraju u
   ne-testnom režimu. `APP_GUARD`/`ThrottlerGuard` se moraju dohvatiti iz
   **istog** `require`-a jer `jest.resetModules()` ponovo učitava `@nestjs/core`
   i kreira novi simbol (inače asertcija pada).
2. `c430131` — `ioredis@^6.0.0` + `redis-health.service.ts` (PING, SET NX PX,
   GET, PTTL, DEL), opt-in preko `REDIS_URL`. `HealthController` dodaje opciono
   `redis` polje; `/health` u `contracts/openapi.json` **nema** response šemu, pa
   `openapi:generate --check` prolazi nepromijenjen. Bez `REDIS_URL` tijelo je
   identično kao prije — instalirane mobilne verzije ne vide razliku.
3. `0192eca` — ispravka prazne `@Cron` asertcije (dolje).

**Dva buga nađena verifikacijom, ne čitanjem koda:**

- `lazyConnect: true` + `enableOfflineQueue: false` bacao je
  **„Stream isn't writeable and enableOfflineQueue options is false"** na prvoj
  komandi, jer socket još nije writeable. Offline red je sada uključen. Ovo bi
  palo i u CI da nisam pokrenuo test lokalno.
- Test „`@Cron` nije disabled izvan testa" imao je `if (cronMeta) { expect(...) }`
  i bio je **prazan**. Izmjereno sondom: `getMetadataKeys(prototype)` vraća `[]`,
  a `getMetadataKeys(prototype, 'metoda')` samo `design:*` — jer NestJS-ov
  `SetMetadata` piše na `descriptor.value`, dakle na **samu funkciju metode**.
  Ispravno čitanje je `getMetadata('SCHEDULE_CRON_OPTIONS', Svc.prototype.metoda)`.
  Ta praznina je krila i drugi nalaz: izvorni kod glasi
  `disabled: NODE_ENV === 'development' || NODE_ENV === 'test'`, pa je cron
  **ugašen i u development env**, ne samo u testu. Test je koristio
  `development`, pa bi pao da asertcija nije bila uslovna.

**Verifikacija (stvarno izmjereno):**

| Provjera | Rezultat |
| --- | --- |
| `maint2-nontest-guard.spec.ts` | 7/7 |
| `redis-health.service.spec.ts` + `health.controller.spec.ts` s Redis-om | 13/13 |
| Stvarne komande kroz `ioredis` (lokalni RESP server) | **36 komandi**: `get` 17, `set` 6, `del` 5, `pttl` 2, `ping` 1, `quit` 1 + handshake `client`/`info`/`hello` |
| `openapi:generate --check` | exit 0 (ugovor nepromijenjen) |
| CI `41061057521` (`cd7a15f`) | 411 testova, 0 pada |
| CI `41064587272` (`c430131`) | 424 testova, 0 pada, **0 preskočenih** |
| CI `41065477837` (`0192eca`) | **425 testova, 0 pada, 0 preskočenih**, tsc 0, eslint 0 |

„0 preskočenih" u CI je suštinski dokaz: gated Redis testovi se tamo **stvarno
izvršavaju** protiv pravog `redis:7`, jer workflow izvozi `REDIS_URL` (l.46),
dok su lokalno preskočeni (sandbox nema Redis).

**Šta NIJE verificirano:**

- Lokalno su Redis testovi išli kroz **ručno napisan minimalni RESP server**, ne
  kroz pravi Redis 7 (sandbox nema `redis-server` ni `docker`). Verificirana je
  klijentska strana i protokol; Redis semantika (npr. ponašanje pod
  istovremenim klijentima) samo u CI.
- `ThermostatPollingService` **nije** izvršen end-to-end — asertira se metadata
  registracija, ne stvarno polliranje.
- Redis lease/lock **ne koristi nijedna poslovna logika**; servis se vježba samo
  kroz `/health`. Uvođenje distributed lock-a je zasebna arhitektonska odluka.
- **Coverage prag nije dodat** — kriterij ga traži „tek nakon mjerenja", a
  mjerenje praga nije rađeno.
- Stvarni Prometheus scrape i Grafana render.

### FE2-11 — Frontend test infrastrukturna (FE-014), 2026-10-30

Frontend je imao **nula testova**. CI je provjeravao samo `openapi:check`,
`type-check`, `lint` i `build` — dakle regresija u poslovnoj logici (npr.
obrnut predznak potrošnje plina) prolazila je neprimijećeno.

**Izbor verzija (nije proizvoljan).** `vitest@5.0.5` traži Vite
`^6.4.0 || ^7.0.0 || ^8.0.0`, a frontend je na Vite 5 — forsirao bi upgrade
produkcijskog builda kao nuspojavu testova. Uzeta je `vitest@3.2.4` čija je
`dependencies.vite` = `^5.0.0 || ^6.0.0 || ^7.0.0-0`. Ostatak stacka:
`@testing-library/react@16.3.3` (React 19), `@testing-library/dom@10.4.2`,
`@testing-library/jest-dom@7.0.1`, `@testing-library/user-event@14.6.8`,
`jsdom@26.1.0`.

`vitest.config.ts` je **odvojen** od `vite.config.ts` (produkcijski ima
`server.port: 80`); `globals: false` s izričitim importima iz `vitest`, da
`tsc -p tsconfig.app.json --noEmit` ne traži `types: ["vitest/globals"]`.
`src/test/setup.ts` dodaje jest-dom matchere, `cleanup()`, te stubove za
`window.confirm` (GasReadingCard ga zove prije brisanja) i `matchMedia`
(antd ga čita pri renderu).

**37 testova u 3 suitea:**

| Suite | Testova | Šta zaključava |
| --- | --- | --- |
| `GasForm.test.tsx` | 13 | `validateForm()` (prazno / previše decimala / nula / ispravno), datum, slanje, API greške, Cancel |
| `GasReadingCard.test.tsx` | 16 | izračun potrošnje i dnevnog prosjeka, kada se blok NE prikazuje, brisanje s `window.confirm`, značke, akcije |
| `locales/__tests__/config.test.ts` | 8 | `fallbackLng`, paritet ključeva, prevodi, stvarni fallback, `<html lang>` (FE2-6) |

**Popravljen stvarni bug (nađen testom).** `GasForm.validateForm()` je
postavljao `errors.readingDate` (grane „obavezno" i „budući datum"), ali ga
**nijedan JSX nije prikazivao** — postojao je samo prikaz za
`errors.counterValue`. Korisnik bi odabrao nevažeći datum, kliknuo „Add
Reading" i **ne bi dobio nikakvu poruku**; forma se tiho nije slala. Sada se
greška prikazuje uz crveni okvir polja.

**Nalaz: grana `futureDateError` je nedostižna kroz UI.** Date input ima
`max={dayjs().format('YYYY-MM-DD')}`, pa budući datum daje
`validity.rangeOverflow = true` i browser odbija submit **prije** nego
`handleSubmit` uopšte počne (izmjereno: `checkValidity() = false`,
`validationMessage = "Constraints not satisfied"`). Korisnik vidi browser
tooltip, ne naš prevedeni tekst. Test to dokumentuje i namjerno zaobilazi
constraint validation (`fireEvent.submit`) da testira samu komponentinu
validaciju — jer kroz klik ta grana nije dostupna.

**Nalaz: semantika `previousReading` je obrnuta od imena.**
`GasReadingsPage.tsx:170-174` sortira **silazno** (`b - a`, najnovije prvi), pa
je `previousReading = sortedReadings[index - 1]` zapravo **novije** očitanje.
Zato `consumption = previousReading.counterValue - reading.counterValue` daje
ispravan pozitivan predznak. Matematika je tačna, ime prop-a zbunjujuće; test
koristi varijable `starije`/`novije` da se predznak ne može tiho obrnuti.

**Ispravka vlastite greške.** Prvom grubom provjerom sam izvijestio „181/181
i18n ključeva". Tačan broj je **183/183** — bash regex je preskočio ugniježđene
`gas.units.m3` i `gas.units.m3h`. Paritet je potpun (nijedan ključ ne
nedostaje), pa test fallback **namjerno uklanja** ključ iz `bs-BS` resursa da
stvarno vježba `fallbackLng`; bez toga bi prošao i da fallback nije
konfigurisan. Isto tako `i18n.options.fallbackLng` je normalizovan u **niz**
`["en-US"]`, ne string.

**Verifikacija (stvarno izmjereno):**

| Provjera | Rezultat |
| --- | --- |
| `npm test` | **37/37** |
| `npm run type-check` | exit 0 |
| `npm run lint` | exit 0 (0 errors, 13 pre-postojeća warnings) |
| **Mutacija 1** — GasForm bez provjere budućeg datuma | **1 test PADA** |
| **Mutacija 2** — GasReadingCard obrnut predznak potrošnje | **3 testa PADAJU** |
| **Mutacija 3** — i18n `fallbackLng: 'bs-BS'` | **2 testa PADAJU** |
| Restauracija nakon mutacija | `diff` potvrdio sva 3 fajla identična backupu, suite opet 37/37 |
| CI `41069792449` | oba joba success; frontend **korak 8 „Unit and component tests (FE2-11)": success** |
| `frontend_inventory.py` | exit 0 (novi fajlovi nisu stranice/komponente) |

Mutacijski test je ključan: bez njega bi „37 prolazi" moglo značiti i da
testovi ne asertiraju ništa. Ovako je dokazano da svaka od tri jedinice
**pada** na namjerno unesenoj grešci.

**Šta NIJE urađeno / NIJE verificirano:**

- **Playwright e2e smoke NIJE implementiran.** Kriterij traži i `test:e2e`
  (login, dashboard, gas unos s mock backendom). Chromium download u sandboxu
  **konkretno pada**: „Failed to download Chromium 131.0.6778.33 (playwright
  build v1148), Download failure, code=1" — Playwright CDN nije na allowlistu.
  Dodavanje CI koraka koji se ne može verificirati lokalno riskiralo bi zeleni
  CI, pa je ostavljen vlasniku.
- Pokrivenost (coverage) nije mjerena ni postavljena kao prag.
- Testirane su samo 2 komponente i i18n; ostalih 5 komponenti i 10 stranica
  nema testova.
- `jsdom` nije pravi browser: layout, stvarni date picker i antd animacije nisu
  pokriveni.

### FE2-13 — Pristupačnost dijaloga, tabele na uskim ekranima, dark mode FOUC, 2026-10-30

Rješava **FE-013** i **FE-021** (Talas C, #22).

**FE-013 — GasForm dijalog bez ARIA/focus trap/Escape.** Custom overlay
`fixed inset-0` nije imao nijedan `role`/`aria` atribut (grep po
`role=|aria-|onKeyDown|Escape|tabIndex` vratio je **prazno**), nijedan keydown
handler niti focus trap. Keyboard-only korisnik nije mogao zatvoriti modal, a
screen reader nije oglašavao modalni kontekst.

Dodano: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` na naslov,
Escape zatvara, Tab/Shift+Tab kruže unutar dijaloga, fokus se pri otvaranju
prebacuje u dijalog a pri zatvaranju vraća na element koji ga je imao.

**FE-013 — veći bug nađen usput: labele nisu bile povezane s inputima.**
Postavljanjem axe skena izmjeren je **CRITICAL** nalaz pravila `label`
(„Ensure every form element has a label") na `input[type="file"]`. Sondom je
utvrđeno da je uzrok širi od samog file polja: **4 od 5** labela u GasForm-u
(counter, file, date, time) **nisu imale `htmlFor`**, pa ih screen reader ne
čita uz polje, a `getByLabelText` ih ne može naći. Jedino je
`useCurrentDateTime` bila ispravno povezana. Dodano `htmlFor` + `id` na sve
četiri.

Ovo je vrijedno zabilježiti kao pouku: nalaz FE-013 je navodio samo „Switch bez
`aria-label`", a stvarno stanje je bilo gore — axe je to otkrio tek kad je
postavljen kao automatizirana provjera, ne čitanjem koda.

**FE-013 — tema Switch bez pristupačnog naziva.** `MainLayout.tsx:146` je imao
samo Tooltip, koji se screen readeru ne čita. Dodan `aria-label`.

**FE-021 — tabele bez horizontalnog skrolovanja.** Izmjeren broj kolona:
Boiler 7, Heating 6, Reports 4, Dashboard 7 — i **nijedna** `width`
deklaracija. Nijedna tabela nije imala `scroll={{ x }}` (grep po `scroll={{`
vratio prazno), a `overflow-x: hidden` na `html, body, #root`
(`index.css:34`) je prelijevanje tiho odsijecao. Dodano
`scroll={{ x: 'max-content' }}` na sve četiri, pa svaka dobija vlastiti skrol
kontejner (`.ant-table-content { overflow: auto }`) i maska ih više ne sakriva.
`'max-content'` je uzet namjerno umjesto izmišljenih fiksnih širina.

**FE-021 — dark mode FOUC.** Klasa `dark` se postavljala React `useEffect`-om
(`ThemeContext.tsx:22-30`), dakle **nakon** prvog rendera, pa je dark-mode
korisnik pri svakom reloadu kratko vidio svijetlu verziju. Dodana inline
skripta u `<head>` — dakle **prije** `<div id="root">` — koja čita
`localStorage` i postavlja klasu prije rendera.

Ključ je izvezen (`export const THEME_STORAGE_KEY`), a test uspoređuje tu
**stvarnu** konstantu s onom u `index.html`. Da je test umjesto toga regexom
tražio tekst u izvoru, promjena ključa na jednom mjestu bi prošla neprimijećeno
i tema bi se tiho resetovala pri svakom reloadu.

**Testovi: 11 novih** u `accessibility.test.tsx` — ARIA semantika 3, tastatura
3, upravljanje fokusom 2, axe sken 1, FOUC 2. Frontend ukupno **48/48**.
`axe-core@4.14.0` je uzet direktno, bez `vitest-axe` (0.1.0, neodržavan
omotač). Pravilo `color-contrast` je isključeno jer jsdom nema layout engine,
pa kontrast piksela nije pouzdano izračunat.

**Verifikacija (stvarno izmjereno):**

| Provjera | Rezultat |
| --- | --- |
| `npm test` | **48/48** |
| `tsc -p tsconfig.app.json --noEmit` | exit 0 |
| `npm run lint` | exit 0 (0 errors, 13 pre-postojeća warnings) |
| **Mutacija 1** — uklonjen `role="dialog"` | **8 testova PADA** |
| **Mutacija 2** — Escape handler onesposobljen | **1 test PADA** |
| **Mutacija 3** — uklonjen `htmlFor` s file inputa | **1 test PADA** (axe nalaz se vraća) |
| **Mutacija 4** — `THEME_STORAGE_KEY` promijenjen | **1 test PADA** |
| Restauracija | md5 + `diff` potvrdili sva 3 fajla identična backupu, suite opet 48/48 |
| CI `41072814594` | oba joba success; frontend korak 8 success |
| inventarske skripte | 9 × exit 0 (`backtest_sketch.py` exit 2 pre-postojeće) |

**Šta NIJE urađeno / NIJE verificirano:**

- **Playwright axe sken na ključnim ekranima NIJE implementiran**, i vizuelna
  provjera „tabela na 360 px skrola" te „reload bez svijetlog flasha" **nije
  izvršena**. Chromium download u sandboxu konkretno pada: „Failed to download
  Chromium 131.0.6778.33 (playwright build v1148), Download failure, code=1".
  axe sken je zato urađen u jsdomu (stvarni `axe-core`, ali bez layouta).
- **`overflow-x: hidden` je zadržan namjerno.** Tabele sada skroluju interno pa
  ih maska više ne sakriva, ali potpuno uklanjanje pravila zahtijeva vizuelnu
  provjeru na 360 px, koja ovdje nije moguća. Uklonjeno bi riskiralo
  horizontalni scrollbar iz sitnih prelijevanja koja ne mogu vidjeti.
- Ostalih 5 komponenti i 10 stranica nemaju axe sken — pokriven je samo
  GasForm.
- `jsdom` ne provjerava stvarni focus ponašanjem browsera: focus trap je
  testiran preko eksplicitnog `keyDown`, ne preko stvarnog Tab ponašanja.

### FE2-14 — Poslovna logika duplirana na klijentu (FE-010), 2026-10-30

Talas C, #23. Prvi dio (granice, magijski brojevi, semantika overshoota) urađen
je bez odluke vlasnika. Drugi dio — preseljenje health scorea i pravila
upozorenja u **jedan izvor** — urađen je nakon odluke vlasnika (tačka 5).

**1. Granice temperature duplirane na klijentu.** `MIN/MAX_CURRENT_FLOW_TEMP =
48/55` postojale su kao dvije nezavisne kopije (`BoilerPage.tsx:16-17` i
`DashboardPage.tsx:183-184`), a treća kopija je u
`mobile/src/screens/dashboard/DashboardScreen.tsx:32-33`. Dodat
`frontend/src/constants/boilerLimits.ts` kao jedinstveni izvor, s
`isWithinFlowTempRange()` i `flowTempRangeMessage()`.

**2. Ispravka nalaza: tvrdnja o 46 vs 48 ne stoji.** FE-010 tvrdi da je „UI
ograničenje 48-55 strože od backend granice 46-55 pa je dio dozvoljenog raspona
nedostižan iz weba". Provjereno:

- `backend/src/modules/Boiler/dto/set-current-temp.dto.ts:14-15` ima **`@Min(48)`
  i `@Max(55)`** — tačno kao web.
- Broj 46 potiče iz `backend/src/modules/Heating/strategies/base.strategy.ts:25`
  (`Math.max(46, Math.min(55, finalTemp))`), a to je clamp **izlaza preporuke**,
  ne ograničenje korisničkog unosa.

Nalaz je poistovjetio dvije različite veličine. Ništa nije „usklađeno" jer
neslaganja nema; umjesto toga je paritet **zaključan testom** koji čita backend
DTO i pada ako se granice raziđu.

**3. Ispravljena semantika „overshoot" (stvarni bug).** `targetTemp -
currentTemp` je pozitivan kad je trenutna temperatura **ispod** ciljne — dakle
kad se cilj ne dostiže. Poruka je glasila „Mogući overshoot", što je korisniku
govorilo **suprotno** od izmjerenog: upozorenje se palilo upravo kad prostorija
zaostaje za ciljem. Preimenovano u shortfall.

Računica je **namjerno ostala ista** da se ne promijeni koje slučajeve
hvatamo — detekcija zaostajanja je korisna. Prava detekcija overshoota
(`currentTemp - targetTemp`) bila bi drugo upozorenje i traži odluku o politici.

**4. Magijski brojevi imenovani.** 20, 3, 1.5, 90 i 15 bili su rasuti po
`DashboardPage.tsx` i nigdje dokumentovani kao politika — nalaz to izričito
traži. Izdvojeni u `frontend/src/constants/heatingAnalysis.ts` s izričitom
oznakom da su **privremena politika preuzeta 1:1 iz postojećeg koda, bez
stručne potvrde**. `computeHealthScore()` izdvojen kao funkcija.

**Verifikacija (stvarno izmjereno):**

| Provjera | Rezultat |
| --- | --- |
| `npm test` | **59/59** (11 novih) |
| `npm run type-check` | exit 0 |
| `npm run lint` | exit 0 (0 errors, 13 pre-postojeća warnings) |
| **Mutacija 1** — uklonjen clamp u `computeHealthScore` | **1 test PADA** |
| **Mutacija 2** — donja granica isključiva (`>=` u `>`) | **1 test PADA** |
| **Mutacija 3** — backend DTO `@Min(48)` → `@Min(46)` | **1 test PADA** (paritet hvata) |
| **Mutacija 4** — `TARGET_SHORTFALL_WARN_C` 1.5 → 2.0 | **1 test PADA** |
| Restauracija | `diff` potvrdio sva 3 fajla identična backupu, suite opet 59/59 |
| CI `41098248837` | oba joba success; frontend korak 8 success |
| inventarske skripte | 9 × exit 0 (`backtest_sketch.py` exit 2 pre-postojeće) |

Mutacija 3 je ovdje najvažnija: dokazuje da paritet test **stvarno** čita
backend i pada kad se server promijeni, umjesto da samo uspoređuje dvije
vrijednosti unutar frontenda.

**5. Odluka vlasnika: health score i upozorenja u backend (jedan izvor).**

Vlasnik je 2026-10-30 odabrao **backend endpoint** umjesto shared modula, i
**oba** upozorenja (shortfall i overshoot) umjesto samo jednog.

Dodan `GET /api/dashboard/health` (commit `7c3023e`):

| komponenta | ponder | izračun |
| --- | --- | --- |
| `learningConfidence` | **35** | prosjek `HeatingIntervalLearning.confidence` × 100 |
| `flowDelta` | **25** | clamp(100 − abs(`actualFlowTemp` − `suggestedFlowTemp`) × 12.5) |
| `thermostatFreshness` | **25** | udio uređaja s `lastSeen` ≤ 10 min × 100 |
| `anomalyRate` | **15** | clamp(100 − (anomalije ÷ uzorak) × 100) |

Usvojena je **ponderisana** (mobilna) formula jer sadrži više signala; web
verzija s jednim faktorom bila bi regresija. Komponente bez podataka se
izostavljaju, a rezultat se normalizuje po sumi pondera dostupnih; fallback je
**50**. Ponderi su preuzeti 1:1 iz postojećeg mobilnog koda i **nisu stručno
potvrđeni** — to je zabilježeno u doc-komentaru samog modula, ne samo ovdje.

Upozorenja (`buildHealthWarnings`): `shortCycles` (warning) · `targetShortfall`
(warning) · **`targetOvershoot` (warning, novo)** · `longCycles` (info) ·
`anomalies` (error). Shortfall i overshoot su odvojena pravila i **ne smiju se
paliti istovremeno** — test to zaključava.

Logika je u `backend/src/common/heating-health.ts` kao **čista** funkcija (bez
Prisma/DI), pa je testabilna bez baze — lokalno nema postgres-a.
`durationMinutes` koristi istu semantiku kao `getHeatingEvents()`.

Frontend sada čita endpoint (`apiClient.getDashboardHealth()`), a
`frontend/src/constants/heatingAnalysis.ts` je **obrisan** — zadržati ga značilo
bi vratiti upravo onu duplikaciju koju FE2-14 uklanja. Testovi te logike žive u
`backend/src/common/tests/heating-health.spec.ts`.

**⚠️ Promjena ponašanja koju treba znati:** backend računa upozorenja nad
zadnjih `HEALTH_EVENT_SAMPLE` (20) događaja, bez obzira na odabrani raspon, dok
je DashboardPage prije koristio raspon iz date pickera (do 500 događaja). Panel
je sada „ukupno stanje sistema", a ne „analiza odabranog raspona".

**Verifikacija backend dijela (stvarno izmjereno):**

| Provjera | Rezultat |
| --- | --- |
| `jest src/common/tests/heating-health.spec.ts` | **23/23** |
| `jest src` (CI annotation) | **448 passed, 0 failed**, 33 suites (bilo 425 → +23) |
| backend `tsc` (CI komanda) | 1 greška — `gas.reading.service.ts:467`, fajl koji NIJE diran |
| `eslint` na svih 5 fajlova | 0 problema (11 `prettier` grešaka ispravljeno `--fix`) |
| `openapi:generate --check` | exit 0; **57 ruta** (bilo 56), **55 šema** (bilo 51) |
| frontend `openapi:check` | exit 0 („tipovi su usklađeni s ugovorom") |
| frontend `npm test` | **53/53** (bilo 59 — 6 testova `heatingAnalysis` uklonjeno zajedno s logikom) |
| `backend_inventory.py` | exit 0; common **22/22**, route **73/73** |
| inventarske skripte | 10 × exit 0 |
| CI `41102580016` | oba joba success; tsc 0, eslint 0 |

Test je uhvatio stvarnu grešku u mojoj implementaciji: `clampScore` je koristio
`!Number.isFinite`, pa je `+Infinity` vraćao `0` umjesto `100`, poistovjećujući
„nevalidno" (NaN) s „iznad granice". Ispravljeno na `Number.isNaN`.

Jedini pad u `jest src` (`maint2-nontest-guard.spec.ts`) je **pre-postojeći** —
potvrđeno preko `git stash push -u` / `pop`: pada i bez mojih izmjena.

**Šta je ostalo otvoreno.**

- **Mobile ne konzumira endpoint.** `DashboardScreen.tsx` i dalje računa
  ponderisanu formulu lokalno. Formula je sada *usaglašena* s backendom pa je
  broj isti, ali duplikacija nije uklonjena. `mobile/` nema CI ni test runner
  (`npm test` exit 127), pa se taj dio **ne može verificirati ovdje**.
- **Treća kopija granica 48/55** u `DashboardScreen.tsx:32-33` nije dirana.
- **Endpoint nije pozvan kroz pravi HTTP stack** — nema e2e niti integracionog
  testa za `GET /api/dashboard/health`; lokalno nema postgres-a.
- **Ponderi nisu stručno potvrđeni** — preuzeti 1:1 iz postojećeg koda.

### FE2-4 — Code-splitting frontend bundlea (FE-004), 2026-10-30

Talas C, #24. Commit `b8cd9cf`.

> **⚠️ NAKNADNA ISPRAVKA 2026-10-30 (`95ab2a0`).** Ovaj korak je proglašen
> završenim uz zelen CI (run `41114017716`), ali je **isporučio bundle koji se
> ruši pri učitavanju — korisnik bi vidio potpuno prazan ekran.**
>
> `manualChunks` je izdvojio `@ant-design/icons` u `vendor-icons`, dok je
> `rc-util` (od kojeg icons zavisi) preko obrasca `/rc-/` išao u `vendor-antd` —
> a antd bezuslovno importuje icons. Nastao je **kružan odnos među čipovima**
> (`vendor-antd ↔ vendor-icons`), pa je pri evaluaciji čitan binding koji još
> nije inicijaliziran:
>
> ```
> TypeError: Cannot read properties of undefined (reading 'primary')
>   at vendor-icons-*.js      (B(P.primary), P uvezen iz vendor-antd)
> ```
>
> React se zato uopšte nije mountovao. **Nijedna mjera kojom je FE2-4 verificiran
> to nije mogla vidjeti**: Vitest, `tsc` i `eslint` čitaju izvorni kod a ne
> bundle, a `curl /` vraća 200 jer je HTML ispravan — pada tek JS.
>
> Ispravka: `@ant-design/icons` ide u **isti čip** kao antd (20 čipova umjesto
> 21; inicijalni payload nepromijenjen, jer su icons i ranije bili u inicijalnom
> učitavanju). Trajnu zaštitu dodaje `scripts/audit/frontend_chunk_graph.cjs`
> (CI korak „Bundle evaluates and renders"), koji provjerava kružne odnose u
> grafu čipova **i** stvarno evaluira entry čip u jsdom-u, tvrdeći da se login
> forma renderuje.
>
> **Pouka:** „CI zelen" nije dokaz da aplikacija radi ako nijedan korak ne
> izvršava sagradjeni artefakt.

**Nalaz i njegova ispravka.** FE-004 je tvrdio da je aplikacija jedan JS čip od
„2.972 kB (gzip 905 kB)". Ponovljeni bazni build 2026-10-30 daje
`dist/assets/index-BQxeVzm2.js 2,975.35 kB │ gzip: 906.26 kB` — broj u nalazu je
**tipfeler**, ne promjena koda. Suština nalaza je stajala: jedan čip, bez lazy
ruta, bez `rollupOptions`, i Vite sam emituje upozorenje „>500 kB".

**Šta je bilo pogrešno.** `App.tsx` je statički importovao svih 10 stranica, pa
je svaka posjeta — uključujući `/login` — preuzimala i parsirala React + antd +
`@ant-design/plots` + react-query + axios + dayjs + i18next + svih 10 stranica.
`@ant-design/plots` koristi **samo** `DashboardPage.tsx:6` (provjereno:
`grep -rn "@ant-design/plots" frontend/src/` → samo ta linija i
`types/ant-design-plots.d.ts`), ali je bio u inicijalnom payloadu za svaku rutu.

**Izmjene.**

1. `frontend/src/App.tsx` — svih 10 stranica preko `React.lazy` unutar jednog
   `Suspense` boundary-ja. Stranice izvoze **imenovane** (`export function
   LoginPage`), a `lazy()` traži default izvoz, pa svaki poziv mapira modul:
   `.then((m) => ({ default: m.LoginPage }))`. `RouteFallback` je namjerno
   običan `<div>` **bez antd-a** — antd ionako dolazi s prvom stranicom koja ga
   treba, a `<Spin>` u fallbacku bi povukao antd u inicijalno učitavanje.
2. `frontend/vite.config.ts` — `build.rollupOptions.output.manualChunks(id)`.
   Grupisanje je po **porodici** paketa, ne po pojedinačnom paketu: antd vuče
   `rc-*` / `@rc-component/*`, a `@ant-design/plots` vuče `@antv/*` i `d3-*`.
   Dijeliti roditelja od njegove zavisnosti u dva čipa rizikuje greške
   inicijalizacije pri pokretanju, pa idu zajedno. `@ant-design/plots` se
   provjerava **prije** `@ant-design/icons` jer oba počinju s `@ant-design/` —
   kod ugniježđene instalacije (`plots/node_modules/icons`) to drži ikone uz
   plots. `server.port: 80` je zadržan nepromijenjen.
3. `frontend/src/__tests__/codeSplitting.test.ts` — 11 regresijskih testova.
   Čitaju izvor preko Vite-ovog `?raw` sufiksa i `import.meta.glob`, **ne**
   preko `node:fs`: u jsdom okruženju `import.meta.url` nije `file:` URL, pa
   `new URL(…, import.meta.url)` baca `TypeError: The URL must be of scheme
   file` (izmjereno — prva verzija testa je tako i pala).

**Izmjereno (`npm run build`, 21 čip).**

| | prije | poslije |
|---|---|---|
| početni čip | `index-BQxeVzm2.js` 2.975,35 kB / gzip 906,26 kB | `index-CldOGUOq.js` **28,20 kB / gzip 9,33 kB** |
| inicijalni JS (referenciran u `dist/index.html`) | 2.975,35 kB / gzip 906,26 kB | **1.434,19 kB / gzip 451,87 kB (−51,8% / −50,1%)** |
| ukupna masa JS-a | 2.975,35 kB | 2.969,62 kB (**−0,19%** ⇒ kod nije izgubljen, samo preorganizovan) |

`index.html` referencira tačno 8 JS fajlova: `index`, `vendor-react`,
`vendor-query`, `vendor-router`, `vendor-utils`, `vendor-icons`, `vendor-antd`,
`vendor-i18n`. **`vendor-plots` (1.467,02 kB) i `DashboardPage` (19,79 kB) nisu
među njima** — dohvaćaju se tek kad se ruta posjeti. `LoginPage` čip je 1,75 kB.

**Verifikacija.** `npx vitest run` → **6 fajlova / 64 testa passed** (bilo
5 fajlova / 53). `npm run type-check` EXIT=0. `npm run lint` EXIT=0 — 13
upozorenja, 0 grešaka, i **nijedno** upozorenje nije u `App.tsx`,
`vite.config.ts` niti u novom testu (svih 13 je u postojećim stranicama).
`npm run build` EXIT=0 i deterministički (ponovljeni build daje iste hashove).

**Mutacijska provjera** — da test nije prazan. Pet mutacija, svaka ruši test:

| mutacija | rezultat |
|---|---|
| dodat statički `import { ReportsPage } from './pages/ReportsPage'` | 1 failed ✅ |
| `manualChunks` → `manualChunksX` | 6 failed ✅ |
| `return 'vendor-plots'` → `return 'vendor-antd'` | 6 failed ✅ |
| `id.includes('@ant-design/icons')` premješten **prije** plots | 1 failed ✅ |
| `id.includes('@ant-design/plots')` → `'@ant-design/XYZ'` | 6 failed ✅ |

Kontrolni prolaz nakon vraćanja: 11/11. **Dvije asertcije su prvo lažno
prolazile i morale su biti popravljene:** `toContain('manualChunks')` preživljava
`manualChunksX`, a `indexOf('@ant-design/plots')` pogađa **komentar** iznad
funkcije pa je mjerenje redoslijeda bilo bezvrijedno — sada se traži
`manualChunks\s*[:(]` odnosno `id.includes('@ant-design/plots')`.

**Šta je ostalo otvoreno.**

- **LCP nije izmjeren.** Kriterij prihvatanja iz backloga traži LCP na
  emuliranoj sporoj vezi; Playwright browser CDN nije dostupan u ovom okruženju
  (`npx playwright install chromium` → `Download failure, code=1`), a ciljni
  prag nikad nije dogovoren s vlasnikom. Taj dio prelazi na **FE2-7** (mjeranje
  u CI). Veličina payloada je izmjerena i pada za ~50%; **vrijeme** prvog
  rendera nije.
- **Runtime render `Suspense` fallbacka nije viđen u pregledniku** — nema e2e,
  pa se ne zna kako fallback izgleda na stvarnoj mreži niti koliko traje.
- **`vendor-antd` (997,89 kB / gzip 310,35 kB) je i dalje u inicijalnom
  payloadu** i najveći je pojedinačni čip. Daljnje dijeljenje antd-a nije
  rađeno jer antd dijeli gotovo svaka stranica, pa bi korist bila mala.
- **Vite i dalje upozorava** „Some chunks are larger than 500 kB" — zbog
  `vendor-antd` i `vendor-plots`. Upozorenje `expo/tsconfig.base` je
  **pre-postojeće** (pojavljuje se 2× i u baznom buildu, prije ikakve izmjene).
- Ukupna gzip masa je neznatno **veća** (908,94 vs 906,26 kB) jer svaki čip nosi
  vlastiti module wrapper — to je očekivana cijena splittinga i ne utiče na
  inicijalno učitavanje, koje je prepolovljeno.

### FE2-7 — Jedan mjerodavni deploy set + build bez localhost fallbacka (FE-009), 2026-10-30

Talas C, #25. Commit `1761876`.

**Odluke vlasnika (2026-10-30).** (1) Mjerodavan je **korijenski** `docker-compose.yml`
s API hostom `api.boiler-control.ba101.top/api`; `frontend/` varijanta se briše.
(2) Dev fallback se uklanja tako da **build pada**. (3) e2e ide u CI iako se
lokalno ne može izvršiti.

**Bug koji nalaz FE-009 nije spominjao.** `frontend/src/services/api.ts:11` je
imalo:

```js
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3020/api';
```

a `frontend/Dockerfile` ima `ARG VITE_API_URL` **bez defaulta**. Build pokrenut
bez tog arga **nije padao** — samo bi u `dist/` ugradio localhost. Deployovana
aplikacija bi onda zvala korisnikov vlastiti stroj, a simptom bi bio „učita se
ali ništa ne radi". Ovo je ozbiljnije od samog nesklada compose fajlova.

**Proturječnost compose setova (verificirano čitanjem fajlova).**

| | varijanta A — korijenski | varijanta B — `frontend/` + `backend/` |
|---|---|---|
| API URL | `https://api.boiler-control.ba101.top/api` | `/backend/api` (relativan) |
| frontend port | `expose: 80` ✅ poklapa se s `nginx.conf` `listen 80` | `expose: 3021` ❌ nginx sluša 80 |
| traefik | **nema nijedne labele** ⇒ frontend nedostupan | ima, `boiler.ba101.top` + `PathPrefix(/backend/)` + stripprefix |
| mreža | frontend **nema** `networks` | `web` |

**Zašto u mjerodavnom setu NEMA `stripprefix`.** `grep -n "setGlobalPrefix"
backend/src/main.ts` → **nema ga**; kontroleri nose prefiks sami
(`@Controller('api/dashboard')`, `dashboard.controller.ts:36`). Klijent pogađa
`https://api.boiler-control.ba101.top/api/dashboard/health`, Traefik to
prosljeđuje nepromijenjeno, backend već vidi `/api/dashboard/health`. Skidanje
`/api` bi dalo 404 na svim rutama. Hostovi **nisu izmišljeni** — oba su već bila
u korijenskom fajlu, a `main.ts:16-19` baca grešku ako `FRONTEND_URL` nedostaje
i koristi ga kao CORS `origin`.

**Izmjene.**

1. `api.ts` — fallback uklonjen: `(import.meta.env.VITE_API_URL ?? '').trim()`.
2. `vite.config.ts` — `requireApiBaseUrl()` plugin ruši `vite build` ako
   varijabla izostane. Guard je namjerno **build-time, ne runtime**: `api.ts` se
   importuje i u Vitest testovima gdje varijabla nije postavljena, pa bi runtime
   throw srušio cijeli suite. `command !== 'build'` poštedi dev i preview —
   **provjereno**: `vite preview` se podigne na 4173 i ne pada.
3. `docker-compose.yml` — traefik labele + mreža `web` za oba servisa.
4. `frontend/docker-compose.yml` — **obrisan**.
5. `backend/docker-compose.yml` — označen zamijenjenim (FE2-7 dopušta „ukloniti
   **ili** označiti"; brisanje bi bilo neopozivo bez pristupa serveru).
6. `frontend/.env.example` — šablon; `.gitignore` ga izričito dozvoljava.
7. CI (frontend job, **13 koraka**) — job-level `VITE_API_URL` (jedna vrijednost
   za build **i** e2e, da e2e ne prolazi nad drugim base-om), `docker compose
   config`, audit skripta, provjera ugrađenog base-a, `type-check:e2e`,
   Playwright install, e2e smoke. `timeout-minutes` 15 → 25.

**Testovi.** `src/services/__tests__/apiBaseUrl.test.ts` (5) je namjerno
**bihevioralan** — čita stvarni axios `baseURL`, ne grep nad izvorom, pa pada i
ako se fallback vrati kroz drugi izraz. `e2e/smoke.spec.ts` (4) radi nad
sagrađenim `dist/` preko `vite preview`. `scripts/audit/frontend_deploy_config_repro.cjs`
ima 8 provjera bez dockera.

**Verifikacija (lokalno).** `type-check` src EXIT=0; `type-check:e2e` EXIT=0;
`lint` 0 grešaka / 13 pre-postojećih upozorenja; **vitest 7 fajlova / 69 testova**
(bilo 6/64); `openapi:check` EXIT=0; build **bez** arga EXIT=1 s jasnom porukom;
build **s** argom EXIT=0, 21 čip; svih 10 audit skripti EXIT=0. `vite preview`:
`GET /` → 200 (8 JS referenci, FE2-4 splitting netaknut), entry čip 200,
**API base ugrađen (1 pojava), `localhost:3020` odsutan (0)**, SPA fallback
`/login` → 200. Shell fragmenti iz workflowa pokrenuti lokalno: pozitivno
prolazi, negativno (ubacen localhost u `dist/`) pada s exit 1.

**Mutacijska provjera.** Audit skripta — 9 mutacija, svaka pada: vraćen
fallback; `expose` 80→3021; vraćen `frontend/docker-compose.yml`; dodan
stripprefix; promijenjen `VITE_API_URL`; `FRONTEND_URL` na pogrešan host;
`FRONTEND_URL` uklonjen; traefik port 80→3021; prazan compose. Unit test — 3
mutacije: `||` fallback (4 pada), `??` fallback (1 pad), uklonjen `.trim()`
(1 pad).

**Moje greške ovog koraka, ispravljene.**

- **`??` mutacija je prvo prolazila.** `vi.stubEnv('VITE_API_URL', '')` postavlja
  **prazan string**, a `'' ?? 'x'` vraća `''` — pa test nikad nije pokrivao
  slučaj kad varijabla **stvarno nedostaje**, što je upravo produkcijski
  scenario. Dodan zaseban test s `undefined`.
- **Dvije mutacije compose-a su bile prazne.** `open(p,'w').write(open(p).read())`
  prvo **truncira** fajl pa onda čita prazno — mutacije su zapisale prazan fajl,
  a skripta je pukla na `undefined.services` umjesto da padne na asertciji.
  Ispravljeno i dodan eksplicitan assert na parsiranje.
- **Treća mutacija je pogodila komentar.** Anchor `FRONTEND_URL=...` prvi put
  pogađa zaglavlje-komentar u compose fajlu, ne stvarni env unos. Isti obrazac kao
  `indexOf` nad komentarom u FE2-4.
- **`localhost:3020` provjera je prvo lažno padala** jer JSDoc u `api.ts`
  namjerno dokumentuje uklonjeni fallback. Riješeno pravim state machine-om za
  skidanje komentara (naivni `//.*$` ne ide jer URL-ovi sadrže `//`).
- **`playwright.config.ts` je imao `/health` kao readiness URL**, ali `vite
  preview` servira statički `dist/` i ne koristi `nginx.conf` — `/health` tamo
  nije endpoint. Promijenjeno na `/`.
- **Najozbiljnije: `curl` 200 sam tretirao kao dokaz da aplikacija radi.** Za
  FE2-4 sam napisao da je „entry čip 200, API base ugrađen, `localhost:3020`
  odsutan" i time proglasio bundle ispravnim. HTTP 200 dokazuje samo da
  **server** radi i da je HTML ispravan — ne i da se JS izvršava. Bundle je u
  tom trenutku padao pri evaluaciji (kružni čipovi iz FE2-4) i aplikacija bi
  prikazala prazan ekran. Otkriveno je tek kad je e2e u CI stvarno otvorio
  stranicu i nije našao nijedan element. **Pouka: nijedan artefakt nije
  verificiran dok se ne izvrši.**
- **Prva verzija nove audit skripte je sama bila nepouzdana.** Dinamička
  evaluacija u jsdom-u nije izlagala `ShadowRoot` kao global, pa je antd-ov
  `rc-util` bacio `ReferenceError` i React se unmountao (`#root` pao na 0
  znakova). Izgledalo je kao bug aplikacije, a bio je propust moje probe —
  ispravljeno, i mutacijski potvrđeno (uklanjanje `ShadowRoot` ruši provjeru).
- `@types/node` je nedostajao, pa `type-check:e2e` nije prolazio; instaliran
  `^22.20.5`. Provjereno da to nije srušilo type-check nad `src`.

**Šta je ostalo otvoreno.**

- **Djelimično verificirano u CI (run `41127519323`, `completed success`, svih
  15 koraka `success`).** Lokalno ovo nije bilo moguće — docker nije instaliran,
  a Chromium download pada (`ECONNRESET` na `150.171.110.151`, `code=1`). CI je
  potvrdio:
  - ✅ `docker compose -f docker-compose.yml config --quiet` (korak „Deploy
    config consistent") — mjerodavni set se parsira.
  - ✅ `node scripts/audit/frontend_deploy_config_repro.cjs` (isti korak).
  - ✅ `node scripts/audit/frontend_chunk_graph.cjs` (korak „Bundle evaluates and
    renders") — bundle se evaluira i login forma se renderuje.
  - ✅ **e2e smoke: `4 passed (3.4s)`** — iz anotacije `🎭 Playwright Run
    Summary`, 0 failure anotacija. Testovi su stvarno izvršeni, nisu preskočeni.
- **`docker build` i dalje NIJE verificiran nigdje.** Nijedan CI korak ne gradi
  frontend image, pa `ARG VITE_API_URL` bez defaulta + build guard nisu
  isprobani kroz stvarni Dockerfile. Ovo je jedini preostali dio koji se ne
  poklapa između lokalnog `npm run build` i onoga što produkcija stvarno gradi.
- **Stvarno stanje servera nije provjereno i ne može se provjeriti iz
  repozitorija:** postoji li traefik mreža `web` pod tim imenom, postoji li
  certresolver `le`, i pokazuje li DNS za `api.boiler-control.ba101.top` na taj
  traefik. Imena su preuzeta iz obrisane varijante i `docker-compose.monitoring.yml`.
- **Traefik labele nikad nisu pokrenute protiv stvarnog traefika** — sintaksa je
  prepisana iz postojećih fajlova u repu, ne potvrđena izvršavanjem.
- **CORS cross-origin tok nije testiran.** Frontend `boiler-control.ba101.top` →
  API `api.boiler-control.ba101.top` je cross-origin; backend `origin` je fiksna
  vrijednost iz `FRONTEND_URL`. Vrijednosti se poklapaju, ali stvaran preflight
  nije izvršen (S-009 repro nije proširen).
- **`/health` nije provjeren kroz nginx** — postoji samo kao compose healthcheck
  i nginx `location = /health`; `vite preview` ga ne servira.
- `backend/docker-compose.yml` je i dalje u repu i i dalje proturječan
  mjerodavnom setu (isto `container_name`, drugaciji host, stripprefix, bez
  `FRONTEND_URL`). Označen je, ne obrisan.

### MO2-16 — Permisije, nešifriran cache dokumenata i inertna dugmad u postavkama (MO-025, MO-020, MO-019), 2026-10-30

Talas C, #27.

**Nalaz je bio djelimično pogrešan, i to u dijelu koji određuje popravku.**
`07-implementation-plan.md:116-132` implicira da se višak permisija uklanja kroz
`expo-build-properties`. Mjerenje pokazuje drugo:

- `grep -rl RECORD_AUDIO --include=AndroidManifest.xml mobile/node_modules` →
  **0 pogodaka**. Nijedan paket ne deklarira tu permisiju u svom manifestu.
- Stvarni izvor je **config plugin paketa `expo-image-picker`**:
  `node_modules/expo-image-picker/plugin/src/withImagePicker.ts:66-68` i
  `:130-132` dodaju `RECORD_AUDIO` **osim ako** je `microphonePermission === false`
  (`:75`, `:139`). Plugin se pokreće **autolinkingom**, bez ijedne linije u
  `app.config.js` — zato `grep` po `mobile/` nije našao ništa, a nalaz je izgledao
  kao da permisija dolazi „iz build propertija".
- `expo-build-properties` u ovom projektu postavlja samo `compileSdk`,
  `targetSdk`, `buildArchs` i minify flagove — **ne permisije**.

Popravka je zato u `plugins`, ne u `expo-build-properties`.

**Zvuk se nigdje ne koristi:** `grep -rn "expo-av|Recording|recordAsync" mobile/src/`
→ **0 pogodaka**. Permisija je bila čist višak, bez funkcionalnog gubitka.

**Izmjena 1 — permisije (`mobile/app.config.js:86`).** Dodan
`['expo-image-picker', { microphonePermission: false }]` u `plugins` niz.

Mjerenje `npx expo config --type introspect --json` (EXIT=0), prije → poslije:

| | prije | poslije |
|---|---|---|
| `android.permissions` | 4 | **3** |
| `RECORD_AUDIO` u config listi | prisutna, **bez `maxSdkVersion`** (važi na svim Android verzijama) | **odsutna** |
| `RECORD_AUDIO` u merged manifestu | običan `<uses-permission>` | `{"tools:node":"remove"}` |

`tools:node="remove"` je **jače** od pukog izostavljanja: to je uputa Android
manifest mergeru da unos ukloni, pa ga nijedan drugi paket ne može vratiti
merge-om. `grep -c '"tools:node":"remove"'` nad cijelim izlazom = **1**.

**Kamera nije dirnuta.** `CAMERA` se **ne pojavljuje** u `expo config --type
introspect` ni prije ni poslije (0 pogodaka), jer je deklarira
`node_modules/expo-image-picker/android/src/main/AndroidManifest.xml` i ulazi
native merge-om. Odsustvo u config izlazu **nije** dokaz da je kamera slomljena —
a stvarno se koristi: `GasForm.tsx:144` i `GasReadingsScreen.tsx:485`
(`launchCameraAsync`). Da sam „dokaz" tražio samo u config izlazu, zaključio bih
pogrešno u oba smjera.

**Storage permisije su namjerno ostavljene.** `READ_/WRITE_EXTERNAL_STORAGE`
dolaze iz manifesta `expo-file-system` i `expo-image-picker`, **oba s
`maxSdkVersion="32"`** uz `tools:replace="android:maxSdkVersion"`. Uz `minSdk 24` /
`targetSdk 35` važe samo na Android ≤12. `withImagePicker.ts:144-145` ih
eksplicitno ne blokira, jer bi to slomilo izbor slika na starijim uređajima.

**Izmjena 2 — cache dokumenata.** Novi servis
`mobile/src/services/storage/downloadCache.ts` (`getDownloadsDirectory`,
`purgeDownloadsDirectory`) je **jedan izvor istine** za putanju
`${cacheDirectory}downloads/`. Prije je `GasReadingsScreen` sastavljao putanju
sam, pa bi „Clear cache" u postavkama mogao brisati **drugi** direktorij nego što
ekran puni — ista klasa greške kao tri kopije granica 48/55 u ovom projektu.

Prije: fakture i slike brojila ostajale su **trajno** u nešifriranom cacheu —
`deleteAsync` se nije pojavljivao **nigdje** u fajlu. Sada:
`GasReadingsScreen.tsx:94` čisti direktorij pri mountu, a `:343` uzima putanju iz
servisa.

**Zašto se NE briše odmah nakon otvaranja**, iako backlog traži „nakon otvaranja
dokumenta pozvan `deleteAsync`": `openLocalFile` (`:320`) koristi
`IntentLauncher.startActivityAsync` (`:323`), koji se rezolvira čim se vanjski
preglednik **pokrene**, ne kad završi s čitanjem fajla. Trenutno brisanje bi
korisniku slomilo pregled dokumenta — popravljen nalaz, slomljena funkcija.
Čišćenje pri mountu daje isti sigurnosni rezultat (ništa ne preživi sesiju) bez
te utrke.

**Izmjena 3 — postavke (`SettingsScreen.tsx`).** `console.log('Clear cache')` →
`handleClearCache` (`:97`): stvarno brisanje plus toast s brojem obrisanih
fajlova. Novi i18n ključevi dodani su u **oba** bloka (`enUS` 609-616, `bsBS`
1218-1225); da su dodani samo u jedan, bosanski korisnik bi umjesto poruke dobio
sirovi ključ.

**„Export data" je analytics izvoz. PRIV-1 postoji kao zasebna GDPR stavka, ali nije implementiran.**
`backend/src/modules/Auth/auth.controller.ts` nema nijednu rutu za izvoz ili
brisanje naloga. `ExportAnalyticsDto` pripada dashboard analytics izvozu, ne
GDPR izvozu naloga. Umjesto izmišljanja
endpointa, dugme vodi na **postojeći, već implementiran** izvoz u Analitici
(`analyticsApi.exportAnalytics` → `GET /api/dashboard/export`, vraća CSV;
`AnalyticsScreen.tsx` `handleExport`). Kad PRIV-1 bude implementiran,
`handleExportData` (`:128`) se preusmjerava na njega.

**Verifikacija.**

| Provjera | Rezultat |
|---|---|
| `npx expo config --type introspect --json` | EXIT=0; `android.permissions` 4→3; `RECORD_AUDIO` `tools:node="remove"` |
| `npm run type-check` (`tsc --noEmit`, `include: ['src','App.tsx','index.js']`) | **EXIT=0** — pokriva i novi servis |
| legacy API potpisi | `getInfoAsync` / `deleteAsync(uri, options)` / `readDirectoryAsync` postoje (`expo-file-system/build/legacy/FileSystem.d.ts:25,64,88`) |
| `launchCameraAsync` i dalje prisutan | `GasForm.tsx:144`, `GasReadingsScreen.tsx:485` |
| CI (run `41131075521`, commit `0ede7d5`) | **`completed success`** — job `test` 21 korak, job `frontend` 18 koraka, **0 failure anotacija** |

**Nijedan unit test nije izvršen.** `mobile/` nema test runnera: `npm test` →
**EXIT=127, `sh: 1: jest: not found`**, a `package.json` nema `jest` ključ.
Backlog traži „test: nakon otvaranja dokumenta pozvan `deleteAsync`" — taj test
**nije izvršiv** bez MO2-8, a `MASTER-ROADMAP.md:259-260` izričito zabranjuje
usputno popravljanje mobilnih testova. Jest nije instaliran.

**Moje greške ovog koraka, ispravljene.**

- **Prvo mjerenje `modResults` je ispalo prazno i izgledalo je kao da fix ne
  radi.** Tražio sam `mods.android.manifest.uses-permission`; stvarna putanja je
  `_internal.modResults.android.manifest.manifest.uses-permission`. Da sam ostao
  pri prvom ispisu, objavio bih pogrešan zaključak o vlastitoj izmjeni.
- **`as never` cast je slomio type-check** (`TS2345: Argument of type
  '["Main", never]' is not assignable to parameter of type 'never'`).
  `useNavigation()` bez generika vraća prazan `RootParamList`, pa overload za
  ugniježđenu navigaciju ne prolazi — isti razlog zašto
  `notificationService.ts:25` drži `NavigationContainerRef<any>`. Riješeno
  lokaliziranim tipiziranim castom, ne `as any`.
- **Prva verzija purge `useEffect`-a je imala mrtvu varijablu** (`cancelled` se
  dodjeljivala ali nikad čitala). Uklonjeno prije commita.

**Šta je ostalo otvoreno.**

- **Nije verificiran finalni `AndroidManifest.xml` u EAS buildu** — `eas-cli` nije
  dostupan u ovom okruženju. Dokaz je `expo config --type introspect`, koji je
  mjerodavan za merged manifest prije pakovanja, ali nije isto što i manifest
  unutar APK-a.
- **Runtime ponašanje čišćenja nije viđeno** — nema jest-a ni emulatora, pa
  `purgeDownloadsDirectory` nije izvršena nad stvarnim fajlovima.
- **PRIV-1 postoji, ali i dalje nije implementiran** — izvoz/brisanje naloga
  (`backend/09-improvements-backlog.md:33`) nije implementiran; „Export data" je
  preusmjeravanje na postojeći izvoz, ne izvoz naloga.
- **`SettingsScreen.tsx:446` („Help") i `:452` („Terms") su i dalje
  `console.log`** — izvan obima MO2-16.
- **Vlasnička odluka o Play obrascu** (pristup fajlovima) iz backloga nije
  riješena i ne može se riješiti iz koda.

### MO2-6 — Settings prekidači bez efekta i bez perzistencije (MO-008), 2026-10-30

Talas C, #28.

**Nalaz je tačan, ali nepotpun.** Backlog kaže da tri prekidača „pozivaju
deprecated no-op". Mjerenje pokazuje da je to tačno samo za jedan:

| prekidač | stanje prije | šta je `onToggle` stvarno radio |
|---|---|---|
| `notificationsEnabled` (`:45`) | `useState(true)` | **ništa** — samo `setNotificationsEnabled(...)`, bez ijednog poziva |
| `pushEnabled` (`:46`) | `useState(true)` | **ništa** — samo `setPushEnabled(...)` |
| `dailyGasReminder` (`:47`) | `useState(true)` | zvao no-op (vidi ispod) |

Dva od tri prekidača nisu zvala **čak ni** no-op — bila su čisti lokalni state.
To je gore nego što nalaz opisuje: korisnik prebaci prekidač, vidi animaciju,
izađe iz ekrana i sve se vrati na `true`.

**No-op funkcije su bile potpuno prazne.** `scheduleDailyGasReadingReminder` i
`cancelDailyGasReadingReminder` (`notificationService.ts:213-233`) imale su tijelo
koje je sadržavalo **samo** `console.log` s napomenom da podsjetnike šalje backend.
`SettingsScreen` ih je zvao na svako prebacivanje **i** na mount (`:67,69,76`), pa
je prekidač djelovao funkcionalno.

**Šta stvarno postoji na backendu.**

- `GET /api/notifications/preferences` (`notifications.controller.ts:97-130`) —
  vraća preferencije, a ako ih nema, kreira zadane za **šest** tipova.
- `PATCH /api/notifications/preferences` (`:133-152`) — `upsert` po
  `userId_type`.
- Tipovi su Prisma enum `NotificationType` (`schema.prisma:319`):
  `DAILY_RECOMMENDATION`, `FLOW_TEMP_CHANGED`, `HEATING_STARTED`,
  `HEATING_ENDED`, `SYSTEM_ALERT`, `GAS_READING_REMINDER`.
- **Backend nema „master" prekidač za obavijesti.** Zato `notificationsEnabled` i
  `pushEnabled` nemaju parnjaka na koji bi se mogli vezati.

**Korekcija nalaza B-010.** Backlog upozorava „ne slati nepostojeće tipove", što
implicira da bi izmišljeni tip tiho napravio smeće u bazi. Mjerenje pokazuje
drugačije: `@Body() body: { type: NotificationType; enabled: boolean }` je običan
TS tip bez DTO klase i bez `class-validator` dekoratora, pa ga globalni
`ValidationPipe` (`main.ts:36-42`) **preskače** — HTTP validacije stvarno nema.
Ali kolona `type` je Prisma **enum**, ne `String`, pa izmišljena vrijednost pada
na nivou baze. Posljedica je 500 umjesto 400, ne tiho smeće.

**Izmjene.**

1. `dailyGasReminder` → vezan na stvarni `PATCH` s tipom
   `GAS_READING_REMINDER`. Optimistično postavi stanje, pri grešci ga **vrati** —
   inače bi prekidač lagao da je promjena prošla. Stanje se na mount čita s
   backenda; dok se ne učita, prekidač je onemogućen (`isLoadingGasReminder`).
2. `notificationsEnabled` i `pushEnabled` → **uklonjeni kao prekidači.** Njihovo
   jedino iskreno stanje je OS dozvola, pa jedan red sada prikazuje stvarni
   `Notifications.getPermissionsAsync().status` i nudi `Linking.openSettings()`.
   Aplikacija ne može sama sebi dodijeliti dozvolu, pa bi prekidač tu i dalje bio
   laž.
3. No-op funkcije **obrisane**. Jedini potrošač bio je `SettingsScreen`
   (provjereno grep-om: 5 referenci, sve u tom fajlu).
4. Pet novih i18n ključeva u **oba** bloka (`enUS` i `bsBS`), svaki potvrđen s
   `grep -c = 2`.
5. Tip `GAS_READING_REMINDER` je imenovana konstanta s komentarom o porijeklu, ne
   string literal — upravo zato što HTTP sloj ne validira.

**Verifikacija.**

| Provjera | Rezultat |
|---|---|
| `npm run type-check` (`tsc --noEmit`) | **EXIT=0** |
| Kriterij „nijedan prekidač bez efekta" | ostala **2** `<Switch>`, oba sa stvarnim handlerom: `toggleColorMode` (`:402`), `handleDailyGasReminderToggle` (`:464`) |
| `useState(true)` prekidači | **0** (jedini preostali `useState(true)` je `isLoadingGasReminder`, loading flag) |
| Zaostale reference na obrisani state | **0** — `setNotificationsEnabled`, `setPushEnabled` = 0 pogodaka; preostali pogoci su i18n ključevi i komentari |
| Novi i18n ključevi | 5 ključeva × 2 bloka = `grep -c = 2` za svaki |
| MO2-16 permisije netaknute | `expo config --type introspect` EXIT=0; `android.permissions` i dalje 3; `RECORD_AUDIO` i dalje `tools:node="remove"` |

**Moja greška ovog koraka, ispravljena.**

- **Lokalni pokazivač grane bio je resetovan na bazni commit `c0131ff`**, pa je
  `git status` pokazivao **185 izmijenjenih fajlova** iz svih prethodnih zadataka,
  a `git log` nije sadržavao nijedan MO2-16 commit. Izgledalo je kao da je sav rad
  izgubljen. Dijagnoza: remote `origin/arena/1bfee051-boiler-control` je bio na
  `3dcac21` i imao je **sve** commitove; resetovan je bio samo lokalni ref.
  Riješeno s `git reset --mixed origin/arena/1bfee051-boiler-control` (ne dira
  radno stablo), nakon čega je status pokazao tačno 3 MO2-6 fajla. Da sam
  commitao prije te provjere, napravio bih commit nad pogrešnom bazom.

**Šta je ostalo otvoreno.**

- **Nijedan unit test nije izvršen.** `mobile/` nema test runnera (`npm test` →
  `jest: not found`), a plan traži „prebacivanje poziva
  `updateNotificationPreference` s tipom `GAS_READING_REMINDER`". MO2-8 je
  preduslov; `MASTER-ROADMAP.md:259-260` zabranjuje usputno popravljanje.
- **Runtime ponašanje nije viđeno** — nema emulatora. Nije potvrđeno da
  `PATCH` stvarno prolazi ni da se stanje vraća nakon izlaska iz ekrana.
- **Tri i18n ključa su sada mrtva**: `settings.pushNotifications`,
  `settings.pushNotificationsDesc`, `settings.notificationsEnabledDesc` (svaki
  0 referenci). Namjerno **nisu obrisani** — brisanje nije dio kriterija, a
  dinamičke konstrukcije ključeva su provjerene (`thermostat.mode.*`,
  `notifications.types.*`, `notifications.typeDescriptions.*` — nijedan ne dira
  `settings.*`).
- **Pre-postojeći i18n bug, nije moj i nije popravljen:** unutar `enUS > gas`
  (linije 479-510) nalaze se **bosanski** stringovi, uključujući zalutali
  `dailyGasReminderTime` ugurán u `units:` blok između `m3` i `m3h`. Zbog toga se
  isti tekst javlja na tri mjesta, pa anchor za `bsBS` blok mora uključiti
  susjedni red.

### Šta bi vlasnik uradio da je rotacija odobrena

1. **Rotirati** `JWT_SECRET`, `DATABASE_PASSWORD`, `TUYA_CLIENT_ID`/`TUYA_CLIENT_SECRET`
   prema runbook-u. **Rotacija ne čeka ništa** — vrijednosti su bile javne.
2. Odlučiti o `WEATHER_API_KEY` i `DATABASE_URL` (ne koriste se u kodu → vjerojatno
   revokacija bez zamjene).
3. Nakon rotacije: `git rm --cached backend/.env` + tri praćena loga, pa canary.
4. Odlučiti o čišćenju historije — **kozmetika**, ne zaštita; GitHub zadržava cache i
   forkove.

### MO2-8 — Testna i lint infrastruktura za mobilnu aplikaciju (MO-012), 2026-10-31

**Nalaz (verifikovan prije izmjene).** `npm test` je vraćao **exit 127**
(`jest: not found`), a `npm run lint` **exit 2**. U `mobile/` nije postojao
nijedan test fajl.

**Korekcija nalaza — uzroci su bili dublji nego „nedostaje paket".**

1. `npm test` exit 127: `jest` nije bio u devDependencies **i** nijedan test
   fajl nije postojao, pa čak i s instaliranim jest-om ne bi bilo šta pokrenuti.
2. `npm run lint` exit 2 je imao **dva** nezavisna uzroka:
   - `.eslintrc.js` je imao `extends: ['expo']`, ali `eslint-config-expo` nikad
     nije bio u devDependencies;
   - nakon instalacije paketa lint je **i dalje** padao s exit 2, jer ESLint 9
     odbija `.eslintrc.*` format i traži flat config.

Migracija na flat config (`mobile/eslint.config.js`) je dakle **nužna, ne
stilistička**. Stari `.eslintrc.js` je obrisan, a njegova dva pravila
(`@typescript-eslint/no-unused-vars`, `react-hooks/exhaustive-deps`) prenesena
su 1:1. Cilj MO2-8 je uspostaviti lint koji radi, ne promijeniti stil usput.

**Verzije (izmjereno 2026-10-31 preko npm registry).** `jest ^30.5.2`,
`jest-expo ~58.0.13` (dist-tag `latest`; **`sdk-58` tag ne postoji**),
`@testing-library/react-native ^14.1.0`, `react-server-dom-webpack 19.3.0`,
`@react-native/jest-preset ^0.88.1`, `eslint ^9.39.5`, `eslint-config-expo
~58.0.4`, `eslint-config-prettier ^10.1.8`, `@typescript-eslint/* ^8.59.0`,
`@types/jest ^30.0.0`.

`react-server-dom-webpack` je **pinovan na tačno `19.3.0`**, ne `~19.3.0`:
caret razrješava na 19.3.1, koji traži `react ^19.3.1`, a projekt ima
`react 19.3.0` (Expov `bundledNativeModules.json`) → `ERESOLVE`.

`@typescript-eslint/*` je nadograđen s `^6` na `^8` jer `eslint-config-expo`
58.0.4 vuče `^8.59.0` kao dependency.

**Ključno mjerenje: prvo ikad izvršeno lint mjerenje.** Budući da lint nikad
nije radio, ovo je prvi stvarni pregled koda. Rezultat: **71 error / 20
warning u 15 fajlova**. Nijedan nije nastao sada — svi su bili tu, samo
nevidljivi.

| Pravilo | Broj | Porijeklo |
|---|---|---|
| `react-hooks/rules-of-hooks` | 28 | klasično — **stvarni crash bugovi** |
| `react-hooks/static-components` | 21 | React Compiler v7 (novo) |
| `react-hooks/refs` | 10 | React Compiler v7 (novo) |
| `import/namespace` | 4 | klasično — lažno pozitivno |
| `react-hooks/preserve-manual-memoization` | 2 | v7 |
| `react-hooks/set-state-in-effect` | 2 | v7 |
| `react-hooks/immutability` | 1 | v7 |
| `react-hooks/purity` | 1 | v7 |
| `react/display-name` | 1 | klasično |
| `react/no-unescaped-entities` | 1 | klasično |

**37 od 71** dolazi iz React Compiler ruleseta (`eslint-plugin-react-hooks`
**7.1.1**) koji nije postojao kad je kod pisan — to su advisory pravila.

**Baseline, dokumentovan u `mobile/eslint.config.js`.** Popraviti 71 prekršaja
kroz 15 fajlova unutar zadatka koji glasi „dodaj test/lint infrastrukturu" bilo
bi upravo ono što `MASTER-ROADMAP.md:259-260` zabranjuje: refactor naslepo, bez
testova za te komponente. Zato pravila s postojećim prekršajima idu na `warn`,
a **sva ostala ostaju na `error`** — CI pada na novoj grešci.

**NOVI NALAZ — 28 `rules-of-hooks` prekršaja su stvarni crash bugovi, ne stil.**
Primjer: `AlertsCard.tsx:136` definira `getAlertColors` koji zove
`useColorModeValue` **12 puta**, a poziva se unutar `alerts.map(...)` na `:165`,
gdje `alerts` ovisi o `dashboardData` (`:60-72`; komponentu renderuje
`DashboardScreen.tsx:336`). Broj hook poziva dakle varira s podacima → React
baca „Rendered more hooks than during the previous render" čim se broj alerta
promijeni. Isti obrazac u `BoilerStatusCard.tsx:136,172,200-222`. **Namjerno
nije popravljeno ovdje** — traži vlastiti zadatak s testovima.

`import/namespace` (4) je lažno pozitivno: `Notifications.AndroidImportance`
stvarno postoji u `expo-notifications`, ali pravilo ne čita TS enum kroz
`eslint-import-resolver-typescript`.

**Testovi: 34/34 prolaze.**

| Suite | Testova | Šta pokriva |
|---|---|---|
| `src/config/__tests__/version.config.test.ts` | 17 | `compareVersions` (5), `getAppVersion` (4), `checkVersionGate` fail-open (8) |
| `src/services/api/__tests__/error.handler.test.ts` | 17 | `parseApiError`: HTTP status → i18n ključ, 401 zaštita (MO2-5), timeout vs. mreža, ne-Axios ulaz |

**Mutacijska provjera: 10/10 namjernih grešaka ruši suite.** Bez ovoga
„prolazi" ne znači ništa — a upravo je to uhvatilo rupu u mom vlastitom testu:
mutacija `case 404 → 'errors.badRequest'` je **preživjela** prvi prolaz, jer sam
404 stavio samo u test gdje `data.message` postoji pa se mapiranje uopće ne
izvršava. Dodavanjem 404 u `it.each` mutacija pada.

**Pokrivenost (`collectCoverageFrom` = `src/services` + `src/components/gas`).**
Prije dodavanja `error.handler.test.ts` bila je **0 %**, jer je jedini test bio
u `src/config`, izvan opsega. Nakon: **5.5 % linija** (28/513), 11 % branch,
`error.handler.ts` **65.1 % linija / 68.8 % branch**. Preostalih 9 od 11 fajlova
u opsegu je na 0 % — prag u CI je namjerno izostavljen jer bi bio besmislen.

**CI.** Novi job `mobile` u `.github/workflows/backend-audit.yml`: `npm ci` →
`type-check` → `lint` → `test --ci --coverage`. Okidači su **samo**
`on.push.branches: [arena/1bfee051-boiler-control]` + `workflow_dispatch`
(pravilo 0a) — bez `pull_request` i bez `main`, što je provjereno čitanjem
parsiranog YAML-a, ne pretpostavkom.

`@types/jest ^30.0.0` je morao biti dodan **nakon** prvog prolaza: `type-check`
je pao s **exit 2 i 102 greške** (66× TS2304 + 33× TS2582) jer TS nije poznavao
`describe`/`it`/`expect`. Nakon instalacije: 0 grešaka.

`coverage/` je dodan u korijenski `.gitignore` (linija 15) — generisani
artefakt ne ide u repo.

**Lokalno izmjereno prije pusha:** `npm ci` exit 0 (1593 paketa),
`type-check` exit 0 (0 grešaka), `lint` exit 0 (0 errors, 92 warnings),
`test --ci` exit 0 (34/34).

**CI ishod (VERIFICIRANO).** Run **`41212573242`** = `completed success` za
commit `fd07a7d`. Sva tri joba zelena: `test` (21 korak), `frontend` (18),
`mobile` (10). Koraci `mobile` joba — `Install dependencies`, `Type-check`,
`Lint`, `Unit tests` — svi `success`. Provjereno preko
`gh api …/actions/runs/{id}/jobs`, jer `gh run watch --exit-status` vraća 0 i
dok je run još `in_progress`.

Anotacije `mobile` joba: 11 warning + 1 notice, **sve objašnjivo i nijedna nije
nova greška**. Deset warninga su `react-hooks/rules-of-hooks` u
`AlertsCard.tsx:140-155` — upravo dokumentovani baseline. Jedanaesti je
GitHub-ovo upozorenje da `actions/checkout@v4`/`setup-node@v4` ciljaju Node 20.
Notice je najava migracije `ubuntu-latest` na Ubuntu 26.

**Napomena o broju anotacija.** ESLint lokalno broji **12** `rules-of-hooks` u
`AlertsCard.tsx` (linije 140-157), a CI prikazuje **10**. Razlog je GitHub-ov
display limit po nivou, ne propuštena provjera — autoritativan broj je lokalni
`npx eslint . --format json` (28 ukupno).

**Šta NIJE verificirano.** Runtime ponašanje komponenti (nema emulatora);
nijedan komponentni test nije napisan iako je `@testing-library/react-native`
instaliran; EAS build nije pokrenut; 28 `rules-of-hooks` prekršaja je
dokumentovano, ali **nije popravljeno**.

### FE2-2 — Auth migracija: access token iz `localStorage` u memoriju (S-004, FE-002), 2026-10-31

**Nalaz (verifikovan prije izmjene).** Access token je stajao u `localStorage`
(`api.ts:63,91,98,154,158`, `AuthContext.tsx:25,39,41,61,84`,
`GasReadingsPage.tsx:14`). Čita ga bilo koji ubačeni script, a traje 24 h bez
revokacije — jedan XSS daje napadaču dan punog pristupa API-ju.

**Korekcija nalaza — SEC-4 je već izgradio većinu onoga što je backlog
pripisivao FE2-2.** Prije nego sam išta gradio, izmjerio sam šta postoji:

| Već postojalo (SEC-4) | Stvarno nedostajalo |
|---|---|
| Rotirani refresh token + reuse detection | Access token čitljiv iz `localStorage` |
| `auth-cookie.ts` (httpOnly/Secure/SameSite) | Download zaobilazio auth sloj |
| `POST /auth/refresh`, `POST /auth/logout` | `ProtectedRoute` vjerovao postojanju stringa |
| CORS `credentials` iza zastavice | Nijedan frontend test refresh toka |
| `detectAuthMode`, `refreshSession`, 401→retry, `logout` s opozivom | — |

Graditi cookie tok iznova bilo bi dupliranje SEC-4. Ono što je nedostajalo je
samo da access token prestane biti čitljiv JavaScriptu.

**Ključna odluka: token u memoriji SAMO kad je zastavica uključena.**
`getToken()` vraća memoriju kad je `cookieAuthEnabled === true`, a
`localStorage` kad je `false`. Razlog je rollback: da je memorija odmah postala
jedini izvor, uključivanje **backend** zastavice bi postalo uslov da frontend
radi, a vraćanje na `off` ne bi vratilo ponašanje. `setToken()` uz to aktivno
briše zaostali token iz `localStorage` — inače bi korisnik prijavljen prije
prelaska ostavio token čitljiv XSS-u iako se aplikacija više ne oslanja na njega.

**Zašto je `ProtectedRoute` morao dobiti `isInitializing` (FE-002).** S tokenom u
memoriji reload stranice znači da tokena pri prvom renderu nema, iako je httpOnly
refresh cookie ispravan i `refreshSession()` upravo traje. Stari
`if (!token) return <Navigate to="/login" />` bi izbacivao prijavljenog
korisnika na svaki F5. Guard je namjerno `!token && isInitializing`: kad token
postoji (`off` tok, gdje se čita odmah) sadržaj se prikazuje bez treperenja.

**Usput ispravljena dokumentacijska greška koja je vodila u nesigurniju
konfiguraciju.** `12-sec4-refresh-token.md:41` je tvrdio da za „cross-site deploy
(frontend na drugom originu)" treba `AUTH_COOKIE_SAME_SITE=none`. Izmjereno iz
commitovane deploy konfiguracije: frontend je `https://boiler-control.ba101.top`
(`docker-compose.yml:35`), API `https://api.boiler-control.ba101.top/api`
(`:66`) — različiti origin-i, ali **isti registrabilni domen** `ba101.top`.
`SameSite` se računa po registrabilnom domenu, ne po originu, pa je zahtjev
same-site i zadano `lax` šalje cookie. Postaviti `none` značilo bi naložiti
browseru da cookie šalje i na cross-site zahtjeve — otvorilo bi refresh endpoint
CSRF-u bez ikakve koristi. Ispravljeno na tri mjesta u tom dokumentu.

**CSRF analiza** (vlasnik je tražio analizu prije prijedloga; dokument
`docs/audit/frontend/08-fe22-auth-migration.md`):

| Vektor | Ishod | Zašto |
|---|---|---|
| Cross-site → `/auth/refresh` | **BLOKIRANO** | `SameSite=lax` ne šalje cookie na cross-site POST |
| Cross-site → bilo koji API endpoint | **BLOKIRANO** | traži `Authorization` header; preflight pada jer CORS `origin` nije refleksija |
| Same-site (sibling `*.ba101.top`) → `/auth/refresh` | mogće, ali samo **ometanje** | cookie se šalje, ali CORS `origin` je fiksiran pa napadač ne može pročitati odgovor → ne može ukrasti novi access token |
| Same-site → `/auth/logout` | mogće | prisilna odjava; neugodno, nije kompromitacija |

Backend nema CSRF zaštitu nigdje (`grep -rniE "csrf|xsrf" src/` = 0 pogodaka),
ali uz `lax` + fiksni CORS origin glavni vektor je zatvoren. Predložena je
opciona provjera `Origin`/`Sec-Fetch-Site` kao defense-in-depth — **nije
implementirana**, čeka odluku vlasnika.

**Testovi: 84/84 (9 fajlova)**, od čega 15 novih. `npm run type-check` exit 0
(0 grešaka), `npm run lint` exit 0 (0 errors / 13 warnings).

**Mutacijska provjera: 6/6 namjernih grešaka ruši suite.** I ovdje je provjera
uhvatila stvarnu grešku — prva verzija `ProtectedRoute` bila je
`if (isInitializing)`, što je značilo treperenje za korisnike koji već imaju
token i promjenu prijašnjeg ponašanja u `off` toku. Test „token uz
inicijalizaciju i dalje prikazuje sadržaj" to nije hvatao dok ga nisam napisao,
pa je implementacija ispravljena na `!token && isInitializing`.

| Mutacija | Ishod |
|---|---|
| `setToken` ipak piše u `localStorage` kad je tok ON | 2 failed |
| `getToken` pada na `localStorage` i kad je tok ON | 1 failed |
| `clearToken` ne čisti memoriju | 1 failed |
| `detectAuthMode`: nedostajuće polje = `true` | 1 failed |
| `ProtectedRoute`: guard za inicijalizaciju uklonjen | 1 failed |
| `ProtectedRoute`: guard ne gleda token | 1 failed |

**Zastavica je i dalje `off`.** `AUTH_COOKIE_REFRESH_ENABLED` nije postavljen ni
u jednoj deploy konfiguraciji u repu. Runbook za uključivanje je napisan
(odjeljak 4 dokumenta), uključujući obavezan redoslijed deploya — stari frontend
ne zna za `isInitializing`, pa bi prijavljeni korisnici bili izbacivani na svaki
reload čim se zastavica uključi.

**Kompatibilnost unazad.** Uz `off` ponašanje je doslovno prijašnje (testovi to
eksplicitno pokrivaju). Mobilna aplikacija se ne dira: RN tok koristi
`transport: 'body'` (`auth.controller.ts:64-67`) i čuva refresh token u Android
Keystore, ne u cookie-ju.

**Šta NIJE verificirano.** Ponašanje u stvarnom browseru — nema emulatora ni
pravog browsera u ovom okruženju, pa postavljanje httpOnly cookie-ja i njegovo
slanje sa `SameSite=lax` **nije isprobano**, samo mockano u testovima. Stvarni
CSRF napad nije izveden; analiza je izvedena iz konfiguracije i specifikacije.
`/auth/refresh` kroz stvarni HTTP s cookie-jem nije pozvan. Migracija nije
primijenjena na stvarnu bazu.

**CI ishod (VERIFICIRANO).** Run **`41218607380`** = `completed success` za
commit `3193f3c`. Sva tri joba zelena: `frontend` (18 koraka), `test` (21),
`mobile` (10). `frontend` job je stvarno izvršio `Type-check`, `Lint`,
`Unit and component tests`, `Build`, `Bundle evaluates and renders` i
`E2E smoke` — svi `success`. Provjereno preko `gh api …/actions/runs/{id}/jobs`.

**Poređenje anotacija s prethodnim runom (`41212838864`, prije FE2-2): 13 prije,
13 poslije — nula novih upozorenja.** Jedine dvije razlike su pomak broja linije
(`AuthContext.tsx:20` → `:31`, jer je edit dodao linije iznad postojećeg
`export const AuthContext`) i trajanje e2e testa (3.4 s → 3.2 s).
`react-refresh/only-export-components` upozorenje na `AuthContext.tsx` je
**pre-postojeće**, nije ga uveo FE2-2.

### REL-7 — Tuya snapshot: nepoznato nije nula (B-026), 2026-10-31

**Nalaz (verifikovan prije izmjene).** Tuya status je djelimičan, a stari kod je
odsutna polja pretvarao u **stvarne** vrijednosti:

| Mjesto | Kod | Kad polje nedostaje |
|---|---|---|
| `tuya.adapter.ts:321` | `(status['TempCurrent'] ?? null) / 2` | `null / 2` → **0 °C** |
| `tuya.adapter.ts:322` | `status['Power'] === true` | **false** |
| `tuya.adapter.ts:282` / `:296` | `… ?? 0` | cilj **0 °C** |

`resolveHeatingState` (`polling.service.ts:435-436`) je na tome birao
`0 < 21` → **start**, odnosno `20 <= 0-1` → **end**.

**Dvije stvari koje nalaz nije istakao.** Prvo, **guard je već postojao ali je
bio mrtav**: `:181` ima `if (currentTemp === null || targetTemp === null) return
'incomplete';`, i ishodi `'incomplete'` + metrika `poll_devices_incomplete`
(`:20`, `:27`) su već bili definisani i spojeni — autor je namjeravao ovo
ponašanje, samo nikad nije proradilo jer je adapter uništio null. Drugo, **DB
upis se dešavao PRIJE guarda** (`:161-179`), pa se lažna nula trajno snimila u
`roomCurrentTemp`/`roomTargetTemp` i kad bi guard okinio.

**Korekcija obima štete — potvrdio vlasnik.** Nalaz je ostavio otvoreno „nije
dokazano da aplikacija izdaje fizičku komandu grijanju". Vlasnik je potvrdio da
**aplikacija ne može upravljati Tuya termostatom**: Tuya API je read-only, daje
statuse (grijanje ON/OFF) i programe. Provjereno i u kodu — `grep` za `.put(`,
`.post(`, `method: 'PUT'`, `method: 'POST'`, `commands`, `/status` kroz
`src/modules/Tuya/**` i `tuya.adapter.ts` daje **0 pogodaka**, a
`handleHeatingStart` (`:246-275`) radi isključivo Prisma upise i logovanje.

To je promijenilo prirodu zadatka. B-026 **nije** bio rizik fizičke sigurnosti
nego rizik integriteta podataka: lažni eventi, lažna historija i trajanja, lažne
notifikacije, pokvaren ulaz za preporuke/učenje. Zbog toga ispravka **ne uvodi
„fail-safe stanje"** — aplikacija nema stanje koje bi mogla postaviti — nego
princip: *ne bilježiti promjenu koju ne možemo posmatrati*.

**Ispravka.** Novi `snapshot-guard.ts` (`toNullableNumber`,
`toNullableBoolean`, `missingSnapshotFields`, `isSnapshotComplete`,
`snapshotGuardEnabled`). `ThermostatSnapshot` sada tipizira polja kao nullable,
pa je „nepoznato" uopće izrazivo. Guard je premješten **prije** upisa u bazu;
nepotpun snapshot vraća `'incomplete'`, bilježi samo kontakt s uređajem
(`lastSeen`/`lastSnapshotAt`) i ne dira lifecycle. Zastavica
`INCOMPLETE_SNAPSHOT_GUARD_ENABLED`, **zadano UKLJUČENO** (staro ponašanje je
bug u podacima, pa ga ne treba čuvati kao zadano).

**Namjerno usko prihvaćene vrijednosti.** `toNullableBoolean` prihvata samo
pravi boolean; `'true'`/`1` ostaju `undefined`. Tiho proširivanje bi stvarni
kvar pretvorilo u tiho drugačije ponašanje. Isto tako `toNullableNumber`
odbija `''`, boolean i `NaN`, jer bi `Number('') === 0` bila tiha greška.

**Testovi: 18/18 novih** (`snapshot-guard.spec.ts`). `tuya_missing_fields_repro.cjs`
je pretvoren **iz dokaza buga u regression guard** (EXIT=0, 6 asertcija):

| Slučaj | `currentTemp` | `targetTemp` | `powerOn` | starts | ends | upis temp. |
|---|---|---|---|---|---|---|
| nedostaje `TempCurrent` | `null` | 21 | true | 0 | 0 | ne |
| nedostaje `Power` | 20 | 21 | `undefined` | 0 | 0 | ne |
| nedostaje `TempSet` | 20 | `null` | true | 0 | 0 | ne |
| `TempCurrent=0` (stvarno) | `0` | 21 | true | 1 | 0 | da |
| `Power=false` (stvarno) | 20 | 21 | `false` | 0 | 1 | — |
| `TempSet=0` (stvarno) | 20 | `0` | true | 0 | 1 | da |

Posljednja tri reda su ključna: **stvarne nule i `false` i dalje rade**, pa
ispravka nije pretvorila mjereno stanje u „nepoznato" i time oslijepila
aplikaciju.

**Mutacijska provjera: 4/4.** Svaka od četiri namjerne greške (vraćanje `0` za
odsutno, `false` za odsutno, guard uvijek isključen, Power se ne provjerava)
ubijena je **i** od jest-a **i** od regression guarda; original vraćen identično.

**Type-check.** U izmijenjenim fajlovima **nula grešaka izvan Prisma kaskade** i
**nula grešaka null-dodjele** (TS2322/TS2345/TS18047/TS18048/TS2531/TS2532), što
znači da promjena na nullable ne lomi nijednog potrošača.

**Šta NIJE verificirano.** Stvarni Tuya odgovori s produkcije nisu uhvaćeni, pa
**učestalost nepotpunih statusa nije izmjerena** — nalaz i dalje stoji da nije
dokazano da ih ovaj model uopće šalje. Prometheus alert na
`poll_devices_incomplete` nije dodan. `tuya-adapter.spec.ts` i
`thermostat-polling-metrics.spec.ts` padaju lokalno jer nedostaje generisani
Prisma klijent (`binaries.prisma.sh` nedostupan); **potvrđeno da padaju
identično na čistom HEAD-u `3978b66`**, dakle pre-postojeće, ne od ove izmjene.

**CI ishod (VERIFICIRANO).** Prvi push (`62977ab`, run `41226514871`) je **pao**
na backend `test` jobu, korak 12 „Lint without modifying files". Uzrok: taj korak
pokreće eslint **bez** `--fix`, dok lokalni `npm run lint` ima `--fix` i automatski
je ispravljao preduge linije u novom kodu — lokalno zeleno, u CI-ju errors.
Popravljeno u `83bd15a` i verificirano **CI-jevom tačnom komandom**
(`npx eslint 'src/**/*.ts' 'test/**/*.ts' --ignore-pattern 'src/generated/**'`):
EXIT=0, **0 errors / 2 warnings** (oba pre-postojeća, `no-floating-promises` u
`correlation-id.service.spec.ts` i `main.ts`). MD5 hashovi fajlova identični prije
i poslije ponovnog pokretanja bez `--fix`, dakle eslint više ništa ne mijenja.

Run **`41226811814`** = `completed success`. Sva tri joba zelena: `frontend`
(18 koraka), `test` (21), `mobile` (10). Korak 12 „Lint without modifying files"
sada `success`, uz `Type-check` i `Build` također `success`.

**Pouka zabilježena:** „lokalni lint prolazi" ne znači „CI lint prolazi" kad se
lokalna komanda razlikuje po `--fix`. Provjera mora koristiti CI-jevu tačnu
komandu.

### REL-8 — Atomski upis dana Tuya programa (B-027), 2026-10-31

**Nalaz (verifikovan prije izmjene).** `program.sync.service.ts` je upisivao
svaki interval zasebnim pozivom, svaki put s hashom **cijelog** programa, a
`cleanupRemovedIntervals` tek nakon svih upsert-a. U cijelom fajlu **nije bilo
nijednog `$transaction`** (pročitano svih 156 linija).

Lanac kvara:

| Linija | Šta radi | Problem |
|---|---|---|
| `:44` | `calculateHash(intervals)` | hash **cijelog** programa |
| `:61-63` | `if (existing[0].programHash === programHash) return` | gleda **samo prvi** red |
| `:116-137` | petlja upsert-a, svaki piše **isti** hash (`:127`, `:135`) | prvi red dobija novi hash iako ostali nisu upisani |
| `:141-155` | `cleanupRemovedIntervals` | tek **nakon** svih upsert-a |

Pad drugog upserta ostavljao je prvi red s novim hashom. Retry bi tada na
`existing[0].programHash === programHash` zaključio da je dan ažuriran i
preskočio preostale upise **i** cleanup — trajno miješano stanje, koje
`tuya.adapter.ts:267` dalje čita pri izboru ciljne temperature.

**Ispravka.** Nova `applyDayAtomically()` stavlja upsert svih intervala +
`deleteMany` cleanup u jedan `this.prisma.$transaction(operations)`. Hash se
zapisuje samo kao dio commita cijelog dana, pa djelimično stanje nikad ne
dobija novi hash i retry stvarno ponovi posao. Zastavica
`PROGRAM_SYNC_ATOMIC_ENABLED`, **zadano UKLJUČENO** (dosljedno REL-7).

**Zašto postojeća repro skripta nije mogla poslužiti kao dokaz.**
`program_sync_partial_repro.cjs` definise `upsert` kao običnu `async` funkciju
koja se **izvršava odmah pri pozivu**. Stvarni Prisma vraća `PrismaPromise`
koji se **ne izvršava** dok se ne await-uje ili preda `$transaction`. Zbog toga
taj harness izvršava sve upserte tokom izgradnje niza, prije nego što
`$transaction` uopće bude pozvan — njime se all-or-nothing ne može dokazati.
Napisana je nova proba koja modelira lazy `PrismaPromise` i `$transaction` s
rollbackom.

**Verifikacija** (`scripts/audit/program_sync_atomic_probe.cjs`, EXIT=0):

| Scenarij | Ishod | Značenje |
|---|---|---|
| Pad na 2. upsertu (atomski put) | `0:0/20/OLD, 1:480/21/OLD, 2:1080/18/OLD` | baza **netaknuta** |
| Retry nakon pada | `0:0/22/NEW, 1:480/23/NEW` | posao završen, `orderIndex 2` obrisan |
| Stari put (zastavica `off`) | `0:0/22/NEW, 1:480/21/OLD, 2:1080/18/OLD` | **miješano** |

Treći red je ključan: kontrola dokazuje da proba stvarno hvata kvar, pa
prolazak nije prazan.

**Dvije CI lekcije — oba pada su bila moja.**

1. **`TS2345` na `operations.push(deleteMany)` — lokalno se NIJE pojavio.**
   Niz je bio izveden iz `.map()` nad upsertima, pa `push` nad `deleteMany` nije
   prolazio. Lokalno nedostaje generisani Prisma klijent
   (`binaries.prisma.sh` nedostupan), pa je `thermostatProgram.upsert` tipa
   `any` i greška se ne okida; u CI-ju je klijent generisan i tipovi su stvarni.
   **Lokalni `tsc` ne može zamijeniti CI type-check za Prisma tipove.**
   Ispravljeno eksplicitnom tipizacijom `PrismaPromise<unknown>[]`.
2. **Prettier greška je pushana** jer je commitovan samo broj grešaka
   (`errors=1`) bez ispisa **koja** je greška. Pravilo: uvijek ispisati greške.

Nakon obje ispravke CI je pozelenio.

**Tada otvoreno (2026-10-31).** **Konkurentnost.** `$transaction` daje atomičnost,
ne i izolaciju protiv dva paralelna procesa. Kriterij prihvatanja traži „dva
konkurentna synca potvrđena na izolovanom PostgreSQL-u", a PostgreSQL u ovom
okruženju nije dostupan — za to treba row lock ili optimistička verzija.
**Nema jest testa**: verifikacija je samo preko probe skripte. Postojeća
miješana stanja u bazi se ne popravljaju automatski — sljedeći sync s
drugačijim hashom ih prepisuje.

### REL-8 — konkurentnost završena (2026-11-02)

Test-only commit `e76bd07` dodao je pravi PostgreSQL integration spec s dva
odvojena Prisma klijenta. Privremeni trigger usporava samo INSERT sintetičkog
uređaja kako bi oba čitanja vidjela prazan dan. Na neizmijenjenom produkcijskom
kodu CI `41503819683` reproducirao je **P2002** u oba izvršavanja speca; lint,
type-check, build, OpenAPI, mobile i frontend su prošli.

`cc8622c` uvodi `pg_advisory_xact_lock` po `deviceId + dayType`, ponovno
čitanje/hash odluku i create/upsert/cleanup u istoj interaktivnoj transakciji.
Prvi pokušaj je u CI `41504828757` dao **P2010** jer je `$queryRaw` čitao
PostgreSQL `void` rezultat lock funkcije. `d91cced` zadržava isti parametrizovani
bigint upit, ali ga izvršava preko `$executeRaw` bez result decodinga.

Završni test dokazuje da oba paralelna poziva završe i da redovi odgovaraju
cjelovitom programu A ili B s jednim hashom. Atomic probe i dalje prolazi
rollback/retry/legacy kontrole, ciljani Tuya unit prolazi **1 suite / 8 testova**, a tačan
ESLint ima **0 errors / 2 postojeća warnings**. Konačni CI `41505358553` za
`d91cced`: backend **69/696 + 6/61 integration**, `tsc: 0`, `eslint: 0`; mobile
**24/136**, frontend **4/4**, nula failure annotations.

Nema migracije, backfilla, API/DTO/OpenAPI/mobile/frontend/compose promjene ni
rollouta. Rollback je i dalje `PROGRAM_SYNC_ATOMIC_ENABLED=off`. Stara miješana
stanja se ne popravljaju automatski, a stvarni provider/production uticaj nije
dokazan ovim sintetičkim testom.

### OBS-1/MAINT-3 — liveness i readiness (2026-11-02)

Test-first HTTP spec je na neizmijenjenom kodu dao očekivana **3 nova 404**
(live, ready success i ready failure) i **2 prošle legacy kontrole**. Commit
`95789ab` dodaje javni `GET /health/live` bez DB/Redis ovisnosti i javni
`GET /health/ready` koji preko postojećeg Prisma poola izvodi samo `SELECT 1`.
Odgovor readiness provjere je ograničen na 1000 ms; greška i timeout vraćaju
generički 503 `{status:'error',timestamp}` bez SQL-a, connection stringa ili
interne poruke. Postojeći `/health`, opciono Redis polje i
`/dashboard/health` nisu mijenjani.

Prvi CI `41510718437` otkrio je test-harness nullable/Redis pretpostavke i
nedjelotvoran root-Prisma spy. Nakon `6da831e`, CI `41511430613` je i dalje
dokazao da taj spy ne presreće readiness upit. `5f0247e` zato uvodi eksplicitnu
`DatabaseHealthService` granicu za kontrolisani 503, bez promjene ruta ili
odgovora. Integracija sa stvarnim PostgreSQL-om dokazuje ready 200; failure
test simulira servisni ishod i **nije** stvarni PostgreSQL outage.

Lokalno prolaze fokusirani **2 suitea / 8 testova + 1 Redis skip**, širi common
skup **18 suiteova / 245 testova + 8 skip** i frontend **11 fajlova / 92 testa**.
Konačni CI `41512728985`: backend **70/705 + 6/63 integration**, `tsc: 0`,
`eslint: 0`; mobile **24/136**, frontend **4/4**, sva tri joba success i nula
failure annotations. OpenAPI i frontend tipovi su regenerisani, a postojeće
operacije ostaju nepromijenjene za instalirane mobilne klijente.

Nema migracije, backfilla, novog flaga, compose/deployment healthchecka ni
rollouta. Rollback je prestati koristiti nove rute ili revertovati aditivni
slice. Per-instance metrike, queue-lag alarmi, Dockerfile/image smoke i stvarni
produkcijski DB outage ostaju otvoreni.

### SEC-7 — produkcijske backend zavisnosti (2026-11-02)

Polazni `npm audit --omit=dev` prijavljivao je 14 paketa (1 critical, 10 high,
3 moderate). Commit `b6b4fed` primjenjuje ne-force lockfile refresh bez
promjene direktnog Nest/Prisma/axios majora: axios 1.21.0,
platform-express 11.2.8 i poravnati Prisma CLI/client/adapter 7.10.1.
Uski overridei postavljaju `multer@2.5.0` samo pod platform-express i
`js-yaml@5.5.0` samo pod Swagger; drugi js-yaml potrošači nisu prebačeni na
novi major.

`npm ci` je reproducibilan, `npm ls` potvrđuje stablo, a ponovni production
audit vraća **exit 0 i nula označenih paketa**. Novi multipart HTTP test
stvarnog controller/`FileInterceptor` puta prolazi 2/2 i prije overridea na
multer 2.4.0 i poslije na 2.5.0, uključujući postojeći 413 file-size limit.
OpenAPI check nema diff, a tačan ESLint ima 0 errors / 2 postojeća warnings.

Konačni CI `41525320585`: backend **71/707 + 6/63 integration**, `tsc: 0`,
`eslint: 0`; mobile **24/136**, frontend **4/4**, sva tri joba success i nula
failure annotations. Nema migracije, API/OpenAPI/mobile promjene ni flaga.
Rollback je revert `b6b4fed` i `npm ci` na prethodnom locku.

Production-nula nije tvrdnja za čitav development graph: puni audit i dalje
ima **37 paketa** (1 critical, 2 high, 33 moderate, 1 low), prvenstveno u
tooling lancu. Container image scan, produkcijski deploy/proxy uvjeti i
stvarni provider pozivi nisu izvedeni; overridee treba ponovo procijeniti
kada ih Nest nativno učini nepotrebnim.

SEC-7B commit `cc39769` zatim uklanja critical/high iz development grafa bez
`package.json` ili source promjene. Svih 97 verzijskih promjena je dev-only;
production direct verzije/overridei i production audit nula ostaju isti.
Konačni full audit ima **34 zapisa** (0 critical, 0 high, 31 moderate, 3 low),
s korijenima `deepmerge`, `glob` i `minimatch`. Preostali npm fix traži
`@nestjs/cli@12.0.11` preko `--force`, pa major nije primijenjen. `npm ci`,
ciljani **8/64 + 1 skip**, OpenAPI check i ESLint **0 errors / 2 warnings**
prolaze. CI `41528411640` potvrđuje backend **71/707 + 6/63**, mobile
**24/136**, frontend **4/4** i nula failure annotations. Rollback je revert
`cc39769`; image scan i produkcijski deploy/audit ostaju otvoreni.

### SEC-5 — prvi upload content-signature dio (2026-11-02)

Commit `5d14a8b` zatvara samo prvi S-006/SEC-5 slice u zajedničkom
`FileStorageService.storeFile`. PDF `%PDF-`, JPEG `FF D8 FF`, puni PNG potpis i
WebP `RIFF`/`WEBP` okvir provjeravaju se prije odredišnog `ensureDir` i
`writeFile`. Za lažni/mismatched sadržaj i sadržaj kraći od potpisa servis baca
`BadRequestException` (400) bez upisanog fajla. Validni potpisi se čuvaju
nepromijenjeni; postojeće MIME allowliste, metadata size limit, random storage
naziv i sanitizacija originalnog naziva ostaju zadržani.

Na neizmijenjenom kodu helper je potvrdio zapis sintetičkih ne-PDF bajtova s
PDF MIME-om. Prvih deset testova je test-first dalo **4 očekivana pada / 6
kontrola**. Nakon dopune truncated PDF/PNG granica, privremeno uklanjanje
jedinstvenog `validateContent` poziva daje **6 očekivanih padova / 6 kontrola**;
vraćeni kod prolazi **12/12**, a odbijeni slučajevi nemaju fajlova u privremenom
storageu. Završni relevantni lokalni skup prolazi **22 suitea / 292 testa + 8
skip**, uključujući neizmijenjeni Gas multipart HTTP test. Helper prolazi, tačan
ESLint ima **0 errors / 2 postojeća warnings**, a OpenAPI check nema diff.

CI `41533224216`: backend **72/719 + 6/63 integration**, `tsc: 0`, `eslint: 0`;
mobile **24/136**, frontend **4/4**, sva tri joba success i nula failure
annotations. Nema migracije/backfilla, storage-schema, postojećeg
fajla/download, API/DTO/OpenAPI, compose/deployment, flag ili installed-mobile
promjene. Rollback je revert `5d14a8b`.

Ovo je magic-bytes kontrola, **ne** puni parser, antivirus ili malware/polyglot
dokaz. Stari fajlovi nisu retroaktivno validirani; download/ownership/retention,
filesystem/symlink i produkcijski deploy nisu mijenjani niti verificirani.
Preostali SEC-5 opseg ostaje otvoren.

### SEC-5 — owner-only Gas fajlovi verificirani stvarnim HTTP tokom

**STATUS: OWNER-ONLY DOKAZ ZAVRŠEN (`08391fc`); PREOSTALI OPSEG OTVOREN.** Izvor je već imao `findFirst({ id, userId })` za pregledani Gas download/upload/delete, pa ovaj slice ne mijenja produkcijski kod. Novi `backend/test/integration/gas-files.integration.spec.ts` pokreće stvarni `AppModule`, `JwtAuthGuard`, Prisma/PostgreSQL i privremeni `UPLOAD_ROOT_PATH` s dva korisnika.

- **Pet scenarija:** anonymous 401; owner PDF/JPEG download s tačnim bajtovima i headerima; identičan foreign/missing 404 za obje download rute; foreign upload/invoice delete/reading delete bez file/DB side effecta; owner upload/download kroz puni HTTP tok.
- **Lokalno:** postojeći **4 suitea / 47 testova**, helper, OpenAPI bez diffa i tačan ESLint **0 errors / 2 postojeća warnings**. Integration spec je pronađen; lokalna baza nije pokretana.
- **CI `41536884218`:** backend **73/724 + 7/68 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136**, frontend **4/4**; sva tri joba success, nula failure annotations. Spec je obuhvaćen objema relevantnim Jest brojkama.
- **Bez scope širenja:** nema production code, migracije/backfilla, API/DTO/OpenAPI, storage-schema, compose/deployment, flag ili installed-mobile promjene. Rollback je revert test/docs slicea.
- **Preostalo:** puni parser/antivirus/polyglot, stari fajlovi, retention/restore, filesystem/symlink/deploy i dokumentovani TOCTOU/reconciliation. Brisanje po odobrenoj retention politici i produkcijska infrastruktura nisu dokazani ovim testom.

### FEAT-8/B-019 — heating-events stvarni HTTP/PostgreSQL dokaz (2026-11-03)

**STATUS: RUNTIME DOKAZ ZAVRŠEN (`13b0b2e`); SNAPSHOT I ROLLOUT ODLUKE OSTAJU.** Produkcijski kod je već imao per-device mapiranje i owner-scope, pa ovaj slice dodaje samo `backend/test/integration/dashboard-heating-events.integration.spec.ts` sa stvarnim `AppModule`, JWT i Prisma/PostgreSQL tokom.

- **Četiri scenarija:** anonymous 401; dva vlasnikova uređaja dobijaju svoje live current/target vrijednosti uz pravu nulu i legacy nazive; tačno jedan owner-scoped device `findMany`; tuđi noviji događaj ne curi, foreign/missing filter daje isti prazan odgovor; prazna stranica nema device lookup.
- **Lokalno:** postojeći **6 Dashboard suitea / 57 testova**, helper, OpenAPI bez diffa i tačan ESLint **0 errors / 2 postojeća warnings**. Spec je pronađen u integration discovery; lokalna baza nije pokretana.
- **CI `41583943166`:** backend **74/728 + 8/72 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136**, frontend **4/4**; sva tri joba success, nula failure annotations. Porast je +1 suite/+4 testa u obje relevantne Jest brojke.
- **Bez scope širenja:** nema production code, migracije/backfilla, API/DTO/OpenAPI, compose/deployment, flag ili installed-mobile promjene. `DASHBOARD_BUCKET_V2_ENABLED` nije diran; rollback je revert test/docs slicea.
- **Preostalo:** live-vs-historical snapshot ugovor, B-020 v2 rollout/timezone odluka i produkcijski deploy. Summary/stats/export i historijske vrijednosti događaja nisu dokazani ovim specom.

### FEAT-8/B-020 — summary/stats stvarni HTTP/PostgreSQL dokaz (2026-11-03)

**STATUS: BACKEND RUNTIME DOKAZ ZAVRŠEN (`eed8830`); V1 DEFAULT I ROLLOUT ODLUKE OSTAJU.** Produkcijski kod je već imao v1/v2 helper i unit pokrivenost; ovaj slice dodaje samo `backend/test/integration/dashboard-buckets.integration.spec.ts` sa stvarnim `AppModule`, JWT i Prisma/PostgreSQL tokom.

- **Šest scenarija:** anonymous 401 za obje rute; zadani v1 spaja dva dana u `10:00` uz tačne summary/stats agregate; opt-in v2 razdvaja UTC date-hour bucket-e; v2 summary/stats dijele UTC dan oko ponoći; v2 razdvaja ponovljeni Europe/Sarajevo DST sat uz `Intl` kontrolu ulaznog para; foreign/missing/no-data odgovori su prazni i ne cure tuđi događaj.
- **CI `41630712262`:** backend **75/734 + 9/78 integration**, `tsc: 0`, `eslint: 0`; frontend **4/4**. Mobile je zabilježio samo poznati `weatherV2NativeWind` timeout (**135/136**); timeout, asserti i paralelizam nisu mijenjani. Prvi run `41629612657` pao je prije HTTP toku zbog nevažećeg test fixturea, ispravljenog u `15694e4`; nije bilo production defecta.
- **Lokalno:** postojeći **6 Dashboard suitea / 57 testova**, fokusirani bucket unit **1/8**, helper, integration discovery i tačan ESLint **0 errors / 2 postojeća warnings**. Stvarni HTTP/DB dokaz je CI; discovery to nije.
- **Bez scope širenja:** flag se privremeno mijenja samo unutar v2 test zahtjeva i vraća; default `DASHBOARD_BUCKET_V2_ENABLED=off` ostaje. Nema production code, migracije/backfilla, API/DTO/OpenAPI, compose/deployment, export ili installed-mobile promjene. Rollback je revert test/docs slicea.
- **Ograničenje i preostalo:** v1 Sarajevo DST kolaps ostaje helper/unit dokaz jer CI server koristi UTC; v2 DST je stvarni HTTP/DB dokaz. Export nije proširen. Hour-profile-vs-series i timezone odluka, v2 rollout, live-vs-historical snapshot ugovor i produkcijski deploy ostaju otvoreni.

### FEAT-8/B-019 — live-vs-historical vremenska kontrola (2026-11-03)

**STATUS: POSTOJEĆE PONAŠANJE KARAKTERIZIRANO (`d4f8d0e`); KONAČNI UGOVOR NIJE ODABRAN.** Peti scenario u `backend/test/integration/dashboard-heating-events.integration.spec.ts` dokazuje razliku historijskih event i live thermostat polja kroz dva uzastopna stvarna HTTP/PostgreSQL čitanja.

- Prije updatea odgovor ima historijske `currentTemp/targetTemp = 20/22` i live `curretTempThermostat/targetTempThermostat = 25/26`. Nakon device updatea na `7/30`, historijska polja i trajanje ostaju `20/22` i 30 minuta, dok live polja postaju `7/30`; `finally` vraća fixture.
- **CI `41638063116`:** backend **75/735 + 9/79 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136**, frontend **4/4**; sva tri joba/koraci success, nula failure annotations.
- **Lokalno:** postojeći **6 Dashboard suitea / 57 testova**, helper, integration discovery i tačan ESLint **0 errors / 2 postojeća warnings**. Nema production/API/DTO/OpenAPI/migracije/flag/mobile promjene; rollback je revert test/docs slicea.
- **Preostalo:** ovo nije proizvodna odluka niti odobrenje live semantike. Naziv, svrha i buduće verzioniranje live naspram historijskog snapshot polja ostaju vlasnička odluka.

### FEAT-6/B-020 — export stvarni HTTP/PostgreSQL dokaz (2026-11-03)

**STATUS: RUNTIME DOKAZ ZAVRŠEN (`9b1a9ea`); V2 ROLLOUT NIJE ODABRAN.** Dva nova scenarija u postojećem `backend/test/integration/analytics-export.integration.spec.ts` provjeravaju stvarni `AppModule`/JWT/Prisma/PostgreSQL tok bez production izmjene.

- Višednevni hour export dokazuje legacy jedan `10:00` bucket sa 75 minuta i dva ciklusa, naspram v2 UTC date-hour bucketa s 30 i 45 minuta. V2 `Europe/Sarajevo` dokazuje hronološki ponovljeni sat s offsetima `+02:00` pa `+01:00` i trajanjima 20 i 40 minuta; agregati i `sourceRows` su tačno provjereni.
- Novi fixture je izvan januarskog opsega postojećih testova, pa njihovi owner-scope, foreign/missing i maxRows rezultati ostaju nepromijenjeni. Zastavica se uključuje samo za v2 zahtjeve i vraća kroz postojeći env cleanup.
- **CI `41644670775`:** backend **75/737 + 9/81 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136**, frontend **4/4**; sva tri joba/koraci success, nula failure annotations.
- **Lokalno:** postojeći **6 Dashboard suitea / 57 testova**, export helper, mutation checks **5/5 killed uz unique anchors**, integration discovery i tačan ESLint **0 errors / 2 postojeća warnings**.
- Nema production/API/DTO/OpenAPI/migracije/compose/mobile promjene; `DASHBOARD_BUCKET_V2_ENABLED` i svi defaulti su netaknuti. Rollback je revert test/docs slicea.
- **Preostalo:** konačni hour-profile-vs-series i timezone ugovor, v2 rollout, budući mobile/web JSON potrošači, asinhroni export i deploy. Ovaj dokaz ne aktivira zastavice i ne rješava PRIV-1.

### SEC-1/B-006 — vlasništvo notifikacija stvarni HTTP/PostgreSQL dokaz (2026-11-03)

**STATUS: ZAŠTITA VEĆ PRISUTNA U IZVORU; RUNTIME DOKAZ ZAVRŠEN (`bc7b847`).** Source review potvrdio je JWT `userId` u kontroleru i atomski `updateMany` po `id+userId` u servisu. Nije bilo production ispravke; zastarjeli backlog/API opis usklađen je s kodom.

- Novi `backend/test/integration/notifications-ownership.integration.spec.ts` kroz stvarni `AppModule`/JWT/Prisma/PostgreSQL dokazuje anonymous 401 bez side effecta, owner 201 s postojećim response oblikom i bazom `isRead=true`, te identičan foreign/missing 404 bez vlasničkog sadržaja i bez izmjene zapisa.
- **CI `41653900831`:** backend **76/740 + 10/84 integration**, `tsc: 0`, `eslint: 0`; frontend **4/4**; postojeći PostgreSQL rollback helper prolazi. Mobile u ovom runu bilježi samo poznati `weatherV2NativeWind` timeout (**135/136**), bez izmjene timeouta, asserta ili paralelizma. Svježi puni run slijedi docs pushom.
- **Lokalno:** postojeći SEC-1 unit **1/4**, integration discovery i tačan ESLint **0 errors / 2 postojeća warnings**.
- Nema production/API/DTO/OpenAPI/migracije/flag/compose/mobile promjene; rollback je revert test/docs slicea i ne uklanja owner zaštitu.
- **Preostalo:** ovaj spec ne proširuje token lifecycle, preferences, mark-all ili masovni reminder i nije dokaz produkcijskog deploya/logova.

### SEC-3/B-007 — admin authorization stvarni HTTP/PostgreSQL dokaz (2026-11-03)

**STATUS: ADMIN ZAŠTITA VEĆ PRISUTNA; RUNTIME DOKAZ ZAVRŠEN (`54b7de2`).** Postojeći `@Roles(ADMIN)` + `RolesGuard` potvrđen je kroz stvarni AppModule/JWT/Prisma/PostgreSQL. `GasReminderService` je mockan samo na DI boundaryju, pa nema stvarnog pusha.

- Dva nova scenarija u postojećem notification integration specu dokazuju anonymous 401 i USER 403 bez delegation poziva, te ADMIN 201 s tačno jednim mock pozivom. Role dolaze iz stvarnih DB korisnika; sva tri postojeća SEC-1 scenarija ostaju zelena.
- **CI `41658825259`:** backend **76/742 + 10/86 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136**, frontend **4/4**; sva tri joba/koraci success, nula failure annotations. PostgreSQL rollback helper prolazi, a zastarjeli help opis je ispravljen bez promjene ponašanja.
- Throttle ostaje pokriven postojećim `seconds(60)` i **100 uspješnih + 5×429** testovima. Lokalno: SEC-1 **4/4**, throttle **2/2**, helper syntax/help, discovery i ESLint **0 errors / 2 postojeća warnings**; admin unit i real-DB dokaz su autoritativno potvrđeni u CI-ju uz generated Prisma.
- Nema production/API/DTO/OpenAPI/migracije/flag/compose/mobile promjene; rollback je revert test/helper/docs slicea i ne uklanja zaštitu.
- **Preostalo:** produkcijski proxy/IP/deploy nije dokazan. Pojedinačni reminder, preferences, token lifecycle i druge notification rute nisu prošireni.

### S-002 — ThermostatDevice runtime create/update body DTO validacija (2026-11-04)

**STATUS: CREATE/UPDATE BODY RAW TIPOVI RIJEŠENI U KODU (`d54ade0`); CI ZELEN.** `mode` enum, path ID-evi, controller, servis, ownership/profil lookupi i Prisma mutacije nisu mijenjani.

- Source review je potvrdio implicitnu konverziju pogrešnih raw tipova za `vendor`, `deviceId`, `alias` i `homeProfileId`. Pregledani mobile update već šalje tipizirane vrijednosti; create consumer nije pronađen. Stvarni controller/DTO HTTP suite koristi mock servis, ne real-DB/ownership dokaz.
- Test-only `15dcdff` dodaje valjan create/update i osam negativaca uz očuvanih osam path-ID kontrola. Lokalni repro je **10 prošlo / 8 palo / 18 ukupno**. CI `41913583688` potvrđuje backend **874 prošlo / 8 palo / 882 ukupno**, sve **119/119 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; samo ciljani body scenariji padaju jer dobijaju 201/200 umjesto 400.
- Raw-input transformacije sada daju 400 prije servisa za pogrešne tipe, dok valjani create zadržava 201/response/JWT userId/servisni argument, a update 200/response/`update(42,17,validBody)`. Nema novih `IsInt`, `Min(1)`, length/not-empty, `0/null` ili flag pravila.
- **Finalni code CI `41914703109`:** backend **87/882 + 13/119 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba success i nula failure annotations. Lokalno cijeli ThermostatDevice HTTP suite prolazi **18/18**, a backend ESLint ima **0 errors / 2 poznata warnings**.
- OpenAPI `--check` i CI generated sync/type-check prolaze bez generated diffa. Nema migracije/backfilla ili mobile/compose/flag promjene. Rollback production fixa je revert `d54ade0`.
- **Preostalo:** real-DB create/update/ownership i tuđi `homeProfileId`, ID pozitivnost, string sadržaj, `0/null` semantika i produkcijski rollout. S-004/session revokacija nije mijenjana.

### S-003 — User profile potvrda trenutne lozinke (2026-11-04)

**STATUS: S-003 OLD-PASSWORD PROPUST RIJEŠEN (`6345fc7`); CI ZELEN. S-004 NIJE RIJEŠEN.** Profilni PUT sada zahtijeva `currentPassword` za promjenu passworda i stvarni PostgreSQL/bcrypt tok je pokriven.

- Test-only `ab8c350` daje lokalno **16 prošlo / 5 palo / 21 ukupno**. CI `41905261533` potvrđuje backend **864 prošlo / 8 palo / 872 ukupno** i integration **116 prošlo / 3 pala / 119 ukupno**; svi failurei su ciljani S-003 scenariji, dok su `tsc`, ESLint, mobile i frontend zeleni.
- Fix uslovno validira neprazan raw-string `currentPassword`, radi bcrypt compare prije hasha i uklanja obje lozinke iz Prisma update podataka. Missing current daje 400, wrong current 401 bez hash/profile promjene, a correct current 200 uz novi hash; običan profile update ostaje isti.
- Lokalno ciljani testovi su **21/21**, povezani Auth/User suiteovi **35/35**, frontend **92/92**, mobile **24/136**, a backend ESLint ima **0 errors / 2 poznata warnings**. Audit repro daje 400/401/200 za missing/wrong/correct current password.
- **Finalni code CI `41906152927`:** backend **87/872 + 13/119 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`, sva tri joba success i nula failure annotations.
- OpenAPI/frontend generated tipovi dodaju samo opcioni `currentPassword`; mobile API tip je usklađen bez promjene ekrana. Web i mobile poznati profilni ekrani ne šalju password, a mobile Settings koristi namjenski Auth endpoint.
- Nema migracije/backfilla, flaga, compose ni deploy izmjene. Rollback production fixa je revert `6345fc7`.
- **Preostalo:** S-004/session revokacija nije promijenjena; stari JWT ostaje prihvaćen u sintetičkom reproe. Produkcijski rollout nije dokazan.

### S-002 — User profile runtime password raw-tip validacija (2026-11-04)

**STATUS: PROFILE PASSWORD RAW TIP RIJEŠEN U KODU (`0300400`); CI ZELEN. S-003 NIJE RIJEŠEN.** Controller, UserService, bcrypt/hash, postojeći minimum i valjani profile-password tok nisu mijenjani.

- Source review i čisti DTO probe potvrđuju da numerički `123456` postaje string dužine šest i prolazi postojeći `@IsString`/`@MinLength(6)`. Valjani string prolazi; nije dodana old-password, revokacija, min/max ili složenost politika. Suite koristi mock servis, ne real-DB/bcrypt/session dokaz.
- Test-only `9935b63` dodaje valjan password 200/response/JWT userId/servisni argument i jedan numerički negativac, bez promjene prethodnih 13 asserti. Lokalni repro je **14 prošlo / 1 pao / 15 ukupno**. CI `41902676553` potvrđuje backend **861 prošao / 1 pao / 862 ukupno**, sve **115/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; samo numerički password dobija 200 umjesto 400.
- Raw-input transform sada daje 400 za numerički password prije `updateMe`, dok valjani string zadržava 200, response i cijeli servisni argument. Ostalih devet DTO polja i postojeći `MinLength(6)` nisu mijenjani; nema novog flaga.
- **Finalni code CI `41903390817`:** backend **85/862 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba success i nula failure annotations. Lokalno profile HTTP prolazi **15/15**, a probe zadržava valjani string i odbija numerički password.
- OpenAPI/frontend generated output je bajtno nepromijenjen. Sync/type-check i frontend **92/92** prolaze. Backend ESLint ima **0 errors / 2 poznata warnings**, a inventory ostaje bajtno nepromijenjen (**34**). Nema migracije/backfilla ili mobile/compose promjene. Rollback production fixa je revert `0300400`.
- **Preostalo:** svih deset DTO polja čuva raw tip, ali S-003 ostaje otvoren — valjani password i dalje prolazi profilni PUT bez nove provjere stare lozinke. Real-DB update, bcrypt/hash, session revokacija i produkcijski rollout nisu dokazani ovim mock controller sliceom.

### S-002 — User profile runtime scalar DTO validacija (2026-11-04)

**STATUS: TRI PROFILE SCALAR POLJA RIJEŠENA U KODU (`9c72bba`); CI ZELEN.** Password/S-003, controller, UserService, bcrypt/hash i gas-price historija nisu mijenjani.

- Source review i čisti DTO probe potvrđuju implicitnu konverziju string/broj dark-mode ulaza u boolean, string/boolean gas cijene u broj i numeričkog basic-ISO datuma u string bez validator greške. Valjani `false`, `1.25` i ISO string prolaze. Web/mobile već šalju gas cijenu kao number; mobile ne šalje dark-mode/date u profile update. Suite koristi mock servis, ne real-DB/bcrypt/gas-price/session dokaz.
- Test-only `a8cc316` dodaje valjan scalar 200/response/servisni argument i pet negativaca, bez promjene prethodnih sedam asserti. Lokalni repro je **8 prošlo / 5 palo / 13 ukupno**. CI `41899374788` potvrđuje backend **855 prošlo / 5 palo / 860 ukupno**, sve **115/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; samo ciljani negativci dobiju 200 umjesto 400.
- Raw-input transform sada daje 400 za pogrešne tipe prije `updateMe`, dok valjani `prefersDarkMode: false`, `gasPriceExVat: 1.25` i ISO `gasPriceEffectiveFrom` zadržavaju 200, response i cijeli servisni argument. Password/S-003 i prethodnih šest tekst polja nisu mijenjani; nema novog flaga ni politike cijene/datuma.
- **Finalni code CI `41900213890`:** backend **85/860 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba success i nula failure annotations. Lokalno profile HTTP prolazi **13/13**, a probe zadržava valjanu kontrolu i odbija pogrešne varijante.
- OpenAPI/frontend generated output je bajtno nepromijenjen. Sync/type-check i frontend **92/92** prolaze. Backend ESLint ima **0 errors / 2 poznata warnings**, a inventory ostaje bajtno nepromijenjen (**34**). Nema migracije/backfilla ili mobile/compose promjene. Rollback production fixa je revert `9c72bba`.
- **Preostalo:** password/S-003, semantičke politike cijene/datuma, real-DB update, bcrypt/hash, gas-price historija, session revokacija i produkcijski rollout nisu obuhvaćeni ovim mock controller dokazom.

### S-002 — User profile runtime text DTO validacija (2026-11-04)

**STATUS: ŠEST PROFILE TEXT POLJA RIJEŠENO U KODU (`63b23af`); CI ZELEN.** Password/S-003, `prefersDarkMode`, gas-price/date polja, controller, UserService, bcrypt/hash i gas-price historija nisu mijenjani.

- Source review i čisti DTO probe potvrđuju implicitnu konverziju numeričkog name/username/homeLocation/avatarUrl/timezone/locale u string bez validator greške. Mobile već šalje string name/username/homeLocation; consumeri nisu mijenjani. Novi suite koristi stvarni controller/production ValidationPipe, mock guard i mock servis, ne real-DB/bcrypt/gas-price/session dokaz.
- Test-only `af1ce37` dodaje valjan 200/response/JWT userId/servisni argument, username trim/lowercase i šest numeričkih negativaca. Lokalni repro je **1 prošao / 6 palo / 7 ukupno**. CI `41885089457` potvrđuje backend **848 prošlo / 6 palo / 854 ukupno**, sve **115/115 integration**, mobile **24/136** i frontend **4/4** zelene; samo ciljani numerički ulazi dobiju 200 umjesto 400.
- Raw-input transform sada daje 400 za numeričke ulaze za šest tekst polja prije `updateMe`, dok valjani stringovi zadržavaju 200, response, cijeli servisni argument i username trim/lowercase normalizaciju. Nema novog flaga.
- Prvi code CI `41885929193` završio je **851/3/854** zbog tri timeouta u postojećim auth-refresh/duplicate-email integration testovima; novi profile suite i zasebni integration/mobile/frontend jobovi su prošli. Bez izmjene timeoutova ili asserti, CI-only `6c3ba5d` bez source diffa dao je zeleni recheck **`41886589502`**: backend **85/854 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`, sva tri joba success i nula failure annotations.
- Lokalno profile HTTP prolazi **7/7**, frontend **92/92**. OpenAPI/frontend generated output je bajtno nepromijenjen, backend ESLint ima **0 errors / 2 poznata warnings**, a inventory ostaje **34**. Nema migracije/backfilla ili mobile/compose promjene. Rollback production fixa je revert `63b23af`.
- **Preostalo:** password/S-003, boolean/gas-price/date polja i cijeli `UpdateUserDto` nisu obuhvaćeni ovim fixom. Real-DB update, bcrypt/hash, gas-price historija, session revokacija i produkcijski rollout nisu novi dokaz mock controller slicea.

### S-002 — Auth register runtime body DTO validacija (2026-11-04)

**STATUS: ČETIRI REGISTER STRING POLJA RIJEŠENA U KODU (`3ad9c55`); CI ZELEN.** Email, AuthService, bcrypt hash, Prisma uniqueness/create, `refreshTransport` i postojeća cookie/refresh politika nisu mijenjani.

- Source review i čisti DTO probe potvrđuju implicitnu konverziju numeričkog username/password/name/homeLocation u string bez validator greške. Numerički i array email već imaju validator grešku; email nije dio fixa. Mobile već šalje četiri string polja. Postojeći Auth baseline je **19/19** uz privremene Prisma import stubove; novi suite koristi mock servis, ne real-DB/bcrypt/uniqueness dokaz.
- Test-only `4f6dd12` dodaje potpun valjan payload/response/normalizaciju/servisni argument i četiri numerička negativca. Novi repro je **1/5 prolaza**, sa Auth kontrolom **20/24**. CI `41882246091` potvrđuje backend **843 prošlo / 4 pala / 847 ukupno**, sve **115/115 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136** i frontend **4/4** zeleni.
- Raw-input transform sada daje 400 za numerički username/password/name/homeLocation prije servisa, dok valjani payload zadržava 201, response, email/username normalizaciju i cijeli servisni argument. Postojeći flag ostaje nepromijenjen.
- **Finalni code CI `41883133590`:** backend **84/847 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba success i nula failure annotations. Lokalno Auth HTTP/cookie suiteovi prolaze **24/24**.
- OpenAPI/frontend generated output je bajtno nepromijenjen. Sync/type-check i frontend **92/92** prolaze. Controller nije mijenjan i inventory ostaje **34**. Nema migracije/backfilla ili mobile/compose promjene. Rollback je revert `3ad9c55`.
- **Preostalo:** real-DB uniqueness/create, bcrypt hash i refresh rollout nisu novi dokaz ovog mock controller slicea.

### S-002 — Auth login runtime body DTO validacija (2026-11-04)

**STATUS: LOGIN STRING TIPOVI RIJEŠENI U KODU (`b6e4f0d`); CI ZELEN.** Identifier/email fallback, AuthService, bcrypt/Prisma lookup, `refreshTransport` i postojeća cookie/refresh politika nisu mijenjani.

- Source review i čisti DTO probe potvrđuju implicitnu konverziju numeričkog identifier/email/password u string bez validator greške. Mobile već šalje dva stringa i `refreshTransport: 'body'`, a web dva stringa. Postojeći Auth baseline je **14/14** uz privremene Prisma import stubove; novi suite koristi mock servis, ne real-DB/bcrypt/throttling dokaz.
- Test-only `7e51bac` dodaje valjan identifier/response/normalizaciju/mobile payload, legacy email fallback i tri numerička negativca. Novi repro je **2/5 prolaza**, sa Auth kontrolom **16/19**. CI `41875464182` potvrđuje backend **839 prošlo / 3 pala / 842 ukupno**, sve **115/115 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136** i frontend **4/4** zeleni.
- Raw-input transform sada daje 400 za numerička polja prije servisa, dok valjani stringovi zadržavaju 200, response, trim/lowercase i servisne argumente. `refreshTransport` i postojeći flag ostaju nepromijenjeni.
- **Finalni code CI `41876377311`:** backend **83/842 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba success i nula failure annotations. Lokalno Auth HTTP/cookie suiteovi prolaze **19/19**.
- OpenAPI/frontend generated output je bajtno nepromijenjen. Sync/type-check i frontend **92/92** prolaze. Controller nije mijenjan i inventory ostaje **34**. Nema migracije/backfilla ili mobile/compose promjene. Rollback je revert `b6e4f0d`.
- **Preostalo:** real-DB/bcrypt login, throttling i refresh rollout nisu novi dokaz ovog mock controller slicea.

### S-002 — Auth change-password runtime body DTO validacija (2026-11-04)

**STATUS: CHANGE-PASSWORD STRING TIPOVI RIJEŠENI U KODU (`e583a10`); CI ZELEN.** Servisni bcrypt compare/hash, Prisma update, JWT userId i postojeća password politika nisu mijenjani.

- Source review je potvrdio `@IsString`/`IsNotEmpty`/`MinLength(6)` bez raw-input čuvanja. Mobile već šalje oba password polja kao stringove. Postojeći Auth cookie baseline je **11/11** uz privremene Prisma import stubove; novi HTTP suite koristi mock servis, ne real-DB/bcrypt/session dokaz.
- Test-only `5aee897` dodaje valjane lozinke/response/servisne argumente i numerička current/new password polja. Novi repro je **1/3 prolaza**, sa kontrolom **12/14**. CI `41850651413` potvrđuje backend **835 prošlo / 2 pala / 837 ukupno**, sve **115/115 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136** i frontend **4/4** zeleni.
- Raw-input transform sada daje 400 za numerička password polja prije servisa, dok valjani stringovi zadržavaju 200, response i `changePassword(42,'current-secret','new-secret')`. `MinLength(6)` i ostala politika ostaju; nema novog flaga.
- **Finalni code CI `41851404905`:** backend **82/837 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba success i nula failure annotations. Lokalno HTTP/cookie suiteovi prolaze **14/14**.
- OpenAPI/frontend generated output je bajtno nepromijenjen. Sync/type-check i frontend **92/92** prolaze. Controller nije mijenjan i inventory ostaje **34**. Nema migracije/backfilla ili mobile/compose promjene. Rollback je revert `e583a10`.
- **Preostalo:** real-DB/bcrypt update, revokacija sesija i produkcijski rollout; mock controller ih ne dokazuje.

### S-002 — Notification register-token runtime body DTO validacija (2026-11-04)

**STATUS: REGISTER-TOKEN STRING TIP RIJEŠEN U KODU (`eb3313d`); CI ZELEN.** Servisni `userDevice` update/create, platform enum i JWT userId nisu mijenjani.

- Source review je potvrdio `expoPushToken` sa samo `@IsString`, bez raw-input čuvanja. Mobile već šalje string token i tipiziranu platformu. Postojeći Notification HTTP baseline je **2/2** uz privremene Prisma import stubove i mock servis, ne real-DB/Expo dokaz.
- Test-only `0d3b414` dodaje valjan token/response/servisne argumente i numerički token negativac. Lokalni repro je **3/4 prolaza**. CI `41843036696` potvrđuje backend **833 prošlo / 1 pao**, sve **115/115 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136** i frontend **4/4** zeleni.
- Raw-input transform sada daje 400 za numerički token prije servisa, dok valjani string zadržava 201, response i `registerToken(42,'ExponentPushToken[synthetic-token]','android')`. Nema novog token formata, length pravila ni flaga.
- **Finalni code CI `41843715972`:** backend **81/834 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba success i nula failure annotations. Lokalni Notification HTTP suite prolazi **4/4**.
- OpenAPI/frontend generated output je bajtno nepromijenjen. Sync/type-check i frontend **92/92** prolaze. Controller nije mijenjan i inventory ostaje **34**. Nema migracije/backfilla ili mobile/compose promjene. Rollback je revert `eb3313d`.
- **Preostalo:** real-DB update/create, stvarna Expo dostava, token lifecycle/više uređaja i produkcijski rollout; mock controller ih ne dokazuje.

### S-002 — Weather v2 confirm runtime body DTO validacija (2026-11-04)

**STATUS: CONFIRM BODY TIPOVI RIJEŠENI U KODU (`4e037b0`); CI ZELEN.** Servisni owner lookup, fresh geocoder, candidate provjera i `updateMany` nisu mijenjani.

- Source review je potvrdio `@IsString`/`@Length` bez raw-input čuvanja. Mobile već šalje trimovan string query i string candidate ID. Postojeći Weather HTTP/OpenAPI baseline je **35/35** uz mock servis, ne real-DB/geocoder dokaz.
- Test-only `1d61859` dodaje valjan confirm/response/servisne argumente i numerički query/candidateId negativce. Lokalni repro je **33/35 prolaza**. CI `41839722716` potvrđuje backend **830 prošlo / 2 pala**, sve **115/115 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136** i frontend **4/4** zeleni.
- Raw-input transform sada daje 400 za numerički query/candidateId prije servisa, dok valjani stringovi zadržavaju 200, response i `confirmLocation(4242,17,'  Sarajevo  ','candidate-1')`. Postojeća length pravila ostaju; nema novog flaga.
- **Finalni code CI `41840434457`:** backend **81/832 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba success i nula failure annotations. Lokalno HTTP/OpenAPI prolaze **38/38**.
- OpenAPI/frontend generated output je bajtno nepromijenjen. Sync/type-check i frontend **92/92** prolaze. Controller nije mijenjan i inventory ostaje **34**. Nema migracije/backfilla ili mobile/compose promjene. Rollback je revert `4e037b0`.
- **Preostalo:** real-DB owner i stvarni geocoder/update tok za confirm, te produkcijski rollout; mock controller ih ne dokazuje.

### S-002 — Weather v2 location query runtime DTO validacija (2026-11-04)

**STATUS: LOCATION SEARCH QUERY RIJEŠEN U KODU (`a441f90`); CI ZELEN.** Servisni owner lookup, `trim`, 2–100 pravila i provider nisu mijenjani.

- Source review je potvrdio direktni `@Query('query')` bez runtime DTO-a. Mobile već šalje trimovan string, a web nema potrošača ove v2 location-search rute. Postojeći Weather HTTP/OpenAPI baseline je **31/31** uz mock servis, ne real-DB/provider dokaz.
- Test-only `0276912` dodaje valjan raw query/response/servisne argumente i missing/array/extra negativce; format-only `168d9cc` samo ispravlja Prettier bez promjene asserti. Lokalni repro je **29/32 prolaza**. Čisti CI `41837152828` potvrđuje backend **826 prošlo / 3 pala**, sve **115/115 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136** i frontend **4/4** zeleni.
- `WeatherLocationQueryDto` sada daje 400 za missing, array i extra query prije servisa, dok valjan raw query zadržava 200, response i `getLocationCandidates(4242,17,'  Sarajevo  ')`. String length i `trim` ostaju u servisu nakon owner provjere; nema novog flaga.
- **Finalni code CI `41838086198`:** backend **81/829 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba success i nula failure annotations. Lokalno HTTP/OpenAPI prolaze **35/35**.
- OpenAPI/frontend generated output je bajtno nepromijenjen. Sync/type-check i frontend **92/92** prolaze. Weather route linije i inventory **34** ostaju nepromijenjeni. Nema migracije/backfilla ili mobile/compose promjene. Rollback je revert `a441f90`.
- **Preostalo:** real-DB owner i stvarni provider tok za location search, te produkcijski rollout; mock controller ih ne dokazuje.

### S-002 — Notification mark-as-read runtime path ID validacija (2026-11-04)

**STATUS: MARK-AS-READ POST PATH ID RIJEŠEN U KODU (`bbf7ce0`); CI ZELEN.** Servisni atomski `updateMany` po id+userId, neotkrivajući 404 i naknadni `findUnique` nisu mijenjani.

- Source review je potvrdio Notification `:id` bez ParseIntPipe. Web i mobile već koriste `markNotificationAsRead(id: number)`. Postojeći real-DB integration dokazi za anonymous/owner/foreign/missing ostaju nepromijenjeni.
- Novi stvarni controller HTTP spec koristi produkcijske ValidationPipe opcije i mock servis; to je path/response dokaz, ne novi real-DB ownership dokaz. Test-only `bf04af0` lokalno daje **1/2 prolaza** jer malformed ID dobija 201. CI `41831732081` potvrđuje backend **824 prošlo / 1 pao**, sve **115/115 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136** i frontend **4/4** zeleni.
- `ParseIntPipe` sada odbija malformed ID s 400 prije servisa, dok valjan ID zadržava 201, cijeli response i `markAsRead(17,42)`. Nema Min(1), novog flaga ni izmjene servisne logike ili baze.
- **Finalni code CI `41832527612`:** backend **81/825 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba success i nula failure annotations. Lokalno novi suite i SEC-3 kontrola prolaze **6/6**; real-DB SEC-1 rezultat ostaje potvrđen.
- OpenAPI/frontend path tip već je bio number i generated output je bajtno nepromijenjen. Sync/type-check i frontend **92/92** prolaze. Deset route markera je usklađeno s importom/formatiranjem; inventory ostaje 34. Nema migracije/backfilla ili mobile/compose promjene. Rollback je revert `bbf7ce0`.
- **Preostalo:** ID pozitivnost i produkcijski rollout; novi mock suite ne zamjenjuje postojeće real-DB dokaze.

### S-002 — ThermostatDevice remove runtime path ID validacija (2026-11-04)

**STATUS: REMOVE DELETE PATH ID RIJEŠEN U KODU (`ea5e860`); CI ZELEN.** Servisni findUnique, delete po ID-u i 403/404 ownership ponašanje nisu mijenjani.

- Source review je potvrdio string path ID i `+id` konverziju. U pregledanim mobile/web potrošačima nema direktnog DELETE poziva. Druge device rute i servisna logika ostaju iste.
- Postojeći stvarni controller HTTP spec koristi produkcijske ValidationPipe opcije i mock servis; baseline je bio 6/6. Test ne izvršava stvarno brisanje i nije novi real-DB owner/foreign/delete dokaz.
- **Test-first:** commit `c5fcc7c` lokalno daje **7/8 prolaza**. CI `41828837866` potvrđuje backend **822 prošlo / 1 pao**, sve **115/115 integration**, `tsc: 0` i `eslint: 0`; samo malformed DELETE koji ranije dobija 200 pada. Mobile **24/136** i frontend **4/4** su zeleni.
- `ParseIntPipe` sada odbija malformed ID s 400 prije servisa, dok valjan ID zadržava 200, cijeli response i `remove(42,17)`. Nema Min(1), novog flaga ni izmjene servisne logike ili baze.
- **Finalni code CI `41829546605`:** backend **80/823 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba success i nula failure annotations. Lokalni cijeli ThermostatDevice HTTP suite je **8/8**.
- Samo remove DELETE OpenAPI/frontend path tip je number; sva četiri ThermostatDevice `:id` parametra sada imaju ParseIntPipe i number ugovor. Sync/type-check i frontend **92/92** prolaze. Import i route markeri su nepromijenjeni; inventory ostaje 34. Nema migracije/backfilla ili mobile/compose promjene. Rollback je revert `ea5e860`.
- **Preostalo:** real-DB owner/foreign/delete dokazi, ID pozitivnost i produkcijski rollout.

### S-002 — ThermostatDevice update runtime path ID validacija (2026-11-04)

**STATUS: UPDATE PATCH PATH ID RIJEŠEN U KODU (`88ff6aa`); CI ZELEN.** Servisni findUnique, provjera profila, update po ID-u i 403/404 ownership ponašanje nisu mijenjani.

- Source review je potvrdio string path ID i `+id` konverziju. Mobile već koristi `updateDevice(id: number)`, a web nema direktan poziv. GET rute, delete i servisna logika ostaju isti.
- Postojeći stvarni controller HTTP spec koristi produkcijske ValidationPipe opcije i mock servis/DTO; baseline je bio 4/4. Sva polja stvarnog update DTO-a su opciona, pa je prazan body valjana kontrola. Ovo nije novi DTO, real-DB owner/foreign ili mutation dokaz.
- **Test-first:** commit `77c23f8` lokalno daje **5/6 prolaza**. CI `41825600924` potvrđuje backend **820 prošlo / 1 pao**, sve **115/115 integration**, `tsc: 0` i `eslint: 0`; samo malformed PATCH koji ranije dobija 200 pada. Mobile **24/136** i frontend **4/4** su zeleni.
- `ParseIntPipe` sada odbija malformed ID s 400 prije servisa, dok valjan ID zadržava 200, cijeli response, prazan DTO i `update(42,17,{})`. Nema Min(1), novog flaga ni izmjene DTO-a, servisne logike ili baze.
- **Finalni code CI `41826075816`:** backend **80/821 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba success i nula failure annotations. Lokalni cijeli ThermostatDevice HTTP suite je **6/6**.
- Samo update PATCH OpenAPI/frontend path tip je number; GET findOne/programs ostaju number, a DELETE ostaje string. Sync/type-check i frontend **92/92** prolaze. Import i route markeri su nepromijenjeni; inventory ostaje 34. Nema migracije/backfilla ili mobile/compose promjene. Rollback je revert `88ff6aa`.
- **Preostalo:** real-DB owner/foreign/mutation dokazi, ID pozitivnost, DELETE ID ruta i produkcijski rollout.

### S-002 — ThermostatDevice programs runtime path ID validacija (2026-11-04)

**STATUS: PROGRAMS GET PATH ID RIJEŠEN U KODU (`498e100`); CI ZELEN.** Servisni findUnique, program findMany/ordering i 403/404 ownership ponašanje nisu mijenjani.

- Source review je potvrdio string path ID i `+id` konverziju. Mobile već koristi `getDevicePrograms(deviceId: number)`, a web nema direktan poziv. FindOne, update/delete rute i servisna logika ostaju isti.
- Postojeći stvarni controller HTTP spec koristi produkcijske ValidationPipe opcije i mock servis; baseline je bio 2/2. Ovo nije novi real-DB owner/foreign dokaz.
- **Test-first:** commit `a891aff` lokalno daje **3/4 prolaza**. CI `41821805924` potvrđuje backend **818 prošlo / 1 pao**, sve **115/115 integration**, `tsc: 0` i `eslint: 0`; samo malformed programs GET koji ranije dobija 200 pada. Mobile **24/136** i frontend **4/4** su zeleni.
- `ParseIntPipe` sada odbija malformed ID s 400 prije servisa, dok valjan ID zadržava 200, cijeli programs response i `getPrograms(42,17)`. Nema Min(1), novog flaga ni izmjene DTO-a, servisne logike ili baze.
- **Finalni code CI `41822404446`:** backend **80/819 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba success i nula failure annotations. Lokalni cijeli ThermostatDevice HTTP suite je **4/4**.
- Samo programs GET OpenAPI/frontend path tip je number; findOne ostaje number, a PATCH/DELETE ostaju string. Sync/type-check i frontend **92/92** prolaze. Import i route markeri su nepromijenjeni; inventory ostaje 34. Nema migracije/backfilla ili mobile/compose promjene. Rollback je revert `498e100`.
- **Preostalo:** real-DB owner/foreign dokazi, ID pozitivnost, PATCH/DELETE ID rute i produkcijski rollout.

### S-002 — ThermostatDevice findOne runtime path ID validacija (2026-11-04)

**STATUS: FINDONE GET PATH ID RIJEŠEN U KODU (`46fbbbd`); CI ZELEN.** Servisni findUnique i 403/404 ownership ponašanje nisu mijenjani.

- Source review je potvrdio string path ID i `+id` konverziju. Mobile već koristi `getDeviceById(id: number)`, a web nema direktan poziv. Programs, update/delete rute i servisna ownership logika ostaju isti.
- Novi stvarni controller HTTP spec koristi produkcijske ValidationPipe opcije i mock servis. Ovo nije novi real-DB owner/foreign dokaz; postojeći numeric-missing 404 contract test i integration tokovi su nepromijenjeni.
- **Test-first:** commit `9c99fde` dodaje novi suite i lokalno daje **1/2 prolaza**. CI `41819704031` potvrđuje backend **816 prošlo / 1 pao**, sve **115/115 integration**, `tsc: 0` i `eslint: 0`; samo malformed GET koji ranije dobija 200 pada. Frontend je zelen, a mobile nezavisno ima poznati weather UI timeout (**135/136**) bez mobile diffa ili izmjene timeouta/asserti/paralelizma.
- `ParseIntPipe` sada odbija malformed ID s 400 prije servisa, dok valjan ID zadržava 200, cijeli nested response i `findOne(42,17)`. Nema Min(1), novog flaga ni izmjene DTO-a, servisne logike ili baze.
- **Finalni code CI `41820151042`:** backend **80/817 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba success i nula failure annotations. Lokalni novi suite je **2/2**.
- Samo findOne GET OpenAPI/frontend path tip je number; programs, PATCH i DELETE ostaju nepromijenjeni. Sync/type-check i frontend **92/92** prolaze. Novi import pomjera šest route markera, usklađenih u fix commitu; inventory ostaje 34. Nema migracije/backfilla ili mobile/compose promjene. Rollback je revert `46fbbbd`.
- **Preostalo:** real-DB owner/foreign dokazi, ID pozitivnost, programs/update/delete ID rute i produkcijski rollout.

### S-002 — Legacy Weather current runtime path ID validacija (2026-11-04)

**STATUS: LEGACY WEATHER CURRENT PATH ID RIJEŠEN U KODU (`816e537`); CI ZELEN.** Owner/location upit, WeatherService, provider i v2 rute nisu mijenjani.

- Source review je potvrdio string path ID i `Number(homeProfileId)` konverziju; sve tri v2 ID rute već imaju ParseIntPipe. Web već koristi numerički ID, a instalirani mobile koristi nepromijenjenu v2 current rutu.
- Postojeći stvarni controller HTTP spec koristi produkcijske ValidationPipe opcije i mock Prisma/weather servis. Ovo je controller/path dokaz, ne real-DB owner/missing-location ili live-provider tok; integration i STUB_ENDPOINTS_MODE ponašanje su nepromijenjeni.
- **Test-first:** baseline je 26/26. Commit `3c709be` dodaje dva scenarija i lokalno daje **27/28 prolaza**. CI `41817823362` potvrđuje backend **814 prošlo / 1 pao**, sve **115/115 integration**, `tsc: 0` i `eslint: 0`; samo malformed legacy current ID koji ranije dobija 200 pada. Frontend i mobile **24/136** zeleni su.
- `ParseIntPipe` sada odbija malformed ID s 400 prije Prisme i weather servisa, dok valjan ID zadržava 200, response, `id:17,userId:4242` owner/location upit i `getTodayWeather('Sarajevo')`. Nema Min(1), novog flaga ni izmjene v2 ruta, providera, servisa, cachea ili baze.
- **Finalni code CI `41818244510`:** backend **79/815 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba success i nula failure annotations. Lokalni fokusirani suite je **28/28**, a sa Weather OpenAPI specom **31/31**.
- Samo legacy current OpenAPI/frontend path tip je number; sve Weather current/location ID rute sada imaju numeric parsing. Sync/type-check i frontend **92/92** prolaze. Nema pomaka route markera, inventory ostaje 34, migracije/backfilla ili mobile/compose promjene. Rollback je revert `816e537`.
- **Preostalo:** real-DB owner/missing-location i live-provider dokazi, ID pozitivnost, ThermostatDevice ID rute i produkcijski rollout.

### S-002 — HomeProfile singular update runtime path ID validacija (2026-11-04)

**STATUS: SINGULAR UPDATE PATH ID RIJEŠEN U KODU (`12ea42e`); SVI REGISTROVANI HOME PROFILE ID-EVI NUMERIČKI PARSIRANI.** Servisni update i `mapProfile` nisu mijenjani.

- Source review je potvrdio string path ID i `Number(id)` konverziju. Web i singularni mobile helper već koriste numerički ID. FindOne owner lookup, update po ID-u i `mapProfile` ostaju isti; neregistrovani duplikat controllera nije mijenjan.
- HTTP spec koristi oba stvarna controllera, produkcijske ValidationPipe opcije i mock servis. Prazan body je valjan sa stvarnim DTO-om jer su sva polja opciona; dokaz je path parsing, ne novi DTO/real-DB update ili ownership tok.
- **Test-first:** baseline je 13/13. Commit `af926f7` dodaje dva scenarija i lokalno daje **14/15 prolaza**. CI `41814974102` potvrđuje backend **812 prošlo / 1 pao**, sve **115/115 integration**, `tsc: 0` i `eslint: 0`; samo malformed singularni PATCH koji ranije dobija 200 pada. Frontend i mobile **24/136** zeleni su.
- `ParseIntPipe` sada odbija malformed singularni PATCH ID s 400 prije servisa, dok valjan ID zadržava 200, cijeli `mapProfile` response i `update(42,17,{})`. Nema Min(1), novog flaga ni izmjene DTO-a, `mapProfile`, servisne logike ili baze.
- **Finalni code CI `41815572210`:** backend **79/813 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba success i nula failure annotations. Lokalna oba HomeProfile suitea su **15/15**.
- Samo singularni PATCH OpenAPI/frontend path tip je number; svi registrovani HomeProfile `:id` parametri sada imaju numeric parsing. Sync/type-check i frontend **92/92** prolaze. Nema pomaka route markera, inventory ostaje 34, migracije/backfilla ili mobile/compose promjene. Rollback je revert `12ea42e`.
- **Preostalo:** DTO payload i real-DB update/ownership dokazi, ID pozitivnost, ThermostatDevice/Weather ID rute i produkcijski rollout.

### S-002 — HomeProfile delete runtime path ID validacija (2026-11-04)

**STATUS: PLURAL DELETE PATH ID RIJEŠEN U KODU (`e3a8195`); SVI PLURALNI HOME PROFILE ID-EVI NUMERIČKI PARSIRANI.** Servisno brisanje i singularna ruta nisu mijenjani.

- Source review je potvrdio string path ID i `+id` konverziju. Mobile ekran već koristi numerički ID; web nema direktan DELETE poziv. Active-profile guard, findOne owner lookup i Prisma delete ostaju isti.
- HTTP spec koristi stvarni controller, produkcijske ValidationPipe opcije i mock servis. Ovo je controller/path dokaz, ne novi real-DB delete/ownership dokaz; integration je nepromijenjen.
- **Test-first:** baseline je 11/11. Commit `0513d3b` dodaje dva scenarija i lokalno daje **12/13 prolaza**. CI `41811782707` potvrđuje backend **810 prošlo / 1 pao**, sve **115/115 integration**, `tsc: 0` i `eslint: 0`; samo malformed DELETE koji ranije dobija 200 pada. Frontend i mobile **24/136** zeleni su.
- `ParseIntPipe` sada odbija malformed DELETE ID s 400 prije servisa, dok valjan ID zadržava 200/response/`remove(42,17)`. Nema Min(1), novog flaga ni izmjene singularne rute, servisne logike ili baze.
- **Finalni code CI `41812292302`:** backend **79/811 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba success i nula failure annotations. Lokalna oba HomeProfile suitea su **13/13**.
- Samo DELETE OpenAPI/frontend path tip je number; svi pluralni HomeProfile `:id` parametri sada imaju numeric parsing. Sync/type-check i frontend **92/92** prolaze. Nema pomaka route markera, inventory ostaje 34, migracije/backfilla ili mobile/compose promjene. Rollback je revert `e3a8195`.
- **Preostalo:** real-DB delete/active/ownership dokazi, ID pozitivnost, singularni PATCH, ThermostatDevice/Weather ID rute i produkcijski rollout.

### S-002 — HomeProfile plural update runtime path ID validacija (2026-11-04)

**STATUS: PLURAL UPDATE PATH ID RIJEŠEN U KODU (`5ebd6e0`); CI ZELEN.** Singularni PATCH, DTO pravila i servisni update nisu mijenjani.

- Source review je potvrdio string path ID i `+id` konverziju. Mobile ekran već koristi numerički ID; web koristi nepromijenjenu singularnu rutu. Servisni findOne owner lookup i update po ID-u ostaju isti.
- HTTP spec koristi stvarni controller, produkcijske ValidationPipe opcije i mock servis. Prazan body je valjan i sa stvarnim DTO-om jer su sva polja opciona; dokaz je path parsing, ne novi DTO/real-DB update ili ownership tok.
- **Test-first:** baseline je 9/9. Commit `4f1016f` dodaje dva scenarija i lokalno daje **10/11 prolaza**. CI `41809377585` potvrđuje backend **808 prošlo / 1 pao**, sve **115/115 integration**, `tsc: 0` i `eslint: 0`; samo malformed PATCH koji ranije dobija 200 pada. Frontend i mobile **24/136** zeleni su.
- `ParseIntPipe` sada odbija malformed pluralni PATCH ID s 400 prije servisa, dok valjan ID zadržava 200/response/`update(42,17,{})`. Nema Min(1), novog flaga ni izmjene singular/delete/findOne/activate ruta, DTO-a ili servisne logike.
- **Finalni code CI `41809891813`:** backend **79/809 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba success i nula failure annotations. Lokalna oba HomeProfile suitea su **11/11**.
- Samo pluralni PATCH OpenAPI/frontend path tip je number; singularni PATCH ostaje nepromijenjen. Sync/type-check i frontend **92/92** prolaze. Nema pomaka route markera, inventory ostaje 34, migracije/backfilla ili mobile/compose promjene. Rollback je revert `5ebd6e0`.
- **Preostalo:** DTO payload i real-DB update/ownership dokazi, ID pozitivnost, singular/delete, ThermostatDevice/Weather ID rute i produkcijski rollout.

### S-002 — HomeProfile findOne runtime path ID validacija (2026-11-04)

**STATUS: FINDONE GET PATH ID RIJEŠEN U KODU (`904e14c`); CI ZELEN.** Servisni owner filter i ostale HomeProfile ID rute nisu mijenjani.

- Source review je potvrdio string path ID i `+id` konverziju. Mobile API helper već koristi numerički ID; web nema direktan poziv ove GET rute. Servisni findOne filter po ID-u i userId-u ostaje isti.
- Postojeći stvarni controller HTTP spec koristi produkcijski ValidationPipe i mock servis. Novi GET dokaz nije real-DB ownership dokaz; postojeći MO2-20 integration tok je nepromijenjen.
- **Test-first:** baseline je 7/7. Commit `95f9244` dodaje dva scenarija i lokalno daje **8/9 prolaza**. CI `41807701616` potvrđuje backend **806 prošlo / 1 pao**, sve **115/115 integration**, `tsc: 0` i `eslint: 0`; jedini backend failure je malformed GET koji ranije dobija 200. Mobile nezavisno ima poznati weather timeout, bez mobile diffa.
- `ParseIntPipe` sada odbija malformed GET ID s 400 prije servisa, dok valjan ID zadržava 200/response/`findOne(42,17)`. Nema Min(1), novog flaga ni izmjene activate/update/delete/singular ruta ili servisne logike.
- **Finalni code CI `41808450482`:** backend **79/807 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba success i nula failure annotations. Lokalna oba HomeProfile suitea su **9/9**.
- Samo GET OpenAPI/frontend path tip je number; sync/type-check i frontend **92/92** prolaze. Nema pomaka route markera, inventory ostaje 34, migracije/backfilla ili mobile/compose promjene. Rollback je revert `904e14c`.
- **Preostalo:** real-DB GET ownership dokaz, ID pozitivnost, preostale HomeProfile/ThermostatDevice/Weather ID rute i produkcijski rollout.

### S-002 — HomeProfile activate runtime path ID validacija (2026-11-04)

**STATUS: ACTIVATE PATH ID RIJEŠEN U KODU (`fe22937`); BACKEND HTTP DOKAZ ZELEN.** Servisna aktivacija i ostali HomeProfile ID parametri nisu mijenjani.

- Source review je potvrdio string path ID i `+id` konverziju. Mobile već koristi numerički ID; web nema poseban activate poziv. Owner lookup, user update i activeHomeProfileId ostaju u nepromijenjenom servisu.
- Novi stvarni controller HTTP spec koristi produkcijski ValidationPipe i mock servis. Nije novi real-DB dokaz; postojeći MO2-20 integration aktivacije je zaseban i nepromijenjen.
- **Test-first:** postojeći baseline je 5/5. Commit `263f689` dodaje dva scenarija i lokalno daje **1/2 prolaza**, a CI `41801773939` potvrđuje **804 prošlo / 1 pao**, sve **115/115 integration**, `tsc: 0` i `eslint: 0`. Valjan ID zadržava 200/response/argumente, a malformed ID ranije dobija 200.
- `ParseIntPipe` sada odbija malformed ID s 400 prije servisa. Nema Min(1), novog flaga ni izmjene ownership/activation logike. Novi import pomjera deset route markera; usklađeni su u fix commitu i inventory ostaje 34.
- **Code run `41802431050`:** backend **79/805 + 12/115 integration** i frontend **4/4** zeleni, `tsc: 0`, `eslint: 0`. Mobile je **135/136** zbog postojećeg weather UI timeouta; bez mobile diffa, isti suite lokalno prolazi **3/3** bez izmjene timeouta/asserti/paralelizma. Run nije proglašen potpuno zelenim.
- Lokalna oba HomeProfile suitea su **7/7**. Samo activate OpenAPI/frontend path tip je number; sync/type-check i frontend **92/92** prolaze. Nema migracije/backfilla ili mobile/compose promjene. Rollback je revert `fe22937`.
- **Preostalo:** ID pozitivnost, ostale HomeProfile/ThermostatDevice/Weather ID rute, novi real-DB ownership dokazi i produkcijski rollout.

### S-002 — Gas invoice download runtime path ID validacija (2026-11-04)

**STATUS: INVOICE DOWNLOAD PATH ID RIJEŠEN U KODU (`6dc7e90`); SVIH SEDAM GASREADING ID RUTA IMA NUMERIC PARSING.** ID pozitivnost i drugi moduli nisu obuhvaćeni.

- Source review je potvrdio da je invoice GET bio posljednji GasReading `:id` bez ParseIntPipe. Web/mobile već koriste numerički ID; owner lookup, private PDF stream, MIME i Content-Disposition logika ostaju isti.
- Postojeći stvarni controller HTTP spec dobio je valjan numeric-ID i malformed-ID scenarij sa synthetic Readable streamom i mock servisom. Nije novi real-filesystem/DB dokaz; postojeći integration tok je zaseban.
- **Test-first:** baseline je 22/22. Commit `1be2cc3` lokalno daje **23/24 prolaza i jedan pad**, a CI `41799552405` potvrđuje **802 prošlo / 1 pao**, sve **115/115 integration**, `tsc: 0` i `eslint: 0`. Valjan GET zadržava 200/PDF bajtove/headere/argumente, a malformed ID ranije dobija 200.
- `ParseIntPipe` sada odbija malformed ID s 400 prije servisa. Nema Min(1), novog flaga ni izmjene streama, filename sanitizerja, headera ili response logike.
- **Finalni code CI `41800096690`:** backend **78/803 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba/koraci success i nula failure annotations. Fokusirani suite je **24/24**, svi lokalni Gas testovi **57/57**.
- Samo GET invoice OpenAPI/frontend path tip je number; sync/type-check i frontend **92/92** prolaze. ESLint **0 errors / 2 postojeća warnings**. Nema migracije/backfilla ili mobile/compose promjene. Rollback je revert `6dc7e90`.
- **Preostalo:** real-filesystem/DB nije dodatno dokazan, ID pozitivnost, drugi moduli, cijeli DTO inventar i produkcijski rollout.

### S-002 — Gas meter-image download runtime path ID validacija (2026-11-04)

**STATUS: METER-IMAGE DOWNLOAD PATH ID RIJEŠEN U KODU (`9abe486`); HTTP STREAM DOKAZ ZELEN.** Owner/filesystem logika, headeri i invoice download nisu mijenjani.

- Source review je potvrdio string path ID i `+id` konverziju. Web/mobile već koriste numerički ID; servisni owner lookup, private stream, MIME i Content-Disposition logika ostaju isti.
- Postojeći stvarni controller HTTP spec dobio je valjan numeric-ID i malformed-ID scenarij sa synthetic Readable streamom i mock servisom. Nije novi real-filesystem/DB dokaz; postojeći integration tok je zaseban.
- **Test-first:** baseline je 20/20. Commit `4a9ba4b` lokalno daje **21/22 prolaza i jedan pad**, a CI `41795655135` potvrđuje **800 prošlo / 1 pao**, sve **115/115 integration**, `tsc: 0` i `eslint: 0`. Valjan GET zadržava 200/bajtove/headere/argumente, a malformed ID ranije dobija 200.
- `ParseIntPipe` sada odbija malformed ID s 400 prije servisa. Nema Min(1), novog flaga ni izmjene streama, filename sanitizerja, headera ili response logike.
- **Finalni code CI `41796151794`:** backend **78/801 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba/koraci success i nula failure annotations. Fokusirani suite je **22/22**, svi lokalni Gas testovi **55/55**.
- Samo GET meter-image OpenAPI/frontend path tip je number; sync/type-check i frontend **92/92** prolaze. ESLint **0 errors / 2 postojeća warnings**. Nema migracije/backfilla ili mobile/compose promjene. Rollback je revert `9abe486`.
- **Preostalo:** real-filesystem/DB nije dodatno dokazan, ID pozitivnost, invoice download i drugi moduli te produkcijski rollout.

### S-002 — Gas invoice DELETE runtime path ID validacija (2026-11-04)

**STATUS: INVOICE DELETE PATH ID RIJEŠEN U KODU (`f0a3664`); HTTP DOKAZ ZELEN.** Servisno owner/file/DB brisanje i download ID parametri nisu mijenjani.

- Source review je potvrdio string path ID i `+id` konverziju. Web/mobile već koriste numerički ID; controller ne mijenja servisni owner lookup, file deletion, DB update ili response.
- Postojeći stvarni controller HTTP spec s produkcijskim ValidationPipe dobio je valjan numeric-ID i malformed-ID scenarij. Servis je mockan; postojeći real-DB/file integration tok je zaseban i nepromijenjen.
- **Test-first:** baseline je 18/18. Commit `5b6edf0` lokalno daje **19/20 prolaza i jedan pad**, a CI `41791150307` potvrđuje **798 prošlo / 1 pao**, sve **115/115 integration**, `tsc: 0` i `eslint: 0`. Valjan DELETE zadržava 200/response/argumente, a malformed ID ranije dobija 200 i dolazi do servisa.
- `ParseIntPipe` sada odbija malformed ID s 400 prije servisa. Nema Min(1), novog flaga ni izmjene stvarnog brisanja fajla/zapisa ili drugih ruta.
- **Finalni code CI `41791663202`:** backend **78/799 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba/koraci success i nula failure annotations. Fokusirani suite je **20/20**, svi lokalni Gas testovi **53/53**.
- Samo DELETE invoice OpenAPI/frontend path tip je number; sync/type-check i frontend **92/92** prolaze. ESLint **0 errors / 2 postojeća warnings**. Nema migracije/backfilla ili mobile/compose promjene. Rollback je revert `f0a3664`.
- **Preostalo:** novi real-DB/file-delete dokaz nije dodat, ID pozitivnost, meter/invoice download i drugi moduli te produkcijski rollout.

### S-002 — Gas invoice upload runtime path ID validacija (2026-11-04)

**STATUS: INVOICE UPLOAD PATH ID RIJEŠEN U KODU (`2bfa4e3`); HTTP DOKAZ ZELEN.** DTO, PDF/storage/DB logika i drugi ID parametri nisu mijenjani.

- Source review je potvrdio string path ID i `+id` konverziju. Web/mobile već šalju numerički ID, `invoicePdf` i optional cijenu; FileInterceptor, UploadInvoiceDto i servis nisu mijenjani.
- Postojeći stvarni controller HTTP spec s produkcijskim ValidationPipe dobio je valjan numeric-ID i malformed-ID scenarij. Servis je mockan; postojeći real-DB/file integration tok je zaseban i nepromijenjen.
- **Test-first:** baseline je 16/16. Commit `da4b941` lokalno daje **17/18 prolaza i jedan pad**, a CI `41788986551` potvrđuje **796 prošlo / 1 pao**, sve **115/115 integration**, `tsc: 0` i `eslint: 0`. Valjan upload zadržava 201/DTO/file argumente, a malformed ID ranije dobija 201 i dolazi do servisa.
- `ParseIntPipe` sada odbija malformed ID s 400 prije servisa. Nema Min(1), novog flaga ni izmjene DTO-a, content-signature, file-limit, storage, ownership, transakcije, price history ili response logike.
- **Finalni code CI `41789558574`:** backend **78/797 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba/koraci success i nula failure annotations. Fokusirani suite je **18/18**, svi lokalni Gas testovi **51/51**.
- Samo POST invoice OpenAPI/frontend path tip je number; sync/type-check i frontend **92/92** prolaze. ESLint **0 errors / 2 postojeća warnings**. Nema migracije/backfilla ili mobile/compose promjene. Rollback je revert `2bfa4e3`.
- **Preostalo:** novi real-storage/DB/price-history dokaz nije dodat, ID pozitivnost, invoice-delete/download i drugi ID parametri te produkcijski rollout.

### S-002 — Gas meter-image upload runtime path ID validacija (2026-11-04)

**STATUS: METER-IMAGE UPLOAD PATH ID RIJEŠEN U KODU (`6c0947b`); HTTP DOKAZ ZELEN.** Multipart/storage/DB logika i drugi ID parametri nisu mijenjani.

- Arena grafted base oporavljen je fetch + `git reset --mixed` na remote `1e4e4e5`, bez `--hard`; radno stablo je bilo čisto prije testa. Backend/frontend dependencies vraćeni su npm ci bez lockfile izmjena.
- Source review je potvrdio string path ID i `+id` konverziju. Web/mobile već šalju numerički ID i isti multipart `meterImage`; FileInterceptor i servis nisu mijenjani.
- Postojeći stvarni controller HTTP spec s produkcijskim ValidationPipe i stvarnim FileInterceptorom dobio je valjan numeric-ID i malformed-ID scenarij. Servis je mockan; nije real-storage/DB dokaz.
- **Test-first:** baseline je 14/14. Commit `89f0e78` lokalno daje **15/16 prolaza i jedan pad**, a CI `41779354108` potvrđuje **794 prošlo / 1 pao**, sve **115/115 integration**, `tsc: 0` i `eslint: 0`. Valjan upload zadržava 201/file argumente, a malformed ID ranije dobija 201 i dolazi do servisa.
- `ParseIntPipe` sada odbija malformed ID s 400 prije servisa. Nema Min(1), novog flaga ni izmjene content-signature, file-limit, storage, ownership ili response logike.
- **Finalni code CI `41779782667`:** backend **78/795 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba/koraci success i nula failure annotations. Fokusirani suite je **16/16**, svi lokalni Gas testovi **49/49**.
- Samo POST meter-image OpenAPI/frontend path tip je number; sync/type-check i frontend **92/92** prolaze. ESLint **0 errors / 2 postojeća warnings**. Nema migracije/backfilla ili mobile/compose promjene. Rollback je revert `6c0947b`.
- **Preostalo:** real-storage/DB side effecti, ID pozitivnost, invoice/download i drugi ID parametri te produkcijski rollout.

### S-002 — Gas reading DELETE runtime path ID validacija (2026-11-03)

**STATUS: DELETE PATH ID RIJEŠEN U KODU (`d922323`); HTTP DOKAZ ZELEN.** Servisno brisanje, real-DB ownership/file side effecti i preostali ID parametri nisu mijenjani.

- Source review je potvrdio string path ID i `+id` konverziju. Web/mobile već koriste `deleteGasReading(id: number)`; servisni owner lookup, file deletion i DB delete ostaju nepromijenjeni.
- Postojeći stvarni controller HTTP spec dobio je valjan numeric-ID i malformed-ID scenarij s mock delete servisom. Dokaz je controller/path granica, ne real-DB ili filesystem dokaz.
- **Test-first:** baseline je 12/12. Commit `de896a8` lokalno daje **13/14 prolaza i jedan pad**, a CI `41734916905` potvrđuje **792 prošlo / 1 pao**, sve **115/115 integration**, `tsc: 0` i `eslint: 0`. Valjan DELETE ostaje 200, a malformed ID ranije dolazi do servisa sa 200.
- `ParseIntPipe` sada odbija malformed ID s 400 prije servisa. Valjan response i `delete(42, 17)` ostaju; nema Min(1), novog flaga ni izmjene drugih ID ruta.
- **Finalni code CI `41735480831`:** backend **78/793 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba/koraci success i nula failure annotations. Fokusirani suite je **14/14**, svi lokalni Gas testovi **47/47**.
- OpenAPI/frontend DELETE path tip je number; sync/type-check i frontend **92/92** prolaze. ESLint **0 errors / 2 postojeća warnings**. Nema migracije/backfilla ili mobile/compose promjene. Rollback je revert `d922323`.
- **Preostalo:** real-DB/file deletion dokaz, ID pozitivnost, drugi ID parametri i produkcijski rollout.

### S-002 — Gas reference runtime path ID validacija (2026-11-03)

**STATUS: REFERENCE PATH ID RIJEŠEN U KODU (`56955be`); HTTP DOKAZ ZELEN.** Ostali Gas ID parametri, pozitivnost ID-a i servisna transakcija nisu mijenjani.

- Source review je potvrdio string path ID i `+id` konverziju nakon validation sloja. Web/mobile već šalju numerički ID i postojeći boolean body DTO; `GAS_STRICT_VALIDATION` ostaje nepromijenjen.
- Postojeći stvarni controller HTTP spec s produkcijskim ValidationPipe pravilima dobio je valjan numeric-ID i malformed-ID scenarij. Servis je mockan na DI boundaryju; ovo nije real-DB ownership ili transakcijski dokaz.
- **Test-first:** baseline je 10/10. Commit `0763bb9` lokalno daje **11/12 prolaza i jedan pad**, a CI `41732729676` potvrđuje **790 prošlo / 1 pao**, sve **115/115 integration**, `tsc: 0` i `eslint: 0`. Valjan PATCH ostaje 200, dok malformed ID ranije dobija 200 i dolazi do servisa.
- `ParseIntPipe` sada odbija malformed ID s 400 prije servisa. Valjan response i argumenti `(userId=42, readingId=17, dto)` ostaju; nema `Min(1)`, novog flaga ni izmjene drugih ID ruta.
- **Finalni code CI `41733423596`:** backend **78/791 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba/koraci success i nula failure annotations. Fokusirani suite je **12/12**, svi lokalni Gas testovi **45/45**.
- OpenAPI i frontend path tip su sada number, što postojeći klijenti već koriste; sync/type-check i frontend **92/92** prolaze. ESLint **0 errors / 2 postojeća warnings**. Nema migracije/backfilla ili mobile/compose promjene. Rollback je revert `56955be`.
- **Preostalo:** drugi ID parametri, pozitivnost ID-a, real-DB reference transakcija/ownership i produkcijski rollout.

### S-002 — Gas analysis runtime query DTO validacija (2026-11-03)

**STATUS: GAS ANALYSIS QUERY ULAZ RIJEŠEN U KODU (`0f45b90`); HTTP DOKAZ ZELEN.** Servisni proračun, fallback i response nisu mijenjani; redoslijed datuma nije nova DTO politika.

- Source review je potvrdio pojedinačne string query parametre i direktni `new Date`. Web šalje postojeći `YYYY-MM-DD` raspon, installed mobile ne šalje parametre, a postojeći samo-from fallback je također sačuvan.
- Postojeći stvarni controller HTTP spec s produkcijskim ValidationPipe pravilima dobio je osam scenarija: tri valjane kontrole i pet nevažećih oblika. Servis je mockan jer je predmet controller validacija; nije real-DB dokaz.
- **Test-first:** baseline je 2/2. Commit `2ff5f02` lokalno daje **5/10 prolaza i 5 padova**, a CI `41730527365` potvrđuje **784 prošla / 5 palo**, sve **115/115 integration**, `tsc: 0` i `eslint: 0`. Malformed, prazan, ponovljeni i dodatni parametar ranije su dobijali 200 i dolazili do servisa.
- `GetGasAnalysisDto` ima optional `IsDateString` za from/to i globalni whitelist za dodatna polja. Nema novog para-obaveznih polja, poređenja datuma ili maksimalnog intervala; `GasReadingService` je nepromijenjen.
- **Finalni code CI `41731170925`:** backend **78/789 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba/koraci success i nula failure annotations. Fokusirani suite je **10/10**, svi lokalni Gas testovi **43/43**.
- OpenAPI primjeri su regenerisani, a frontend tipovi ostaju isti optional string oblici; sync/type-check i frontend **92/92** prolaze. ESLint **0 errors / 2 postojeća warnings**. Nema migracije/backfilla, novog flaga ili mobile/compose promjene. Rollback je revert `0f45b90`.
- **Preostalo:** poredjenje i maksimalni raspon datuma, real-DB analiza, preostali `:id` i drugi neDTO ulazi te produkcijski rollout.

### S-002 — Heating event stub runtime DTO validacija (2026-11-03)

**STATUS: HEATING STUB ULAZ RIJEŠEN U KODU (`ffd1624`); HTTP DOKAZ ZELEN.** Ovo nije implementacija stvarne pohrane događaja niti fizičke temperaturne politike.

- Source review je potvrdio inline body za postojeća četiri brojčana polja. Zadani stub response ostaje 501, legacy rollback zadržava stari 201 response za validan ulaz, a repo frontend/mobile nema POST potrošača.
- Postojeći stvarni controller HTTP spec dopunjen je produkcijskim ValidationPipe opcijama i deset scenarija: validna legacy kontrola, jedan default-invalid i osam legacy-invalid oblika. Prisma/vanjske granice su mockane jer ruta ne poziva bazu; to nije real-DB dokaz.
- **Test-first:** baseline je bio 16/16. Commit `b4652e1` lokalno daje **17/26 prolaza i 9 padova**, a CI `41727970087` potvrđuje **772 prošla / 9 palo**, uz svih **115/115 integration**, `tsc: 0` i `eslint: 0`. Stari default-invalid daje 501, a legacy-invalid 201 umjesto 400.
- `CreateHeatingEventDto` zahtijeva `deviceId` integer i tri brojčane temperature, uz raw-input zaštitu od implicitne konverzije i whitelist za dodatna polja. Nema temperaturnih min/max pravila ni izmjene globalnog pipea/stub režima.
- **Finalni code CI `41728674581`:** backend **78/781 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba/koraci success i nula failure annotations. Fokusirani lokalni suite je **26/26**.
- OpenAPI/frontend tipovi su regenerisani, sync/type-check i frontend **92/92** prolaze; ESLint **0 errors / 2 postojeća warnings**. Nema migracije/backfilla, novog flaga, mobile/compose promjene. Rollback je revert `ffd1624`.
- **Preostalo:** stvarna pohrana i ownership uređaja, fizički rasponi, produkcijski rollout i drugi neDTO query/param ulazi.

### S-002 — notification preferences runtime DTO validacija (2026-11-03)

**STATUS: PREFERENCES DIO RIJEŠEN U KODU (`b7d713c`); STVARNI HTTP/POSTGRESQL DOKAZ ZELEN.** Drugi inline/interface ulazi i šire granice sadržaja nisu obuhvaćeni.

- Source review je potvrdio da je PATCH preferences i dalje koristio inline TypeScript tip bez runtime validacije. Postojeći web/mobile ugovor šalje samo `type` i `enabled`, pa je dodan uski `UpdateNotificationPreferenceDTO` bez promjene kontrolerovog JWT owner upserta ili validnog response oblika.
- Test-only `32e4e96` dodaje deset scenarija: anonymous 401; validan true/false upsert s jednim vlasnikovim redom i bez tuđeg side effecta; te osam nevažećih oblika koji moraju dati 400 bez DB upisa. Posebno su pokriveni missing `enabled`, string `"false"`, ne-string/missing/unknown `type` i dodatno polje.
- **Test-first CI `41723699149`:** **107/115 integration**, tačno osam očekivanih padova i zelene obje kontrole, uz `tsc: 0` i `eslint: 0`. Stari kod je za nevažeći/missing type dao 500, a missing enabled 200. Testovi nisu prilagođavani starom ponašanju.
- DTO koristi `IsEnum` i `IsBoolean`; raw-input transform samo za `enabled` sprječava implicitnu konverziju stringa prije validacije. Globalni ValidationPipe i drugi DTO-ovi ostaju nepromijenjeni.
- **Finalni code CI `41724589209`:** backend **78/771 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba/koraci success i nula failure annotations. Porast je +10 testova bez novog suitea.
- Lokalni actual-DTO probe prolazi za dva validna boolean oblika i odbija svih osam nevažećih. OpenAPI/frontend tipovi su regenerisani, sync/type-check i frontend **92/92** prolaze; ESLint **0 errors / 2 postojeća warnings**. Real-DB rezultat je CI, ne lokalni Jest.
- Nema migracije/backfilla, flaga, mobile/compose promjene. Rollback je revert `b7d713c`, čime se vraća nedostatak runtime validacije.
- **Preostalo:** drugi inline/interface ulazi, proizvoljni manual `data`, length/payload-size politika, token lifecycle i produkcijski deploy.

### S-002 — manual notification runtime DTO validacija (2026-11-03)

**STATUS: MANUAL DIO RIJEŠEN U KODU (`ce1a2cf` + `4efede1`); STVARNI HTTP/POSTGRESQL DOKAZ ZELEN.** U tom sliceu preferences i ostali inline/interface ulazi nisu obuhvaćeni; preferences je naknadno riješen u `b7d713c`.

- Source review je potvrdio da je `ManualNotificationDTO` i dalje bio interface. Postojeći `CreateNotificationDTO` nije slijepo reuseovan: njegov obavezni `userId` ne odgovara manual ugovoru u kojem controller primaoca uzima isključivo iz JWT-a. Novi klasni DTO zadržava opcioni legacy `userId`, ali ga i dalje ignorira.
- Postojeći notification integration spec proširen je s deset scenarija: anonymous 401; validan response/push/DB upis; redundantni userId bez preusmjeravanja; te sedam nevažećih oblika koji moraju dati 400 bez push ili DB upisa. ExpoPushService je mockan samo na DI boundaryju, pa nema stvarnog push saobraćaja.
- **Test-first:** CI `41693193798` dao je devet padova, ali su dvije pozitivne kontrole pale zbog postojećeg SYSTEM_ALERT debouncea. Commit `d989849` mijenja samo fixture tip. CI `41693806959` zatim daje **98/105 integration**, tačno sedam očekivanih DTO padova, `tsc: 0` i `eslint: 0`; validne kontrole prolaze.
- **Code provjera:** prvi DTO code run `41694883756` ostavio je samo number-title i object-message kao 201 jer globalni `enableImplicitConversion` pretvara ulaz prije `@IsString`. `4efede1` dodaje DTO-lokalni raw-input transform samo za title/message; globalni pipe i drugi DTO-ovi nisu mijenjani.
- **Finalni CI `41695612403`:** backend **78/761 + 12/105 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba/koraci success i nula failure annotations. Porast je +10 testova bez novog suitea.
- Lokalni actual-DTO probe daje nula grešaka za validan i legacy userId te po jednu za number-title, object-message, unknown-type i extra-field. Tačan ESLint ima **0 errors / 2 postojeća warnings**. Frontend OpenAPI sync/type-check i **92/92** testova prolaze. Real-DB rezultat je CI, ne lokalni Jest.
- OpenAPI sada dokumentuje manual request shemu, a frontend tipovi su regenerisani; response `{success:true,message}` ostaje isti. Nema migracije/backfilla, flaga, mobile ili compose promjene. Rollback je revert `4efede1` i `ce1a2cf`, čime se vraća nedostatak runtime validacije.
- **Preostalo nakon ovog manual slicea:** drugi interface/inline ulazi, `data` i title/message length/payload-size politika, token lifecycle i produkcijski deploy. Preferences je naknadno riješen u `b7d713c`.

### SEC-4 — atomska konkurentna rotacija refresh tokena (2026-11-03)

**STATUS: RACE ISPRAVLJEN U KODU (`de635ad`); STVARNA PRISMA/POSTGRESQL PROVJERA ZELENA.** Ovo nije zatvaranje ostalih SEC-4 auth/session tema.

- Na neizmijenjenom kodu sonda stvarnog servisa reproducirala je **dva fulfilled ishoda, dva aktivna različita nasljednika i tri vlasnikova reda**. Test-only commiti `a4607f8` i `6d0f4a5` dodali su real-DB service spec; CI `41668760579` pao je samo na konkurentnom testu (**94/95 integration**, `tsc: 0`, `eslint: 0`). Raniji run `41668103008` imao je dvije harness greške tipizacije, zatim ispravljene bez promjene asserta ili production koda.
- `rotate()` sada koristi conditional `updateMany({ id, revokedAt: null })`; tačno jedan poziv dobiva claim. Opoziv starog i insert nasljednika su u istoj transakciji, a gubitnik claima koristi postojeći reuse cleanup i vraća `UnauthorizedException`. Hash-only pohrana, sequential reuse, logout/revoke i zaštita tuđih sesija ostaju.
- **Finalni CI `41669534608`:** backend **78/751 + 12/95 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba/koraci success i nula failure annotations. Porast u odnosu na SEC-2 je +1 suite/+2 testa, odnosno +1 integration suite/+2 integration testa.
- Konkurentni spec dokazuje jedan fulfilled i jedan rejected ishod, samo stari i jedan novi vlasnikov red, nula aktivnih vlasnikovih tokena nakon reusea i jednu aktivnu sesiju drugog korisnika. Lokalni offline helper je prije fixa očekivano pao, a poslije prolazi; fake transakcija modelira row-lock barijeru i ne predstavlja se kao real-DB dokaz. ESLint ima **0 errors / 2 postojeća warnings**. Lokalni Auth unit nije pokrenut bez generated Prisma; CI je autoritativan.
- Nema nove migracije/backfilla ni novog flaga. `AUTH_COOKIE_REFRESH_ENABLED` ostaje zadano **off**; nema DTO/cookie/Bearer/SecureStore/access-TTL/frontend/mobile promjene. Revert `de635ad` vraća race, a rollback ne smije predstavljati uključivanje feature flaga.
- **Preostalo:** spec je servisni real-DB dokaz, ne AppModule/HTTP/browser test. Access-token revokacija, `isActive`, promjena lozinke bez stare, 2FA, produkcijski rollout i fizički browser/SecureStore QA ostaju otvoreni.

### SEC-2/B-009/B-010 — anomaly ownership i DTO stvarni HTTP/PostgreSQL dokaz (2026-11-03)

**STATUS: RUNTIME DOKAZ ZAVRŠEN (`971c8f9`); INVALID-ID GRANICA ISPRAVLJENA (`0bbb5db`).** Source review je potvrdio postojeći JWT userId, owner scope u findFirst/updateMany i DTO validatore. Nova production izmjena je samo ParseIntPipe za eventId; validni response i postojeći foreign/missing odgovor nisu mijenjani.

- Novi `backend/test/integration/anomalies-ownership.integration.spec.ts` sa stvarnim AppModule/JWT/Prisma/PostgreSQL i dva korisnika ima sedam scenarija: anonymous 401; owner confirm; owner ISO datum; owner prazan body; identičan foreign/missing odgovor bez DB/recommendation side effecta; malformed datum i podvaljeno userId polje 400; nevažeći eventId 400 prije DB upita.
- **Test-first CI `41662817605`:** real-DB **92/93**, jedini pad je invalid ID — expected 400, received 200. Time je production mismatch dokazan prije ispravke, bez mijenjanja testa radi starog odgovora.
- **Finalni code CI `41663389051`:** backend **77/749 + 11/93 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba/koraci success i nula failure annotations. Porast je +1 suite/+7 testova.
- **Lokalno:** DTO unit **7/7**, oba offline helpera, integration discovery, izolovani controller/pipe probe 400 bez servisnog poziva i tačan ESLint **0 errors / 2 postojeća warnings**. Stvarni DB dokaz je CI; lokalna baza nije pokretana.
- Recommendation je mockan samo na DI boundaryju; nema stvarnog recommendation/push rada. Nema migracije/backfilla, flaga, DTO/OpenAPI/compose promjene. Instalirani mobile zadržava validne odgovore, a nevažeći ID sada dobija 400. Rollback ParseIntPipe-a ne smije ukloniti postojeću owner zaštitu.
- **Preostalo:** GET anomalija, konkurentni ownership race, produkcijski proxy/deploy i stvarni recommendation tok nisu obuhvaćeni.

## Implementacija — MO2-2 version gate ZAVRŠEN (2026-10-29)

`MO2-2` je bio **preduslov za API-1/API-2/SEC-4/FEAT-7**: bez gate-a svaka promjena API ugovora ruši instalirane mobilne verzije. Vlasnik ga je odobrio („DA, prije prve promjene API ugovora").

**Commiti:** `2b87231` (backend) → `dc67416` (mobile + docs).

### Backend (`2b87231`)

- `GET /api/app/config` — javno, `@Public()`, bez `@UseGuards`. Prefiks `api/` je u kontroleru jer `main.ts` nema `setGlobalPrefix`.
- `AppConfigService` čita `MOBILE_MIN_SUPPORTED_VERSION`, `MOBILE_LATEST_VERSION`, `APP_VERSION_GATE_ENABLED`.
- **Fail-safe:** neispravan semver → log + zadano; neispravan flag → log + `true`; gate ugašen → `minSupportedVersion = 0.0.0`; servis nikad ne baca.
- Zadano: gate **uključen** s `minSupportedVersion = 1.0.0` (verzija koja je stvarno kod korisnika) — ne blokira nikoga dok se env ne podigne.
- Bez nove zavisnosti: `semver` je u `backend/node_modules` ali **nije deklariran** (fantomska), pa se koristi strogi regex.

### Mobile (`dc67416`)

- `src/config/version.config.ts` — `getAppVersion()`, `compareVersions()`, `checkVersionGate()`.
- **Fail-open:** korisnik se blokira **isključivo** kad backend nedvosmisleno kaže da je verzija premala. Mreža, timeout, HTTP 500, ne-JSON, neispravan semver i nepoznata lokalna verzija → aplikacija radi.
- `UpdateRequiredScreen` se renderuje **umjesto** `NavigationContainer`, pa se gate ne može zaobići back dugmetom ni deep linkom; gate ima prednost nad auth-om.
- **Jedan izvor verzije** (bila tri): `version` izbačen iz `app.json`, `app.config.js` čita `pkg.version`, `SettingsScreen` koristi `getAppVersion()`.
- `expo-updates` 29.0.20 (dist-tag `sdk-54`), `runtimeVersion: { policy: 'appVersion' }`, `updates.url` iz jedinstvenog `EAS_PROJECT_ID`.
- `eas.json`: dodat `preview`, svaki profil dobio `channel`, `submit.production` popunjen **isključivo preko `${env:...}`**.
- `expo-application` 7.0.8 deklariran (bio fantomska zavisnost).

### Verifikacija

| Provjera | Rezultat |
|---|---|
| `jest src/common/tests/` | 5 suite-ova, **94 testa**, 0 padova |
| Backend negativni test (`DEFAULT_MIN_SUPPORTED_VERSION`→9.9.9) | **7 failed** → vraćeno → PASS |
| HTTP test (supertest) | `GET /api/app/config` → 200 bez tokena; `/app/config` → 404 |
| `scripts/audit/mobile_version_gate.cjs` (NOVA) | **23/23** prolazi |
| Negativni test harness-a (`openGate`→`mustUpdate:true`) | **4 pada**, exit 1 |
| `mobile` `tsc --noEmit` | exit 0 |
| backend `tsc` | baseline **213** = poslije **213** (0 novih) |
| `expo config` version | **2.0.0** = `package.json` (bilo 1.0.0) |
| 6 audit skripti | exit 0 |

`scripts/audit/mobile_version_gate.cjs` transpajlira **stvarni** `version.config.ts` + `api.config.ts`, stub-uje expo module, podigne lokalni HTTP server i izvršava pravi `checkVersionGate()` — jer mobilni projekt nema test runner (MO-012, `npm test` exit 127).

### Ispravke vlastitih tvrdnji

- **„Svih 6 audit skripti exit 0"** — bilo je pogrešno: mjerio sam `rc=$?` iza pipe-a na `tail`, što vraća exit od `tail`-a (zamka zabilježena ranije u ovom istom dokumentu). Stvarno stanje: `backend_inventory.py` je **već bio exit 1 na `f5018b3`** (pomjereni brojevi linija u `notifications.controller.ts` nakon SEC-1), a `mobile_inventory.py` sam pokvario novim ekranom. **Oboje ispravljeno**: API katalog 69→70 redova uz **0** formalnih grešaka (bilo 13), inventar ekrana 14→15, dodani markeri za `app-config.{controller,service}.ts`.
- **„Baseline 1021 tsc grešaka"** — izmjereno komandom bez `--types node,jest`; s CI komandom baseline je **213**.
- **„8 providera"** u inventaru — stvarno **7** (brojao sam linije, uključujući zatvarajuću zagradu).

### Šta NIJE verificirano

- **`eas build --dry-run` NIJE pokrenut** — `eas-cli` nije instaliran u sandboxu (kriterij prihvatanja #3 ostaje otvoren).
- **OTA isporuka preko `expo-updates` nije testirana** — treba EAS nalog i objavljen update.
- **`UpdateRequiredScreen` nije viđen na stvarnom uređaju/emulatoru** — nema RN test runnera.
- **Gate je testiran protiv lokalnog mock servera**, ne protiv stvarnog deployanog backenda.
- **iOS dugme za store je skriveno** dok vlasnik ne upiše `IOS_APP_STORE_ID` (namjerno prazan — izmišljeni ID bi odveo na tuđu aplikaciju).
- `submit.production` traži env varijable koje vlasnik mora postaviti (`GOOGLE_SERVICE_ACCOUNT_KEY_PATH`, `ASC_APP_ID`, `ASC_API_KEY_PATH`, `ASC_API_KEY_ISSUER_ID`, `ASC_API_KEY_ID`).

---

## API-1 — Ugovor za stub endpointe (B-001, B-002, B-003)

**Status:** implementirano i verificirano.

**Problem.** Tri endpointa su vraćala prividno ispravan odgovor za
neimplementiranu funkcionalnost:

- `POST /api/heating-events` → izmišljeni `Math.floor(Math.random() * 10000)` ID,
  **ništa se nije upisivalo u bazu** (najgore: klijent je mislio da je zapis kreiran),
- `GET /api/weather` → `{}`,
- `GET /api/recommendations/today` → `[]`.

`{}` i `[]` su **nerazlučivi od „nema podataka"**, pa klijent ne može znati da li
zaista nema preporuka za danas ili endpoint uopšte nije implementiran.

**Identifikacija potrošača (kriterij prihvatanja) — sva tri stuba imaju 0 potrošača.**

| Stub | Šta stvarno rade klijenti | Potrošača |
| --- | --- | --- |
| `POST /api/heating-events` | kompletna lista `.post()` ruta u oba klijenta ne sadrži heating-events | **0** |
| `GET /api/weather` | `getCurrentWeather()` zove `GET /weather/current/:homeProfileId` (druga ruta) | **0** |
| `GET /api/recommendations/today` | `ReportsPage` zove `getReports()` → `GET /recommendations` | **0** |

Rute koje **imaju** potrošače i nisu dirane: `GET /heating-events`,
`GET /dashboard/heating-events`, `GET /recommendations`,
`GET /weather/current/:homeProfileId`.

**Rješenje.** Novi `backend/src/common/stub-endpoint.ts`:

- `throwIfStubRejected(endpoint, { alternative })` baca
  `UnimplementedEndpointException` → **`501 Not Implemented`** s tijelom
  `{ statusCode, error, endpoint, reason: 'stub-not-implemented', message, alternative? }`.
  `reason` je ono što razlikuje „neimplementirano" od „nema podataka".
- `alternative` navodi stvarnu rutu koja radi (weather, recommendations).

**Feature flag / rollback.** `STUB_ENDPOINTS_MODE`:

- `reject` (**zadano**) → 501,
- `legacy` → staro stub ponašanje, bez potrebe za deployem novog koda.

Neispravna vrijednost pada na `reject` (fail-safe: zastavica ne smije moći
ugasiti zaštitu) i loguje upozorenje.

**Testovi.** `backend/src/common/tests/stub-endpoint.spec.ts` — **16 testova**,
uključujući HTTP nivo (supertest) za sve tri rute i dokaz da `legacy` režim
vraća stari `{}` / `[]`.

```bash
cd backend && npx jest src/common/tests/stub-endpoint.spec.ts   # 16 passed
cd backend && npx jest src/common/tests/                        # 110 passed
```

**Verifikacija (stvarno izmjereno):**

| Provjera | Rezultat |
| --- | --- |
| `npx jest src/common/tests/stub-endpoint.spec.ts` | 16/16, exit 0 |
| `npx jest src/common/tests/` | 6 suite-ova / 110 testova, exit 0 (baseline 5/94 + novi 1/16) |
| Mutacijski test (501 → 200 u pomagaču) | **4 failed / 12 passed, exit 1** — test hvata regresiju |
| `npx tsc -p tsconfig.json --noEmit --types node,jest` | **213 = tačno baseline**, 0 novih grešaka |
| `npx eslint` (5 promijenjenih fajlova) | exit 0 |
| 6 audit skripti | svih 6 exit 0 |

**Napomena o audit dokumentima.** Dodavanje importa pomjerilo je linije u tri
kontrolera, pa su `file:line` markeri u `02-api-catalog.md` postali zastarjeli i
`backend_inventory.py` je pao (exit 1, 12 formalnih grešaka). Ispravljeno 12
zamjena (6 markera × 2 pojave) uz `assert n == 2` da se ne pogode rasponi poput
`:20-49`. Skripta ponovo exit 0.

**Šta NIJE verificirano:** ponašanje protiv deployanog backenda; integracioni
testovi (`npx prisma generate` ne prolazi u sandboxu jer `binaries.prisma.sh`
nije dostupan — CI to radi preko `npm run generate:prisma`).

---

## API-2 — OpenAPI kao provjeren ugovor

**Status:** implementirano i verificirano (prva faza; codegen klijentskih
tipova je `FE2-8`).

**Problem.** Swagger se montirao na `/api/docs`, ali specifikacija **nije
bila dokazana**: nije postojao nijedan komitovani artefakt, pa se nije moglo
utvrditi ni da je potpuna ni da li se mijenja na nekompatibilan način.
`DocumentBuilder` je bio inline u `main.ts`, pa bi svaki generator morao
duplicirati postavke i neizbježno driftati.

**Rješenje.**

1. **`backend/src/openapi.config.ts`** — jedinstveni izvor istine.
   `buildOpenApiConfig()`, `createOpenApiDocument()`,
   `serializeOpenApiDocument()`. Serijalizacija **dubinski sortira ključeve**,
   jer bez toga promjena redoslijeda ruta u modulu daje lažni diff i CI
   provjera bi bila beskorisna. `main.ts` i generator zovu iste funkcije.
2. **`backend/scripts/generate-openapi.ts`** (`npm run openapi:generate`) —
   pokreće stvarnu aplikaciju bez `listen`, piše ugovor u
   **`contracts/openapi.json`**, a s `--check` samo upoređuje i vraća exit 1
   pri odstupanju.
3. **CI korak „OpenAPI contract in sync (API-2)"** u `backend-audit.yml`,
   nakon `Build` (jer `prepare` već pokrene `generate:prisma`).

**Potpuna dokumentovanost.** Bilo je **16 kontrolera, samo 11 s `@ApiTags`**.
Dodato 6 tagova na 5 kontrolera (`Metrics`, `Auth`, `Home Profiles`,
`Home Profile` ×2, `Notifications`) → sada **16/16** i **0 operacija bez
taga**.

**Rezultat (stvarno generisano):** `openapi 3.0.0`, **54 putanje, 67
operacija, 14 šema, 16 tagova**.

**Unakrsna provjera potpunosti.** 70 route dekoratora u kodu → 67
jedinstvenih `(verb, path)` parova → u specu **0 nedostaje, 0 viška**.
Razlika 70 vs 67 nisu izgubljene rute nego **3 duplikata**:

| Rute | Deklarisano dvaput |
| --- | --- |
| `GET /api/home-profile` | `home.profile.controller.ts` i `home.profile.single.controller.ts` |
| `POST /api/home-profile` | isto |
| `PATCH /api/home-profile/{id}` | isto |

Ovo je već bilo zabilježeno (`01-inventory.md:9`, `02-api-catalog.md:5` i
`:74-76` — „Neregistrovana kopija*"), a sada je nezavisno potvrđeno.
**Važno:** spec odražava **runtime stvarnost** (67 operacija), ne statičke
deklaracije — upravo to znači „provjeren ugovor".

**Verifikacija (stvarno izmjereno):**

| Provjera | Rezultat |
| --- | --- |
| `npm run openapi:generate` | exit 0, artefakt zapisan |
| `--check` kad je usklađeno | exit 0 |
| **Mutacijski test** (uklonjen `/api/weather` iz artefakta) | **exit 1**, „ugovor se razlikuje od komitovanog artefakta" |
| `tsc` bez stuba (isti uslovi kao baseline) | **213 = tačno baseline**, 0 novih |
| `npx eslint` (7 fajlova) | exit 0 |
| 6 audit skripti | svih 6 exit 0 |
| YAML workflow | 14 koraka, OpenAPI korak prisutan |

**Ispravka vlastite greške iz API-1.** Prošli commit `dba58a5` sam predao uz
tvrdnju „svih 6 audit skripti exit 0". Provjera čistog worktree-a na tom
commitu pokazala je **`backend_inventory.py` exit 1** —
`NEDOSTAJE backend/src/common/stub-endpoint.ts`: dodao sam fajl u
`backend/src/common/` bez odgovarajućeg `<!-- common:... -->` markera u
`01-inventory.md`. Sada ispravljeno. Pouka: „skripta prolazi" mora biti
izmjereno nad **commitovanim** stanjem, ne nad radnim stablom usred izmjena.

**Napomena o sandboxu.** `prisma generate` ovdje ne prolazi
(`binaries.prisma.sh` nije dostupan, ni s `--no-engine`), pa je za
instanciranje aplikacije korišten **privremeni** stub generisan iz
`prisma/schema.prisma` (12 enuma, 15 model delegata). Direktorij
`backend/src/generated` je gitignored (`.gitignore:51`), pa stub **nije
komitovan** — u CI zamjenjuje ga pravi `generate:prisma`.

**Šta NIJE verificirano:** generisanje klijentskih tipova za frontend/mobile
(to je `FE2-8`); ponašanje CI koraka u stvarnom GitHub Actions okruženju.
