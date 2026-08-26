-- CreateTable
CREATE TABLE `ThermostatProgram` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `deviceId` INTEGER NOT NULL,
    `dayType` ENUM('WORKDAY', 'SATURDAY', 'SUNDAY') NOT NULL,
    `startMinute` INTEGER NOT NULL,
    `targetTemp` DOUBLE NOT NULL,
    `orderIndex` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ThermostatProgram_deviceId_dayType_orderIndex_key`(`deviceId`, `dayType`, `orderIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ThermostatProgram` ADD CONSTRAINT `ThermostatProgram_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `ThermostatDevice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
