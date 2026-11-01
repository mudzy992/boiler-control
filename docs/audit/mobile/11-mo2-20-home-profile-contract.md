# MO2-20 — čist home-profile ugovor: GET bez side effecta, bez placeholdera

**Status:** RIJEŠENO U KODU 2026-11-01 (`0b0c25d`), CI-verificirano.
**CI run:** `41356375190` na `0b0c25d`.
**Nalaz:** MO-026 (`02-architecture-findings.md`).

## Cilj

`GET /api/home-profiles` ne smije mijenjati stanje, ne smije vraćati izmišljen
placeholder tekst kao stvarnu lokaciju, a mobilna forma pri uređivanju ne smije
pretvoriti legitimne `0`, `false` i `''` vrijednosti u defaulte.

## Promjene — backend

`backend/src/modules/HomeProfile/home.profile.service.ts`:

- `findAll` više **ne zove** `prisma.user.update`. Prije je čitanje liste
  upisivalo `user.activeHomeProfileId` kada je bio `null`; sada se aktivni
  profil za potrebe odgovora samo izračuna
  (`user.activeHomeProfileId ?? profiles[0]?.id ?? null`) bez upisa.
- Upis aktivnog profila ostaje tamo gdje i pripada: `create` (prvi profil) i
  `PATCH /api/home-profiles/:id/activate`.
- `name` i `location` u `findAll`, `findActive` i `activate` više nemaju
  placeholder fallbackove `'Unnamed Home'` / `'No location set'`. Kada podatak
  ne postoji, vraća se `null`.
- `location` i dalje poštuje redoslijed `profile.location` pa
  `user.homeLocation`, ali samo kroz `??`, tako da prazan string ostaje prazan
  string, a ne prelaz na drugu vrijednost.

## Promjene — mobile

- Novi `mobile/src/screens/home/homeProfileForm.ts` sadrži čistu funkciju
  `homeProfileToForm()` i tipove `HomeProfileFormSource` /
  `HomeProfileFormValues`. Sva polja koriste `??`, ne `||`.
- `HomeManagementScreen.openEditModal` sada zove `homeProfileToForm(home)`
  umjesto inline mapiranja s `||`.
- `HomeProfile.name` i `HomeProfile.location` na ekranu su opcionalni/nullable,
  a prikaz koristi `?? ''`, tako da `null` iz backenda ne lomi render.

## Migracija, rollback i flag

- Nema DB migracije.
- Nema novog env flaga. Planirani `HOME_PROFILE_DTO_V2` **nije** uveden.
- Rollback je revert commita `0b0c25d`.
- **Odstupanje od plana:** plan je tražio uklanjanje duplikata
  `name`/`homeName`. Duplikat je **namjerno zadržan** jer instalirani mobilni
  klijenti čitaju `name`. Uklonjeni su samo placeholder tekstovi i GET side
  effect. Potpuno uklanjanje aliasa ostaje otvoreno i traži version gate.
- `mobile/src/services/api/homeProfile.api.ts` tipovi i dalje nisu generisani
  iz OpenAPI ugovora; to ostaje otvoreno.

## Kompatibilnost unazad

- Legacy polja `name`, `isActive` i `thermostats` ostaju u odgovoru, pa stari
  instalirani klijenti nastavljaju raditi.
- Jedina promjena oblika odgovora je `null` umjesto placeholder stringa za
  `name`/`location`. Mobilni ekran je prilagođen u istom commitu.
- Nema novih obaveznih polja ni novih API poziva.

## Testovi

Backend:

- Novi `backend/src/modules/HomeProfile/tests/home-profile-read.spec.ts` —
  3 testa: `findAll` ne zove `user.update` i čuva `null`/`0`/`false`;
  `isActive` prati perzistirani `activeHomeProfileId`; `user.homeLocation`
  fallback samo kada je `profile.location` `null`.
- `backend/test/integration/heating-polling.integration.spec.ts` — novi
  `MO2-20 home-profile read contract` blok: stvarni PostgreSQL, registracija
  korisnika, profil s `location: null`, `numberOfResidents: 0`,
  `hasFloorHeating: false` i eksplicitno `activeHomeProfileId: null`.
  Test tvrdi da je `activeHomeProfileId` `null` **prije i poslije**
  `GET /api/home-profiles`, da su `location`/`name` `null`, a `0`/`false`
  očuvani; drugi test tvrdi da `PATCH :id/activate` **upisuje** aktivni profil.

Lokalno:

- `npx jest src/modules/HomeProfile/tests/home-profile-read.spec.ts --runInBand`
  — **1 suite / 3 testa**;
- tačna CI lint komanda
  `npx eslint 'src/**/*.ts' 'test/**/*.ts' --ignore-pattern 'src/generated/**'`
  — **0 grešaka / 2 pre-existing warninga**;
- mobile `npm run type-check` — čisto;
- mobile `npx jest` — **9 suite / 65 testova**;
- mobile `npx eslint .` — **0 grešaka / 78 pre-existing warninga**.

## CI dokaz

Run `41356375190` na `0b0c25d`:

- backend `test` **success**: tsc 0, eslint 0, **48 suite / 566 testova**,
  **4 integration suite / 56 testova**;
- mobile **success**;
- frontend failure samo na pre-existing
  `Deploy config consistent (FE2-7)`, po odluci `preserve_compose`.

## Ostaje otvoreno

- Duplikat `name`/`homeName` u odgovoru (namjerno zadržan radi starih klijenata).
- Generisani tipovi za `homeProfile.api.ts` iz OpenAPI ugovora.
- `GET /api/home-profiles/active` i dalje pada na prvi profil kada aktivni ID
  nije postavljen; to je read-only ponašanje, ali integritet veze
  `user.activeHomeProfileId` nije posebno testiran.
