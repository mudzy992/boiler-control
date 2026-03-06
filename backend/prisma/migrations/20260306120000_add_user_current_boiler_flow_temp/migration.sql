-- Add canonical user-level boiler flow temp state
ALTER TABLE `User`
  ADD COLUMN `currentBoilerFlowTemp` DOUBLE NULL,
  ADD COLUMN `currentBoilerFlowTempSetAt` DATETIME(3) NULL;

-- Backfill canonical state from each user's latest boiler history row
UPDATE `User` u
JOIN (
  SELECT
    b.userId,
    COALESCE(b.actualTemp, b.suggestedTemp) AS carryTemp,
    b.createdAt AS carrySetAt
  FROM `BoilerHistory` b
  JOIN (
    SELECT userId, MAX(createdAt) AS latestCreatedAt
    FROM `BoilerHistory`
    GROUP BY userId
  ) latest
    ON latest.userId = b.userId
   AND latest.latestCreatedAt = b.createdAt
) bh
  ON bh.userId = u.id
SET
  u.currentBoilerFlowTemp = bh.carryTemp,
  u.currentBoilerFlowTempSetAt = bh.carrySetAt;
