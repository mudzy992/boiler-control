-- P4 (`17` §13 korak 5): mjerni podaci dana.
--
-- Dopunjava `DailyRecord` poljima koja se NE mogu znati u 06:00: koliko je
-- ciklusa bilo, koliko je soba podbacila (posebno noću), i koja je stvarna
-- histereza termostata izmjerena iz serije. Aditivno i nullable: stari redovi
-- ostaju kakvi su, a `outcomeAt IS NULL` znači "još nije obračunat".
--
-- Rollback: ALTER TABLE "DailyRecord" DROP COLUMN ... (sedam kolona);
-- predlozi i serija ostaju netaknuti.

ALTER TABLE "DailyRecord" ADD COLUMN "nightUndershootC" DOUBLE PRECISION;
ALTER TABLE "DailyRecord" ADD COLUMN "nightMinOutdoorMeasuredC" DOUBLE PRECISION;
ALTER TABLE "DailyRecord" ADD COLUMN "nightFlowC" DOUBLE PRECISION;
ALTER TABLE "DailyRecord" ADD COLUMN "hysteresisK" DOUBLE PRECISION;
ALTER TABLE "DailyRecord" ADD COLUMN "hysteresisAsymmetryK" DOUBLE PRECISION;
ALTER TABLE "DailyRecord" ADD COLUMN "outcomeAt" TIMESTAMP(3);
ALTER TABLE "DailyRecord" ADD COLUMN "outcomeVersion" TEXT;
