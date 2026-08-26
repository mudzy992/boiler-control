-- AlterTable
ALTER TABLE `HomeProfile` ADD COLUMN `location` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `activeHomeProfileId` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_activeHomeProfileId_key` ON `User`(`activeHomeProfileId`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_activeHomeProfileId_fkey` FOREIGN KEY (`activeHomeProfileId`) REFERENCES `HomeProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

