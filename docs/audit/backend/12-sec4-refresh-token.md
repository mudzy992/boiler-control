# SEC-4 — Rotirani refresh token i httpOnly cookie

**Datum:** 2026-10-30
**Nalaz:** SEC-4 / B-016 (`docs/audit/backend/08-security.md`, `02-findings.md:160`)
**Status:** Faza 1 (backend) implementirana i iza zastavice; klijenti (frontend, mobile) još nisu prebačeni.
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

## Šta ova faza NE radi

- **Ne mijenja `JwtAuthGuard`** — i dalje čita samo `Authorization: Bearer`.
- **Ne prebacuje frontend ni mobile** na cookie tok (to je FE2-2 / MO2-7).
- **Ne skraćuje život access tokena** — i dalje 24 h. Skraćivanje ima smisla
  tek kad klijenti znaju osvježiti sesiju.
- **Ne uklanja token iz `localStorage`** na frontendu.
- Nova migracija **nije primijenjena ni na jednu stvarnu bazu** u ovom
  okruženju (nema lokalnog PostgreSQL-a); verificira je CI kroz
  `npx prisma migrate deploy` nad servisom `postgres:16`.
