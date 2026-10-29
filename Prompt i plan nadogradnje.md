# Prompt za agenta: audit i plan nadogradnje — boiler-control

## 0. Uloga i pravila rada

Ti si senior arhitekta i tehnički auditor (NestJS/Prisma/PostgreSQL, React/Vite, React Native/Expo, sistemi grijanja). Zadatak je **detaljan audit i plan implementacije** monorepo projekta `boiler-control` (backend, frontend, mobile). **U ovom zadatku ne mijenjaš izvorni kod aplikacije (jedini izuzeci su navedeni u sekciji 0a).** Dokumentaciju proizvodiš u `docs/audit/`. Smiješ čitati kod, pokretati lint/type-check/testove, pokretati read-only upite i skripte za mjerenje.

Obavezna pravila:

1. **Dokaz za svaku tvrdnju.** Svaki nalaz ima putanju `file:linija` (ili naziv funkcije) i oznaku pouzdanosti: `VERIFIKOVANO` (pročitao si kod/pokrenuo), `HIPOTEZA` (izvedeno, treba potvrdu). Ne izmišljaj endpointe, polja ni ponašanja. Ako nešto ne možeš potvrditi, upiši to u „Otvorena pitanja“.
2. **Konkretno, ne generički.** Zabranjeni su savjeti tipa „dodati više testova“ ili „poboljšati sigurnost“ bez tačnog mjesta, razloga, prijedloga izmjene i načina provjere.
3. **Jezik:** dokumenti na bosanskom, identifikatori/kod/nazivi fajlova na engleskom.
4. **Ne vjeruj postojećoj dokumentaciji.** U `docs/` ima 60+ markdown fajlova (mnogi zastarjeli ili duplirani, npr. `PLAN-V3.md` i `PLAN-current-boiler-temp-source-of-truth.md` su iste veličine). Kod je izvor istine; dokumente koristi samo kao kontekst i označi gdje se razilaze s kodom.
5. **Ne prikazuj vrijednosti tajni.** Ako nađeš tajne (`.env`, logovi, git historija), navedi samo lokaciju i tip, nikad vrijednost.
6. Ako ti nešto blokira rad, ne zaustavljaj se: zabilježi pretpostavku i nastavi.

## 0a. Git, CI, čišćenje dokumentacije, testovi i skripte (OBAVEZNO, važi u svim fazama)

**Git i CI**

1. Radi isključivo na trenutnoj, aktivnoj grani. Na početku izvrši `git branch --show-current` i zapiši ime u `docs/audit/STATUS.md`. Ne kreiraj nove grane.
2. **Nikad ne otvaraj PR prema `main` grani**, ne pushaj na `main`, ne mergeaj u `main`, ne mijenjaj `main`. I plan implementacije se izvršava kao serija malih commitova na aktivnoj grani, ne kao PR-ovi.
3. **CI se pokreće samo i isključivo na trenutnoj aktivnoj grani.** Svaki workflow koji predložiš ima `on.push.branches: [<aktivna-grana>]` i `workflow_dispatch`; bez `pull_request` triggera, bez `main` i bez `branches: ['**']`. Ime grane navedi na jednom mjestu radi lakše promjene.
4. Commituj lokalno na aktivnu granu, u malim commitovima (Conventional Commits). Ne pushaj dok korisnik to ne zatraži.

**Čišćenje zastarjele dokumentacije (prvi korak Faze 1, prije audita)**

Vlasnik projekta potvrdio je da su zastarjeli dokumenti uredno arhivirani i da ih je bezbjedno obrisati iz repozitorija.

- Prvo ih pročitaj radi konteksta, zatim ih obriši pomoću `git rm`. U `docs/audit/00-cleanup-log.md` upiši svaku obrisanu putanju (jedna rečenica o čemu je bio i zašto je zastario) te odjeljak „Povijesne odluke i poznata ograničenja“ sa svime što je i dalje relevantno, da znanje ne nestane.
- Zastarjelim se smatraju: izvještaji o završenim fazama i migracijama (`PHASE_*`, `P2*`, `MIGRATION_*`, `*_COMPLETE`, `*_SUMMARY`), planovi i prijedlozi koji su implementirani ili odbačeni, duplikati (npr. `PLAN-V3.md` i `PLAN-current-boiler-temp-source-of-truth.md`) i `docs/internal/**`.
- Zadrži: `README.md` fajlove, `GEMINI.md`, `.github/copilot-instructions.md`, `docs/audit/**` i setup/deploy dokumente koje si provjerio prema kodu i koji su tačni. Ako nisi siguran da je dokument zastario, provjeri prema kodu; ako i dalje nisi siguran, zadrži ga i upiši u otvorena pitanja.
- Prije brisanja `grep`-om provjeri da nijedan kod, build, Docker ili zadržani dokument ne referencira obrisane fajlove; mrtve linkove u zadržanim dokumentima ukloni ili ispravi.
- Sve ide u jedan commit: `docs: remove obsolete documentation`.
- Nedokumentne zastarjele artefakte (`*.bak`, `*.log`, `*.txt` kopije koda, `prisma/migrations_backup/`) ovdje NE briši; navedi ih u nalazima uz preporuku.

**Testovi (obavezni)**

- Nijedan korak plana nije „gotov“ bez testova: unit, integration i po potrebi contract/e2e, sa konkretnim test-slučajevima i komandom za pokretanje. Test-first gdje je moguće (prvo test koji reproducira grešku, pa popravak).
- U auditu pokreni postojeće testove i zapiši stvarno stanje (broj testova, prolaz/pad, pokrivenost, flaky testovi). Ne popravljaj ih, samo ih evidentiraj u nalazima.

**Pomoćne skripte (obavezne)**

- Za audit napravi skripte u `scripts/audit/` koje ne diraju kod aplikacije: provjera inventara (fajlovi naspram popisa), reprodukcija weather grešaka, tabelarni obračun formula (ulaz → izlaz), skica backtest harnessa.
- U planu za svaki korak navedi pomoćne skripte koje treba napraviti (npr. `scripts/test-all.sh`, `scripts/dev-up.sh` za bazu i Redis, `scripts/db-reset-seed.sh`, `scripts/record-weather-fixtures.ts`, `scripts/backtest-formulas.ts`, `scripts/smoke.sh`): svrha, ulazi/izlazi, način pokretanja. Skripte moraju biti idempotentne, imati `--help` i ne smiju sadržavati tajne.

**Dozvoljene izmjene u auditu:** samo `docs/audit/**`, `scripts/audit/**` i brisanje zastarjele dokumentacije. Sve ostalo je izvor koji se ne mijenja.

## 1. Kontekst projekta (iz preliminarnog pregleda, provjeri sve)

- **Monorepo:** `backend/` (NestJS 11, Prisma 7, PostgreSQL, `@nestjs/schedule`, throttler, swagger, Expo push), `frontend/` (React 19, Vite, Ant Design 5, Tailwind, React Query, JWT u localStorage), `mobile/` (Expo 54, RN 0.81, NativeBase + NativeWind, React Query, i18next en/bs, SecureStore).
- **Backend moduli:** Auth, User, HomeProfile, ThermostatDevice, ThermostatPoll, Tuya, Boiler, Heating (engine + strategije), HeatingRecommendation, HeatingAnomalyChecker, Dashboard, Weather, Gas (očitanja, fakture, cijene), Notification, ExpoPush, Schedule (cron servisi), Common (adapteri, circuit breaker, metrike, anomaly detection, reporting, fallback, correlation ID).
- **Pravilo iz `GEMINI.md`:** poslovna logika u frontendu i mobile mora ostati u paritetu. Ocijeni da li je to stvarno ispunjeno.
- **Infrastruktura:** `docker-compose.yml` ima samo backend i frontend (vanjska mreža `db_net`), `docker-compose.monitoring.yml` postoji. **Redis ne postoji** nigdje u produkcijskom kodu (spominje se samo u komentarima/dokumentima).
- **Svi cron poslovi rade unutar API procesa:** polling termostata (svaku minutu, sekvencijalno kroz sve uređaje), 2 anomaly joba (\*/5 min), dnevna preporuka (00:00), gas reminder. Cache/fallback/metrike/throttler su u memoriji procesa.

## 2. Protokol faza (OBAVEZNO)

Radiš **strogo sekvencijalno**: Faza 1 Backend → Faza 2 Frontend → Faza 3 Mobile → Faza 4 Objedinjeni plan.

- **Ne smiješ početi sljedeću fazu dok trenutna nije u potpunosti završena** (svi dokumenti iz njene liste isporuka postoje, prošla je samoprovjera iz sekcije 8).
- Na kraju svake faze **ZAUSTAVI SE**, ažuriraj `docs/audit/STATUS.md` (šta je gotovo, otvorena pitanja, odluke koje čekaju korisnika) i ispiši tačno: `FAZA N ZAVRŠENA — čekam odobrenje za fazu N+1`. Nastavljaš tek kada korisnik napiše `ODOBRENO: faza N+1`.
- Frontend i mobile audit smiju se **oslanjati** na backend dokumente (API katalog, ugovori, plan Redis/worker, weather, formule), ali ne smiju se nikako počinjati prije odobrenja.

## 3. FAZA 1 — BACKEND (`backend/`)

**Korak 0 (prije bilo kakvog audita):** izvrši čišćenje zastarjele dokumentacije prema sekciji 0a i napiši `docs/audit/00-cleanup-log.md`. Tek tada kreni na 3.1.

### 3.1 Popis i inventar (`docs/audit/backend/01-inventory.md`, `02-api-catalog.md`, `03-data-model.md`)

Za **svaki modul** u `backend/src/modules/*` i `backend/src/common/*`: namjena, javni API, zavisnosti (graf), ulazne/izlazne tačke, cron/pozadinski poslovi, eksterni pozivi, Prisma modeli koje dotiče, testovi koji ga pokrivaju (i šta ne pokrivaju), mrtav ili dupliran kod (npr. `boiler.service.txt`, stub `GET /api/weather` koji vraća `{}`).

API katalog: tabela svih ruta (metoda, putanja, guard/role/plan, DTO, validacija, ko je potrošač: web/mobile), uz nalaze o nedostajućoj validaciji, provjeri vlasništva (IDOR: da li svaki `:id` provjerava `userId`), nekonzistentnim odgovorima i verzioniranju.

Model podataka: svi Prisma modeli i relacije, indeksi koji fale (npr. `HeatingEvent` po `deviceId + timestampStart`, `Notification`, `WeatherCache`), rast tabela i potreba za retencijom (`HeatingEvent`, `WeatherCache`, `BoilerHistory`, `Notification`), tipovi (Float za novac/brojila), cascade pravila, redundanca (npr. `HomeProfile.learningConfidence` vs `confidence` u engineu, enumi duplirani između `HomeProfile_*` i `InsulationType/WindowType/HeatingType`), te `migrations_backup/`.

### 3.2 Detaljan audit po segmentima (`04-findings.md`, `08-security.md`)

Obradi svaki segment zasebno, s nalazima i preporukama: **arhitektura i granice modula**, **pouzdanost** (timeouti, retry, idempotentnost, circuit breaker, ponašanje pri padu Tuye/Open-Meteo/baze), **konkurentnost i rasipanje resursa** (poll petlja je sekvencijalna po uređaju, N+1 upiti, `include` svega, transakcije), **sigurnost** (JWT životni vijek/refresh/revokacija, hashiranje, role/plan guardovi, CORS/helmet, throttling per-ruta, upload faktura/slika: MIME, veličina, putanje, path traversal, Tuya tajne, `.env` i logovi u repou, tajne u git historiji → preporuka za rotaciju), **observability** (metrike su u memoriji, health, korelacijski ID, strukturirani logovi, alerting), **testovi** (pokreni `npm test` i integracijske; navedi stvarno stanje, pokrivenost, flaky testove), **DevOps** (Dockerfile, entrypoint/migracije pri startu, healthchecks, resource limits, backup baze, CI/CD koji ne postoji), **kvalitet koda** (tipizacija `any`, dupliciran kod, namingu `anomayl`, mrtvi fajlovi i logovi u repou).

### 3.3 Tri obavezne tematske analize

**A) Vremenska prognoza — popravak povezivanja** (`05-weather.md`)

Preliminarne opservacije iz `Weather/*` (potvrdi ili opovrgni, sve su `HIPOTEZA` dok ne dokažeš):

- `HomeProfile` ima samo tekstualni `location`; geokodiranje po imenu grada ide pri svakom promašaju cachea (nejednoznačni gradovi, pravopis, „count=1“ bez izbora), nema pohranjenih koordinata ni vremenske zone; zona je hardkodirana na `Europe/Sarajevo`.
- Vrijednosti poput `wind_kph`, `gust_kph`, `pressure_mb`, `cloud` uzimaju `.at(-1)` (zadnji sat dana), a ne trenutni sat; `feelslike` traži indeks preko `new Date().getHours()` nad nizom koji je ručno pomjeren za `utcOffset` (moguća razlika lokalne i UTC zone servera); `sunrise/sunset` se pomjeraju za offset, a API već vraća lokalno vrijeme u traženoj zoni (moguća dvostruka korekcija).
- `forecast_days: 1` — za proračun krivulje nema prognoze za sutra ni trenda; `temp_avg` se računa samo 06–15h.
- Cache: `findFirst` + `delete` + `create` bez unique ključa po gradu, bez stale-while-revalidate, bez negativnog cachea, bez dijeljenja između korisnika iz iste lokacije; pri grešci baca generički `Error` (HTTP 500) umjesto degradiranog odgovora.
- `GET /api/weather` je stub koji vraća `{}`; `condition_text` je sirovo `WMO_<kod>` bez mapiranja/i18n; mjesečeva polja su prazna; `WEATHER_API_KEY` postoji u env-u a Open-Meteo ga u korištenom obliku ne koristi; miješaju se `openmeteo` SDK i sirovi `fetch`, a timeout/retry iz adaptera možda ne vrijedi za sirovi `fetch` (provjeri).
- Provjeri uslove korištenja Open-Meteo (besplatni sloj je namijenjen nekomercijalnoj upotrebi; da li je projekat komercijalan?).

Isporuka: (1) tačan uzrok svakog kvara/nedosljednosti s dokazom (po mogućnosti reproduciraj skriptom/unit testom), (2) ciljni dizajn: koordinate + timezone u `HomeProfile` (jednom razriješene, korisnik bira iz rezultata geokodiranja), dohvat po koordinatama, satna prognoza 48–72 h i dnevna 3–7 dana, ispravan odabir „current“ sata, cache ključ po zaokruženim koordinatama (npr. 0.1°), stale-while-revalidate, fallback na drugi provider (npr. MET Norway) i zadnju poznatu vrijednost s oznakom starosti, mapiranje WMO kodova, jasan DTO i javni endpoint, pohrana prognoze naspram stvarne temperature za učenje i validaciju formula, metrike (stopa grešaka, starost podataka), (3) plan testova s snimljenim fixture odgovorima i contract testom, (4) migracije i kompatibilnost sa postojećim mobile verzijama.

**B) Usavršavanje formula za izračun** (`06-formulas.md`)

Obuhvati sve formule: `FlowTemperatureEngine` + strategije (`Anonymous/Profile/Full`), `HeatingRecommendationService`, `DailyRecommendationService`, učenje (`HeatingIntervalLearning`), `anomaly-detection`, `reporting`, Dashboard health score, Gas (potrošnja iz razlike brojila, prosjek/medijan/devijacija, trend, trošak i PDV).

Preliminarne opservacije koje moraš provjeriti brojevima (napravi tabelu ulaz → izlaz):

- Krivulja: `ext>=10 → 45`, `ext<=-15 → 56`, inače `51 − 0.3·ext` daje 48 pri 10 °C i 55.5 pri −15 °C (skokovi na granicama), a konačni clamp je `[46, 55]`, pa su 45 i 56 nedostižni. Granične vrijednosti nisu usklađene.
- `weightedExternalTemp = 0.7·min + 0.3·max` (clamp −15..10): obrazloži ili zamijeni (satni profil, prognoza sutrašnjeg dana, vjetar, oblačnost/sunčevo zračenje, toplinska inercija zgrade).
- `areaFactor = max(0, 150 − površina)·0.02` povećava temperaturu za manje stanove, a ne penalizira veće; `heightFactor` linearan; zadnji množilac `insulationFactor` skalira i negativne korekcije i naučeni offset (da li je to namjera?). Ne koriste se `insulationThickness`, `constructionYear`, `numberOfResidents`, `hasFloorHeating`, `seasonMode`, ciljne temperature profila.
- Povjerenje se množi sa 0.8 i u offsetu i u `calculateConfidence` (dvostruko smanjenje?); provjeri smjer znaka: `avgOvershoot` se **dodaje**, a `reachTimeAdjustment` je pozitivan kad je zagrijavanje brže od 30 min (obje korekcije bi trebale ići u smjeru smanjenja temperature polaznice); `delta` događaja i `intervalKey.includes('morning')` (string matching); decay po indeksu a ne po vremenu.

Isporuka: za **svaku formulu** — trenutni oblik, fizikalno značenje i jedinice, dozvoljeni raspon, uočeni problemi, prijedlog novog oblika s obrazloženjem (npr. standardna ekvitermna krivulja s eksponentom po tipu ogrjevnih tijela i projektnom spoljnom temperaturom za lokaciju umjesto linearne; stepeni-dani grijanja za normalizaciju potrošnje plina; EWMA/RLS ograničeno učenje s pragom uzoraka; confidence iz broja i varijanse uzoraka), sigurnosne granice po modelu kotla, **sensitivity analizu**, **backtest harness** nad `HeatingEvent`/`BoilerHistory`/seed podacima, golden-file i property-based testove, te **shadow mode** (nova formula se računa paralelno i loguje razliku, bez primjene) prije prebacivanja iza feature flaga. Navedi metriku uspjeha (npr. vrijeme dostizanja ciljne temperature, overshoot, potrošnja plina po stepen-danu).

**C) Redis i worker procesi — gdje, kako i gdje NE** (`07-redis-workers.md`)

Uvedi Redis i zasebne workere gdje ima stvarne koristi, svaku odluku opravdaj (usvojiti / odgoditi / ne usvajati) uz cijenu i rizik. Minimalno razmotri:

- **Red poslova (BullMQ, `@nestjs/bullmq`)**: poll svih uređaja → ponavljajući job koji **raspoređuje po jedan job po uređaju** (kontrolisan concurrency, `jobId` radi deduplikacije, timeout, retry s backoffom, DLQ), zamjena `@Cron` poslova (poll, anomaly provjere, dnevna preporuka, gas reminder), osvježavanje prognoze po lokaciji, slanje push notifikacija (retry + provjera Expo receipt-a), generisanje izvještaja, obrada upload-a faktura.
- **Odvojen worker proces**: `src/worker.ts` s `NestFactory.createApplicationContext`, poseban servis `boiler-control-worker` u `docker-compose.yml`, API se može skalirati na više replika bez dupliranja cron poslova; graceful shutdown.
- **Redis kao keš**: prognoza (po koordinatama), Dashboard agregati, Tuya access token (danas u tabeli `TuyaToken`), keš stanja uređaja; strategija invalidacije i TTL.
- **Distribuirano zaključavanje / single-flight** (SET NX PX) za osvježavanje prognoze i tokena; **throttler storage** u Redisu (danas u memoriji → ne radi s više replika); dijeljeno stanje circuit breakera; idempotency ključevi; rate-limit prema Tuya API-ju; opcionalno pub/sub ili SSE za live status.
- Za svaku stavku: ponašanje kad je Redis nedostupan (graceful degradation), konfiguracija (AOF/RDB, `maxmemory-policy`, lozinka/TLS, mrežna izolacija), docker-compose izmjene, env varijable, metrike (dubina reda, trajanje joba, failed/stalled), plan migracije bez prekida rada (strangler pristup, paralelni rad starih i novih poslova uz lock), te plan testiranja.

### 3.4 Prijedlozi nadogradnje (`09-improvements-backlog.md`)

Predloži **svaku smislenu nadogradnju** backenda, grupisano: funkcionalnosti (npr. sedmični raspored s prognozom, upozorenja na zamrzavanje, procjena računa za plin, više kotlova/uređaja, praćenje efikasnosti kotla, export podataka), performanse, pouzdanost, sigurnost (refresh tokeni, 2FA, audit log), API (verzioniranje `/v1`, OpenAPI kao izvor generisanih tipova za web i mobile), održavanje, privatnost/GDPR (brisanje računa, retencija). Svaka stavka: problem, prijedlog, korist, trud (S/M/L), rizik, zavisnosti, kriterij prihvatanja.

### 3.5 Plan implementacije (`10-implementation-plan.md`)

Redoslijed u **malim koracima (commit ili mala serija commitova na aktivnoj grani, bez PR-ova prema main)** (svaki samostalno izvodiv i povratljiv), grupisano u talase: 0) hitne sigurnosne i higijenske popravke, 1) weather popravak, 2) formule u shadow modu, 3) Redis + worker, 4) prebacivanje formula, 5) ostalo. Za svaki korak: cilj, fajlovi, migracije baze (s rollback-om), feature flag, obavezni testovi (konkretni test-slučajevi i komanda za pokretanje, test-first gdje je moguće), pomoćne skripte koje korak donosi ili koristi, kriterij prihvatanja (uključuje zelene testove), procjena truda, kompatibilnost unazad za već instalirane mobile verzije, redoslijed zavisnosti. Na kraju **registar rizika** i **rollout/rollback plan**.

**CI i skripte u planu:** predloži jedan workflow (lint, type-check, unit i integration testovi s PostgreSQL i Redis servisima, build) koji se pokreće samo i isključivo na trenutnoj aktivnoj grani, bez `pull_request` triggera i bez `main`. Dodaj katalog pomoćnih skripti: tabela s nazivom, svrhom, načinom pokretanja i korakom plana koji ih koristi.

## 4. FAZA 2 — FRONTEND (`frontend/`) — tek nakon `ODOBRENO: faza 2`

Isti postupak i isti nivo detalja. Dokumenti u `docs/audit/frontend/`.

- **Inventar:** sve stranice (`pages/*`), komponente, rute, kontekst (Auth/Theme), `services/api.ts`, hookovi, i18n (`locales`), mapa „ekran → API poziv → backend ruta“.
- **Audit:** React Query (ključevi, invalidacija, staleTime, retry, dupli pozivi), upravljanje stanjem, **JWT u localStorage** (XSS rizik; razmotri httpOnly cookie + refresh), obrada 401/grešaka, prazna/učitavajuća/greška stanja, performanse (bundle size, code splitting, lazy rute, memoizacija grafova), pristupačnost (a11y, tastatura, kontrast), responzivnost i dark mode (konzistentnost s pravilima iz `GEMINI.md`), lokalizacija (bs/en, hardkodirani tekstovi), forme i validacija, testovi (vjerovatno ih nema), build/Docker/nginx (CSP, sigurnosni headeri, cache).
- **Veza sa backend planom:** ekran za vremensku prognozu (satna/dnevna, starost podataka, izbor lokacije s koordinatama), prikaz formule „zašto ova temperatura“ (osnovna krivulja, korekcije, povjerenje), stanje poslova/zdravlje sistema za admina, ažuriranje u realnom vremenu (polling vs SSE).
- **Prijedlozi nadogradnje i plan implementacije** u istom formatu kao u 3.4 i 3.5, uz generisane API tipove iz OpenAPI-ja i testnu strategiju (unit, komponentni, Playwright e2e).

## 5. FAZA 3 — MOBILE (`mobile/`) — tek nakon `ODOBRENO: faza 3`

Dokumenti u `docs/audit/mobile/`.

- **Inventar:** ekrani, navigatori, komponente, `services/api/*` (primijeti da postoji i `src/api/dashboard.api.ts` mimo `services/api`), storage (AsyncStorage/SecureStorage), push notifikacije i deep linkovi, i18n, tema, `app.json`/EAS konfiguracija.
- **Audit:** paritet funkcionalnosti s webom (tabela web ↔ mobile), **NativeBase je u održavanju/zastario** uz NativeWind (dva sistema stilizacije: procijeni migraciju), kompatibilnost verzija (Expo 54, RN 0.81, React 19, Reanimated 4/worklets), React Query offline podrška i keširanje, rukovanje mrežnim greškama, sigurno čuvanje tokena, obnova tokena, pouzdanost push registracije i primanja, performanse listi/grafova (`react-native-chart-kit`), pristupačnost, razlike iOS/Android, forme (kamera/galerija/dokumenti za fakture i brojilo), **strategija izdanja i kompatibilnosti starih verzija aplikacije s novim API-jem** (minimalna podržana verzija, force-update), crash reporting, testovi.
- **Mobile-specifične nadogradnje:** widget/lock screen, lokalne notifikacije za zamrzavanje i podsjetnik za očitanje, offline unos očitanja plina uz sinkronizaciju, upozorenja o prognozi, biometrijska prijava.
- **Prijedlozi i plan implementacije** u istom formatu; plan mora biti usklađen s backend i frontend planom (redoslijed izdanja, feature flagovi).

## 6. FAZA 4 — Objedinjeni plan (`docs/audit/MASTER-ROADMAP.md`) — tek nakon `ODOBRENO: faza 4`

Jedan prioritizirani roadmap za sva tri dijela (talasi, zavisnosti, kritični put, procjene, rizici, ključne odluke), plus „Quick wins (< 1 dan)“ i „Šta ne raditi“. Prioritet računaj pomoću Impact × Confidence ÷ Effort i obrazloži.

## 7. Format nalaza (koristi uvijek isti)

```
### [ID] Naslov — Ozbiljnost: KRITIČNO | VISOKO | SREDNJE | NISKO — Pouzdanost: VERIFIKOVANO | HIPOTEZA
- Gdje: path/file.ts:linije
- Šta nije u redu i zašto je bitno (posljedica za korisnika/sistem):
- Dokaz (isječak, rezultat komande ili testa):
- Preporuka (konkretna izmjena):
- Kako provjeriti da je riješeno:
- Trud: S|M|L — Zavisnosti: ...
```

Svaki dokument počinje kratkim sažetkom (top 5 nalaza) i spiskom otvorenih pitanja za vlasnika projekta.

## 8. Samoprovjera prije zaustavljanja faze

Prije nego napišeš `FAZA N ZAVRŠENA`, potvrdi u `STATUS.md` (s dokazom) da:

- svaki modul/ekran/ruta iz koda ima red u inventaru (provjeri skriptom: izlistaj fajlove i uporedi s popisom),
- svaki nalaz ima lokaciju, dokaz i oznaku pouzdanosti,
- weather, formule i Redis/worker (u fazi 1) imaju kompletan dizajn, testni plan i rollback,
- svaka stavka u planu ima kriterij prihvatanja i procjenu truda,
- izvorni kod aplikacije nije izmijenjen (git status pokazuje promjene samo u docs/audit/, scripts/audit/ i obrisanoj zastarjeloj dokumentaciji),
- nigdje nije ispisana vrijednost tajne.

Dodatno potvrdi:

- zastarjela dokumentacija je obrisana i opisana u `00-cleanup-log.md`,
- rad je bio isključivo na aktivnoj grani, bez PR-a ili pusha prema `main`,
- postojeći testovi su pokrenuti i njihovo stvarno stanje je zapisano,
- svaki korak plana ima obavezne testove i popis pomoćnih skripti,
- predloženi CI se pokreće samo na aktivnoj grani.

Završi fazu kratkim izvještajem: broj nalaza po ozbiljnosti, top 10 prioriteta, odluke koje trebaju korisnika.
