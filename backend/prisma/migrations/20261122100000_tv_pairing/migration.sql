-- F16 (2026-11-17): uparivanje Android TV-a QR kodom.
--
-- Dvije stvari, obje aditivne — nijedan postojeći red se ne mijenja:
--
-- 1. `UserDevice.kind` razdvaja telefon od TV-a. Bez njega TV i telefon dijele
--    isti spisak tokena, pa se notifikacija namijenjena TV-u ne može
--    razlikovati od one za telefon. Zadana vrijednost `PHONE` je postojeće
--    ponašanje, pa migracija ne mijenja ni jedan uređaj.
--
-- 2. `TvPairingSession` nosi stanje jednokratnog koda.
--
--    Zašto HASH, a ne kod: isto pravilo kao `RefreshToken`. Baza koja procuri
--    ne smije sadržavati upotrebljive kodove. Kod se prikazuje na TV-u, pa je
--    i najmanja mogućnost čitanja iz baze dovoljna za preuzimanje sesije.
--
--    Zašto `codeHint` (4 znaka): lista uparenih uređaja mora korisniku reći
--    KOJI je uređaj koji. Prva verzija je čuvala `shortCode` — cijeli kod u
--    čistom obliku — i test je to uhvatio. Četiri znaka od osam nisu dovoljna
--    za prijavu, a dovoljna su za prepoznavanje.
--
--    Zašto `status` enum: `PENDING → APPROVED → CLAIMED` je ono što garantuje
--    jednokratnost. Preuzimanje ide preko `UPDATE ... WHERE status='APPROVED'`,
--    pa dva paralelna zahtjeva ne mogu oba proći.

-- `DeviceKind`
DO $$ BEGIN
  CREATE TYPE "DeviceKind" AS ENUM ('PHONE', 'TV');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- `TvPairingStatus`
DO $$ BEGIN
  CREATE TYPE "TvPairingStatus" AS ENUM ('PENDING', 'APPROVED', 'CLAIMED', 'EXPIRED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- `UserDevice.kind` — zadano `PHONE`, pa postojeći redovi ostaju kakvi su bili.
ALTER TABLE "UserDevice"
  ADD COLUMN IF NOT EXISTS "kind" "DeviceKind" NOT NULL DEFAULT 'PHONE';

-- `UserDevice.label` — ime koje korisnik vidi (npr. „TV u dnevnoj").
ALTER TABLE "UserDevice"
  ADD COLUMN IF NOT EXISTS "label" TEXT;

-- `TvPairingSession`
CREATE TABLE IF NOT EXISTS "TvPairingSession" (
  "id"               SERIAL PRIMARY KEY,
  "codeHash"         TEXT NOT NULL,
  "codeHint"         TEXT NOT NULL,
  "status"           "TvPairingStatus" NOT NULL DEFAULT 'PENDING',
  "userId"           INTEGER,
  "accessToken"      TEXT,
  "refreshToken"     TEXT,
  "pollCount"        INTEGER NOT NULL DEFAULT 0,
  "expiresAt"        TIMESTAMP(3) NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt"        TIMESTAMP(3),
  "approvedByDevice" TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS "TvPairingSession_codeHash_key"
  ON "TvPairingSession" ("codeHash");

CREATE INDEX IF NOT EXISTS "TvPairingSession_expiresAt_idx"
  ON "TvPairingSession" ("expiresAt");

CREATE INDEX IF NOT EXISTS "TvPairingSession_status_idx"
  ON "TvPairingSession" ("status");
