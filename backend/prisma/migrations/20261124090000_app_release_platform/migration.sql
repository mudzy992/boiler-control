-- F17: izdanja razdvojena po platformi (mobilni / TV).
--
-- Zašto: `AppRelease.version` je bio `@unique` na cijeloj tabeli, pa bi TV APK
-- iste verzije kao mobilni (oba `1.0.0` — sasvim normalno) udario u
-- "Unique constraint failed". Gore od pada: `latestPublished()` bi TV-u mogao
-- vratiti mobilni release, pa bi TV nudio update na pogrešnu aplikaciju.
--
-- Poslije ove migracije jedinstven je PAR `(platform, version)`.
--
-- Idempotentno: `IF NOT EXISTS` svuda, pa se može pokrenuti na bazi koja je
-- djelimično migrirana.

-- 1) Enum `DeviceKind` već postoji (F16, `UserDevice.kind`). Provjeravamo da
--    nije slučajno obrisan, jer `platform` na njega referencira.
DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeviceKind') THEN
    CREATE TYPE "DeviceKind" AS ENUM ('PHONE', 'TV');
  END IF;
END
$mig$;

-- 2) Kolona. `DEFAULT 'PHONE'` je ono što čini migraciju bezbjednom za
--    postojeće redove: sva dosadašnja izdanja su bila mobilna, pa se ne mogu
--    "preseliti" u TV niti ostati bez platforme.
ALTER TABLE "AppRelease"
  ADD COLUMN IF NOT EXISTS "platform" "DeviceKind" NOT NULL DEFAULT 'PHONE';

-- 3) Skini staru jedinstvenost samo po `version`.
--
-- **Izmjereno, ne pretpostavljeno.** Prva verzija ove migracije je tražila
-- `pg_constraint` sa `contype = 'u'` nad kolonom `version`. Takav constraint
-- NE POSTOJI: Prisma `@unique` na koloni generiše **`CREATE UNIQUE INDEX`**, a
-- ne tabelarni constraint (v. `20261120100000_app_release/migration.sql`,
-- l. 39: `CREATE UNIQUE INDEX "AppRelease_version_key" …`). Zato je blok tiho
-- prošao ništa ne uradivši — a onda je korak 4 pao jer `(platform, version)`
-- nije mogao nastati dok je `version` sam jedinstven.
--
-- Brisanje po **imenu iz stvarne migracije**, ne po pretpostavci: ime je dio
-- onoga što je Prisma generisala i može se pročitati iz repoa.
DROP INDEX IF EXISTS "AppRelease_version_key";

-- Ako je baza ipak dobila tabelarni constraint (ručna izmjena), skidamo i njega.
-- Provjera ide preko `pg_constraint`, a ne `pg_indexes`, jer su to dva različita
-- objekta u Postgresu i jedan ne pokriva drugi.
DO $mig$
DECLARE
  constraint_name text;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'AppRelease'
    AND c.contype = 'u'
    AND array_length(c.conkey, 1) = 1
    AND c.conkey[1] = (
      SELECT a.attnum FROM pg_attribute a
      WHERE a.attrelid = t.oid AND a.attname = 'version'
    )
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "AppRelease" DROP CONSTRAINT %I', constraint_name);
  END IF;
END
$mig$;

-- 4) Novi jedinstveni ključ: para (platforma, verzija).
--
-- **Index, ne constraint** — isto kako Prisma generiše `@@unique`
-- (`CREATE UNIQUE INDEX "ThermostatProgram_deviceId_dayType_orderIndex_key" …`,
-- v. `2026.../migration.sql` l. 170). Da je ovdje constraint, `prisma migrate
-- diff` bi prijavio razliku između šeme i baze: Prisma tabelarne constraint-e
-- ne prepoznaje kao `@@unique`.
CREATE UNIQUE INDEX IF NOT EXISTS "AppRelease_platform_version_key"
  ON "AppRelease" ("platform", "version");

-- 5) Indeksi koje upiti stvarno koriste:
--    - `latestPublished(platform)` filtrira `platform` + `isPublished`;
--    - postojeći `@@index([publishedAt])` ostaje (sortiranje liste).
CREATE INDEX IF NOT EXISTS "AppRelease_platform_isPublished_idx"
  ON "AppRelease" ("platform", "isPublished");
