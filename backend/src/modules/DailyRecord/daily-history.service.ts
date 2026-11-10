import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildDailyHistory,
  type DailyHistory,
  type DailyRecordInput,
} from './daily-history';
import { applyPageCycles } from './history-page';
import { resolveHomeTimeZone } from './proposal-schedule';

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
      // Zona je potrebna za razrez ciklusa po lokalnom danu — bez nje ciklus
      // koji počne u 23:50 ne bi bilo moguće pripisati pravom danu.
      select: {
        id: true,
        weatherTimezone: true,
        user: { select: { timezone: true } },
      },
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

    /*
     * `F13` (drugi krug): ciklusi iz događaja za dane koje obračun još nije
     * obradio. `DailyOutcomeService` gleda samo 7 dana unazad, a tabela 20 —
     * zato je za starije dane Ciklusi ostajao crtica iako `HeatingEvent`
     * redovi postoje. Upit je uzak: samo dani iz ove strane, samo početak i
     * kraj ciklusa.
     */
    const zone = resolveHomeTimeZone({
      homeTimeZone: home.weatherTimezone,
      userTimeZone: home.user.timezone,
    });
    const dates = kept.map((row) => row.localDate).sort();
    /*
     * Granice prozora su datumi **bez vremena** (`YYYY-MM-DD` → UTC ponoć tog
     * dana). To je namjerno šire od stvarnog lokalnog dana: sat vremena više
     * događaja na rubu ne mijenja ništa jer `fillCyclesFromEvents` razrezuje po
     * lokalnom datumu, a sat vremena manje bi odsjeklo ciklus koji je počeo
     * prije ruba.
     */
    const windowStart = new Date(`${dates[0]}T00:00:00.000Z`);
    const windowEnd = new Date(
      new Date(`${dates[dates.length - 1]}T00:00:00.000Z`).getTime() +
        2 * 24 * 60 * 60 * 1000,
    );
    const eventsForPage =
      dates.length === 0
        ? []
        : await this.prisma.heatingEvent.findMany({
            where: {
              thermostat: { homeProfileId },
              // Jedan dan šire: ciklus koji je počeo dan prije ponoći, a
              // završio u danu iz zahtjeva, mora ući u skup da bi mu se znalo
              // trajanje.
              timestampStart: {
                gte: windowStart,
                lt: windowEnd,
              },
            },
            select: { timestampStart: true, timestampEnd: true },
            orderBy: { timestampStart: 'asc' },
          });

    const page = applyPageCycles(
      kept,
      eventsForPage.map((row) => ({
        startedAt: row.timestampStart,
        endedAt: row.timestampEnd,
      })),
      zone.zone,
    );
    const filled = page.rows;

    const history = buildDailyHistory(filled, {
      truncated: (window.offset ?? 0) + kept.length < total,
    });

    /*
     * Red popunjen iz događaja mora to i reći. Bez ovoga bi tabela prikazala
     * broj ciklusa u istoj koloni i sa istom oznakom kao cikluse izmjerene
     * serijom — a to su dvije različite mjere (serija mjeri i `dutyPercent`,
     * događaji ne).
     */
    const rowsWithSource = history.rows.map((row) => {
      if (row.cycles == null) return row;
      if (row.cyclesSource === 'EVENTS') return row;
      return page.filledFromEvents.has(row.localDate)
        ? { ...row, cyclesSource: 'EVENTS' as const }
        : row;
    });

    return {
      ...history,
      rows: rowsWithSource,
      homeProfileId,
      total,
      offset: window.offset ?? 0,
    };
  }
}
