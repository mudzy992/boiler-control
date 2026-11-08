-- P1 (`17` §13 korak 2): vremenska serija stanja uređaja, jedan red po
-- petominutnom bucketu. Aditivno: nijedna postojeća tabela se ne mijenja i
-- nijedan red se ne backfiluje — serija počinje od prvog ciklusa poslije
-- primjene.
--
-- Rollback: DROP TABLE "ThermostatObservation"; DROP TYPE "ObservationSource";
-- (`ThermostatDevice.roomCurrentTemp` i `HeatingEvent` ostaju netaknuti, pa
-- rollback ne gubi ništa što klijenti čitaju.)

CREATE TYPE "ObservationSource" AS ENUM ('TUYA', 'MANUAL');

CREATE TABLE "ThermostatObservation" (
  "id" SERIAL NOT NULL,
  "deviceId" INTEGER NOT NULL,
  "homeProfileId" INTEGER NOT NULL,
  "at" TIMESTAMP(3) NOT NULL,
  "roomTempC" DOUBLE PRECISION,
  "targetTempC" DOUBLE PRECISION,
  "isHeating" BOOLEAN NOT NULL,
  "outdoorTempC" DOUBLE PRECISION,
  "flowSetC" DOUBLE PRECISION,
  "source" "ObservationSource" NOT NULL DEFAULT 'TUYA',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ThermostatObservation_pkey" PRIMARY KEY ("id")
);

-- Jedan uređaj, jedan bucket. Ponovni upis istog bucketa pada ovdje i tretira
-- se kao "već postoji" — serija se ne može udvostručiti restartom procesa.
CREATE UNIQUE INDEX "ThermostatObservation_deviceId_at_key" ON "ThermostatObservation"("deviceId", "at");
-- Učenje čita po kući i vremenskom rasponu.
CREATE INDEX "ThermostatObservation_homeProfileId_at_idx" ON "ThermostatObservation"("homeProfileId", "at");

ALTER TABLE "ThermostatObservation" ADD CONSTRAINT "ThermostatObservation_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "ThermostatDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
