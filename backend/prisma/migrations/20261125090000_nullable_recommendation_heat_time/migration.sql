-- Expected heat-up time is optional learned metadata, not a measured duration.
-- Older writers stored 0 when no estimate existed; preserve those rows as
-- unknown instead of presenting the placeholder as a real estimate.
ALTER TABLE "Recommendation"
  ALTER COLUMN "expectedHeatTimeMin" DROP NOT NULL;

UPDATE "Recommendation"
SET "expectedHeatTimeMin" = NULL
WHERE "expectedHeatTimeMin" <= 0;
