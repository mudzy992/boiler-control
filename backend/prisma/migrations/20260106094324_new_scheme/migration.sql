/*
  Warnings:

  - You are about to drop the column `deviceId` on the `HeatingEvent` table. All the data in the column will be lost.
  - You are about to drop the column `hvacAction` on the `HeatingEvent` table. All the data in the column will be lost.
  - You are about to drop the column `timestampEnd` on the `HeatingEvent` table. All the data in the column will be lost.
  - You are about to drop the column `timestampStart` on the `HeatingEvent` table. All the data in the column will be lost.
  - You are about to alter the column `source` on the `HeatingEvent` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(7))`.
  - You are about to drop the column `heatingType` on the `HomeProfile` table. All the data in the column will be lost.
  - You are about to alter the column `insulationType` on the `HomeProfile` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(0))`.
  - You are about to alter the column `windowType` on the `HomeProfile` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(1))`.
  - You are about to drop the column `date` on the `Recommendation` table. All the data in the column will be lost.
  - You are about to drop the column `deviceId` on the `ThermostatDevice` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `ThermostatDevice` table. All the data in the column will be lost.
  - You are about to drop the column `vendor` on the `ThermostatDevice` table. All the data in the column will be lost.
  - You are about to drop the column `cloud` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `condition_text` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `feelslike` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `gust_kph` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `moon_illumination` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `moon_phase` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `moonrise` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `moonset` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `precipitation_mm` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `pressure_mb` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `snow_cm` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `sunrise` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `sunset` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `temp_avg` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `temp_max` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `temp_min` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `temperature` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `uv_index` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `wind_dir` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `wind_kph` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the `BoilerHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TuyaToken` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[integrationId,externalDeviceId]` on the table `ThermostatDevice` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `eventType` to the `HeatingEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hvacState` to the `HeatingEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `thermostatId` to the `HeatingEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `timestamp` to the `HeatingEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `heatingSystem` to the `HomeProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `externalTemp` to the `Recommendation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `homeProfileId` to the `Recommendation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `externalDeviceId` to the `ThermostatDevice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `integrationId` to the `ThermostatDevice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tempCurrent` to the `WeatherCache` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `BoilerHistory` DROP FOREIGN KEY `BoilerHistory_userId_fkey`;

-- DropForeignKey
ALTER TABLE `HeatingEvent` DROP FOREIGN KEY `HeatingEvent_deviceId_fkey`;

-- DropForeignKey
ALTER TABLE `ThermostatDevice` DROP FOREIGN KEY `ThermostatDevice_userId_fkey`;

-- DropIndex
DROP INDEX `HeatingEvent_deviceId_fkey` ON `HeatingEvent`;

-- DropIndex
DROP INDEX `ThermostatDevice_userId_fkey` ON `ThermostatDevice`;

-- AlterTable
ALTER TABLE `HeatingEvent` DROP COLUMN `deviceId`,
    DROP COLUMN `hvacAction`,
    DROP COLUMN `timestampEnd`,
    DROP COLUMN `timestampStart`,
    ADD COLUMN `eventType` ENUM('START', 'STOP', 'HEARTBEAT') NOT NULL,
    ADD COLUMN `hvacState` ENUM('HEATING', 'IDLE') NOT NULL,
    ADD COLUMN `thermostatId` INTEGER NOT NULL,
    ADD COLUMN `timestamp` DATETIME(3) NOT NULL,
    MODIFY `source` ENUM('DEVICE', 'SCHEDULE', 'AI', 'USER') NOT NULL;

-- AlterTable
ALTER TABLE `HomeProfile` DROP COLUMN `heatingType`,
    ADD COLUMN `heatingSystem` ENUM('RADIATORS', 'FLOOR', 'COMBINED') NOT NULL,
    MODIFY `insulationType` ENUM('NONE', 'POOR', 'AVERAGE', 'GOOD', 'EXCELLENT') NOT NULL,
    MODIFY `windowType` ENUM('SINGLE_GLASS', 'DOUBLE_GLASS', 'TRIPLE_GLASS') NOT NULL;

-- AlterTable
ALTER TABLE `Recommendation` DROP COLUMN `date`,
    ADD COLUMN `externalTemp` DOUBLE NOT NULL,
    ADD COLUMN `homeProfileId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `ThermostatDevice` DROP COLUMN `deviceId`,
    DROP COLUMN `userId`,
    DROP COLUMN `vendor`,
    ADD COLUMN `externalDeviceId` VARCHAR(191) NOT NULL,
    ADD COLUMN `integrationId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `WeatherCache` DROP COLUMN `cloud`,
    DROP COLUMN `condition_text`,
    DROP COLUMN `feelslike`,
    DROP COLUMN `gust_kph`,
    DROP COLUMN `moon_illumination`,
    DROP COLUMN `moon_phase`,
    DROP COLUMN `moonrise`,
    DROP COLUMN `moonset`,
    DROP COLUMN `precipitation_mm`,
    DROP COLUMN `pressure_mb`,
    DROP COLUMN `snow_cm`,
    DROP COLUMN `sunrise`,
    DROP COLUMN `sunset`,
    DROP COLUMN `temp_avg`,
    DROP COLUMN `temp_max`,
    DROP COLUMN `temp_min`,
    DROP COLUMN `temperature`,
    DROP COLUMN `uv_index`,
    DROP COLUMN `wind_dir`,
    DROP COLUMN `wind_kph`,
    ADD COLUMN `condition` VARCHAR(191) NULL,
    ADD COLUMN `pressureMb` DOUBLE NULL,
    ADD COLUMN `tempAvg` DOUBLE NULL,
    ADD COLUMN `tempCurrent` DOUBLE NOT NULL,
    ADD COLUMN `tempMax` DOUBLE NULL,
    ADD COLUMN `tempMin` DOUBLE NULL,
    ADD COLUMN `windKph` DOUBLE NULL;

-- DropTable
DROP TABLE `BoilerHistory`;

-- DropTable
DROP TABLE `TuyaToken`;

-- CreateTable
CREATE TABLE `IntegrationAccount` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `vendor` ENUM('TUYA', 'EWELINK', 'HOME_ASSISTANT', 'GENERIC') NOT NULL,
    `externalAccountId` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NULL,
    `accessToken` VARCHAR(191) NULL,
    `refreshToken` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `IntegrationAccount_userId_idx`(`userId`),
    UNIQUE INDEX `IntegrationAccount_vendor_externalAccountId_key`(`vendor`, `externalAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BoilerEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `recommendationId` INTEGER NULL,
    `flowTempActual` DOUBLE NULL,
    `heatingStart` DATETIME(3) NULL,
    `heatingEnd` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BoilerEvent_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `HeatingEvent_thermostatId_timestamp_idx` ON `HeatingEvent`(`thermostatId`, `timestamp`);

-- CreateIndex
CREATE UNIQUE INDEX `ThermostatDevice_integrationId_externalDeviceId_key` ON `ThermostatDevice`(`integrationId`, `externalDeviceId`);

-- CreateIndex
CREATE INDEX `WeatherCache_city_fetchedAt_idx` ON `WeatherCache`(`city`, `fetchedAt`);

-- AddForeignKey
ALTER TABLE `IntegrationAccount` ADD CONSTRAINT `IntegrationAccount_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ThermostatDevice` ADD CONSTRAINT `ThermostatDevice_integrationId_fkey` FOREIGN KEY (`integrationId`) REFERENCES `IntegrationAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HeatingEvent` ADD CONSTRAINT `HeatingEvent_thermostatId_fkey` FOREIGN KEY (`thermostatId`) REFERENCES `ThermostatDevice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Recommendation` ADD CONSTRAINT `Recommendation_homeProfileId_fkey` FOREIGN KEY (`homeProfileId`) REFERENCES `HomeProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BoilerEvent` ADD CONSTRAINT `BoilerEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BoilerEvent` ADD CONSTRAINT `BoilerEvent_recommendationId_fkey` FOREIGN KEY (`recommendationId`) REFERENCES `Recommendation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `HomeProfile` RENAME INDEX `HomeProfile_userId_fkey` TO `HomeProfile_userId_idx`;

-- RenameIndex
ALTER TABLE `ThermostatDevice` RENAME INDEX `ThermostatDevice_homeProfileId_fkey` TO `ThermostatDevice_homeProfileId_idx`;
