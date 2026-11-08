-- P0 (`17` §13 korak 1): jedan dnevni zapis po kući i lokalnom danu.
-- Isključivo dopunjuje šemu: nijedna postojeća tabela se ne mijenja i nijedan
-- red se ne backfiluje. Stari `Recommendation` redovi ostaju netaknuti.
--
-- Rollback: DROP TABLE "DailyRecord"; DROP TYPE "FlowSetSource";
-- (`Recommendation` se ne dira, pa rollback ne gubi prikaz koji klijenti čitaju.)

CREATE TYPE "FlowSetSource" AS ENUM ('USER', 'CARRIED', 'UNKNOWN');

CREATE TABLE "DailyRecord" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "homeProfileId" INTEGER NOT NULL,
  "localDate" VARCHAR(10) NOT NULL,
  "proposedFlowTemp" DOUBLE PRECISION,
  "proposedAt" TIMESTAMP(3),
  "seasonMode" "SeasonMode",
  "skipReason" TEXT,
  "flowSetC" DOUBLE PRECISION,
  "flowSetSince" TIMESTAMP(3),
  "flowSetSource" "FlowSetSource",
  "flowSetChangedDuringDay" BOOLEAN NOT NULL DEFAULT false,
  "nightMinC" DOUBLE PRECISION,
  "dayMeanC" DOUBLE PRECISION,
  "dayMaxC" DOUBLE PRECISION,
  "degreeHours" DOUBLE PRECISION,
  "modelVersion" TEXT,
  "slopeS" DOUBLE PRECISION,
  "slopeCi" DOUBLE PRECISION,
  "params" JSONB,
  "cycles" INTEGER,
  "medianCycleMin" DOUBLE PRECISION,
  "dutyPercent" DOUBLE PRECISION,
  "overshootC" DOUBLE PRECISION,
  "comfortOk" BOOLEAN,
  "undershootC" DOUBLE PRECISION,
  "gasM3" DOUBLE PRECISION,
  "degreeDays" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyRecord_pkey" PRIMARY KEY ("id")
);

-- Jedan dan, jedan red. Ovo je istovremeno i garancija idempotentnosti
-- pisca: drugi pokušaj istog dana pada na ovaj indeks i tretira se kao "već
-- postoji", a ne kao greška.
CREATE UNIQUE INDEX "DailyRecord_homeProfileId_localDate_key" ON "DailyRecord"("homeProfileId", "localDate");
CREATE INDEX "DailyRecord_userId_localDate_idx" ON "DailyRecord"("userId", "localDate");

ALTER TABLE "DailyRecord" ADD CONSTRAINT "DailyRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyRecord" ADD CONSTRAINT "DailyRecord_homeProfileId_fkey" FOREIGN KEY ("homeProfileId") REFERENCES "HomeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
