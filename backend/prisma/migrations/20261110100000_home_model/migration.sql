-- P2/P3 (`17` §13 koraci 3 i 4): model kuće — nagib krive `s = b/a` i dnevni
-- član `c`, izmjereni iz dnevne bilanse energije nad serijom od 5 min.
--
-- Aditivno: nova tabela, jedan red po kući. Nijedna postojeća tabela se ne
-- mijenja i nijedan podatak se ne prepisuje.
--
-- Rollback: DROP TABLE "HomeModel"; DROP TYPE "HomeModelState";
-- (predlozi i serija ostaju netaknuti — model je izvedeni podatak, ne izvor.)

CREATE TYPE "HomeModelState" AS ENUM ('COLD_START', 'TRACKING', 'DEGRADED');

CREATE TABLE "HomeModel" (
  "id" SERIAL NOT NULL,
  "homeProfileId" INTEGER NOT NULL,
  "slopeS" DOUBLE PRECISION,
  "slopeCiLow" DOUBLE PRECISION,
  "slopeCiHigh" DOUBLE PRECISION,
  "internalGainC" DOUBLE PRECISION,
  "aPerHour" DOUBLE PRECISION,
  "bPerHour" DOUBLE PRECISION,
  "days" INTEGER NOT NULL DEFAULT 0,
  "daysEvaluated" INTEGER NOT NULL DEFAULT 0,
  "residualStd" DOUBLE PRECISION,
  "sourceDeviceId" INTEGER,
  "state" "HomeModelState" NOT NULL DEFAULT 'COLD_START',
  "reason" TEXT,
  "modelVersion" TEXT NOT NULL,
  "windowDays" INTEGER NOT NULL,
  "lastAttemptAt" TIMESTAMP(3),
  "lastFitAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HomeModel_pkey" PRIMARY KEY ("id")
);

-- Jedan model po kući.
CREATE UNIQUE INDEX "HomeModel_homeProfileId_key" ON "HomeModel"("homeProfileId");

ALTER TABLE "HomeModel" ADD CONSTRAINT "HomeModel_homeProfileId_fkey" FOREIGN KEY ("homeProfileId") REFERENCES "HomeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
