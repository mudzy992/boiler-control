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
  /** Koliko se preskače — straničenje tabele (`36`). */
  offset?: number;
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
  ): Promise<
    DailyHistory & { homeProfileId: number; total: number; offset: number }
  > {
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
      skip: window.offset ?? 0,
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

    const hasMoreRows = rows.length > window.limit;
    const kept = hasMoreRows ? rows.slice(0, window.limit) : rows;

    /*
     * Ukupan broj se dobija zasebnim `count`-om, jer `take: limit + 1` govori
     * samo „ima još", ne koliko. Bez broja tabela ne može napisati „21–40 od
     * 302" — a to je razlog zbog kojeg je straničenje i traženo (`36`).
     */
    const total = await this.prisma.dailyRecord.count({
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
    });

    return {
      ...buildDailyHistory(kept, {
        truncated: (window.offset ?? 0) + kept.length < total,
      }),
      homeProfileId,
      total,
      offset: window.offset ?? 0,
    };
  }
}
