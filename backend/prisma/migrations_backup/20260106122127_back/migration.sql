/*
  Warnings:

  - You are about to drop the column `eventType` on the `HeatingEvent` table. All the data in the column will be lost.
  - You are about to drop the column `hvacState` on the `HeatingEvent` table. All the data in the column will be lost.
  - You are about to drop the column `thermostatId` on the `HeatingEvent` table. All the data in the column will be lost.
  - You are about to drop the column `timestamp` on the `HeatingEvent` table. All the data in the column will be lost.
  - You are about to alter the column `source` on the `HeatingEvent` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(1))` to `VarChar(191)`.
  - You are about to drop the column `heatingSystem` on the `HomeProfile` table. All the data in the column will be lost.
  - You are about to alter the column `insulationType` on the `HomeProfile` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(2))` to `VarChar(191)`.
  - You are about to alter the column `windowType` on the `HomeProfile` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(6))` to `VarChar(191)`.
  - You are about to drop the column `externalTemp` on the `Recommendation` table. All the data in the column will be lost.
  - You are about to drop the column `homeProfileId` on the `Recommendation` table. All the data in the column will be lost.
  - You are about to drop the column `externalDeviceId` on the `ThermostatDevice` table. All the data in the column will be lost.
  - You are about to drop the column `integrationId` on the `ThermostatDevice` table. All the data in the column will be lost.
  - You are about to drop the column `condition` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `pressureMb` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `tempAvg` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `tempCurrent` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `tempMax` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `tempMin` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the column `windKph` on the `WeatherCache` table. All the data in the column will be lost.
  - You are about to drop the `BoilerEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `IntegrationAccount` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `deviceId` to the `HeatingEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hvacAction` to the `HeatingEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `timestampStart` to the `HeatingEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `heatingType` to the `HomeProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `date` to the `Recommendation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deviceId` to the `ThermostatDevice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `ThermostatDevice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vendor` to the `ThermostatDevice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `temperature` to the `WeatherCache` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `BoilerEvent` DROP FOREIGN KEY `BoilerEvent_recommendationId_fkey`;

-- DropForeignKey
ALTER TABLE `BoilerEvent` DROP FOREIGN KEY `BoilerEvent_userId_fkey`;

-- DropForeignKey
ALTER TABLE `HeatingEvent` DROP FOREIGN KEY `HeatingEvent_thermostatId_fkey`;

-- DropForeignKey
ALTER TABLE `IntegrationAccount` DROP FOREIGN KEY `IntegrationAccount_userId_fkey`;

-- DropForeignKey
ALTER TABLE `Recommendation` DROP FOREIGN KEY `Recommendation_homeProfileId_fkey`;

-- DropForeignKey
ALTER TABLE `ThermostatDevice` DROP FOREIGN KEY `ThermostatDevice_integrationId_fkey`;

-- DropIndex
DROP INDEX `HeatingEvent_thermostatId_timestamp_idx` ON `HeatingEvent`;

-- DropIndex
DROP INDEX `Recommendation_homeProfileId_fkey` ON `Recommendation`;

-- DropIndex
DROP INDEX `ThermostatDevice_integrationId_externalDeviceId_key` ON `ThermostatDevice`;

-- DropIndex
DROP INDEX `WeatherCache_city_fetchedAt_idx` ON `WeatherCache`;

-- AlterTable
ALTER TABLE `HeatingEvent` DROP COLUMN `eventType`,
    DROP COLUMN `hvacState`,
    DROP COLUMN `thermostatId`,
    DROP COLUMN `timestamp`,
    ADD COLUMN `deviceId` INTEGER NOT NULL,
    ADD COLUMN `hvacAction` VARCHAR(191) NOT NULL,
    ADD COLUMN `timestampEnd` DATETIME(3) NULL,
    ADD COLUMN `timestampStart` DATETIME(3) NOT NULL,
    MODIFY `source` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `HomeProfile` DROP COLUMN `heatingSystem`,
    ADD COLUMN `heatingType` VARCHAR(191) NOT NULL,
    MODIFY `insulationType` VARCHAR(191) NOT NULL,
    MODIFY `windowType` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Recommendation` DROP COLUMN `externalTemp`,
    DROP COLUMN `homeProfileId`,
    ADD COLUMN `date` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `ThermostatDevice` DROP COLUMN `externalDeviceId`,
    DROP COLUMN `integrationId`,
    ADD COLUMN `deviceId` VARCHAR(191) NOT NULL,
    ADD COLUMN `userId` INTEGER NOT NULL,
    ADD COLUMN `vendor` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `WeatherCache` DROP COLUMN `condition`,
    DROP COLUMN `pressureMb`,
    DROP COLUMN `tempAvg`,
    DROP COLUMN `tempCurrent`,
    DROP COLUMN `tempMax`,
    DROP COLUMN `tempMin`,
    DROP COLUMN `windKph`,
    ADD COLUMN `cloud` INTEGER NULL,
    ADD COLUMN `condition_text` VARCHAR(191) NULL,
    ADD COLUMN `feelslike` DOUBLE NULL,
    ADD COLUMN `gust_kph` DOUBLE NULL,
    ADD COLUMN `moon_illumination` INTEGER NULL,
    ADD COLUMN `moon_phase` VARCHAR(191) NULL,
    ADD COLUMN `moonrise` VARCHAR(191) NULL,
    ADD COLUMN `moonset` VARCHAR(191) NULL,
    ADD COLUMN `precipitation_mm` DOUBLE NULL,
    ADD COLUMN `pressure_mb` DOUBLE NULL,
    ADD COLUMN `snow_cm` DOUBLE NULL,
    ADD COLUMN `sunrise` VARCHAR(191) NULL,
    ADD COLUMN `sunset` VARCHAR(191) NULL,
    ADD COLUMN `temp_avg` DOUBLE NULL,
    ADD COLUMN `temp_max` DOUBLE NULL,
    ADD COLUMN `temp_min` DOUBLE NULL,
    ADD COLUMN `temperature` DOUBLE NOT NULL,
    ADD COLUMN `uv_index` DOUBLE NULL,
    ADD COLUMN `wind_dir` VARCHAR(191) NULL,
    ADD COLUMN `wind_kph` DOUBLE NULL;

-- DropTable
DROP TABLE `BoilerEvent`;

-- DropTable
DROP TABLE `IntegrationAccount`;

-- CreateTable
CREATE TABLE `BoilerHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `externalTemp` DOUBLE NOT NULL,
    `suggestedTemp` DOUBLE NOT NULL,
    `actualTemp` DOUBLE NULL,
    `heatingStart` DATETIME(3) NULL,
    `heatingEnd` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TuyaToken` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `accessToken` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ThermostatDevice` ADD CONSTRAINT `ThermostatDevice_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HeatingEvent` ADD CONSTRAINT `HeatingEvent_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `ThermostatDevice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BoilerHistory` ADD CONSTRAINT `BoilerHistory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
