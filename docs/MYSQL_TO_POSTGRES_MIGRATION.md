# MySQL → PostgreSQL migracija

**Status:** Kod je pripremljen za PostgreSQL. **Stvarni prenos produkcijskih
podataka nije izvršen** (nije ni mogao biti, izvan je obima ove pripreme —
ovo okruženje nema pristup mreži/bazi). Ovaj dokument opisuje šta je
promijenjeno u kodu, i tačne korake za ops/deploy fazu.

---

## 1. Šta je promijenjeno u kodu

| Fajl | Izmjena |
|---|---|
| `backend/prisma/schema.prisma` | `datasource db.provider`: `mysql` → `postgresql` |
| `backend/prisma/migrations/migration_lock.toml` | provider → `postgresql` |
| `backend/prisma/migrations/2026*` (24 stara fajla) | **premješteno** u `backend/prisma/migrations_mysql_archive/` — ne primjenjuju se više, čuvaju se samo kao istorijski zapis |
| `backend/prisma/migrations/20260826000000_postgres_baseline/migration.sql` | **novo** — ručno napisana, konsolidovana baseline migracija koja odgovara trenutnoj `schema.prisma` u Postgres SQL dijalektu |
| `backend/src/prisma/prisma.service.ts` | `PrismaMariaDb` adapter → `PrismaPg` adapter (`@prisma/adapter-pg`) |
| `backend/prisma/seed.ts` | isto — adapter zamijenjen |
| `backend/package.json` | `@prisma/adapter-mariadb` → `@prisma/adapter-pg`; dodano `pg`, `@types/pg`, `dotenv-cli`; `test:integration` skripta više **ne sadrži hardkodovane produkcijske kredencijale** (učitava `.env.test` umjesto toga) |
| `backend/package-lock.json` | **obrisan** — mora se regenerisati sa `npm install` (nije moguće offline u ovom okruženju) |
| `backend/.env`, `backend/.env.example` (novo) | **sanitizovano** — stvarni produkcijski secrets uklonjeni i zamijenjeni placeholder vrijednostima; port 3306→5432; format connection stringa promijenjen na `postgresql://` |
| `backend/.env.test.example` (novo) | template za integration test env |
| `backend/README.md`, `backend/DATABASE_SETUP.md`, `backend/MIGRATION_INSTRUCTIONS.md` | ažurirano/označeno da je baza sada Postgres |

### Zašto je `.env` sanitizovan

Prvobitni `.env` u projektu je sadržavao **stvarne produkcijske kredencijale**
u čistom tekstu (DB lozinka, JWT secret, Tuya i Weather API ključevi) — ovo
je bio CRITICAL nalaz iz ranijeg audita. Umjesto da se ti isti secreti
prekopiraju u novi Postgres connection string, fajl je sanitizovan. **Prava
vrijednost svakog secreta mora biti rotirana** (ne samo prekopirana) prije
produkcijske upotrebe — vidi audit iz prethodnog dijela razgovora.

### Zašto konsolidovana baseline migracija umjesto prevoda 24 migracije

Prisma migracije su SQL specifičan za engine (backtick identifikatori,
`AUTO_INCREMENT`, MySQL tipovi kao `DATETIME(3)` itd.). Prevođenje 24
istorijske migracije jedne po jedne bi bilo rizično i nepotrebno — standardna
praksa pri promjeni DB engine-a je da se napravi **jedna svježa baseline
migracija** iz trenutnog stanja `schema.prisma`, a stara historija se čuva
samo kao referenca. To je urađeno ovdje.

**Napomena o tačnosti:** `migration.sql` u
`20260826000000_postgres_baseline/` je pisan ručno, jer u ovom okruženju
nije bilo moguće pokrenuti Prisma CLI (nema mrežnog pristupa ni instaliranih
binarnih engine-a). Prije primjene na stvarnu Postgres instancu, **obavezno**
provjeriti/regenerisati preko:

```bash
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

...i uporediti izlaz sa ovim fajlom. Tretirati ovaj fajl kao snažan prvi
nacrt, ne kao garantovano identičan Prisma-generisanom artefaktu.

### Šta NIJE trebalo mijenjati

`schema.prisma` ne koristi nijedan `@db.*` native-type anotaciju niti bilo
kakav `$queryRaw`/`$executeRaw` poziv u kodu servisa — provjereno pretragom
cijelog `backend/src`. To znatno pojednostavljuje migraciju: nije bilo
MySQL-specifičnih native tipova koje treba ručno mapirati na Postgres
ekvivalente, niti raw SQL-a koji koristi MySQL sintaksu (npr.
`DATE_FORMAT`, `` ` ``-quoted identifiers, `ON DUPLICATE KEY UPDATE`).

---

## 2. Koraci za deploy (ops faza — van obima ove pripreme)

1. **Provizionisati PostgreSQL instancu** (preporuka: verzija 15+).
2. Popuniti `.env` sa stvarnim (**rotiranim**, ne prekopiranim) vrijednostima:
   `DATABASE_URL`, `DATABASE_HOST/PORT/USER/PASSWORD/NAME`, `JWT_SECRET`,
   `WEATHER_API_KEY`, `TUYA_CLIENT_ID`/`TUYA_CLIENT_SECRET`.
3. `cd backend && npm install` — ovo će regenerisati `package-lock.json` i
   instalirati `pg`/`@prisma/adapter-pg`.
4. `npx prisma generate` — generiše Prisma Client za postgresql provider.
5. `npx prisma migrate deploy` — primjenjuje
   `20260826000000_postgres_baseline` na praznu Postgres bazu (kreira svih
   17 tabela + enume + indekse + FK).
6. **Prenos postojećih podataka** (ako postoji produkcijska MySQL baza sa
   stvarnim podacima koje treba zadržati) — ovo je poseban, jednokratni ETL
   korak, van obima ove pripreme jer zahtijeva pristup obje žive baze:
   - Preporučen alat: [`pgloader`](https://pgloader.io/) — direktno zna
     čitati iz MySQL/MariaDB i pisati u Postgres, uz automatsko mapiranje
     tipova.
   - Alternativa: `mysqldump` → CSV export po tabeli → `COPY` import u
     Postgres (sporije, ali bez dodatnih alata).
   - **Obavezno**: raditi u maintenance-window-u, sa MySQL bazom u
     read-only stanju tokom prenosa, i **verifikovati broj redova po
     tabeli** (`SELECT COUNT(*)`) prije/poslije na obje baze prije nego se
     MySQL instanca ugasi.
   - Zadržati staru MySQL instancu netaknutu (read-only) minimalno par
     sedmica nakon cutover-a, kao rollback opciju.
7. Pokrenuti `npm run test:integration` (uz popunjen `.env.test`) protiv
   test Postgres instance prije produkcijskog cutover-a.
8. Verifikovati aplikaciju end-to-end (auth, thermostat polling, boiler
   sync, gas upload) na staging okruženju prije produkcije.

---

## 3. Poznate razlike MySQL vs Postgres relevantne za ovaj projekat

- **Case sensitivity identifikatora**: Postgres je case-sensitive kad su
  identifikatori quotovani (a Prisma ih uvijek quotuje) — model/kolona
  imena u `schema.prisma` (PascalCase/camelCase) ostaju identična, Prisma
  Client API se ne mijenja.
- **UTF-8 emoji/multi-byte podrška**: MySQL je zahtijevao `utf8mb4` collation
  eksplicitno da bi radio sa punim Unicode rasponom (emoji i sl.); Postgres-ov
  standardni `UTF8` encoding to već pokriva nativno — nema potrebe za
  dodatnom collation konfiguracijom.
- **`Json` tip**: mapiran na `JSONB` u Postgres bazi (umjesto `JSON` u MySQL)
  — funkcionalno ekvivalentno za trenutnu upotrebu (`Notification.data`),
  JSONB je čak i brži za upite ako se ikad bude filtriralo po sadržaju.
- **Autoincrement**: MySQL `AUTO_INCREMENT` → Postgres `SERIAL` (sequence)
  — ponašanje ekvivalentno za trenutnu upotrebu.

---

## 4. Šta NIJE urađeno u ovoj pripremi (svjesno, van obima)

- Stvarni prenos produkcijskih podataka (zahtijeva pristup živoj bazi).
- Pokretanje `npm install` / regenerisanje `package-lock.json` (zahtijeva
  mrežni pristup nedostupan u ovom okruženju).
- Rotacija stvarnih secrets (zahtijeva pristup produkcijskim sistemima —
  DB, Tuya, Weather API konzolama).
- Ažuriranje starijih, istorijskih `.md` dokumenata u `docs/` koji spominju
  MySQL (npr. razni `*_SUMMARY.md`/`*_STATUS.md` fajlovi) — namjerno
  ostavljeni netaknuti kao istorijski zapis tog trenutka razvoja; samo
  operativni dokumenti koji bi se stvarno koristili za setup
  (`README.md`, `DATABASE_SETUP.md`, `MIGRATION_INSTRUCTIONS.md`) su
  ažurirani/označeni.
