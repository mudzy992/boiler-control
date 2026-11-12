-- F5.3 (2026-11-12): `confidence` učenja intervala prestaje biti konstanta.
--
-- Zašto kolona: stara formula je bila pokretni prosjek sa fiksnim prirastom
-- 0,1, čija je fiksna tačka 0,1 — pa je `confidence` poslije 320 uzoraka još
-- bio 0,1000. Novi izraz ima dva člana: koliko uzoraka ima (iz `samples`) i
-- koliko se slažu. Drugi član traži **izmjereno odstupanje**, a to mjesto u
-- šemi nije postojalo. Bez njega bi `confidence` ponovo bio funkcija samo
-- broja uzoraka — dakle ponovo monotona, samo drugom krivom.
--
-- Aditivno i nullable: postojeći redovi ostaju `NULL`, što novi izraz tumači
-- kao „nema izmjerenog slaganja" ⇒ `confidence = 0`, a ne kao savršeno
-- slaganje. To je namjerno: bolje priznati da model nije provjeren nego
-- naslijediti staru tihu konstantu.
--
-- Rollback: ALTER TABLE "HeatingIntervalLearning" DROP COLUMN "residualStd";

ALTER TABLE "HeatingIntervalLearning" ADD COLUMN "residualStd" DOUBLE PRECISION;

-- F5.4 (2026-11-12): premašivanje se uči jednom, percentilom.
--
-- Zašto kolona: `avgOvershoot` je prosjek istog mjerenja koje već ulazi u
-- `offset`, pa je strategija isti broj sabirala 1,5 puta (`offset +
-- avgOvershoot·0,5`). Prosjek je usto pogrešna mjera: dva dana od 5 K daju
-- prosjek 0,46 K na 25 mirnih dana. 90. percentil odgovara na pitanje „koliko
-- visoko premašuje kad stvarno premašuje".
--
-- `avgOvershoot` se NE briše: čita ga API ugovor i dashboard (istorija i
-- prikaz). Samo prestaje ulaziti u odluku.
--
-- Aditivno i nullable: `NULL` = red prije F5.4 ⇒ korekcija se ne primjenjuje
-- (bolje ne mijenjati polaznu nego primijeniti staru vrijednost drugi put).
--
-- Rollback: ALTER TABLE "HeatingIntervalLearning" DROP COLUMN "p90OvershootC";

ALTER TABLE "HeatingIntervalLearning" ADD COLUMN "p90OvershootC" DOUBLE PRECISION;
