/*
  Warnings:

  - You are about to drop the column `homeLoacation` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `User` DROP COLUMN `homeLoacation`,
    ADD COLUMN `homeLocation` VARCHAR(191) NULL;
