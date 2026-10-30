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
| `AUTH_COOKIE_SAME_SITE` | `lax` | `strict` \| `lax` \| `none`. Za cross-site deploy (frontend na drugom originu) treba `none` |
| `AUTH_COOKIE_SECURE` | `true` | `Secure` atribut; `false` samo za lokalni razvoj bez HTTPS-a |
| `AUTH_COOKIE_DOMAIN` | *(prazno)* | Opcioni `Domain` atribut |

Napomena: `SameSite=None` bez `Secure` browser odbija, pa kod u tom slučaju
pada na `lax` umjesto da pošalje cookie koji neće raditi.

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
npx jest src/modules/Auth/tests/ --runInBand     # 18/18
```

| Suite | Testova |
|---|---|
| `tests/refresh-token.spec.ts` | 12 |
| `tests/auth-cookie.spec.ts` | 6 |

TDD: `refresh-token.spec.ts` je napisan **prije** servisa i prvi prolaz je pao s
„Cannot find module '../refresh-token.service'".

```bash
node scripts/audit/cors_headers_repro.cjs        # EXIT=0
```

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
- **Ne uklanja token iz `localStorage`** na frontendu — access token je i dalje
  tamo; zaštićen je samo dugotrajni refresh token.
- **Nije isprobano na stvarnom uređaju ni u browseru.** Mobile tok ovisi o
  `expo-secure-store` na Android Keystore-u, a emulator nije dostupan u ovom
  okruženju; `SameSite`/`Secure` za cross-site deploy traži
  `AUTH_COOKIE_SAME_SITE=none` + HTTPS i također nije potvrđeno.
- Nova migracija **nije primijenjena ni na jednu stvarnu bazu** u ovom
  okruženju (nema lokalnog PostgreSQL-a); verificira je CI kroz
  `npx prisma migrate deploy` nad servisom `postgres:16`.
