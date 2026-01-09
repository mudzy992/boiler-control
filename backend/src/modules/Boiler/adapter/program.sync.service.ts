// program-sync.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { TuyaProgramByDay, TuyaProgramInterval } from './program-sync.types';
import { DayType } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ProgramSyncService {
  private readonly logger = new Logger(ProgramSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Glavna ulazna tačka:
   * - prima dekodirani Tuya program
   * - sinhronizuje bazu
   */
  async syncProgram(
    deviceId: number,
    tuyaProgram: TuyaProgramByDay,
  ): Promise<void> {
    for (const dayType of Object.values(DayType)) {
      const intervals = tuyaProgram[dayType] ?? [];

      if (!intervals.length) {
        this.logger.warn(`No intervals for ${dayType}, deviceId=${deviceId}`);
        continue;
      }

      await this.syncDay(deviceId, dayType, intervals);
    }
  }

  // ---------------- PRIVATE ----------------

  private async syncDay(
    deviceId: number,
    dayType: DayType,
    intervals: TuyaProgramInterval[],
  ): Promise<void> {
    const programHash = this.calculateHash(intervals);

    const existing = await this.prisma.thermostatProgram.findMany({
      where: { deviceId, dayType },
      orderBy: { orderIndex: 'asc' },
    });

    // 1️⃣ Ako nema ničega u bazi → INSERT ALL
    if (existing.length === 0) {
      await this.insertAll(deviceId, dayType, intervals, programHash);
      this.logger.log(`Inserted program for ${dayType}, deviceId=${deviceId}`);
      return;
    }

    // 2️⃣ Ako hash isti → NO-OP
    if (existing[0].programHash === programHash) {
      return;
    }

    // 3️⃣ Inače → UPSERT + CLEANUP
    await this.upsertAll(deviceId, dayType, intervals, programHash);
    await this.cleanupRemovedIntervals(
      deviceId,
      dayType,
      intervals.map((i) => i.orderIndex),
    );

    this.logger.log(`Updated program for ${dayType}, deviceId=${deviceId}`);
  }

  private calculateHash(intervals: TuyaProgramInterval[]): string {
    const payload = intervals
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((i) => ({
        startMinute: i.startMinute,
        targetTemp: i.targetTemp,
        orderIndex: i.orderIndex,
      }));

    return createHash('sha1').update(JSON.stringify(payload)).digest('hex');
  }

  private async insertAll(
    deviceId: number,
    dayType: DayType,
    intervals: TuyaProgramInterval[],
    programHash: string,
  ): Promise<void> {
    await this.prisma.thermostatProgram.createMany({
      data: intervals.map((i) => ({
        deviceId,
        dayType,
        startMinute: i.startMinute,
        targetTemp: i.targetTemp,
        orderIndex: i.orderIndex,
        programHash,
      })),
    });
  }

  private async upsertAll(
    deviceId: number,
    dayType: DayType,
    intervals: TuyaProgramInterval[],
    programHash: string,
  ): Promise<void> {
    for (const interval of intervals) {
      await this.prisma.thermostatProgram.upsert({
        where: {
          deviceId_dayType_orderIndex: {
            deviceId,
            dayType,
            orderIndex: interval.orderIndex,
          },
        },
        update: {
          startMinute: interval.startMinute,
          targetTemp: interval.targetTemp,
          programHash,
        },
        create: {
          deviceId,
          dayType,
          startMinute: interval.startMinute,
          targetTemp: interval.targetTemp,
          orderIndex: interval.orderIndex,
          programHash,
        },
      });
    }
  }

  private async cleanupRemovedIntervals(
    deviceId: number,
    dayType: DayType,
    validOrderIndexes: number[],
  ): Promise<void> {
    await this.prisma.thermostatProgram.deleteMany({
      where: {
        deviceId,
        dayType,
        orderIndex: {
          notIn: validOrderIndexes,
        },
      },
    });
  }
}
