-- Odluka vlasnika 2026-11-08 (`19` §1): model bojlera se bira iz kataloga,
-- a ne upisuje kao slobodan tekst.
--
-- `boilerCatalogId` nosi `id` zapisa iz `backend/src/modules/BoilerCatalog/catalog.json`.
-- Iz njega se čita sigurnosni bit "jesu li grijanje i PTV odvojena podešavanja";
-- bez potvrđenog modela aplikacija NE savjetuje snižavanje polazne.
--
-- `boilerModel` (slobodan tekst) ostaje samo kao istorijski podatak; nijedna
-- odluka se na njega ne oslanja. Ne briše se da stari podaci ne nestanu.
--
-- Aditivno i nullable. Rollback:
--   ALTER TABLE "HomeProfile" DROP COLUMN "boilerCatalogId";

ALTER TABLE "HomeProfile" ADD COLUMN "boilerCatalogId" TEXT;
