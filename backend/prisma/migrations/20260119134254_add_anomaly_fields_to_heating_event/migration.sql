-- AlterTable
ALTER TABLE `HeatingEvent` ADD COLUMN `isAnomaly` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `proposedEndTime` DATETIME(3) NULL,
    ADD COLUMN `userConfimed` BOOLEAN NOT NULL DEFAULT false;
