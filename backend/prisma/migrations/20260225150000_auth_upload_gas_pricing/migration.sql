-- AlterTable
ALTER TABLE `User`
    ADD COLUMN `username` VARCHAR(191) NULL,
    ADD COLUMN `gasPriceExVat` DOUBLE NULL;

-- AlterTable
ALTER TABLE `HeatingEvent`
    ADD COLUMN `anomalyCheckedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `GasReading`
    ADD COLUMN `meterImagePath` VARCHAR(191) NULL,
    ADD COLUMN `meterImageMime` VARCHAR(191) NULL,
    ADD COLUMN `meterImageOriginalName` VARCHAR(191) NULL,
    ADD COLUMN `isInvoiceReference` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `referenceMonth` DATETIME(3) NULL,
    ADD COLUMN `invoicePdfPath` VARCHAR(191) NULL,
    ADD COLUMN `invoicePdfMime` VARCHAR(191) NULL,
    ADD COLUMN `invoicePdfOriginalName` VARCHAR(191) NULL,
    ADD COLUMN `invoiceUploadedAt` DATETIME(3) NULL,
    ADD COLUMN `invoiceGasPriceExVat` DOUBLE NULL;

-- CreateTable
CREATE TABLE `GasPriceHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `gasReadingId` INTEGER NULL,
    `priceExVat` DOUBLE NOT NULL,
    `vatRate` DOUBLE NOT NULL DEFAULT 0.17,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `source` ENUM('MANUAL', 'INVOICE') NOT NULL DEFAULT 'MANUAL',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `User_username_key` ON `User`(`username`);

-- CreateIndex
CREATE UNIQUE INDEX `GasReading_userId_referenceMonth_key` ON `GasReading`(`userId`, `referenceMonth`);

-- CreateIndex
CREATE INDEX `GasPriceHistory_userId_effectiveFrom_idx` ON `GasPriceHistory`(`userId`, `effectiveFrom`);

-- CreateIndex
CREATE INDEX `GasPriceHistory_userId_effectiveTo_idx` ON `GasPriceHistory`(`userId`, `effectiveTo`);

-- AddForeignKey
ALTER TABLE `GasPriceHistory` ADD CONSTRAINT `GasPriceHistory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GasPriceHistory` ADD CONSTRAINT `GasPriceHistory_gasReadingId_fkey` FOREIGN KEY (`gasReadingId`) REFERENCES `GasReading`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
