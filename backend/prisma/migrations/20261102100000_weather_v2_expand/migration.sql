-- FEAT-1 / REL-1 / MO2-17: additive weather v2 location and last-good cache.
-- Existing text locations and WeatherCache rows are not changed or backfilled.
-- Rollback is configuration/deployment rollback; keep these new structures during
-- the rollback window so confirmed locations and last-good data remain available.

ALTER TABLE "HomeProfile" ADD COLUMN "weatherLatitude" DOUBLE PRECISION;
ALTER TABLE "HomeProfile" ADD COLUMN "weatherLongitude" DOUBLE PRECISION;
ALTER TABLE "HomeProfile" ADD COLUMN "weatherTimezone" TEXT;
ALTER TABLE "HomeProfile" ADD COLUMN "weatherLocationProvider" TEXT;
ALTER TABLE "HomeProfile" ADD COLUMN "weatherLocationProviderId" TEXT;
ALTER TABLE "HomeProfile" ADD COLUMN "weatherLocationLabel" TEXT;
ALTER TABLE "HomeProfile" ADD COLUMN "weatherLocationName" TEXT;
ALTER TABLE "HomeProfile" ADD COLUMN "weatherLocationAdmin1" TEXT;
ALTER TABLE "HomeProfile" ADD COLUMN "weatherLocationCountry" TEXT;
ALTER TABLE "HomeProfile" ADD COLUMN "weatherLocationCountryCode" TEXT;
ALTER TABLE "HomeProfile" ADD COLUMN "weatherLocationConfirmedAt" TIMESTAMP(3);

CREATE TABLE "WeatherV2Cache" (
  "id" SERIAL NOT NULL,
  "cacheKey" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WeatherV2Cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeatherV2Cache_cacheKey_key" ON "WeatherV2Cache"("cacheKey");
CREATE INDEX "WeatherV2Cache_fetchedAt_idx" ON "WeatherV2Cache"("fetchedAt");
