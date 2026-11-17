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
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeviceKind') THEN
    CREATE TYPE "DeviceKind" AS ENUM ('PHONE', 'TV');
  END IF;
END $$;

-- 2) Kolona. `DEFAULT 'PHONE'` je ono što čini migraciju bezbjednom za
--    postojeće redove: sva dosadašnja izdanja su bila mobilna, pa se ne mogu
--    "preseliti" u TV niti ostati bez platforme.
ALTER TABLE "AppRelease"
  ADD COLUMN IF NOT EXISTS "platform" "DeviceKind" NOT NULL DEFAULT 'PHONE';

-- 3) Skini staru jedinstvenost samo po `version`.
--
--    Ime constrainta nije pretpostavka: `@unique` na koloni u Prismi daje
--    `<Tabela>_<kolona>_key`, ali ako je baza pravljena drugačije, ime bi bilo
--    drugo i `DROP` bi pao. Zato tražimo po kolonama, a ne po imenu.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'AppRelease'
    AND c.contype = 'u'
    AND (
      SELECT array_agg(a.attname ORDER BY a.attname)
      FROM unnest(c.conkey) AS k(attnum)
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    ) = ARRAY['version']
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "AppRelease" DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- 4) Novi jedinstveni ključ: para (platforma, verzija).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AppRelease_platform_version_key'
  ) THEN
    ALTER TABLE "AppRelease"
      ADD CONSTRAINT "AppRelease_platform_version_key"
      UNIQUE ("platform", "version");
  END IF;
END $$;

-- 5) Indeksi koje upiti stvarno koriste:
--    - `latestPublished(platform)` filtrira `platform` + `isPublished`;
--    - postojeći `@@index([publishedAt])` ostaje (sortiranje liste).
CREATE INDEX IF NOT EXISTS "AppRelease_platform_isPublished_idx"
  ON "AppRelease" ("platform", "isPublished");
