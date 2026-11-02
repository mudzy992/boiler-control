# HANDOFF — stanje na kraju turna (2026-11-02)

Radni dokument za nastavak. Nije dio audit nalaza; može se obrisati kad se
Talas D završi.

## Nastavak 2026-11-02 — MO2-14, weather v2, PRIV-1A/B i FE2-7

- **Verificirani code HEAD:** `223193d`; udaljena sesijska grana je istog SHA-a prije završnog docs upisa. `origin/main` je posljednji put provjeren na `357f71f`. Vlasnik ručno radi merge, PR se ne otvara.
- **MO2-14:** NativeWind migracija završena je kroz `6d540e8`; nema `native-base`, NativeBaseProvider, NativeBase LogBox suppression ni BackHandler polyfilla. CI `41425004414`: backend/mobile success. Fizički vizuelni QA na tri veličine ekrana ostaje otvoren.
- **Weather v2:** osnovna implementacija i ispravke su `aa921fe`, `5627eb0`, `ab040ab`, `309d95e`. Nakon cold-start timeouta u runovima `41438917708` i `41439567029`, `344f6e4` memoizira forecast, a `efd20c9` mountuje location modal tek na zahtjev; timeout, asserti i paralelizam nisu mijenjani. Finalni code CI `41442409308`: backend i mobile success. Backend ima 56 suiteova / 608 testova i 5 integration suiteova / 60 testova; mobile ima 24 suitea / 136 testova.
- **Weather combined SDK/DST replay:** `223193d` dodaje deterministic generator, proljetni/jesenji FlatBuffers fixture i stvarni SDK/provider replay bez mreže. Pokriveni su current, 72 sata/7 dana, sunrise/sunset `valuesInt64`, `INT64_MAX`, prave nule, `NaN` → `null`, preskok i ponavljanje DST sata. To su generisani SDK ulazi, ne live provider capture. CI `41449372725`: sva tri joba success; backend 57 suiteova / 612 testova + 5/60 integration, mobile 24/136, frontend 4/4 E2E.
- **PRIV-1A:** `5627eb0` dodaje samo read-only `GET /api/auth/export`, zadano `ACCOUNT_EXPORT_ENABLED=off`, nalog i 13 eksplicitno selektovanih vlasničkih kolekcija, no-store, row/byte 413 i verzionirani JSON. Dvokorisnički PostgreSQL test, redakcija i obje granice prolaze u CI. Hashovi, globalni Tuya token, weather cache i privatni storage pathovi su isključeni; gas originali ostaju na owner-only download rutama. Nema migracije ni brisanja.
- **PRIV-1B / MO2-16:** `3fc4e1d` povezuje Settings sa stvarnim backend JSON exportom, ne s Analytics. Mobile validira format/verziju i svih 13 kolekcija, zapisuje `.download` pa atomski preimenuje u `.json` u postojećem dijeljenom downloads cacheu i otvara `expo-sharing`. Dvostruki tap je blokiran; 404, 413, neispravan odgovor i ostale greške imaju različite poštene poruke bez logovanja sadržaja. Clear cache pokriva istu datoteku. Nema novog mobile flaga, backend/DB promjene ni produkcijskog uključivanja.
- **CI dijagnostika koja ostaje korisna:** OpenAPI artefakt koristi rekurzivno sortiranu serializaciju i byte-stabilnu regresiju. Mobile CI koristi postojeći sigurni `jest_report.cjs` uz očuvan originalnog exit koda. Weather async testovi koriste real timers, a 72h/7d formatteri bounded cache.
- **Frontend / FE2-7:** `4543e6c` uklanja sve provjere Traefik labela iz offline checkera jer njima automatski upravlja Coolify. Korijenski compose nije mijenjan i labele nisu vraćane. Zadržane su provjere compose servisa/parsiranja, nginx/expose porta, `VITE_API_URL`, CORS `FRONTEND_URL`, localhost fallbacka, uklonjenog duplicate frontend composea i ugrađenog bundle basea. Temp-copy mutacije daju 9/9 očekivanih ishoda: compose bez labela i compose s proizvoljnim Traefik labelama prolaze, a sedam namjernih compose/API/CORS/localhost/duplicate regresija i dalje pada. CI run `41447108866` je potpuno zelen: backend 56 suiteova / 608 testova + 5 integration suiteova / 60 testova, mobile 24 suitea / 136 testova, a frontend prolazi i Build, embedded-base, bundle evaluaciju/render te 4/4 Playwright E2E testa.
- **Detalji:** `backend/05-weather.md`, `backend/17-priv1-account-export.md`, `mobile/07-implementation-plan.md`. Generisani current+hourly+daily SDK/DST replay je CI-verificiran. Stvarni provider current+hourly+daily/DST capture, produkcijski rollout/migracija, distribuirani SWR, fizički vizuelni QA i fizički native share/Clear cache QA nisu dokazani.
- **Sljedeće vlasničke odluke:** ručni merge i eventualno uključivanje flagova nakon rollout provjere. Ne počinjati brisanje naloga bez backup-retention i eventualne legal-retention politike.

## Stanje na kraju sesije (2026-11-01, VERIFICIRANO)

- Arena sesijska grana `arena/c9961f17-boiler-control`. Vlasnik i dalje ručno
  pull/merge, **PR se ne otvara**. `origin/main` je zadnji provjeren na
  `8735c6c` (PERF-1 merged); compose nije mijenjan.
- **SEC-6 je završen**: svih četiri `/metrics*` rute štiti dedicated
  `METRICS_AUTH_TOKEN` Bearer guard (fail-closed), reporting izvoz koristi
  worst-case agregate bez ID labela, reporting logovi/alert tekst su minimizirani,
  a Prometheus/Grafana stack artefakti obrisani su iz repoa. Implementacija
  **`6845060`**; CI run **`41323254765`**: backend/mobile success, frontend samo
  pre-existing FE2-7. Detalji: `backend/16-sec6-metrics-auth.md`.
- **FE2-10 je završen**: aditivni `Recommendation.breakdown` JSONB snapshot,
  tipiziran `GET /api/recommendations` odgovor i read-only „Razlog preporuke“
  prikaz na Dashboard/Reports ekranima. Formula i vrijednost preporuke nisu
  mijenjani; stari redovi imaju `breakdown: null`. Implementacija
  **`ab08519`** + CI ispravka **`c9fe88c`**; CI run **`41339126329`**:
  backend/mobile success, frontend samo pre-existing FE2-7. Detalji:
  `frontend/09-fe2-10-recommendation-breakdown.md`.
- **FE2-3 je završen**: shared `QueryClient` i query key-ovi, notification/gas
  cache se dijele, ručni `setInterval` polling zamijenjen je React Query
  intervalom koji pauzira u skrivenom tabu. Implementacija **`29ce3c7`**;
  CI run **`41343423105`**: backend/mobile success, frontend samo pre-existing
  FE2-7. Detalji: `frontend/10-fe2-3-react-query.md`.
- **MO2-12 je završen**: mobilni dashboard čita health score i upozorenja iz
  postojećeg `GET /api/dashboard/health`; lokalna health formula i alert
  pragovi su uklonjeni. Implementacija **`5914c9f`**; CI run **`41347741131`**:
  backend/mobile success, frontend samo pre-existing FE2-7. Detalji:
  `mobile/08-mo2-12-health-alerts.md`.
- **MO2-13 je završen**: gas readings lista je virtualizirana (`FlatList`),
  dashboard kartice su memoizirane, Dashboard/Heating dijele isti
  `['dashboard']` key, a polling pauzira kad aplikacija nije aktivna.
  Implementacija **`07acc30`**; CI run **`41351779085`**: backend/mobile
  success, frontend samo pre-existing FE2-7. Detalji:
  `mobile/09-mo2-13-lists-polling.md`.
- **MO2-15 je završen**: mobilni dashboard prikazuje „razlog preporuke“ iz
  backend breakdown snapshota, bez lokalne rekonstrukcije formule; granice
  unosa trenutne temperature centralizirane su i usklađene s backendom.
  Implementacija **`d21a8a4`**; CI run **`41353900211`**: backend/mobile
  success, frontend samo pre-existing FE2-7. Detalji:
  `mobile/10-mo2-15-recommendation-breakdown.md`.
- **MO2-20 je završen**: `GET /api/home-profiles` više ne upisuje
  `user.activeHomeProfileId`, `name`/`location` vraćaju `null` umjesto
  placeholder teksta, a mobilna forma čuva `0`, `false` i `''` kroz `??`.
  Implementacija **`0b0c25d`**; CI run **`41356375190`**: backend/mobile
  success, frontend samo pre-existing FE2-7. Detalji:
  `mobile/11-mo2-20-home-profile-contract.md`.
- **PERF-1 (#38) je završen za prihvaćeni indeks**: sintetički CI benchmark
  prije migracije, standardna migracija `HeatingEvent(deviceId, timestampStart DESC)`,
  legacy `deviceId` indeks zadržan, weather `(city, fetchedAt DESC)` odgođen.
  Implementacija **`579e58c`** + **`d9831c9`**.
- CI run **`41303090502`** na `d9831c9`: backend **success** (eslint/tsc 0,
  OpenAPI sync, PERF-1 benchmark + rollback regresija, 43 suite/535 testova,
  4 integration suite/53 testa), mobile **success**. Frontend je crven samo
  na pre-existing `Deploy config consistent (FE2-7)`. Detalji:
  `backend/15-perf1-index-benchmark.md`.
- **PERF-2 (#39) je završen**: bounded keyset thermostat polling,
  `POLL_PAGINATION_ENABLED` zadano **on** (vlasnik `default_on`),
  `POLL_BATCH_SIZE=100` (1..500), select samo potrebna polja, legacy rollback
  `off`. Implementacija **`763df53`** + CI ispravka **`1b1330e`**.
- FEAT-6 (#35) ostaje završen: bounded synchronous analytics export,
  owner 404, spreadsheet-safe CSV, opt-in v2 JSON/IANA zona/DST, row/range
  limit. `PRIV-1` postoji i ostaje otvoren; asinhroni jobovi nisu rađeni.
  Detalji: `backend/13-feat6-analytics-export.md`.
- Vlasnikove odluke: `analytics_only`, `bounded_sync`, `preserve_compose`,
  `perf2`, `default_on`, `synthetic_ci`, `standard`, `token_fail_closed`,
  `aggregate_worst`, `minimize_reporting`, `keep_metrics_remove_stack`,
  `backend_breakdown`. Root/app compose i FE2-7 checker nisu mijenjani.

## Završeno u ovoj sesiji (sve CI zeleno)

| Stavka | Commiti | CI run |
|---|---|---|
| FE2-2 (#32) auth migracija | `3193f3c` + `3978b66` | `41218607380`, `41218925886` |
| REL-7 (#33) Tuya snapshot | `62977ab` + `83bd15a` + `e0b4e8b` | `41226811814`, `41227022427` |
| TempSet /2 (nastavak REL-7) | `0e544bf` | `41231364645` |
| REL-8 (#34) atomski upis programa | `799a011` + `30188de` + `48a3b41` | `41233788265`, `41233970069` |
| REL-8 dokumentacija | `817b264` | `41236341153` |

## FEAT-6 (#35) — implementirano

**Analytics only + bounded sync.** Iz `backend/09-improvements-backlog.md:48` i
`MASTER-ROADMAP.md:128`, uz vlasnikove odluke:

- Postojeći `GET /api/dashboard/export` sada provjerava vlasništvo prije
  analytics čitanja; tuđi i nepostojeći profil imaju identičan 404.
- CSV neutralizira `=`, `+`, `-`, `@` i vodeće praznine/kontrolne znakove,
  pravilno citira zareze/navodnike/newline, a negativne brojeve ne pretvara u
  tekst.
- Legacy bez `version=2` zadržava omotnicu, kolone, LF i legacy bucket
  semantiku. V2 je iza `ANALYTICS_EXPORT_V2_ENABLED=off` i donosi JSON,
  eksplicitnu IANA zonu, DST-offset satne labele i `meta`.
- Limit: 366 dana i `ANALYTICS_EXPORT_MAX_ROWS` default 10000, hard cap 50000.
  Prekoračenje vraća 413, bez truncation-a.
- **PRIV-1 postoji** (`backend/09-improvements-backlog.md:33`,
  `MASTER-ROADMAP.md:149`) i ostaje otvoren. FEAT-6 nije GDPR export naloga.
- Testovi: CSV/helper/servis/HTTP/PostgreSQL integration, mutation checks 5/5,
  OpenAPI contract i frontend generisani tipovi.
- Datoteke: `backend/src/common/csv.ts`,
  `backend/src/modules/Dashboard/analytics-export.ts`, Dashboard DTO/servis/
  kontroler, `contracts/openapi.json`, `frontend/src/types/api.d.ts`,
  `scripts/audit/analytics_export_repro.cjs`,
  `scripts/audit/analytics_export_mutations.py`,
  `scripts/audit/openapi_dashboard_fragment.cjs`.

## Ostalo otvoreno

- REL-8: **konkurentnost nije verificirana** (PostgreSQL nedostupan); **nema
  jest testa**, verifikacija je samo `program_sync_atomic_probe.cjs`
- `test/unit/tuya-adapter.spec.ts:67,189` koristi `TempSet: 44` ali **ne
  assertuje apsolutnu ciljnu temperaturu**, pa ne štiti TempSet ispravku
- FE2-2: CSRF defense-in-depth i datum uključivanja
  `AUTH_COOKIE_REFRESH_ENABLED` čekaju odluku vlasnika
- Talas D: svi traženi koraci su gotovi (SEC-6, FE2-10, FE2-3, MO2-12,
  MO2-13, MO2-15, MO2-20). Blokirani: MO2-7 (#29), FORM-1 (#31)
- MO2-20: duplikat `name`/`homeName` namjerno zadržan radi instaliranih
  klijenata; generisani tipovi za `homeProfile.api.ts` ostaju otvoreni

## Git stanje (VERIFICIRANO)

- Grana: `arena/c9961f17-boiler-control`
- Implementacijski HEAD: **`0b0c25d`** — MO2-20 home-profile read ugovor.
  Dokumentacijski commit ovog turna je iznad njega.
- `origin/main` je zadnji provjeren na `8735c6c` (PERF-1 merged); compose
  nije mijenjan.
- Zadnji CI run: **`41356375190`** na `0b0c25d`: `test` i `mobile` success,
  `frontend` failure samo na pre-existing FE2-7 deploy config koraku.

**UPOZORENJE — lokalni git ref se vraća na base `179d171` između turnova.**
Desilo se **6 puta**. Prvo u svakom turnu:

```
git rev-parse HEAD          # mora biti 0b0c25d ili novije
git status --short | wc -l  # mora biti 0
```

Ako HEAD pokaže `179d171` i status ~44 fajlova, oporavak je:

```
git fetch origin arena/c9961f17-boiler-control
git reset --mixed origin/arena/c9961f17-boiler-control   # NE --hard; oporavak SHA: 0b0c25d
```

`--mixed` ne dira radno stablo, pa ne-commitovani rad preživi.

## Završeno u ovom turnu

### FE2-2 (#32) — access token iz `localStorage` u memoriju
Commiti `3193f3c` + `3978b66`. CI `41218607380` i `41218925886` oba success.
Detalji u `STATUS.md` sekcija „FE2-2 — Auth migracija".

### REL-7 (#33) — Tuya snapshot: nepoznato nije nula (B-026)
Commiti `62977ab` + `83bd15a` + `e0b4e8b`. CI `41226811814` i `41227022427`
oba success. Detalji u `STATUS.md` sekcija „REL-7 — Tuya snapshot".

Ključno: aplikacija **ne upravlja** Tuya termostatom (read-only API, 0 PUT/POST
pogodaka), pa B-026 nije fizički sigurnosni rizik nego integritet podataka.
Ispravka ne uvodi fail-safe stanje nego princip *ne bilježiti promjenu koju ne
možemo posmatrati*. Zastavica `INCOMPLETE_SNAPSHOT_GUARD_ENABLED`, zadano
UKLJUČENO.

## NALAZ `TempSet /2` — RIJEŠEN (vlasnik potvrdio uslov)


**RJEŠENJE (2026-10-31).** Vlasnik je potvrdio uslov: *ako `TempSet` dolazi iz
Tuya adaptera, a ne iz baze, i on treba `/2`*. Provjereno u kodu —
`tuya.adapter.ts:303` čita `status['TempSet']` (odgovor Tuya API-ja iz
`fetchStatus`), **nije** iz baze. Nasuprot tome `activeInterval.targetTemp`
dolazi iz `prisma.thermostatProgram` i **već je normalizovan** jer
`decodeTuyaProgram` dijeli s 2 na `:393` prije `syncProgram` upisa — tamo se ne
dijeli ponovo. Ispravka primijenjena samo na Tuya granu.

Regression guard ažuriran na realistične duplirane vrijednosti (`TempSet:42`
→ `targetTemp:21`); `TempSet:0` ostaje kao kontrola stvarne nule. Guard EXIT=0,
jest 18/18, eslint (CI komanda) 0 errors, type-check 0 grešaka izvan Prisma
kaskade.

**OTVORENO (nije verificirano):** `test/unit/tuya-adapter.spec.ts:67,189`
koristi `TempSet: 44` ali **ne assertuje apsolutnu ciljnu temperaturu** (testira
brojanje zahtjeva i cache), pa ne štiti ovu ispravku. Vrijedi dodati test koji
assertuje jedinice.

---

## (historijski) NOVI NALAZ — bio otvoren, čeka vlasnika

### (historijski) `TempSet` se ne dijeli s 2 dok se `TempCurrent` dijeli — HIPOTEZA

Vlasnik je potvrdio da Tuya vraća duplirane vrijednosti (44 → 22 °C).

| Linija | Kod | Dijeli s 2? |
|---|---|---|
| `tuya.adapter.ts:333` | `rawCurrentTemp / 2` | **da** |
| `tuya.adapter.ts:393` | `i.temp / 2` (program) | **da** |
| `tuya.adapter.ts:303` | `toNullableNumber(status['TempSet'])` | **NE** |

Dokaz da je i `TempSet` dupliran: `test/unit/tuya-adapter.spec.ts:66-67`
koristi `TempCurrent: 40, TempSet: 44` (40/2=20 °C, 44/2=22 °C).

**Zašto je HIPOTEZA, ne VERIFIKOVANO:** nema pristupa stvarnom Tuya API-ju, a
navedeni test ne assertuje ciljnu temperaturu (testira brojanje zahtjeva), pa
nije dokaz namjere.

**Posljedica ako je tačno:** fallback grana (`Mode !== '0'` ili bez programa)
vraća cilj 44 umjesto 22, pa `resolveHeatingState` (`polling.service.ts:467-468`)
vidi `20 < 44` i **uvijek grije**.

**Namjerno NIJE dirano** u REL-7 — bila bi promjena ponašanja bez odobrenja, a
vlasnik ima stvarni uređaj da to potvrdi.

**Idući korak kad vlasnik potvrdi:** podijeliti `TempSet` s 2 na `:303`, dodati
test koji assertuje jedinice, i provjeriti da li `Mode === '0'` grana (koja
čita cilj iz baze, `activeInterval.targetTemp`) već ima °C — miješanje jedinica
između te dvije grane je isto moguće.

## REL-8 (#34) — KOD GOTOV I CI ZELEN; dokumentacija NIJE ažurirana

**Stanje:** commitovano i pushano. Commiti `799a011` (implementacija) +
`30188de` (TS2345 fix) + `48a3b41` (Prettier fix). CI run **`41233788265`** =
`completed success`, sva tri joba (`test` 21, `frontend` 18, `mobile` 10).

**ŠTA NEDOSTAJE — sljedeći turn mora dovršiti:**
- `docs/audit/STATUS.md`: nema REL-8 sekciju
- `docs/audit/backend/09-improvements-backlog.md`: REL-8 red (linija 54, 6
  ćelija) NIJE označen kao riješen
- `docs/audit/backend/04-findings.md`: B-027 nema razrješenje
- Novi jest test NE postoji — verifikacija je samo `program_sync_atomic_probe.cjs`
- Provjera homoglyfa u HANDOFF-u će naći cirilicu/CJK: to su **citirani
  primjeri** u odjeljku o non-ASCII zamkama, NE defekti.

**Šta je urađeno:**
- Dodan `PROGRAM_SYNC_ATOMIC_FLAG` + `programSyncAtomicEnabled()` (zadano ON)
- `syncDay` grana 3 je sada uslovna: atomski put ili stari put
- Nova metoda `applyDayAtomically()` — upsert svih intervala + `deleteMany`
  cleanup u jednom `this.prisma.$transaction(operations)`
- Type-check: **nula novih grešaka**. Jedina greška u fajlu (`TS2538` na
  `tuyaProgram[dayType]`) je **pre-postojeća** — verificirano na čistom HEAD-u
  u worktreeu, gdje je na `:24` (pomaknuta na `:41` mojim umetnutim blokom).

**ATOMICNOST JESTE VERIFICIRANA** — proba `program_sync_atomic_probe.cjs`
(EXIT=0) dokazuje: pad na 2. upsertu ostavlja bazu netaknutu, retry završava
posao i briše `orderIndex 2`, a kontrola sa zastavicom `off` i dalje ostavlja
miješano stanje (što dokazuje da proba nešto hvata).

**Šta NIJE verificirano — konkurentnost:**

**Dvije CI lekcije (oba pada su bila moja):**
1. `TS2345` na `operations.push(deleteMany)` — **lokalno se nije pojavio** jer
   nedostaje generisani Prisma klijent pa je `upsert` tipa `any`. U CI-ju je
   klijent generisan. **Lokalni `tsc` NE može zamijeniti CI type-check za
   Prisma tipove.**
2. Prettier grešku sam pushao jer sam commitovao ne provjerivši koju grešku
   eslint javlja (vidio sam samo `errors=1`). **Uvijek ispisati greške, ne samo
   broj.**

`scripts/audit/program_sync_partial_repro.cjs` **pada** (EXIT=1), ali NE zato
što je ispravka pogrešna. Njen fake repozitorij definiše `upsert` kao običnu
`async` funkciju koja se **izvršava odmah pri pozivu**. Moj kod gradi niz
operacija preko `.map()`, pa se u fake-u svi upserti izvrše **prije** nego što
`$transaction` uopće bude pozvan — sintetički pad izbaci tokom izgradnje niza.

Stvarni Prisma se ponaša drugačije: `prisma.thermostatProgram.upsert(...)`
vraća `PrismaPromise` koji se **ne izvršava** dok se ne await-uje ili preda
`$transaction`. Dakle kod je ispravan za stvarni Prisma, ali **fake harness ne
modelira lazy PrismaPromise**, pa njime nije moguće dokazati all-or-nothing.

**Idući korak:** proširiti fake da vraća lazy opise operacija i implementira
`$transaction(ops)` koji izvršava redom i **poništava** na padu (rollback u
memoriji). Tek tada se može assertovati da pad ostavlja bazu netaknutom.
Alternativno: pravi integracijski test na PostgreSQL-u — ali PostgreSQL ovdje
nije dostupan.

**Konkurentnost NIJE riješena.** `$transaction` daje atomičnost, ne izolaciju
protiv dva paralelna procesa. Kriterij prihvatanja traži „dva konkurentna synca
potvrđena na izolovanom PostgreSQL-u" — to ostaje **nije verificirano**.

## Sljedeće po redoslijedu (Talas D)

`docs/audit/MASTER-ROADMAP.md`. Traženi redoslijed ovog turna je zatvoren:
SEC-6, FE2-10, FE2-3, MO2-12, MO2-13, MO2-15 i MO2-20 su gotovi i
CI-verificirani.

Gotovo: REL-4, MAINT-2, MAINT-4, REL-7, REL-8, FEAT-6, PERF-2, PERF-1, SEC-6,
FE2-10, FE2-3, MO2-12, MO2-13, MO2-15, MO2-20.

Sljedeći kandidati iz reda u `docs/audit/mobile/06-improvements-backlog.md`
i `docs/audit/backend/09-improvements-backlog.md` traže novu vlasničku odluku
(npr. MO2-14 NativeBase migracija, MO2-17 weather v2, PRIV-1).

Blokirani: MO2-7 (#29), FORM-1 (#31 — vlasnik traži referentne senzorske
uzorke).

## Obavezujuće konvencije (iz prethodnih turnova)

- Nikad PR na ovoj grani — vlasnik ručno radi pull/merge. Commit+push odobreni.
- **Provjeriti CI ishod prije nego se korak proglasi gotovim.** Poll
  `gh api .../actions/runs/{id}` do `completed`, pa provjeriti jobove i
  anotacije. `gh run view --log-failed` NE radi (host nije na allowlistu).
- CI lint korak pokreće eslint **bez** `--fix`. Lokalni `npm run lint` ima
  `--fix`. Provjera mora koristiti CI-jevu tačnu komandu:
  `npx eslint 'src/**/*.ts' 'test/**/*.ts' --ignore-pattern 'src/generated/**'`
- Svaki korak plana: cilj, fajlovi, migracija/rollback, feature flag, obavezni
  testovi s komandom, pomoćne skripte, kriterij prihvatanja, procjena truda,
  kompatibilnost unazad.
- Dokumenti na bosanskom, identifikatori na engleskom.
- Backlog redovi se označavaju `**RIJEŠENO U KODU <datum> (ID, sha):** …
  **OSTAJE OTVORENO:** …`. Tabela ima **6 ćelija** — pazi na `|` u tekstu
  (REL-7 je imao `number | null` i razbio tabelu na 7).
- `MASTER-ROADMAP.md` je čista ICE rang-lista, bez oznaka napretka.
- Nakon commita koji dokument pokazuje na SHA: **ne amendati**, napraviti novi
  commit.

## Okruženje — šta radi, šta ne

**Radi:** `npm ci` (backend/frontend/mobile), `npx jest <path>`,
`npx tsc --noEmit`, `npx eslint`, 9 audit skripti (`scripts/audit/*.py`),
`gh api`, repro skripte (`node scripts/audit/*.cjs`).

**NE radi (ne pokušavaj ponovo):**
- `binaries.prisma.sh` → Prisma klijent se ne može generisati ⇒
  `src/generated/prisma/` nedostaje ⇒ `tsc` daje ~2000 grešaka kaskade.
  **Mjerodavno je brojati samo greške u svojim fajlovima, isključujući
  TS2307 i TS2339.**
- `tuya-adapter.spec.ts` i `thermostat-polling-metrics.spec.ts` padaju lokalno
  (nedostaje Prisma klijent) — **potvrđeno da padaju identično na čistom
  HEAD-u**, dakle pre-postojeće.
- Playwright browser CDN, `eas-cli`, `docker`, `nginx`, postgres, redis,
  emulator, `apt-get` (PEP 668 / dpkg lock).
- `node_modules` i `/tmp` se brišu između turnova ⇒ prvo `npm ci`.
- **Bash heredoc izobličava `š`/`č`/`ž`** ⇒ koristiti `write_file` ili Python.
- **Non-ASCII zamke:** tri puta nađen homoglyph (`иначе` u `api.ts`, `gutа`
  U+0430, `о` U+043E u `STATUS.md:468`, `е` U+0435 u `04-findings.md:246`) i
  kineski `事件` u komentaru. Uvijek skenirati:
  `re.findall(r'[\u0400-\u04FF\u4E00-\u9FFF]+', s)`

## Metode koje su se pokazale nužnim

1. **Mutacijska provjera s asertacijom na anker.** „Test prolazi" ne znači
   „test nešto provjerava". Python `assert s.count(old)==1` prije mutacije —
   bez toga mutacija tiho ne bude primijenjena. REL-7: 4/4. FE2-2: 6/6.
2. **Provjeri na čistom HEAD-u prije nego tvrdiš „ja sam ovo slomio"**
   (`git worktree add /tmp/x <sha>`). Više puta se ispostavilo da je pad
   pre-postojeći.
3. **CI-jeva tačna komanda, ne lokalni alias.** REL-7 je pao u CI-ju upravo
   zbog `--fix` razlike.
4. **Poređenje anotacija s prethodnim runom** da se dokaže „nula novih".
5. **Ne vjerovati dokumentaciji bez provjere.** `12-sec4-refresh-token.md:41`
   je preporučivao `SameSite=none` što je vodilo u nesigurniju konfiguraciju.
