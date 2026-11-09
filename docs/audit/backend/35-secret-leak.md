# 35 — Tajne u javnom repozitoriju (SEC-5)

Datum: 2026-11-08. **Ovo je najozbiljniji nalaz do sada i traži akciju vlasnika,
ne samo commit.**

## Šta je bilo

Repozitorij `mudzy992/boiler-control` je **javan** (`isPrivate: false`), a u
praćenim fajlovima su bile stvarne vrijednosti:

| Fajl | Šta je bilo unutra | Stanje |
|---|---|---|
| `env.md` | `DATABASE_URL` sa **lozinkom Postgres baze** + host baze | očišćeno 2026-11-08 |
| `backend/.env` | ista lozinka + `JWT_SECRET`, `WEATHER_API_KEY`, `TUYA_CLIENT_SECRET` (svi pravi, 31–32 znaka) | **izbačen iz Gita** |
| `backend/env.md` | MySQL lozinka za stari `sql.ba101.top` | očišćeno |
| `backend/test-run.log`, `backend/p2b-test-run.log` | komandna linija sa MySQL lozinkom, Weather i Tuya ključevi | **obrisani iz Gita** |
| `docs/ENVIRONMENT_SETUP.md` | Weather API ključ, Tuya client id + secret, MySQL lozinka | očišćeno |

`backend/.env` je imao zaglavlje kako je „sanitized" — nije bilo istina.
`.gitignore` je imao `.env` i `.env.*`, ali git ignoriše samo **nepraćene**
fajlove; jednom dodan fajl ostaje praćen zauvijek. Pravilo je zato bilo istinito
i beskorisno.

## Šta sam uradio (mehanički dio)

1. `git rm --cached backend/.env` — fajl ostaje na disku za lokalni rad, ali nije
   više u Gitu. `.gitignore` sada eksplicitno navodi `backend/.env`.
2. Obrisani `backend/test-run.log` i `backend/p2b-test-run.log`; `*.log` je u
   `.gitignore`. Log sa komandnom linijom je lošiji od samog `.env`-a jer se
   kopira u issue, paste i screenshot.
3. Očišćeni `env.md`, `backend/env.md`, `docs/ENVIRONMENT_SETUP.md` — placeholderi
   plus zaglavlje koje kaže da su vrijednosti kompromitovane.
4. `scripts/audit/secret-scan.cjs` + `.github/workflows/secret-scan.yml` —
   skener praćenih fajlova, nula zavisnosti. Provjeren u oba smjera: čisto drvo
   prolazi (933 fajla, 0 nalaza), a podmetnuta tajna pada sa `exit 1`.

## Šta vlasnik MORA uraditi (ovo ne mogu ja)

Brisanje iz radnog stabla **ne briše** ništa iz Git historije. Svaka od ovih
vrijednosti je bila javno dostupna i smatra se kompromitovanom:

| # | Tajna | Gdje se mijenja | Zašto je hitno |
|---|---|---|---|
| 1 | **Postgres lozinka** | Coolify → Postgres servis → password; zatim `DATABASE_URL` u backend env i `DATABASE_URL_READONLY`/`DATABASE_URL_BACKFILL` u GitHub secrets | pun pristup svim podacima |
| 2 | **JWT_SECRET** | Coolify env; rotacija razrješava sve sesije | neko sa secretom može izdati valjan token za bilo koji `userId` |
| 3 | **WEATHER_API_KEY** | OpenWeather nalog; izdati novi | tuđa potrošnja kvote |
| 4 | **TUYA_CLIENT_ID / SECRET** | Tuya IoT platforma → aplikacija → reset secret | pristup tuđim uređajima na nalogu |
| 5 | **MySQL lozinka** (`sql.ba101.top`) | ako server još radi — ugasiti ili promijeniti | stara baza, isti obrazac lozinke |
| 6 | Svaka lozinka koja je bila ista kao ove | svugdje gdje se ponavlja | ponovna upotreba lozinke je najčešći put do drugog naloga |

Redoslijed: **(2) JWT → (1) baza → (3,4) eksterni API-ji**. JWT prvi jer je
najmanje invazivan (svi se samo odjave), pa se odmah vidi da rotacija radi.

### Da li prepisati historiju?

Tehnički: `git filter-repo --invert-paths --path env.md --path backend/.env …`
pa force-push. **Ali**: GitHub drži forkove, klonove i keširane blobove; ako je
repo bio javan, pretpostavka mora biti da je kopija negdje postoji. Zato:

- rotacija je **obavezna** i ne zavisi od prepisa historije;
- prepis historije je **kozmetika** koja ima smisla samo ako se radi i na svim
  klonovima; može slomiti tuđe checkout-e.

Preporuka: rotirati sve, pa tek onda (ako se želi) prepisati historiju.

## Šta skener ne hvata

- **Historiju.** Namjerno: ne može se „popraviti" skenerom, a lažni osjećaj
  sigurnosti je gori od nikakvog.
- **Tajne u nestandardnom obliku** (npr. base64 blob, tajna u JSON-u pod
  neočekivanim imenom ključa).
- **Tajne u slikama i PDF-ovima.**
- **Tajne koje su već izašle** — skener gleda sadašnje stanje, ne prošlost.

Za ozbiljniji nivo: GitHub Secret Scanning + push protection (uključuje se u
postavkama repozitorija, radi i na privatnim) i, ako se ikad pređe na plaćeni
plan, `gitleaks` u CI-ju preko cijele historije.
