# 11 — Runbook: rotacija i revokacija kredencijala (SEC-0)

**Status:** pripremljen od agenta, **izvršenje je vlasnikovo**. Agent ne rotira, ne
revokuje i ne ispisuje vrijednosti tajni.

> ## ODLUKA VLASNIKA (2026-10-30)
>
> - **`TUYA_CLIENT_ID` / `TUYA_CLIENT_SECRET` se NE DIRAJU.** Trajna uputa — agent ih
>   ne rotira, ne revokuje i ne mijenja.
> - **Za ostala polja rotacija je moguća, ali vlasnik je odlučio da NIJE POTREBNA.**
>   Runbook stoga ostaje kao pripremljeni postupak, ne kao nalog za izvršenje.
> - Posljedica: `backend/.env` ostaje praćen Gitom, jer je uklanjanje iz praćenja
>   imalo smisla tek uz rotaciju. Ispravke koje **jesu** provedene (maskirana
>   dokumentacija, `.dockerignore`) ostaju na snazi i ne ovise o ovoj odluci.
> - Agent ne procjenjuje je li odluka sigurnosno opravdana; bilježi je. Nalaz S-010
>   ostaje verificiran: vrijednosti iz `.env` su se pojavljivale u javnoj
>   dokumentaciji i ostaju u Git historiji.

**Datum pripreme:** 2026-10-30
**Ozbiljnost:** VISOKO — repozitorij je **javan**, a tajne su bile u HEAD-u.

---

## 1. Šta je utvrđeno (verificirano, bez vrijednosti)

| # | Nalaz | Dokaz | Stanje |
|---|---|---|---|
| 1 | `backend/.env` je **praćen Gitom** i svih 18 polja ima postavljenu vrijednost, uključujući `JWT_SECRET`, `DATABASE_PASSWORD`, `DATABASE_URL`, `TUYA_CLIENT_SECRET`, `WEATHER_API_KEY`, `DATABASE_USER`, `TUYA_CLIENT_ID`. | `git ls-files --error-unmatch backend/.env` → uspješno. `.gitignore:25-27` ima `.env` pravila, ali `.gitignore` **ne djeluje na već praćene fajlove**. | **OTVORENO** — čeka rotaciju pa onda `git rm --cached` |
| 2 | Repozitorij je **javan**. | `gh api repos/mudzy992/boiler-control` → `"private": false, "visibility": "public"` | **OTVORENO** — vlasnikova odluka |
| 3 | Stvarne vrijednosti tajni bile su ispisane u **dokumentaciji** `env.md` (6 polja) i `backend/env.md` (7 polja) — ukupno **13 curenja**. Ovo prethodni audit **nije zabilježio**; nalazi S-005/S-008 govore samo o `.env` i logovima. | `node scripts/audit/env_leak_canary.cjs` prije ispravke → `leaks: 13` | **RIJEŠENO u HEAD-u** (vrijednosti zamijenjene placeholderima) — ali su i dalje u **historiji** |
| 4 | `backend/.dockerignore` **nije** isključivao goli `.env` (samo `.env.local`, `.env.development`, `.env.test`), pa je cijela datoteka s tajnama ulazila u Docker build kontekst i mogla završiti u slojevima image-a. | `grep -nxE '\.env' backend/.dockerignore` → prije: nema ga; poslije: ima ga | **RIJEŠENO** |
| 5 | Praćeni logovi (`backend/p2b-test-run.log`, `backend/test-run.log`) sadrže **imena** polja (`DATABASE_PASSWORD='n…'`, dužina 15), ali **nijednu stvarnu vrijednost** iz `.env`. | Python usporedba vrijednosti iz `.env` sa sadržajem logova → `ne` za svih 7 osjetljivih polja | **Precizira S-008**: logovi ne cure trenutne tajne, ali su nepotrebno praćeni |

> **Ključno:** stavke 3 i 4 su ispravljene u HEAD-u, ali **to ne poništava izloženost**.
> Vrijednosti su bile javno čitljive i ostaju u Git historiji. **Rotacija je obavezna
> i ne čeka ništa.**

---

## 2. Gdje se koja tajna stvarno koristi (verificirano grep-om po `backend/src`)

| Polje | Potrošač u kodu | Posljedica rotacije |
|---|---|---|
| `JWT_SECRET` | `src/modules/Auth/auth.module.ts:11` (`JwtModule` secret) | **Svi postojeći tokeni odmah postaju nevažeći** — korisnici se moraju ponovo prijaviti, uključujući instalirane mobilne aplikacije |
| `DATABASE_PASSWORD` | `src/prisma/prisma.service.ts:18,30` (Prisma datasource) | Prekid DB pristupa dok se nova vrijednost ne raspodijeli |
| `TUYA_CLIENT_ID` + `TUYA_CLIENT_SECRET` | `src/modules/Boiler/adapter/tuya.adapter.ts:152-158` (HMAC-SHA256 potpis) i `src/modules/Tuya/tuya.auth.service.ts:18-19` | Prekid upravljanja kotlom dok se novi par ne raspodijeli |
| `DATABASE_URL` | **nijedan** `.ts` fajl u `src/` ga ne čita | Vjerojatno ga Prisma čita direktno iz env-a — **potvrditi prije revokacije** |
| `WEATHER_API_KEY` | **nijedan** `.ts` fajl u `src/` ga ne čita | Kandidat za **revokaciju bez zamjene** (open-meteo ne traži ključ) — **potvrditi** |

---

## 3. Postupak rotacije (vlasnik izvršava)

Redoslijed je bitan: **prvo omogući novo, tek onda onemogući staro.** Kompromitovani
ključ se **ne vraća** kao rollback.

### 3.1 Priprema (prije bilo čega)

1. Odrediti secret manager (GitHub Actions secrets + providerov secret store za
   runtime, npr. Doppler/Infisical/AWS Secrets Manager — po izboru vlasnika).
2. Za svako polje iz `backend/.env.example` (18 polja, verificiran 1:1 paritet s
   `.env`) pripremiti novu vrijednost u secret manageru. **Ne u repou.**
3. Zabilježiti vrijeme početka u evidenciju (odjeljak 6). Vrijednosti se ne bilježe.

### 3.2 `JWT_SECRET`

1. Generisati novi nasumični secret (npr. `openssl rand -base64 48`) u secret manager.
2. Odlučiti hoće li se podržati **dual-mode** (privremeno prihvatanje i starog i novog
   potpisa) da postojeći klijenti ne ispadnu odmah. Bez dual-mode-a svi tokeni padaju
   u trenutku zamjene.
3. Raspodijeliti novi secret, restartovati backend, potvrditi da se prijava radi.
4. Tek nakon toga prestati prihvata stari potpis.
5. **Otvorena odluka (blokira `SEC-4`/`FE2-2`):** rok prelaska s Bearer tokena u
   `localStorage` na httpOnly cookie + rotirani refresh, uz dual-mode prelaz.

### 3.3 `DATABASE_PASSWORD`

1. Kreirati novu lozinku kod DB providera **kao dodatnu**, ne zamjensku — da stari
   pristup radi dok se nova ne raspodijeli.
2. Raspodijeliti novu, restartovati backend, potvrditi upit (npr. health endpoint koji
   stvarno dira bazu).
3. Tek tada ukinuti staru lozinku.

### 3.4 `TUYA_CLIENT_ID` / `TUYA_CLIENT_SECRET`

1. U Tuya IoT Developer portalu izdati novi par ključeva za postojeću aplikaciju.
2. Raspodijeliti, restartovati, potvrditi da `tuya.auth.service` dobija token i da
   HMAC potpis prolazi.
3. Tek tada povući stari par.

### 3.5 `WEATHER_API_KEY` i `DATABASE_URL`

1. Potvrditi da ih nijedan kod ne čita (grep u odjeljku 2 to pokazuje, ali vrijedi
   ponoviti na stvarnom deploymentu).
2. Ako se ne koriste — **revokovati bez zamjene** i ukloniti polje iz `.env`.

---

## 4. Nakon rotacije: uklanjanje iz repozitorija

Ovo se radi **tek kad stare vrijednosti više ne rade**, jer samo uklanjanje iz HEAD-a
ne briše historiju.

```bash
# 1) prestati pratiti .env (fajl ostaje na disku)
git rm --cached backend/.env

# 2) potvrditi da canary ne nalazi curenje
node scripts/audit/env_leak_canary.cjs

# 3) ukloniti nepotrebno praćene logove
git rm --cached backend/p2b-test-run.log backend/test-run.log backend/start-dev.log
```

`.gitignore` već ima `.env`, `.env.*` i `!.env.example` (l.25-27), pa nakon
`git rm --cached` pravila konačno stupaju na snagu.

### 4.1 Čišćenje historije — **samo uz izričito odobrenje**

`git filter-repo` ili BFG prepisuju SHA-ove svih commitova. To znači:

- svaki klonirani repo mora biti ponovo kloniran;
- otvoreni PR-ovi i grane se moraju uskladiti;
- **GitHub zadržava stare objekte u cache-u i forkovima** — potpuno uklanjanje zahtijeva
  i GitHub support zahtjev.

Zato je **rotacija jedina stvarna zaštita**, a čišćenje historije kozmetika.

---

## 5. Provjera da je gotovo (kriterij prihvatanja)

```bash
node scripts/audit/env_leak_canary.cjs      # EXIT 0, leaks: [], envExcluded: true
```

Dodatno, ručno:

- [ ] Stari `JWT_SECRET` više ne potpisuje valjan token (prijava s starim tokenom → 401).
- [ ] Stara DB lozinka se odbija.
- [ ] Stari Tuya par ne dobija token.
- [ ] Backend radi s novim vrijednostima iz secret managera.
- [ ] `docker build` ne sadrži `.env` — canary u image-u:
      `docker run --rm <image> sh -c 'test ! -f /app/.env && echo OK'`
- [ ] `backend/.env` nije praćen (`git ls-files backend/.env` → prazno).

**Bez ispisa vrijednosti u chat, issue, commit poruku ili log.**

---

## 6. Evidencija (popuniti pri izvršenju, bez vrijednosti)

| Datum | Polje | Provider | Ko | Stari ključ deaktiviran | Napomena |
|---|---|---|---|---|---|
|  | `JWT_SECRET` |  |  |  |  |
|  | `DATABASE_PASSWORD` |  |  |  |  |
|  | `TUYA_CLIENT_*` |  |  |  |  |
|  | `WEATHER_API_KEY` |  |  |  | revokacija bez zamjene? |
|  | `DATABASE_URL` |  |  |  |  |

---

## 7. Šta je agent uradio, a šta nije

**Uradio (verificirano):**

- Maskirao 13 curenja u `env.md` i `backend/env.md` (vrijednosti → placeholderi +
  upozorenje na vrhu).
- Dodao goli `.env` i `.env.*` (uz `!.env.example`) u `backend/.dockerignore`.
- Napisao `scripts/audit/env_leak_canary.cjs` — read-only, idempotentna, s `--help`,
  **bez ispisa vrijednosti**. Prije ispravki: EXIT 1 s 13 curenja; poslije: EXIT 0.

**Nije uradio (namjerno, izvan ovlasti):**

- Nije rotirao ni revokovao nijedan kredencijal.
- Nije uklonio `backend/.env` iz Git praćenja (čeka rotaciju).
- Nije čistio Git historiju.
- Nije ispisao nijednu vrijednost tajne — ni u chat, ni u repo, ni u commit poruku.
