-- AlterTable
ALTER TABLE `HomeProfile` ADD COLUMN `boilerModel` VARCHAR(191) NULL,
    ADD COLUMN `hasFloorHeating` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `homeName` VARCHAR(191) NULL,
    ADD COLUMN `numberOfResidents` INTEGER NULL,
    ADD COLUMN `preferredScheduleNotes` VARCHAR(191) NULL,
    ADD COLUMN `targetDayTemp` DOUBLE NULL,
    ADD COLUMN `targetMorningTemp` DOUBLE NULL,
    ADD COLUMN `targetNightTemp` DOUBLE NULL;
