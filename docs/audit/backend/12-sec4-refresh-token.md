# SEC-4 — Rotirani refresh token i httpOnly cookie

**Datum:** 2026-10-30
**Nalaz:** SEC-4 / B-016 (`docs/audit/backend/08-security.md`, `02-findings.md:160`)
**Status:** Faze 1–3 implementirane (backend + frontend + mobile) i sve iza zastavice.
**Zastavica:** `AUTH_COOKIE_REFRESH_ENABLED` — zadano `off`.

---

## Cilj

Originalni nalaz: „JWT u `localStorage`, bez refresha, bez opoziva"
(`auth.module.ts:10-13`, `jwt-auth.guard.ts:27`, `frontend/src/services/api.ts:23,35,44,48`).

Tri odvojena problema:

| # | Problem | Rješenje u ovoj fazi |
|---|---|---|
| 1 | Jedan token traje **24 h** i ne može se opozvati | Rotirani refresh token s evidencijom u bazi → opoziv moguć |
| 2 | Token je u `localStorage` → čitljiv svakim XSS-om | Refresh token ide u **httpOnly** cookie; JS mu ne može pristupiti |
| 3 | Nema odjave na serveru | `POST /api/auth/logout` opoziva token |

## Dizajnerska odluka (važno)

**Refresh token ide u httpOnly cookie. Access token ostaje u tijelu odgovora.**

To znači da `JwtAuthGuard` ostaje **nepromijenjen** i da svi postojeći Bearer
klijenti (uključujući instalirane mobilne verzije) rade **bez ijedne promjene**.
Klijent refresh token nikad ne vidi i nikad ga ne šalje eksplicitno — browser ga
šalje automatski samo na `/api/auth/refresh` i `/api/auth/logout`.

Alternativa (access token također u cookie) zahtijevala bi dual-mode guard i
promjenu svakog klijenta; odgođena je jer donosi veći rizik uz istu zaštitu od
curenja dugotrajne tajne.

## Zastavice

| Varijabla | Zadano | Značenje |
|---|---|---|
| `AUTH_COOKIE_REFRESH_ENABLED` | `off` | Uključuje izdavanje cookie-ja, `/auth/refresh`, `/auth/logout` i CORS `credentials` |
| `AUTH_COOKIE_SAME_SITE` | `lax` | `strict` \| `lax` \| `none`. **Za stvarnu topologiju ovog projekta `lax` je dovoljan** — vidi ispravku ispod |
| `AUTH_COOKIE_SECURE` | `true` | `Secure` atribut; `false` samo za lokalni razvoj bez HTTPS-a |
| `AUTH_COOKIE_DOMAIN` | *(prazno)* | Opcioni `Domain` atribut |

Napomena: `SameSite=None` bez `Secure` browser odbija, pa kod u tom slučaju
pada na `lax` umjesto da pošalje cookie koji neće raditi.

### Ispravka (FE2-2, 2026-10-31): `none` NIJE potreban za ovaj deploy

Ovaj dokument je ranije tvrdio da „za cross-site deploy (frontend na drugom
originu) treba `none`". **To je netačno i vodi u strože nesigurniju
konfiguraciju.**

Dokaz iz commitovane deploy konfiguracije (`docker-compose.yml`):

| Šta | Vrijednost | Izvor |
|---|---|---|
| Frontend | `https://boiler-control.ba101.top` | `docker-compose.yml:35` (`FRONTEND_URL`) |
| API | `https://api.boiler-control.ba101.top/api` | `docker-compose.yml:66` (`VITE_API_URL`) |

Origin-i jesu različiti, ali `SameSite` se **ne računa po originu** nego po
*registrabilnom domenu* (eTLD+1). Obje strane imaju eTLD+1 = `ba101.top`, pa je
zahtjev frontend → API **same-site**. `SameSite=lax` stoga šalje refresh cookie
na `POST /api/auth/refresh` bez ikakvog popuštanja.

Zašto je `none` actively štetan: `SameSite=None` nalaže browseru da cookie šalje
i na **cross-site** zahtjeve, čime se uklanja zaštita koju `lax` daje besplatno.
Postaviti `none` ovdje značilo bi otvoriti refresh endpoint CSRF-u sa
`evil.com`, bez ijedne koristi.

`AUTH_COOKIE_SAME_SITE=none` ima smisla **samo** ako se frontend i API ikad
postave na različite registrabilne domene (npr. frontend na `primjer.ba`, API na
`ba101.top`). Tada treba `none` + `Secure` + `AUTH_COOKIE_DOMAIN`, i CSRF
zaštita postaje obavezna, ne opciona. Dok je topologija ovakva kakva jeste,
zadano `lax` je ispravno.

**Zastavice nisu u `.env` / `.env.example`** jer su opcione i imaju zadane
vrijednosti u kodu; dodavanje bi slomilo paritet koji provjerava
`scripts/audit/env_leak_canary.cjs`.

## Fajlovi

| Fajl | Promjena |
|---|---|
| `backend/prisma/schema.prisma` | model `RefreshToken` + relacija `User.refreshTokens` |
| `backend/prisma/migrations/20261030000000_auth_refresh_token/migration.sql` | NOVA migracija |
| `backend/src/modules/Auth/refresh-token.service.ts` | NOVO — `issue`/`rotate`/`revoke`/`revokeAllForUser` |
| `backend/src/modules/Auth/auth-cookie.ts` | NOVO — zastavica + čitanje/postavljanje cookie-ja |
| `backend/src/modules/Auth/auth.controller.ts` | `POST /auth/refresh`, `POST /auth/logout`, cookie pri login/register |
| `backend/src/modules/Auth/auth.service.ts` | `issueAccessToken()` (javni omot postojećeg `signToken`) |
| `backend/src/modules/Auth/auth.module.ts` | registracija `RefreshTokenService` |
| `backend/src/main.ts` | `credentials: authCookieEnabled()` |
| `scripts/audit/cors_headers_repro.cjs` | anchor ažuriran + drugi prolaz sa zastavicom ON |
| `contracts/openapi.json`, `frontend/src/types/api.d.ts` | regenerisano (2 nove rute) |

## Migracija i rollback

- **Naprijed:** `npx prisma migrate deploy` → `CREATE TABLE "RefreshToken"` +
  unique index na `tokenHash` + indexi na `userId`/`expiresAt` + FK s
  `ON DELETE CASCADE`. Dodatak samo; ne dira postojeće tabele ni podatke.
- **Nazad:** `DROP TABLE "RefreshToken"` ( reverzibilno), ili jednostavno
  `AUTH_COOKIE_REFRESH_ENABLED=off` — tada se tabela ne koristi i ponašanje je
  identično prijašnjem.

## Sigurnosna svojstva

1. **Token se ne čuva u bazi.** `RefreshToken.tokenHash` je SHA-256 hex; test
   `refresh-token.spec.ts` izričito asertira da se izdati token ne pojavljuje u
   `JSON.stringify` svih redova.
2. **Rotacija.** Svaki `/auth/refresh` opoziva stari token i izdaje novi.
3. **Reuse detection.** Ako se predoči već opozvan token, opozivaju se **sve**
   sesije tog korisnika i zahtjev se odbija s 401.
4. **Bez nove zavisnosti.** `cookie-parser` namjerno NIJE dodan — Express već
   ima `res.cookie()`, a za čitanje je dovoljno parsirati jedan `Cookie` header.
   Time `package-lock.json` ostaje nedirnut.
5. **CORS ostaje siguran.** `origin` je i dalje fiksna vrijednost iz env-a, ne
   refleksija. `cors_headers_repro.cjs` sada to dokazuje i sa uključenim
   `credentials`: `originStillFixed: true`, `foreignOriginReflected: false`.

## Testovi

```bash
cd backend
npx jest src/modules/Auth/tests/ --runInBand     # 23/23 u zelenom CI-ju
```

| Suite | Testova |
|---|---|
| `tests/refresh-token.spec.ts` | 12 |
| `tests/auth-cookie.spec.ts` | 11 |

TDD: `refresh-token.spec.ts` je napisan **prije** servisa i prvi prolaz je pao s
„Cannot find module '../refresh-token.service'".

```bash
node scripts/audit/cors_headers_repro.cjs        # EXIT=0
```

## Konkurentna rotacija — dopuna 2026-11-03

**STATUS: ATOMSKA ROTACIJA RIJEŠENA U KODU (`de635ad`); CI REAL-DB DOKAZ ZELEN.**
Ovo rješava race u refresh servisu, ne cijeli preostali SEC-4 auth/session opus.

Izvorna sumnja nije preuzeta napamet: stari `rotate()` je odvojio `findUnique`,
neuslovni `update` i `issue`. Izolovana sonda stvarnog servisa nad fake bazom je
na neizmijenjenom kodu dala dva fulfilled ishoda, dva aktivna različita nasljednika
i tri vlasnikova reda; vrijednosti tokena nisu ispisane.

- **Test-first (`a4607f8`, ispravljen harness `6d0f4a5`):**
  `backend/test/integration/auth-refresh.integration.spec.ts` pokreće stvarni
  `RefreshTokenService` i Prisma/PostgreSQL. Barrier tjera oba poziva da pročitaju
  isti aktivni red prije bilo kakve rotacije. CI `41668760579` dao je **94/95
  integration**; pao je samo konkurentni test (`fulfilled, fulfilled` umjesto
  jednog odbijenog poziva), uz `tsc: 0` i `eslint: 0`. Prvi test-only run
  `41668103008` imao je i dvije greške tipizacije harnessa, ispravljene bez
  slabljenja asserta ili izmjene production koda.
- **Ispravka (`de635ad`):** `updateMany({ id, revokedAt: null })` mora pogoditi
  tačno jedan red. Opoziv starog i kreiranje jednog nasljednika su u istoj
  transakciji. Izgubljeni claim prolazi kroz postojeći reuse cleanup, opoziva sve
  vlasnikove sesije i vraća `UnauthorizedException`; tuđe sesije se ne diraju.
  PostgreSQL row lock drži konkurentni claim do commita cijele transakcije.
- **Dokaz:** test potvrđuje tačno jedan fulfilled i jedan rejected ishod, samo
  stari i jedan novi vlasnikov red, nula aktivnih vlasnikovih tokena nakon reuse
  detekcije i jednu netaknutu aktivnu sesiju drugog korisnika. Sequential reuse,
  hash-only pohrana, expiry i logout ostaju pokriveni postojećim testovima.
- **Offline helper:** `node scripts/audit/refresh_token_concurrency_repro.cjs`
  prije ispravke izlazi sa statusom 1 na `fulfilled, fulfilled`, a poslije prolazi
  s `fulfilled, rejected`, `ownerActiveRows: 0` i `otherActiveRows: 1`. Fake
  transakcija modelira row-lock barijeru; helper nije dokaz stvarne baze.
- **Finalni CI `41669534608`:** backend **78 suiteova / 751 test + 12/95
  integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`;
  sva tri joba/koraci success i nula failure annotations.

Nema nove migracije ni backfilla; koristi se postojeća `RefreshToken` tabela.
`AUTH_COOKIE_REFRESH_ENABLED` ostaje zadano **off**, pa kompatibilni rollback i
dalje ima postojeći flag, a ne uključivanje novog toka. Revert `de635ad` vraća
dokazani race. Nema DTO, cookie, Bearer, SecureStore, access-TTL, frontend ili
mobile promjene. Spec testira servis uz stvarnu bazu, ne AppModule/HTTP/browser;
`isActive`, access-token revokacija, promjena lozinke, 2FA i produkcijski rollout
ostaju izvan ovog slicea.

---

## S-002 — refresh/logout raw-tip dopuna (2026-11-05)

**STATUS: BODY RAW TIP RIJEŠEN (`e60d2a6`); CI ZELEN.** Ovo je uski DTO slice,
ne promjena token lifecycle ili S-004 politike.

- `RefreshDto.refreshToken` sada čuva raw tip prije `@IsString`; numerički
  JSON broj više se ne pretvara u string. Na obje rute daje 400 prije mock
  `rotate`/`revoke`, dok valjani string zadržava 200, response i servisne
  argumente. Cookie prednost, Bearer i transport po ulazu ostaju isti.
- Test-only `2c6b4e2` dodaje četiri stvarna controller/DTO HTTP scenarija.
  Lokalni repro je **2 prošlo / 2 pala / 4**, a CI `41982338874` **913 prošlo /
  2 pala / 915 ukupno**, samo ciljano. Poslije fixa lokalno je **4/4**, svi Auth
  testovi **48/48**, ESLint **0 errors / 2 poznata warnings**, OpenAPI `--check`
  prolazi. Finalni CI `41982824034`: backend **88/915 + 13/119 integration**,
  mobile **24/136**, frontend **4/4**, nula failure annotations.
- Nema nove migracije/backfilla, flaga, generated/client/compose/deploy
  promjene. Postojeći `AUTH_COOKIE_REFRESH_ENABLED` je uključen samo unutar
  testnog setupa; produkcijski default ostaje `off`. Rollback je revert
  `e60d2a6`.
- Novi suite koristi mock servise i nije novi real-DB rotation/revoke,
  browser/SecureStore ili session-revocation dokaz. Postojeći integration i
  cookie testovi ostaju; S-004, stari JWT nakon promjene lozinke i rollout se
  ne zatvaraju ovim sliceom.

---

## Faza 2 — frontend (`frontend/`)

Backend postaje **jedini izvor istine** o stanju zastavice: `AppConfig` je dobio
polje `authRefreshEnabled`, pa klijent NE smije imati vlastitu env zastavicu.
Razlog je konkretan: da klijent traži `credentials` koje backend nije dozvolio,
browser **blokira cijeli odgovor**, ne samo cookie.

| Fajl | Promjena |
|---|---|
| `backend/src/common/app-config.service.ts` | `authRefreshEnabled: authCookieEnabled()` u obje grane |
| `frontend/src/services/api.ts` | `detectAuthMode()`, `refreshSession()`, `withCredentials` po zahtjevu, 401 → refresh → retry, `logout()` zove backend |
| `frontend/src/context/AuthContext.tsx` | tiha obnova sesije pri pokretanju; odjava opoziva na serveru |

Zaštićeno od petlje: refresh se ne pokreće na `/auth/refresh` ni `/auth/login`,
svaki zahtjev se ponavlja **najviše jednom** (`_sec4Retried`), a konkurentni 401
dijele isti promise (`refreshInFlight`) pa nema lavine zahtjeva.

## Faza 3 — mobile (`mobile/`)

**Android nema browser cookie jar**, pa se httpOnly cookie ovdje ne može
osloniti. Zato je uveden drugi transport:

- `LoginDto`/`RegisterDto` imaju `refreshTransport?: 'cookie' | 'body'`
  (zadano `cookie`). Mobilni klijent šalje `'body'`.
- Backend vraća refresh token u tijelu **samo** na taj eksplicitni zahtjev —
  web klijent ga nikad ne dobija, pa httpOnly zaštita ostaje netaknuta.
- `POST /auth/refresh` i `POST /auth/logout` prihvataju token iz **cookie-ja
  ILI tijela**. Cookie ima prednost, pa web klijent ne može podvaliti stari
  token preko tijela.
- Refresh token se čuva u **Android Keystore** preko `expo-secure-store`.

| Fajl | Promjena |
|---|---|
| `backend/src/modules/User/dto/login.dto.ts`, `register.dto.ts` | `refreshTransport` s `@IsIn(['cookie','body'])` |
| `backend/src/modules/Auth/dto/refresh.dto.ts` | NOVO — tijelo za refresh/logout |
| `backend/src/modules/Auth/auth.controller.ts` | `issueRefresh()`, dual-source refresh/logout |
| `backend/src/modules/Auth/dto/auth-response.dto.ts` | opciono `refreshToken` u obje response šeme |
| `mobile/src/services/storage/SecureStorage.ts` | `setRefreshToken`/`getRefreshToken`/`removeRefreshToken` |
| `mobile/src/services/api/client.ts` | `detectAuthMode()`, `refreshSession()`, `logout()`, 401 → refresh → retry |
| `mobile/src/context/AuthContext.tsx` | obnova sesije pri pokretanju; server-side odjava |

Neispravna vrijednost `refreshTransport` se odbija s 400 (`@IsIn`), jer bi tiho
vraćanje na `cookie` ostavilo mobilnog klijenta bez mogućnosti osvježavanja.

### Testovi faza 2–3

```bash
cd backend
npx jest src/modules/Auth/tests/ src/common/tests/app-config.service.spec.ts --runInBand   # 48/48
cd ../frontend && npm run type-check   # EXIT=0
cd ../mobile   && npm run type-check   # EXIT=0
```

**Frontend nema test runner** (0 testova u repou, nema vitest/jest), pa su
frontend i mobile promjene verificirane **samo tipizacijom i lintom** — ne
ponašanjem. Mobile `npm run lint` daje EXIT=2 i na HEAD-u jer
`eslint-config-expo` nije u `package.json`.

---

## Šta ova faza NE radi

- **Ne mijenja `JwtAuthGuard`** — i dalje čita samo `Authorization: Bearer`.
- **Ne skraćuje život access tokena** — i dalje 24 h. Skraćivanje ima smisla
  tek kad je tok uključen u produkciji i izmjereno ponašanje.
- ~~**Ne uklanja token iz `localStorage`** na frontendu — access token je i dalje
  tamo; zaštićen je samo dugotrajni refresh token.~~ **Ažurirano (FE2-2,
  2026-10-31):** ovo je bila tačna granica SEC-4, ali više ne stoji. FE2-2
  premješta access token u memoriju (`api.ts`: `accessToken` polje), a
  `setToken()` aktivno briše zaostali primjerak iz `localStorage` kad je tok
  uključen. Pokriveno testovima u `frontend/src/services/__tests__/authTokenStorage.test.ts`.
- **Nije isprobano na stvarnom uređaju ni u browseru.** Mobile tok ovisi o
  `expo-secure-store` na Android Keystore-u, a emulator nije dostupan u ovom
  okruženju. **Ispravka (FE2-2):** `SameSite`/`Secure` za ovaj deploy **ne
  traži** `AUTH_COOKIE_SAME_SITE=none` — frontend i API dijele registrabilni
  domen `ba101.top`, pa je zahtjev same-site i zadano `lax` šalje cookie.
  Detalji i dokaz: sekcija „Ispravka (FE2-2)" iznad.
- Nova migracija **nije primijenjena ni na jednu stvarnu bazu** u ovom
  okruženju (nema lokalnog PostgreSQL-a); verificira je CI kroz
  `npx prisma migrate deploy` nad servisom `postgres:16`.
