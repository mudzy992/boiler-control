-- F16 faza 3: push token TV-a dolazi kroz uparivanje.
--
-- Zašto: TV aplikacija po pravilu radi samo GET, izuzetak je uparivanje. Da bi
-- dobijala notifikacije morala bi registrovati Expo push token — a to je
-- `POST /api/notifications/register-token`, dakle drugi upis koji TV ne smije.
-- Zato TV šalje token uz zahtjev za kod (`POST /api/tv-pairing/sessions`), a
-- server ga upisuje u `UserDevice` tek kad telefon odobri.
--
-- Idempotentno: `ADD COLUMN IF NOT EXISTS` i `DO $$` blok za constraint, pa se
-- migracija može pokrenuti na bazi koja je već djelimično migrirana.

ALTER TABLE "TvPairingSession"
  ADD COLUMN IF NOT EXISTS "tvPushToken" TEXT;

-- Token mora biti upotrebljiv Expo token ili NULL. Provjera je u bazi, ne samo
-- u DTO-u: TV ruta je javna (`@Public()`), pa je ovo jedina odbrana koja važi i
-- ako se DTO validacija ikad zaobiđe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TvPairingSession_tvPushToken_shape'
  ) THEN
    ALTER TABLE "TvPairingSession"
      ADD CONSTRAINT "TvPairingSession_tvPushToken_shape"
      CHECK (
        "tvPushToken" IS NULL
        OR "tvPushToken" ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'
      );
  END IF;
END $$;

-- Indeks nije potreban: token se čita po `codeHash` (već `@unique`), nikad po
-- samom tokenu.
