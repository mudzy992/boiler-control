-- F13 (odluka vlasnika 2026-11-08): donja granica polazne po domu.
--
-- Zašto: motor (kriva + offseti) računa i do 46 °C, a unos je bio zaključan na
-- 48 (`SetCurrentTempDto`, `BoilerService`). Korisnik je dobijao predlog koji
-- fizički može upisati na kotlu, ali ga aplikacija odbija — pa je predlog
-- ostajao neupotrebljiv.
--
-- Zašto po domu, a ne globalno: donja granica je fizička, ne bezbjednosna —
-- zavisi od kotla i od toga grije li se radijatorima (traži višu polaznu) ili
-- podom (niža je normalna). Jedan broj za sve domove bio bi pogrešan za oba
-- slučaja.
--
-- Aditivno i nullable: postojeći domovi ostaju `NULL`, što znači „važi granica
-- sistema" (48) — ništa se ne mijenja dok vlasnik ne podesi.
--
-- Rollback: ALTER TABLE "HomeProfile" DROP COLUMN "minHeatingFlowC";
-- Ostale kolone i podaci ostaju netaknuti.

ALTER TABLE "HomeProfile" ADD COLUMN "minHeatingFlowC" DOUBLE PRECISION;
