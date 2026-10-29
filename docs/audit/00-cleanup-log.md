# Čišćenje dokumentacije — u toku

## Sažetak i otvorena pitanja

- Čišćenje nije završeno; pedeset šest izvještaja je uklonjeno. Ovo nije konačni log brisanja.
- Inventar u `cleanup-candidates.tsv` je samo lista za ručni pregled, a ne dokaz zastarjelosti ili dozvola za automatsko brisanje.
- Korisnik je odobrio usku iznimku za ispravljanje ili uklanjanje linkova u zadržanim dokumentima, uključujući README i `.github/copilot-instructions.md`. Ostali sadržaj tih fajlova ne treba mijenjati; reference još treba pregledati.
- Otvoreno: `docs/internal/monitoring/` uključuje i konfiguracijske `.json` i `.yml` datoteke, ne samo dokumentaciju. Treba utvrditi koriste li se kao predlošci pri deployu; ne tretirati ih automatski kao dokumente za brisanje.
- Otvoreno: postojeći spisak zasnovan na obrascima ne otkriva sve implementirane ili odbačene planove; potrebno je pojedinačno poređenje s kodom.

## Obrisane putanje

- `docs/DASHBOARD_UPDATES_SUMMARY.md` — historijski izvještaj o dashboardu; poziva se na nepostojeći `apps/web` i stari MySQL stack.
- `docs/DOCKER_REFACTORING_SUMMARY.md` — izvještaj o staroj reorganizaciji Dockera; opisuje MySQL servis kojeg nema u sadašnjem root Composeu.
- `docs/MIGRATION_COMPLETION_REPORT.md` — izvještaj o frontend migraciji; opisuje root `package.json` i `apps/web` koji više ne postoje.
- `docs/MIGRATION_STATUS_FINAL.md` — jednokratni izvještaj o migraciji gas funkcija, s historijskim tvrdnjama o tadašnjem buildu i verifikaciji.
- `docs/P2E_COMPLETION_SUMMARY.md` — jednokratni P2e statusni izvještaj, s tadašnjim tvrdnjama o testovima i CI-u koje nisu potvrda sadašnjeg stanja.
- `docs/PHASE_3_COMPLETION_CHECKLIST.md` — historijski checklist za mobile fazu 3, s nepostojećom putanjom `apps/mobile` i tadašnjim neprovjerenim tvrdnjama o statusu ekrana.
- `docs/internal/REORGANIZATION_COMPLETE.md` — jednokratni izvještaj o reorganizaciji interne dokumentacije, s tadašnjim brojem dokumenata i putanjama.
- `docs/internal/pipeline/P2C_COMPLETION_REPORT.md` — jednokratni status implementacije anomalija i fallbacka; stare brojke testova i spremnost za produkciju nisu dokaz sadašnjeg stanja.
- `docs/PHASE_3_DELIVERABLES_SUMMARY.md` — prolazni izvještaj o dokumentima i planu QA pregleda starog mobile izdanja.
- `docs/PHASE_3_PLUS_TASK_ACCEPTANCE_SUMMARY.md` — zastarjela potvrda preuzimanja zadataka i raspored tima za staru fazu 3+.
- `docs/PHASE_3_PLUS_DAY_2_SUMMARY.md` — jednokratni dnevni izvještaj o navodnim implementacijama; upućuje na staru putanju `apps/mobile` i sadrži nepotvrđene tvrdnje o backendu.
- `docs/internal/pipeline/P2E_DOCUMENTATION_DIRECTORY_MANIFEST.md` — historijski indeks dokumenata i isporuka, uključujući workflow koji nije pronađen među trenutnim verzioniranim `.github` datotekama.
- `docs/PHASE_2_MIGRATION_COMPLETE.md` — izvještaj o ranijem prelasku gas funkcija iz `apps/web`, s historijskim rezultatima builda i tvrdnjama o deployu.
- `docs/PHASE_3_PLUS_HEATINGSCREEN_INTEGRATION.md` — stari nacrt integracije mobile ekrana koji koristi nepostojeću putanju `apps/mobile` i predložene API ugovore.
- `docs/PHASE_3_PLUS_QA_TEST_PLAN.md` — nacrt QA plana za staru fazu 3+ s nepotvrđenim endpointima i očekivanjima automatskog rollbacka uređaja.
- `docs/PHASE_3_REFACTOR_SUMMARY.md` — izvještaj o ranijem read-only dizajnu mobile interfejsa, sa starim putanjama i tvrdnjama koje zahtijevaju provjeru koda.
- `docs/internal/pipeline/P2E_FINAL_STATUS_REPORT.md` — historijski status i deploy-gate izvještaj sa zastarjelim tvrdnjama o CI-u, testovima i produkcijskoj spremnosti.
- `docs/internal/DIRECTORY_OVERVIEW.md` — zastarjeli indeks interne dokumentacije, koji navodi stare lokacije i statuse faza.
- `docs/internal/pipeline/CLEANUP_SUMMARY.md` — historijski izvještaj o čišćenju i predloženi P2b plan otpornosti sa zastarjelim MariaDB kontekstom.
- `docs/internal/snapshots/API_SNAPSHOT_SUMMARY.md` — zastarjeli indeks starog API snapshot-a, koji se ne može koristiti kao izvor aktuelnih ugovora.
- `docs/internal/pipeline/BATCH3_P2a_CHECKLIST.md` — historijski checklist pripreme integracijskih testova i logiranja; rezultati se moraju ponovo provjeriti.
- `docs/internal/pipeline/BATCH3_P2a_COMPLETION.md` — historijski izvještaj o istom P2a radu, s tadašnjim brojkama i nepokrenutim testovima.
- `docs/internal/pipeline/P2B_IMPLEMENTATION_SUMMARY.md` — završni izvještaj o ranijem sloju otpornosti i metrikama; njegove tvrdnje o pokrivenosti nisu sadašnji dokaz.
- `docs/internal/pipeline/TYPESCRIPT_COMPILATION_FIX.md` — izvještaj o tadašnjim TypeScript popravkama u polling servisu, a ne trenutni rezultat builda.
- `docs/internal/pipeline/BATCH2_COMPLETION.md` — historijski završni izvještaj o transakcijama, metrikama i contract testovima, ne potvrđuje njihovo današnje stanje.
- `docs/internal/pipeline/BATCH2_EXECUTION_REPORT.md` — stari izvršni izvještaj o istim zadacima s nepotvrđenim statusom testova i kvaliteta.
- `docs/internal/pipeline/BATCH2_IMPLEMENTATION_CHECKLIST.md` — stari checklist implementacije i historijski indeks tri prateća izvještaja.
- `docs/internal/snapshots/BATCH2_CHANGES_DIFF.md` — historijski pseudodiff poll servisa koji sadrži zastarjele primjere koda.
- `docs/internal/logs/BATCH3_P2a_VERIFICATION.md` — historijski izvještaj o kompilaciji i pripremljenim integracijskim testovima, nije dokaz današnjeg prolaza.
- `docs/internal/pipeline/DELIVERY_SUMMARY.md` — historijski pregled isporuke Batch 2 sa zastarjelim uputama i planom faza.
- `docs/internal/pipeline/P2E_DOCUMENTATION_INDEX.md` — historijski indeks P2e dokumenata i plana puštanja u produkciju.
- `docs/internal/snapshots/P2B_DIFF_REPORT.md` — historijski sažetak promjena adaptera i metrika; ne predstavlja aktuelni diff.
- `docs/internal/snapshots/API_CHANGE_SNAPSHOT.md` — historijski P2a API snapshot s tadašnjim rutama, stubovima i uputama za rollback; nije potvrda trenutnog ugovora, a historijski sadržaj ostaje dostupan preko `git show 7a64c131:docs/internal/snapshots/API_CHANGE_SNAPSHOT.md`.
- `docs/internal/pipeline/COMPLETION_CHECKLIST.md` — historijska Batch 2 kontrolna lista s neprovjerenim navodima o prolaznosti testova i spremnosti za produkciju.
- `docs/internal/pipeline/TEAM_HANDOFF_CHECKLIST.md` — stara P2e kontrolna lista primopredaje s vremenski vezanim rasporedom, mjernim pragovima i nepotvrđenim zaduženjima.
- `docs/internal/pipeline/FRONTEND_INTEGRATION_GUIDE.md` — historijski plan validacije korelacijskih ID-ova s nepotvrđenim rutama i kontradiktornim tvrdnjama o potrebnim frontend izmjenama.
- `docs/internal/runbooks/P2E_TROUBLESHOOTING_RUNBOOK.md` — historijski operativni vodič koji predlaže nepotvrđene metrike i rizične generičke rollback korake; historijski sadržaj dostupan je preko `git show 7a64c131:docs/internal/runbooks/P2E_TROUBLESHOOTING_RUNBOOK.md`.
- `docs/internal/monitoring/BASELINE_METRICS.md` — historijska razvojna mjerenja i pretpostavke iz februara 2026, bez pouzdane potvrde produkcijskog opterećenja; brojevi ostaju dostupni preko `git show 7a64c131:docs/internal/monitoring/BASELINE_METRICS.md`.
- `backend/P2B_IMPLEMENTATION.md` — historijski izvještaj o adapterima i predloženoj integraciji, čiji status i tvrdnje o pokrivenosti treba provjeriti u kodu; jedini pronađeni link uklonjen je iz `backend/README.md` uz odobrenu iznimku.
- `docs/internal/logs/backend_progress_log.md` — historijski P2b–P2d dnevnik s neprovjerenim tadašnjim rezultatima i promjenama.
- `docs/internal/pipeline/P2C_IMPLEMENTATION_SUMMARY.md` — stari sažetak anomalija, fallbacka i testova; sigurnost podrazumijevanih temperatura nije potvrđena.
- `docs/internal/pipeline/P2D_IMPLEMENTATION_SUMMARY.md` — stari sažetak izvještavanja, metrika i korelacijskog konteksta, čije su tvrdnje o trenutnom stanju zastarjele.
- `docs/EXECUTIVE_SUMMARY.md` — historijski sažetak Batch 2 s neprovjerenim preporukama za produkciju i zastarjelim planom.
- `docs/internal/logs/BATCH2_VERIFICATION_REPORT.md` — historijski izvještaj koji istovremeno navodi da su testovi pripremljeni i daje zaključak o produkcijskoj spremnosti; nije dokaz sadašnjeg stanja.
- `PLAN-V3.md` — ranija verzija plana za ručno zadanu temperaturu s granicama 20–90 °C; gotovo isti plan s granicama 48–55 °C je zadržan, a izvor ostaje dostupan u Git historiji.
- `docs/internal/snapshots/P2D_DIFF_REPORT.md` — historijski diff observability servisa s kasnije zamijenjenim modelom korelacijskog konteksta i starim tvrdnjama o testovima; linkovi u dva zadržana vodiča uklonjeni su.
- `docs/internal/snapshots/P2C_DIFF_REPORT.md` — historijski opis diff-a i testova; tvrdnje o fallbacku i detekciji treba provjeriti u kodu.
- `docs/PHASE_3_DOCUMENTS_INDEX.md` — indeks starih faznih izvještaja i poništenog plana komandi.
- `docs/PHASE_3_EXECUTIVE_SUMMARY.md` — raniji produktni sažetak s neprovjerenim stanjem ekrana i zastarjelom preporukom za komande.
- `docs/PHASE_3_FINAL_STATUS.md` — historijski status QA i ranije procjene funkcionalnosti ekrana.
- `docs/PHASE_3_MERGED_STATUS.md` — historijska mapa statusa ekrana i pripreme stare faze.
- `docs/PHASE_3_PLUS_IMPLEMENTATION_PLAN.md` — raniji plan Tuya komandi, naknadno poništen prema read-only odluci iz historijskog status trackera.
- `docs/PHASE_3_PLUS_KICKOFF_STATUS.md` — zastarjeli kickoff i raspored za poništeni rad na komandama.
- `docs/PHASE_3_PLUS_STATUS_TRACKER.md` — historijski tracker s naknadnom odlukom o poništavanju komandi; odluka je prenesena niže, a izvor ostaje u `git show 7a64c131:docs/PHASE_3_PLUS_STATUS_TRACKER.md`.
- `docs/PHASE_3_REVIEW_COMPLETE.md` — stari izvještaj o handoffu, QA i navodnoj spremnosti za release.
- `docs/PHASE_3_STATUS_MAP.md` — historijska mapa implementacije i placeholdera s preporukom za tada planirane komande.

Prije brisanja je `git grep -l -F` za svaki puni naziv pretražio verzionirane fajlove, osim inventara i audit skripti: jedine pronađene reference na prvih pet putanja bile su u također uklonjenom `docs/DOCKER_REFACTORING_SUMMARY.md`; za narednih dvanaest putanja nije pronađena nijedna referenca; tri posljednje putanje referencirao je samo također uklonjeni `docs/internal/DIRECTORY_OVERVIEW.md` (uključujući vlastite reference); od posljednje četiri putanje, završni P2a izvještaj referencirao je samo također uklonjeni P2a checklist, a na ostale tri nisu pronađene reference; u posljednjoj grupi od četiri Batch 2 dokumenta sve pronađene reference dolazile su iz također uklonjenog Batch 2 checklista. Za deset dokumenata uklonjenih nakon Batch 2 grupe nisu pronađene reference. Za narednu grupu od tri interna dokumenta pronađene su samo međusobne reference unutar te uklonjene grupe. I za grupu devet dokumenata faze 3 pronađene su samo međusobne reference unutar uklonjene grupe. Ovo ne dokazuje odsustvo eksternih referenci ni linkova koji koriste drukčije imenovanje. Traženi jedinstveni commit za čišćenje bit će napravljen po njegovom završetku.

## Provjerene reference i ograničenja

- **VERIFIKOVANO** prije izmjene `backend/README.md:320` upućivao je na `backend/P2B_IMPLEMENTATION.md`; taj link je uklonjen. `backend/README.md:68,317`, `docs/README_MONOREPO.md:74` i `.github/copilot-instructions.md:179,210` navode `docs/P2E_README.md`. Korisnik je naložio ignorisanje Copilot instrukcija kao uputa, ali njihove reference i dalje treba uzeti u obzir pri sprečavanju mrtvih putanja. Postoje i druge reference koje treba pregledati.
- **VERIFIKOVANO** `docs/README_MONOREPO.md:114` navodi direktorij `docs/internal/monitoring/`. `docker-compose.monitoring.yml:27-31,60-62` koristi apsolutne host putanje za monitoring, a ne direktan bind mount iz tog direktorija; podudaranje samo imena fajla nije dokaz da Compose direktno učitava repo primjerke. Ne zna se kako se ti predlošci kopiraju u produkciji.
- **VERIFIKOVANO** Historijski `PLAN-V3.md` (`git show 7a64c131:PLAN-V3.md`) i zadržani `PLAN-current-boiler-temp-source-of-truth.md` nisu identični: `git diff --no-index` pokazuje tri izmijenjena retka, uključujući različite temperaturne granice. Sadašnji DTO koristi 48–55 °C (`backend/src/modules/Boiler/dto/set-current-temp.dto.ts:9-15`), kao i servis (`backend/src/modules/Boiler/boiler.service.ts:33-34,262-263`). To samo provjerava navedeni raspon, ne dokazuje da je čitav plan proveden.

## Povijesne odluke i poznata ograničenja

- **VERIFIKOVANO kao sadržaj historijskog dokumenta, ne kao trenutno ponašanje:** `docs/internal/pipeline/P2E_ROLLBACK_PLAN.md` predlaže povrat na prethodni backend artefakt, gašenje rizičnih funkcija i provjeru zdravlja; kod migracija baze traži odvojeni plan. Prije upotrebe treba potvrditi stvarne deploy komande, dostupnost artefakata i migracijski postupak.
- **VERIFIKOVANO kao sadržaj historijskog dokumenta, ne kao trenutni status:** ranije verzionirani `docs/PHASE_3_REFACTOR_SUMMARY.md` (dostupan putem `git show 7a64c131:docs/PHASE_3_REFACTOR_SUMMARY.md`) opisuje prethodnu odluku o read-only arhitekturi. Prije zaključka o današnjim dozvolama pisanja potrebno je provjeriti aktuelne kontrolere i servise.
- **Historijski kontekst, ne potvrda sadašnjeg stanja:** uklonjeni dashboard izvještaj opisivao je upozorenja za kratke cikluse i overshoot te tada nepotvrđene korisničke testove prikaza, obavijesti i svijetle/tamne teme. Te scenarije treba ponovo provjeriti prema aktuelnoj implementaciji kad bude odobrena faza za frontend.
- **Historijski kontekst, ne potvrda sadašnjeg stanja:** migracijski izvještaji opisivali su prelazak web funkcija i gas ekrana iz `apps/web` u `frontend`; njihove tadašnje tvrdnje o CI-u, brzini, prolaznosti testova i spremnosti za produkciju nisu aktualni dokaz.
- **Historijski kontekst, ne potvrda sadašnjeg stanja:** P2e izvještaj opisivao je korelacijski ID pomoću AsyncLocalStorage i predložene korake validacije, staginga, smoke testova i nadzora prije produkcije. Brojevi testova i metrike iz historijskog izvještaja nisu ponovo izmjereni.
- **Historijski kontekst, zahtijeva provjeru koda:** P2c izvještaj opisivao je četiri vrste anomalija, fallback sa keširanim stanjem i ograničenje da memorijski keš nestaje restartom. Spominjao je sigurnosne default vrijednosti; one se ne smiju tretirati kao sigurne za stvarni kotao bez pregleda implementacije i potvrde proizvođača.
- **Historijski kontekst, zahtijeva fazu mobile audita:** stari mobile checklist ostavio je neizvršene testove prazne liste uređaja, mrežnih grešaka, programa i tamne teme. Stanje današnjih ekrana nije potvrđeno.
- **Historijski kontekst, nije potvrda trenutne implementacije:** stari izvještaji o fazi 3+ navode upravljanje ciljnom temperaturom, režimom i rasporedom te testove grešaka, konkurentnih zahtjeva i potvrde komande uređaja. Međusobno se razlikuju u tvrdnjama o tome je li Tuya write API bio završen; stvarno stanje treba provjeriti u backend kodu, bez pretpostavke da je upravljanje kotlom sigurno.
- **Historijski testni prijedlozi, ne potvrđeno ponašanje:** QA nacrt je predlagao provjere granica i neispravnih ulaza za setpoint, timeout i offline uređaja, istovremenih izmjena, očuvanja ostalih dana pri izmjeni rasporeda, read-after-write i evidentiranja korisnika. Prije usvajanja prilagoditi provjerenom API ugovoru i stvarnim granicama uređaja; timeout ne dokazuje da je daljinska komanda poništena niti garantuje rollback.
- **Historijski testni prijedlozi, ne potvrđeno stanje:** P2b plan je predlagao mock spore Tuya usluge, otvaranje i oporavak circuit breakera te provjeru metrika; aktuelnu implementaciju i vrijednosti timeouta treba provjeriti iz koda. Historijski API snapshot navodio je promjene statusnih kodova i ruta; potrebno ih je usporediti s aktuelnim kontrolerima, bez oslanjanja na staru listu.
- **Historijska opservacija, zahtijeva provjeru koda:** P2b sažetak spominje timeout preko `Promise.race`, retry i circuit breaker; `Promise.race` sam po sebi ne otkazuje osnovni zahtjev. Pri auditu treba utvrditi postoji li stvarni mehanizam otkazivanja i da li se isti pozivi mogu preklapati. Izvještaj o TypeScript popravku opisivao je uklanjanje neiskorištenog idempotency ključa; provjeriti današnju deduplikaciju zasebno.
- **Historijske tvrdnje koje se međusobno razlikuju:** Batch 2 izvještaji tvrde da vremenski ključ sprečava duplikate, dok kasniji izvještaj o TypeScript popravku navodi da je neiskorišteni ključ uklonjen. Treba provjeriti trenutnu implementaciju i ograničenja baze prije bilo kakvog zaključka o idempotentnosti.
- **Historijski ugovori, zahtijeva provjeru koda i instaliranih klijenata:** stari P2a snapshot opisivao je promjene naziva ruta i statusa prijave, ali istovremeno navodio neprovjerenu kompatibilnost. Prije promjene API-ja treba uporediti stvarne kontrolere i klijente, te podršku starih mobile izdanja; historijski prijedlog vraćanja javnog pristupa dashboardu nije siguran rollback i ne treba ga slijediti.
- **Historijski operativni prijedlozi, ne dokaz da su provedeni:** P2e primopredaja predlagala je provjeru testova, sigurnosti i korporacijskog monitoringa, kontakt dežurnog, provjeru alert kanala, validaciju korelacijskih ID-ova i praćenje staginga prije produkcije. Brojke i pragovi iz starog izvještaja nisu potvrđeni za današnji sistem.
- **Historijski testni prijedlog:** provjeriti izolaciju korelacijskog konteksta pri istovremenim zahtjevima, dostupnost ID-a u greškama i ponašanje kad zaglavlje nedostaje ili je neispravno. Stari vodič ne dokazuje da su ta zaglavlja trenutno podržana niti da ih klijenti trebaju trajno ponovo koristiti.
- **Historijski operativni scenariji:** u slučaju povišenih grešaka, latencije ili rasta memorije treba provjeriti dostupnost baze i eksternih servisa, resurse te povezane logove; tačne metrike, pragove, autorizaciju i komande treba utvrditi za aktuelno okruženje. Stari prijedlozi za slijepo vraćanje pojedinačnih fajlova i izlaganje podataka iz `.env` nisu preporučen postupak.
- **Historijska mjerenja, nisu današnji SLO:** prethodni dokument je prikazivao razvojne latency percentile, heap/RSS, CPU i testove konkurentnosti, ali opisani postupak ne dokazuje produkcijsko opterećenje niti uspješne autorizirane zahtjeve. Ponoviti mjerenja uz zabilježene verzije, okruženje, status odgovora, opterećenje i kontrolnu grupu prije definisanja alarma.
- **Historijska odluka o sigurnosti uređaja:** historijski `docs/PHASE_3_PLUS_STATUS_TRACKER.md:10-23` (`git show 7a64c131:docs/PHASE_3_PLUS_STATUS_TRACKER.md`) izričito bilježi poništenje rada na Tuya komandama i read-only politiku. To nije dokaz aktuelnog koda ni dozvola za komande: budući plan mora očuvati ovo ograničenje dok vlasnik izričito ne odobri drugačije.
- **Historijska opservacija o observabilityju:** P2d dokumenti opisivali su memorijske metrike, izvještaje i korelacijski kontekst, uključujući stariji `process.pid` kontekst; stvarnu izolaciju i trenutne metrike treba provjeriti iz aktuelnog koda i testova.
- Ovaj zapis obuhvata dokumente uklonjene u ovom koraku; zadržani dokumenti mogu sadržavati dodatni historijski kontekst koji tek treba provjeriti naspram izvornog koda.

## Zadržani kandidati i granice odluke

Preostali kandidati nisu automatski obrisani. P2E README i povezani vodiči zadržani su zbog tekstualnih referenci i neprovjerene operativne upotrebe; njihov sadržaj i stare deploy komande ne predstavljaju potvrđene upute. Stari izvještaji i planovi s tekstualnim referencama iz zadržanih dokumenata također su zadržani dok se njihova potreba ne razriješi; dozvoljena iznimka ne dopušta izmjene okolnog teksta. `PLAN-current-boiler-temp-source-of-truth.md` je zadržan jer uključuje buduće prijedloge čije usvajanje nije utvrđeno. Monitoring YAML/JSON nije dokumentacija i ostaje netaknut. Stare MySQL migracijske upute ostaju kao historijski kontekst s upozorenjem u samom dokumentu; ne izvršavati ih na PostgreSQL bazi.

Konačna provjera `git grep -l -F` po imenu svih obrisanih fajlova u verzioniranim datotekama, isključujući audit, audit skripte i zadani prompt koji historijski navodi plan, nije našla preostale reference; to ne dokazuje odsustvo vanjskih referenci ili drukčijih oblika putanja.
