-- Istraživanje u shadow periodu (`17` §8.5).
--
-- Aditivna migracija. `shadowExplorationDirection` pamti smjer jučerašnjeg
-- istraživanja, jer pravilo „nikad dva dana zaredom u istu stranu" bez toga ne
-- može da se provjeri.

ALTER TABLE "DailyRecord"
  ADD COLUMN "shadowExploration" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "shadowExplorationDirection" TEXT;
