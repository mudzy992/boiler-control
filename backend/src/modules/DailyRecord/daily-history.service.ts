import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildDailyHistory,
  type DailyHistory,
  type DailyRecordInput,
} from './daily-history';

/**
 * Čitanje historije dnevnih zapisa (`31`) — **samo čita**.
 *
 * Odvojeno od `ShadowReportService` jer mjeri drugu stvar: shadow izvještaj
 * poredi odluku sa formulom, a ovaj izvještaj kaže **koliko historije postoji i
 * odakle je došla** (živi rad ili backfill). Bez toga bi 301 rekonstruisan dan
 * bio u bazi i nigdje vidljiv.
 */

export interface DailyHistoryWindow {
  /** Uključivo, `YYYY-MM-DD`. */
  from?: string;
  /** Uključivo, `YYYY-MM-DD`. */
  to?: string;
  /** Najviše redova; preko toga se odgovor označi kao skraćen. */
  limit: number;
}

/** Gornja granica jednog odgovora — više od toga klijent ne prikazuje. */
export const MAX_HISTORY_ROWS = 400;

@Injectable()
export class DailyHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async forHome(
    userId: number,
    homeProfileId: number,
    window: DailyHistoryWindow,
  ): Promise<DailyHistory & { homeProfileId: number }> {
    // Vlasništvo se provjerava ovdje, ne u kontroleru — servis se može zvati i
    // iz drugog mjesta, pa pravilo mora putovati s njim.
    const home = await this.prisma.homeProfile.findFirst({
      where: { id: homeProfileId, userId },
      select: { id: true },
    });

    if (!home) {
      throw new NotFoundException(`HomeProfile ${homeProfileId} nije pronađen`);
    }

    const rows = (await this.prisma.dailyRecord.findMany({
      where: {
        homeProfileId,
        ...(window.from || window.to
          ? {
              localDate: {
                ...(window.from ? { gte: window.from } : {}),
                ...(window.to ? { lte: window.to } : {}),
              },
            }
          : {}),
      },
      // Najnoviji prvi, pa se reže na `limit`; u odgovoru se sortira uzlazno.
      orderBy: { localDate: 'desc' },
      take: window.limit + 1,
      select: {
        localDate: true,
        proposedFlowTemp: true,
        proposedAt: true,
        cycles: true,
        medianCycleMin: true,
        dutyPercent: true,
        overshootC: true,
        undershootC: true,
        flowSetC: true,
        flowSetSource: true,
        gasM3: true,
        degreeDays: true,
        nightUndershootC: true,
        hysteresisK: true,
        heatRateCPerHour: true,
        shadowFlowC: true,
        shadowAction: true,
        modelVersion: true,
        outcomeVersion: true,
        outcomeAt: true,
      },
    })) as unknown as DailyRecordInput[];

    const truncated = rows.length > window.limit;
    const kept = truncated ? rows.slice(0, window.limit) : rows;

    return {
      ...buildDailyHistory(kept, { truncated }),
      homeProfileId,
    };
  }
}
