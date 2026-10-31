# FE2-2 — Auth migracija: access token iz `localStorage` u memoriju

**Datum:** 2026-10-31
**Status:** implementirano iza postojeće zastavice; uključivanje zastavice čeka vlasnika
**Zastavica:** `AUTH_COOKIE_REFRESH_ENABLED` (backend), zadano `off`

---

## 1. Polazno stanje (izmjereno, ne pretpostavljeno)

SEC-4 (`8e1d6a8`/`e438abc`) je već izgradio **backend** i veći dio frontend
plumbinga. Prije FE2-2 stvarno stanje je bilo:

| Već postojalo (SEC-4) | Nedostajalo (FE2-2) |
|---|---|
| Rotirani refresh token + reuse detection | Access token i dalje u `localStorage` |
| `auth-cookie.ts` (httpOnly/Secure/SameSite) | Download čitao token direktno iz `localStorage` |
| `POST /auth/refresh`, `POST /auth/logout` | `ProtectedRoute` vjerovao postojanju stringa |
| CORS `credentials` iza zastavice | Nijedan frontend test refresh toka |
| `detectAuthMode()`, `refreshSession()`, 401→retry | — |

Dakle FE2-2 **nije** gradio cookie tok od nule — to bi bilo dupliranje SEC-4.
Ono što je nedostajalo je da access token prestane biti čitljiv JavaScriptu.

### Nalaz koji je FE2-2 trebao zatvoriti

`localStorage.getItem('token')` čita **bilo koji** ubačeni script. Token traje
24 h bez revokacije (S-004), pa jedan XSS na bilo kojoj stranici daje napadaču
dan punog pristupa API-ju. To je srž nalaza S-004/FE-002, a ne nedostatak
refresh mehanizma.

---

## 2. Šta je promijenjeno

| Fajl | Promjena |
|---|---|
| `frontend/src/services/api.ts` | novo polje `accessToken`; `getToken()`/`setToken()`/`clearToken()` centralizuju odluku gdje token živi; nova metoda `downloadProtectedFile()`; sva tri interceptor-a prešla na te metode |
| `frontend/src/context/AuthContext.tsx` | novo stanje `isInitializing`; token se čita preko `apiClient.getToken()`; `localStorage.removeItem` zamijenjen s `apiClient.clearToken()` |
| `frontend/src/components/ProtectedRoute.tsx` | čeka dok traje tiho obnavljanje sesije, ali **samo kad tokena nema** |
| `frontend/src/pages/GasReadingsPage.tsx` | `openProtectedFile` ide kroz `apiClient.downloadProtectedFile` umjesto ručnog `fetch` s Bearer headerom |
| `frontend/src/services/__tests__/authTokenStorage.test.ts` | 11 testova (novo) |
| `frontend/src/components/__tests__/ProtectedRoute.test.tsx` | 4 testa (novo) |

### Ključna odluka: token u memoriji **samo** kad je zastavica uključena

`getToken()` vraća memoriju kad je `cookieAuthEnabled === true`, a
`localStorage` kad je `false`. Razlog je rollback: da je memorija postala
jedini izvor odmah, uključivanje **backend** zastavice bi postalo uslov da
frontend uopće radi, a vraćanje zastavice na `off` ne bi vratilo ponašanje.

`setToken()` uz to **aktivno briše** zaostali token iz `localStorage` kad je tok
uključen. Bez toga bi korisnik koji je bio prijavljen prije prelaska ostavio
token čitljiv XSS-u iako se aplikacija više ne oslanja na njega.

### Zašto je `ProtectedRoute` morao dobiti `isInitializing`

S tokenom u memoriji reload stranice znači da tokena pri prvom renderu **nema**,
iako je httpOnly refresh cookie ispravan i `refreshSession()` upravo traje.
Stari `if (!token) return <Navigate to="/login" />` bi izbacivao prijavljenog
korisnika na svaki F5.

Guard je namjerno `!token && isInitializing`, ne samo `isInitializing`: kad token
postoji (npr. `off` tok, gdje se čita iz `localStorage` odmah) sadržaj se
prikazuje bez treperenja. Ovu razliku je uhvatio test „token uz inicijalizaciju
i dalje prikazuje sadržaj", a prva verzija implementacije ju je lomila.

---

## 3. CSRF analiza

Zatražena je analiza **prije** prijedloga. Evo dokaza.

### Topologija (iz commitovane deploy konfiguracije)

| Šta | Vrijednost | Izvor |
|---|---|---|
| Frontend origin | `https://boiler-control.ba101.top` | `docker-compose.yml:35` |
| API origin | `https://api.boiler-control.ba101.top/api` | `docker-compose.yml:66` |
| Registrabilni domen (eTLD+1) | `ba101.top` — **isti za obje strane** | izvedeno |

Origin-i jesu različiti, ali `SameSite` se računa po registrabilnom domenu, ne po
originu. Zahtjev frontend → API je dakle **same-site**.

### Svojstva cookie-ja (`auth-cookie.ts:88-101`)

| Atribut | Vrijednost | Posljedica |
|---|---|---|
| `httpOnly` | `true` (hardkodovano) | JS ga ne može pročitati |
| `sameSite` | `lax` (zadano, `AUTH_COOKIE_SAME_SITE` nigdje nije postavljen) | cookie se **ne** šalje na cross-site POST |
| `secure` | `true` (zadano) | samo preko HTTPS-a |
| `Domain` | nije postavljen (`AUTH_COOKIE_DOMAIN` prazan) | cookie je **host-only** za `api.boiler-control.ba101.top` |

### Pogođeni endpointi

Samo dva čitaju refresh cookie: `POST /api/auth/refresh`
(`auth.controller.ts:113`) i `POST /api/auth/logout` (`:151`). Svi ostali
zahtjevi nose access token u `Authorization: Bearer` headeru.

### Zaključak po vektoru

| Vektor | Ishod | Zašto |
|---|---|---|
| Cross-site (`evil.com`) → `/auth/refresh` | **BLOKIRANO** | `SameSite=lax` ne šalje cookie na cross-site POST |
| Cross-site → bilo koji API endpoint | **BLOKIRANO** | traži `Authorization` header; cross-site `fetch` ga ne može postaviti bez preflighta, a preflight pada jer CORS `origin` nije refleksija nego fiksna vrijednost (`main.ts:22-32`) |
| Same-site (`bilo-šta.ba101.top`) → `/auth/refresh` | **MOGUĆE, ali ograničeno** | cookie se šalje; napadač **ne može pročitati odgovor** (CORS origin je fiksiran), pa ne može ukrasti novi access token. Realan učinak je prisilna rotacija, odnosno ometanje — ne krađa vjerodajnica |
| Same-site → `/auth/logout` | **MOGUĆE** | prisilna odjava. Neugodno, nije kompromitacija |

**Ukupna procjena:** uz zadano `lax` glavni CSRF vektor je zatvoren. Preostali
rizik je zloupotreba s kompromitovanog **sibling subdomena** `ba101.top`, i to
samo u obliku ometanja (prisilna odjava / rotacija), ne krađe.

### Prijedlog (čeka odluku vlasnika — nije implementirano)

1. **Zadržati `SameSite=lax`.** Ne postavljati `none`: za ovu topologiju ne bi
   donio korist, a uklonio bi zaštitu koju `lax` daje besplatno.
2. **Ne postavljati `AUTH_COOKIE_DOMAIN`.** Host-only cookie je uži i time
   bolji; postavljanje domene proširilo bi cookie na sve subdomene.
3. **Opciono, defense-in-depth:** provjera `Origin`/`Sec-Fetch-Site` headera na
   dva endpointa koja čitaju cookie. Odbiti zahtjev čiji `Origin` nije
   `FRONTEND_URL`. Time se zatvara i vektor sibling subdomena. Cijena: ~20
   linija u `auth.controller.ts` + testovi. **Preporučeno, ali ne hitno** —
   postojeća zaštita je dovoljna za trenutnu površinu napada.
4. Ako se ikad frontend i API razdvoje na različite registrabilne domene,
   tačke 1–2 se moraju preispitati, a tačka 3 postaje **obavezna**.

---

## 4. Runbook za uključivanje zastavice

> Ovo je plan, **nije izvršeno**. `AUTH_COOKIE_REFRESH_ENABLED` je i dalje `off`
> u svim konfiguracijama u repu.

### Preduslovi (svaki mora biti potvrđen prije koraka 1)

- [ ] Migracija `20261030000000_auth_refresh_token` primijenjena na produkcijsku
      bazu (`npx prisma migrate deploy`). **Nije primijenjena ni na jednu stvarnu
      bazu** u ovom okruženju.
- [ ] Backend i frontend servira HTTPS (cookie ima `Secure`).
- [ ] `FRONTEND_URL` na backendu tačno `https://boiler-control.ba101.top` —
      CORS `origin` je fiksna vrijednost, pa bilo kakvo odstupanje ruši cookie tok.
- [ ] Deployovan frontend koji sadrži FE2-2. **Redoslijed je obavezan**: stari
      frontend ne zna za `isInitializing`, pa bi prijavljeni korisnici bili
      izbacivani na svaki reload čim se zastavica uključi.
- [ ] `AUTH_COOKIE_SAME_SITE` i `AUTH_COOKIE_DOMAIN` **ostavljeni neprazni na
      zadano** (odnosno prazno) — vidi analizu iznad.

### Koraci

1. **Izmjeri osnovnu liniju.** Zabilježi stopu neuspjelih prijava i broj 401
   odgovora za 24 h prije prelaska. Bez toga nema kako prepoznati regresiju.
2. Uključi `AUTH_COOKIE_REFRESH_ENABLED=on` na backendu i restartuj servis.
3. **Provjeri dual-mode.** Stari Bearer tok mora i dalje raditi: `off`→`on` ne
   smije odjaviti postojeće korisnike, jer njihov token ostaje u
   `localStorage` dok ga `setToken()` ne zamijeni.
4. Prati 24 h: stopa neuspjelih prijava, broj `/auth/refresh` poziva, broj
   reuse-detection događaja (reuse detection znači ili krađu ili bug u
   rotaciji).
5. Tek nakon stabilnog prozora razmotri skraćivanje života access tokena — to je
   zasebna promjena, ne dio ovog koraka.

### Rollback

`AUTH_COOKIE_REFRESH_ENABLED=off` + restart. Time se:

- CORS vraća doslovno na prijašnje (`credentials: authCookieEnabled()` → `false`),
- `/auth/refresh` i `/auth/logout` počinju vraćati 401,
- frontend se preko `detectAuthMode()` vraća na `localStorage` tok.

Rollback je čist **jer** je zastavica jedini izvor istine i čita se s backend-a,
a ne iz frontend env-a. Da frontend ima vlastitu zastavicu, neslaganje bi
značilo da browser traži `credentials` koje backend nije dozvolio, a CORS tada
blokira **cijeli odgovor**, ne samo cookie.

### Šta se gubi prelaskom

Refresh cookie je host-only i httpOnly, pa preživljava reload. Access token u
memoriji **ne** preživljava reload — obnavlja se iz cookie-ja. Ako je cookie
istekao ili je korisnik otvorio novi tab bez sesije, slijedi prijava. To je
namjereno ponašanje, ne greška.

---

## 5. Testovi

| Komanda | Rezultat (2026-10-31) |
|---|---|
| `cd frontend && npm run type-check` | exit 0, **0 grešaka** |
| `cd frontend && npm run lint` | exit 0, 0 errors / 13 warnings |
| `cd frontend && npm test` | exit 0, **84/84** (9 fajlova) |

Novi testovi: `authTokenStorage.test.ts` (11) i `ProtectedRoute.test.tsx` (4).

**Mutacijska provjera: 6/6 namjernih grešaka ruši suite.** Bez ovoga „prolazi"
ne znači ništa — a provjera je i ovdje uhvatila stvarnu grešku: prva verzija
`ProtectedRoute` bila je `if (isInitializing)`, što test „token uz
inicijalizaciju i dalje prikazuje sadržaj" nije hvatao dok ga nisam napisao.

| Mutacija | Ishod |
|---|---|
| `setToken` ipak piše u `localStorage` kad je tok ON | 2 failed |
| `getToken` pada na `localStorage` i kad je tok ON | 1 failed |
| `clearToken` ne čisti memoriju | 1 failed |
| `detectAuthMode`: nedostajuće polje = `true` | 1 failed |
| `ProtectedRoute`: guard za inicijalizaciju uklonjen | 1 failed |
| `ProtectedRoute`: guard ne gleda token | 1 failed |

---

## 6. Kompatibilnost unazad

- **Zastavica `off` (današnje stanje):** ponašanje je doslovno prijašnje. Token
  ide u `localStorage`, `Authorization: Bearer`, 401 čisti token i preusmjerava.
  Testovi to eksplicitno pokrivaju.
- **Stare instalirane verzije frontenda:** ne znaju za `isInitializing`. Zato je
  redoslijed deploya obavezan (frontend prije uključivanja zastavice).
- **Mobilna aplikacija:** ne dira se. RN tok koristi `transport: 'body'`
  (`auth.controller.ts:64-67`) i čuva refresh token u Android Keystore, ne u
  cookie-ju. MO2 paritet ostaje otvoren kao zasebna stavka.

---

## 7. Šta NIJE verificirano

- **Ponašanje u stvarnom browseru.** Nema emulatora ni pravog browsera u ovom
  okruženju (Playwright CDN nedostupan, potvrđeno četiri puta). Postavljanje
  httpOnly cookie-ja i njegovo slanje s `SameSite=lax` **nije** isprobano u
  stvarnom browseru — samo u testovima s mockanom axios instancom.
- **Stvarni CSRF napad nije izveden.** Analiza iz odjeljka 3 je izvedena iz
  konfiguracije i specifikacije, ne mjerenjem.
- **`/auth/refresh` kroz stvarni HTTP nije pozvan** s cookie-jem; backend
  testovi (`refresh-token.spec.ts`) pokrivaju servisni sloj.
- **Migracija nije primijenjena** na stvarnu bazu.
- **CSRF zaštita (prijedlog 3) nije implementirana** — čeka odluku vlasnika.

---

## 8. Preostalo otvoreno

- Odluka o CSRF zaštiti (prijedlog iz odjeljka 3, tačka 3).
- Odluka o datumu uključivanja zastavice.
- i18n ključ `gas.authMissing` (`locales/config.ts:117`/`:325`) ostao je bez
  potrošača nakon što je `openProtectedFile` prestao ručno provjeravati token.
  Namjerno **nije obrisan** — isti pristup kao mrtvi ključevi iz MO2-6.
- Mobilni paritet (SecureStore + refresh) kao zasebna stavka.
