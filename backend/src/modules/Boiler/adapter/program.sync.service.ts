// program-sync.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { TuyaProgramByDay, TuyaProgramInterval } from './program-sync.types';
import { PrismaService } from '../../../prisma/prisma.service';
import { DayType, PrismaPromise } from 'src/generated/prisma';

/**
 * REL-8 (B-027): zastavica za atomski upis dana programa. Zadano UKLJUCENO -
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

    const existing = await this.prisma.thermostatProgram.findMany({
      where: { deviceId, dayType },
      orderBy: { orderIndex: 'asc' },
    });

    // 1️⃣ Ako nema ničega u bazi → INSERT ALL
    if (existing.length === 0) {
      await this.insertAll(deviceId, dayType, intervals, programHash);
      this.logger.log(
        `Inserted program for ${String(dayType)}, deviceId=${deviceId}`,
      );
      return;
    }

    // 2️⃣ Ako hash isti → NO-OP
    if (existing[0].programHash === programHash) {
      return;
    }

    // 3️⃣ Inače → UPSERT + CLEANUP
    if (programSyncAtomicEnabled()) {
      // REL-8 (B-027): cijeli dan u jednoj transakciji. Prije ove ispravke svaki
      // upsert je bio zaseban poziv i svaki je pisao hash CIJELOG programa, pa je
      // pad drugog upserta ostavljao prvi red s novim hashom. Retry bi tada na
      // `existing[0].programHash === programHash` zakljucio da je dan azuriran i
      // preskocio preostale upise i cleanup - trajno mijesano stanje.
      await this.applyDayAtomically(deviceId, dayType, intervals, programHash);
    } else {
      await this.upsertAll(deviceId, dayType, intervals, programHash);
      await this.cleanupRemovedIntervals(
        deviceId,
        dayType,
        intervals.map((i) => i.orderIndex),
      );
    }

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
   * REL-8 (B-027): upsert svih intervala + cleanup u JEDNOJ transakciji.
   *
   * Hash se zapisuje samo kao dio commita cijelog dana, pa djelomicno stanje
   * nikad ne dobija novi hash i retry stvarno ponovi posao.
   */
  private async applyDayAtomically(
    deviceId: number,
    dayType: DayType,
    intervals: TuyaProgramInterval[],
    programHash: string,
  ): Promise<void> {
    const operations: PrismaPromise<unknown>[] = intervals.map((interval) =>
      this.prisma.thermostatProgram.upsert({
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
      }),
    );

    operations.push(
      this.prisma.thermostatProgram.deleteMany({
        where: {
          deviceId,
          dayType,
          orderIndex: { notIn: intervals.map((i) => i.orderIndex) },
        },
      }),
    );

    await this.prisma.$transaction(operations);
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
