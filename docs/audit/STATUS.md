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
- Nova offline reprodukcija `scripts/audit/gas_validation_repro.cjs` izvodi stvarni `ValidationPipe` sa `main.ts` opcijama i DTO-e; `false` kao string i nepoznati neprazni string postaju boolean `true`, dok JSON `false` ostaje `false` (B-015). Prazan string brojila prolazi kao 0 i `-1` kao -1; stvarni gas servis nad fake DB upiše sintetičko prvo negativno očitanje (B-016). Pri kasnijem očitanju 200, ranije 100 servis odbija sa 400 (B-017). Nema HTTP/guarda, stvarne DB ili provider poziva.
- B-018 dokumentuje neatomsku provjeru jednog očitanja po UTC danu i odsustvo dnevnog unique ključa u Prisma modelu; stvarni PostgreSQL race i produkcijska shema nisu potvrđeni. `06-formulas.md`, backlog i plan dopunjeni su zavisnostima domena/validacije. Nova skripta koristi fake DB i presreće samo učitavanje Prisma/storage saradnika; ne tvrditi da je persistencija stvarna.
- Faza 1 ostaje otvorena: potrebni su preostali runtime HTTP/ownership i DevOps/security pregled, stvarni provider fixture ili dokumentovan razlog nedostupnosti, detaljniji backtest i samoprovjera.

### Upload reprodukcija

- `scripts/audit/upload_validation_repro.cjs` koristi stvarni `FileStorageService` i samo sintetičke bajtove u novom privremenom direktoriju koji uklanja. Potvrđeno da se ne-PDF bajtovi čuvaju ako je deklarisani MIME PDF; neprihvatljivi MIME, prevelika deklarisana veličina i `../` putanja u izolovanim slučajevima odbijeni sa 400. Detalji/ograničenja S-006 u `backend/08-security.md`; nije pokrenut HTTP, guard, stvarna baza niti produkcijski storage, a stvarna iskoristivost i symlink prijetnja nisu dokazani.

### Ponovna CI provjera audit grane

- Nakon pusha audit commitova do `c37c1de`, branch-only GitHub Actions [run 40873918268](https://github.com/mudzy992/boiler-control/actions/runs/40873918268) je uspješan: ESLint 0, TypeScript 0, build, 10 suiteova/167 općih testova i 2 suitea/49 integracijskih; dva skupa se preklapaju. Ovo potvrđuje taj commit, ne automatski buduće commitove. Brojčani coverage nije pročitan iz dostupnih anotacija; e2e skripta i dalje nema config, a ovaj CI run ne dokazuje stvarne providere, production deploy, rad aplikacije s Redisom ni produkcijski ownership.
- GitHub je prijavio upozorenje o runtime prelasku checkout/setup-node actiona s Node 20 na Node 24 i migraciji `ubuntu-latest` na Ubuntu 26; kompatibilnost pratiti u idućim CI runovima, bez tvrdnje da je sadašnja aplikacija migrirana na Node 24 (verziju aplikacijskog Nodea konfigurira workflow zasebno).

### Dashboard: sekundarni upit i bucket semantika

- `node scripts/audit/dashboard_repro.cjs` izvršava stvarni servis s fake DB i sintetičkim redovima: pokazuje da se temperatura prvog uređaja pripisuje i drugom događaju i da prazan rezultat ipak zadaje lookup `id: undefined` (B-019). Ovo ne dokazuje cross-user pristup niti ponašanje pravog Prisma klijenta.
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
- B-022: `scripts/audit/fallback_ttl_repro.cjs` na stvarnom fallback servisu i lažnom satu pokazuje da timer prvog upisa briše noviji upis istog ključa prije njegovog TTL-a. Nepostojanje runtime callera u statički pretraženom `backend/src` znači da aktivni produkcijski efekt nije dokazan; zadani 60 °C nije potvrđen kao sigurna fizička granica. Nema DB, mreže ili uređaja.
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
- B-023: `node scripts/audit/poll_metrics_repro.cjs` dva deterministička prolaza ručno pozivaju stvarni polling servis s fake DB i dva sintetička uređaja; oba padaju prije snapshot-a, ali ciklus bilježi success. Odvojeni slučaj greške listanja bilježi failed. Nije testiran cron, stvarni provider ili produkcijski alert; backlog OBS-1 i plan 5.2 dopunjeni.
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
8. **FE2-3** — React Query ujedinjenje s globalnim defaultima i visibility pauzom (3.1).
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
- Tipki dokaz za MO-001: `scripts/audit/mobile-probe/filesystem_api_probe.ts` + `tsconfig.json` — `npx tsc --noEmit -p ../scripts/audit/mobile-probe/tsconfig.json` → **exit 0**. Potvrđeno da `expo-file-system` 19.x (instalirano **19.0.22**, `package.json` traži `~19.0.21`) **ne izvozi** `documentDirectory`/`cacheDirectory`/`temporaryDirectory` kao modulske konstante (samo statički getteri klase `Paths`), dok `makeDirectoryAsync` postoji kao **throwing stub** iz `legacyWarnings`. Zbog toga je CSV export u `GasReadingsScreen.tsx:308-386` slomljen (MO-001, VISOKO).
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
9. **MO2-13** — performanse listi: virtualizacija + memoizacija (3.1).
10. **MO2-15/MO2-17** — preporuke i weather v2 usklađeni s backend FEAT planom (4.2/4.3, s FE2-10/FE2-9).

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

**Još otvoreno (ne blokira Talas A):** version gate (`MO2-2`), mjerodavna formula (`FORM-1`/`FEAT-7`), obim ciklusa (Talas E). — **riješenо u drugom krugu, v. ispod.**

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
