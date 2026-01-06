/*
  Warnings:

  - Added the required column `homeProfileId` to the `ThermostatDevice` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `HomeProfile` ADD COLUMN `learningConfidence` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `learningOffset` DOUBLE NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `ThermostatDevice` ADD COLUMN `homeProfileId` INTEGER NOT NULL,
    ADD COLUMN `mode` ENUM('MANUAL', 'PROGRAM', 'OFF') NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE `HeatingIntervalLearning` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `homeProfileId` INTEGER NOT NULL,
    `intervalKey` VARCHAR(191) NOT NULL,
    `avgReachTimeMin` DOUBLE NOT NULL,
    `avgOvershoot` DOUBLE NOT NULL,
    `offset` DOUBLE NOT NULL DEFAULT 0,
    `confidence` DOUBLE NOT NULL DEFAULT 0,
    `samples` INTEGER NOT NULL DEFAULT 0,
    `lastUpdated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `HeatingIntervalLearning_homeProfileId_intervalKey_key`(`homeProfileId`, `intervalKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ThermostatDevice` ADD CONSTRAINT `ThermostatDevice_homeProfileId_fkey` FOREIGN KEY (`homeProfileId`) REFERENCES `HomeProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HeatingIntervalLearning` ADD CONSTRAINT `HeatingIntervalLearning_homeProfileId_fkey` FOREIGN KEY (`homeProfileId`) REFERENCES `HomeProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
