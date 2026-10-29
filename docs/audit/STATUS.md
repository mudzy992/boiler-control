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
