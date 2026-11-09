-- P5 (`17` §13 korak 6, shadow dio): odluka kontrolera se računa uz predlog,
-- ali ga NE mijenja. Ove kolone postoje da se odluka može uporediti sa onim
-- što je korisnik stvarno dobio prije nego što postane predlog.
--
-- `DailyRecord`: shadow polazna, akcija, razlozi i vrijeme računanja.
-- `HomeModel`: naučena granica iz kratkih ciklusa (pamti se, inače bi se
-- polazna vraćala na istu grešku svaki drugi dan).
--
-- Aditivno i nullable: stari redovi ostaju kakvi su, `shadowAt IS NULL` znači
-- "nije računato". Rollback: DROP COLUMN za sedam kolona; predlozi, ishodi i
-- model ostaju netaknuti.

ALTER TABLE "DailyRecord" ADD COLUMN "shadowFlowC" DOUBLE PRECISION;
ALTER TABLE "DailyRecord" ADD COLUMN "shadowAction" TEXT;
ALTER TABLE "DailyRecord" ADD COLUMN "shadowReasons" TEXT;
ALTER TABLE "DailyRecord" ADD COLUMN "shadowAt" TIMESTAMP(3);
ALTER TABLE "DailyRecord" ADD COLUMN "shadowVersion" TEXT;

ALTER TABLE "HomeModel" ADD COLUMN "shortCycleFloorC" DOUBLE PRECISION;
ALTER TABLE "HomeModel" ADD COLUMN "shortCycleFloorAt" TIMESTAMP(3);
