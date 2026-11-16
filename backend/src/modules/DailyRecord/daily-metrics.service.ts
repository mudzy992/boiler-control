import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Dnevne mjerne kolone iz `DailyRecord` — kanal koji do 16.11. nije postojao.
 *
 * **Nalaz (audit analitike §1.1).** `DailyRecord` nosi 20+ mjernih kolona
 * (`dutyPercent`, `overshootC`, `undershootC`, `hysteresisK`, `heatRateCPerHour`,
 * `nightUndershootC`, …), a **nijedan** endpoint ih nije čitao: svi
 * `api/dashboard/*` vraćaju isključivo `HeatingEvent`. Zato ekran „Analitika"
 * nije mogao odgovoriti ni na jedno pitanje o **ponašanju** kotla — samo o
 * broju ciklusa i trajanju.
 *
 * **Zašto endpoint vraća i pokrivenost, a ne samo redove.** Mjerenje (M3,
 * run `43851109488`) kaže **5/86** dana (6 %) ima te metrike. Bez broja
 * pokrivenosti klijent ne može razlikovati „nema mjerenja tog dana" od „ovaj
 * ekran ne radi" — a ekran koji na 81 od 86 dana pokaže prazninu izgleda kao
 * kvar, ne kao nedostatak podatka. Zato `coverage` ide uz redove, **po
 * koloni**: `dutyPercent` može biti popunjen na 5 dana a `heatRateCPerHour` na
 * 2, i to su dva različita odgovora.
 *
 * Servis **samo čita**.
 */

/**
 * Kolone koje se izlažu. Imenovane su po istom redu kao u shemi, da se ime u
 * odgovoru ne razlikuje od imena u bazi — mapiranje bi bilo mjesto gdje se
 * greška tiho uvlači.
 */
export const DAILY_METRIC_FIELDS = [
  'dutyPercent',
  'medianCycleMin',
  'overshootC',
  'undershootC',
  'hysteresisK',
  'hysteresisAsymmetryK',
  'heatRateCPerHour',
  'nightUndershootC',
  'nightMinOutdoorMeasuredC',
  'nightFlowC',
  'flowSetC',
  'degreeHours',
] as const;

export type DailyMetricField = (typeof DAILY_METRIC_FIELDS)[number];

/** Jedan dan: datum + samo one metrike koje stvarno postoje. */
export type DailyMetricRow = { localDate: string } & Partial<
  Record<DailyMetricField, number>
>;

export interface DailyMetricsCoverage {
  /** Koliko dana je u prozoru (redova u `DailyRecord`). */
  days: number;
  /** Koliko dana ima `outcomeAt` — dakle uopšte obračunato. */
  withOutcome: number;
  /** Po koloni: na koliko dana ima vrijednost. */
  byField: Record<DailyMetricField, number>;
  /**
   * Najbolje pokrivena kolona, u procentima. Ovo je broj po kojem se odlučuje
   * da li ekran ima smisla prikazati (prag 25 % je u `ANALITIKA` mjerenju).
   */
  bestFieldShare: number;
}

export interface DailyMetricsResponse {
  homeProfileId: number;
  from: string | null;
  to: string | null;
  rows: DailyMetricRow[];
  coverage: DailyMetricsCoverage;
}

/** Granice prozora; zadano 90 dana, najviše 400 redova kao i historija. */
export const MAX_METRICS_DAYS = 400;

@Injectable()
export class DailyMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async forHome(
    userId: number,
    homeProfileId: number,
    from?: string,
    to?: string,
  ): Promise<DailyMetricsResponse> {
    // Vlasništvo se provjerava ovdje, ne u kontroleru — isti razlog kao u
    // `DailyHistoryService`: servis se može zvati i iz drugog mjesta.
    const home = await this.prisma.homeProfile.findFirst({
      where: { id: homeProfileId, userId },
      select: { id: true },
    });
    /*
     * `findFirstOrThrow` bi dao **500** za tuđi ili nepostojeći dom. To je isti
     * kvar kao B3 (goli `Error` → 500): 404 jeste tačan odgovor, jer resurs ne
     * postoji — a 500 bi rekao da je pao server.
     */
    if (!home) {
      throw new NotFoundException('Home profile not found');
    }

    const rows = await this.prisma.dailyRecord.findMany({
      where: {
        homeProfileId,
        ...(from || to
          ? {
              localDate: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: { localDate: 'asc' },
      take: MAX_METRICS_DAYS,
      select: {
        localDate: true,
        outcomeAt: true,
        ...Object.fromEntries(DAILY_METRIC_FIELDS.map((f) => [f, true])),
      },
    });

    const byField = Object.fromEntries(
      DAILY_METRIC_FIELDS.map((f) => [f, 0]),
    ) as Record<DailyMetricField, number>;

    let withOutcome = 0;
    const out: DailyMetricRow[] = [];

    for (const row of rows as unknown as Array<
      { localDate: string; outcomeAt: Date | null } & Partial<
        Record<DailyMetricField, number | null>
      >
    >) {
      if (row.outcomeAt) withOutcome += 1;

      /*
       * `null` se **ne prevodi u 0** — isti razlog kao B1. Dan sa `null`
       * `overshootC` nije „nije bilo prebačaja", nego „nije mjereno".
       */
      const metrics: DailyMetricRow = { localDate: row.localDate };
      for (const field of DAILY_METRIC_FIELDS) {
        const value = row[field];
        if (typeof value === 'number' && Number.isFinite(value)) {
          metrics[field] = value;
          byField[field] += 1;
        }
      }
      out.push(metrics);
    }

    const best = Math.max(0, ...DAILY_METRIC_FIELDS.map((f) => byField[f]));

    return {
      homeProfileId,
      from: from ?? null,
      to: to ?? null,
      rows: out,
      coverage: {
        days: rows.length,
        withOutcome,
        byField,
        bestFieldShare: rows.length
          ? Number(((best / rows.length) * 100).toFixed(1))
          : 0,
      },
    };
  }
}
