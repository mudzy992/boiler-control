-- PERF-1: composite index for the polling last-event and minute-slot queries.
-- Synthetic CI benchmark accepted this candidate; the weather candidate was
-- deferred because the normal small-cache workload did not meet the threshold.
-- Existing single-column deviceId index is intentionally retained.
-- Rollback: DROP INDEX IF EXISTS "HeatingEvent_deviceId_timestampStart_idx";

CREATE INDEX "HeatingEvent_deviceId_timestampStart_idx"
    ON "HeatingEvent"("deviceId", "timestampStart" DESC);
