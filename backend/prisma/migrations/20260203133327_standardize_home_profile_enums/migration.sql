/*
  Warnings:

  - You are about to alter the column `insulationType` on the `HomeProfile` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(2))`.
  - You are about to alter the column `windowType` on the `HomeProfile` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(3))`.
  - You are about to alter the column `heatingType` on the `HomeProfile` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(4))`.

*/
-- AlterTable
ALTER TABLE `HomeProfile` MODIFY `insulationType` ENUM('STANDARD', 'EPS', 'MINERAL_WOOL', 'ADVANCED') NOT NULL,
    MODIFY `windowType` ENUM('SINGLE_GLAZED', 'DOUBLE_GLAZED', 'TRIPLE_GLAZED') NOT NULL,
    MODIFY `heatingType` ENUM('RADIATOR', 'UNDERFLOOR', 'MIXED') NOT NULL;
