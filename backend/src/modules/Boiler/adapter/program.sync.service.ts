// program-sync.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { TuyaProgramByDay, TuyaProgramInterval } from './program-sync.types';
import { PrismaService } from '../../../prisma/prisma.service';
import { DayType } from 'src/generated/prisma';

/**
 * REL-8 (B-027): zastavica za atomski, serijalizovan upis dana programa. Zadano UKLJUCENO -
 * staro ponasanje ostavlja trajno mijesano stanje, pa ga ne treba cuvati kao
 * zadano. Zastavica postoji samo za rollback bez deploya.
 */
export const PROGRAM_SYNC_ATOMIC_FLAG = 'PROGRAM_SYNC_ATOMIC_ENABLED';

const OFF_VALUES = new Set(['off', 'false', '0', 'no']);

/** Cista funkcija (bez DI) da bi se dala testirati bez Nest kontejnera. */
export function programSyncAtomicEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = (env[PROGRAM_SYNC_ATOMIC_FLAG] ?? 'on').trim().toLowerCase();
  return !OFF_VALUES.has(raw);
}

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
        this.logger.warn(
          `No intervals for ${String(dayType)}, deviceId=${deviceId}`,
        );
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

    if (programSyncAtomicEnabled()) {
      const outcome = await this.applyDayAtomically(
        deviceId,
        dayType,
        intervals,
        programHash,
      );
      if (outcome === 'unchanged') return;
      this.logger.log(
        `${outcome === 'inserted' ? 'Inserted' : 'Updated'} program for ${String(dayType)}, deviceId=${deviceId}`,
      );
      return;
    }

    // Rollback grana namjerno zadrzava prethodno legacy ponasanje.
    const existing = await this.prisma.thermostatProgram.findMany({
      where: { deviceId, dayType },
      orderBy: { orderIndex: 'asc' },
    });

    if (existing.length === 0) {
      await this.insertAll(deviceId, dayType, intervals, programHash);
      this.logger.log(
        `Inserted program for ${String(dayType)}, deviceId=${deviceId}`,
      );
      return;
    }

    if (existing[0].programHash === programHash) {
      return;
    }

    await this.upsertAll(deviceId, dayType, intervals, programHash);
    await this.cleanupRemovedIntervals(
      deviceId,
      dayType,
      intervals.map((i) => i.orderIndex),
    );

    this.logger.log(
      `Updated program for ${String(dayType)}, deviceId=${deviceId}`,
    );
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

  /**
   * REL-8 (B-027): lock, procjena postojeceg stanja i svi upisi su u istoj
   * transakciji. Advisory lock je po uređaju/danu i automatski nestaje na
   * commit/rollback, pa drugi proces ponovo cita stanje prije hash odluke.
   */
  private applyDayAtomically(
    deviceId: number,
    dayType: DayType,
    intervals: TuyaProgramInterval[],
    programHash: string,
  ): Promise<'inserted' | 'updated' | 'unchanged'> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${this.calculateLockKey(deviceId, dayType)}::bigint)`;

      const existing = await tx.thermostatProgram.findMany({
        where: { deviceId, dayType },
        orderBy: { orderIndex: 'asc' },
      });

      if (existing.length === 0) {
        await tx.thermostatProgram.createMany({
          data: intervals.map((interval) => ({
            deviceId,
            dayType,
            startMinute: interval.startMinute,
            targetTemp: interval.targetTemp,
            orderIndex: interval.orderIndex,
            programHash,
          })),
        });
        return 'inserted' as const;
      }

      if (existing[0].programHash === programHash) {
        return 'unchanged' as const;
      }

      for (const interval of intervals) {
        await tx.thermostatProgram.upsert({
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

      await tx.thermostatProgram.deleteMany({
        where: {
          deviceId,
          dayType,
          orderIndex: { notIn: intervals.map((i) => i.orderIndex) },
        },
      });
      return 'updated' as const;
    });
  }

  private calculateLockKey(deviceId: number, dayType: DayType): bigint {
    const digest = createHash('sha256')
      .update(`rel8:thermostat-program:${deviceId}:${String(dayType)}`)
      .digest();
    return digest.readBigInt64BE(0);
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
