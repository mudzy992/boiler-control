-- `u_day` — dnevni član dobitaka (sunce, gosti, kuhanje), `17` §13 korak 7.
--
-- Aditivna migracija: tri nullable kolone. Bez `u_day` ponašanje ostaje isto kao
-- prije (kontroler ne oduzima ništa), pa nema backfilla i nema prekida rada.

ALTER TABLE "HomeModel"
  ADD COLUMN "uDayC" DOUBLE PRECISION,
  ADD COLUMN "uDayDays" INTEGER,
  ADD COLUMN "uDayAt" TIMESTAMP(3);
