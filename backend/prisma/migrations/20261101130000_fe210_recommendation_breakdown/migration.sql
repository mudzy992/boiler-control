-- FE2-10: additive explanation snapshot for new recommendations.
-- This does not change the recommendation formula or existing rows.
-- Rollback: ALTER TABLE "Recommendation" DROP COLUMN IF EXISTS "breakdown";

ALTER TABLE "Recommendation" ADD COLUMN "breakdown" JSONB;
