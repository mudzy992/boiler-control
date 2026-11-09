-- Odluka vlasnika 2026-11-08 (`19` §2): najviša polazna nije fiksni broj nego
-- ono što sistem dozvoljava — pita se pri kreiranju profila i kad se odabere
-- podno grijanje.
--
-- Aditivno i nullable: `NULL` znači "nije poznato", pa se koristi granica
-- kotla (55 °C). Kolona nikad ne širi raspon 30–55, samo ga sužava.
--
-- Rollback: ALTER TABLE "HomeProfile" DROP COLUMN "maxHeatingFlowC";

ALTER TABLE "HomeProfile" ADD COLUMN "maxHeatingFlowC" DOUBLE PRECISION;
