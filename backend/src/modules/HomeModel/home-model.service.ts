import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import {
  localDateKey,
  resolveHomeTimeZone,
} from '../DailyRecord/proposal-schedule';
import {
  buildDayRow,
  fitDailyBalance,
  type DayAggregate,
  type DayRejection,
  type DayRow,
} from './daily-balance';
import { dayGains, estimateDayGain } from './day-gain';

/**
 * Model kuće (`17` §5.3, §13 koraci 3–4).
 *
 * Jedan red po kući, izveden iz petominutne serije (`21`). Ovo NIJE zapis
 * događaja nego procjena: smije se prepisivati, i treba — svaki novi dan je
 * novi dokaz.
 *
 * Ono što se danas mjeri je `s = b/a` (nagib krive kuće) i `c` (dnevni član
 * unutrašnjih dobitaka). Apsolutni `a` i `b` traže prozore mirovanja/grijanja
 * ≥ 45 min, kojih u kućama sa kratkim ciklusima nema (`17` §6.2) — zato ostaju
 * `null`, a ne izmišljeni.
 */

export const HOME_MODEL_VERSION = 'model-1';

/**
 * Prozor fita. 60 dana je izabrano jer je to najduže razdoblje u kojem kuća još
 * nije promijenila režim (grijanje → mirovanje) i u kojem `u_day` ostaje
 * uporediv; duži prozor miješa sezone, kraći daje preširok interval.
 */
export const FIT_WINDOW_DAYS = 60;

export type HomeModelState = 'COLD_START' | 'TRACKING' | 'DEGRADED';

export interface HomeModelWriteResult {
  homeProfileId: number;
  state: HomeModelState;
  slope: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  days: number;
  daysEvaluated: number;
  reason: string | null;
}

/** Jedan uzorak serije, onako kako ga agregacija čita. */
export interface ObservationSampleRow {
  deviceId?: number;
  at: Date;
  roomTempC: number | null;
  targetTempC: number | null;
  isHeating: boolean;
  outdoorTempC: number | null;
  flowSetC: number | null;
}

interface MutableDay {
  samples: number;
  heatingSamples: number;
  heatingPairs: number;
  flowMinusRoomSum: number;
  roomSum: number;
  outdoorSum: number;
  outdoorSamples: number;
  targets: number[];
}

/**
 * Grupisanje serije po **lokalnom** danu kuće.
 *
 * `samples` broji samo uzorke sa poznatom sobnom temperaturom: `x` i `y` se
 * računaju iz nje, pa dan bez nje nema težinu. Vanjska temperatura ima svoj
 * brojač jer može postojati i kad soba nedostaje (i obratno).
 */
export function aggregateByLocalDay(
  observations: readonly ObservationSampleRow[],
  zone: string,
  completeBefore: string,
): DayAggregate[] {
  const days = new Map<string, MutableDay>();

  for (const observation of observations) {
    const localDate = localDateKey(observation.at, zone);
    if (localDate >= completeBefore) continue; // dan još nije završen

    if (observation.outdoorTempC != null) {
      let day = days.get(localDate);
      if (!day) {
        day = emptyDay();
        days.set(localDate, day);
      }
      day.outdoorSum += observation.outdoorTempC;
      day.outdoorSamples += 1;
    }

    if (observation.roomTempC == null) continue;

    let day = days.get(localDate);
    if (!day) {
      day = emptyDay();
      days.set(localDate, day);
    }
    day.samples += 1;
    day.roomSum += observation.roomTempC;
    if (observation.targetTempC != null) {
      day.targets.push(observation.targetTempC);
    }

    if (observation.isHeating) {
      day.heatingSamples += 1;
      if (observation.flowSetC != null) {
        day.heatingPairs += 1;
        day.flowMinusRoomSum += observation.flowSetC - observation.roomTempC;
      }
    }
  }

  const aggregates: DayAggregate[] = [];
  for (const [localDate, day] of [...days.entries()].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    aggregates.push({
      localDate,
      samples: day.samples,
      heatingSamples: day.heatingSamples,
      heatingPairs: day.heatingPairs,
      flowMinusRoomSum: day.flowMinusRoomSum,
      roomSum: day.roomSum,
      outdoorSum: day.outdoorSum,
      outdoorSamples: day.outdoorSamples,
      targetRoomC: medianOrNull(day.targets),
    });
  }

  return aggregates;
}

function emptyDay(): MutableDay {
  return {
    samples: 0,
    heatingSamples: 0,
    heatingPairs: 0,
    flowMinusRoomSum: 0,
    roomSum: 0,
    outdoorSum: 0,
    outdoorSamples: 0,
    targets: [],
  };
}

function medianOrNull(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Polja koja fit smije pisati. Namjerno **nema** `aPerHour`/`bPerHour`: dok
 * sekundarna metoda (`17` §6.2) ne nađe prozore ≥ 45 min, ta dva broja se ne
 * mogu izmjeriti, pa se ni ne dotiču.
 */
type HomeModelFields = {
  state: HomeModelState;
  sourceDeviceId?: number | null;
  reason: string | null;
  days: number;
  daysEvaluated: number;
  windowDays: number;
  modelVersion: string;
  lastAttemptAt: Date;
  lastFitAt?: Date;
  slopeS?: number;
  slopeCiLow?: number;
  slopeCiHigh?: number;
  internalGainC?: number;
  residualStd?: number;
  /** `u_day` (`17` §13 korak 7). `null` briše procjenu — nema je, ne nula je. */
  uDayC?: number | null;
  uDayDays?: number | null;
  uDayAt?: Date | null;
};

@Injectable()
export class HomeModelService {
  private readonly logger = new Logger(HomeModelService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Noćni fit. U 03:00 UTC, jer se radi o **završenim** danima: koji je dan
   * završen odlučuje zona kuće, a ne sat servera (`aggregateByLocalDay`).
   */
  @Cron('0 3 * * *', {
    name: 'home-model-fit',
    disabled:
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test',
  })
  async fitAllHomes(now: Date = new Date()): Promise<void> {
    const homes = await this.prisma.homeProfile.findMany({
      where: { user: { isActive: true } },
      select: {
        id: true,
        weatherTimezone: true,
        user: { select: { id: true, timezone: true } },
      },
    });

    for (const home of homes) {
      try {
        await this.fitHome(home.id, now);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Model kuće ${home.id} nije izračunat: ${message}`);
      }
    }
  }

  async fitHome(
    homeProfileId: number,
    now: Date = new Date(),
  ): Promise<HomeModelWriteResult> {
    const home = await this.prisma.homeProfile.findUnique({
      where: { id: homeProfileId },
      select: {
        id: true,
        weatherTimezone: true,
        user: { select: { timezone: true } },
      },
    });

    if (!home) {
      throw new Error(`HomeProfile ${homeProfileId} ne postoji`);
    }

    const zone = resolveHomeTimeZone({
      homeTimeZone: home.weatherTimezone,
      userTimeZone: home.user.timezone,
    });
    const todayLocal = localDateKey(now, zone.zone);
    const windowStart = new Date(
      now.getTime() - FIT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    const observations = await this.prisma.thermostatObservation.findMany({
      where: { homeProfileId, at: { gte: windowStart } },
      orderBy: { at: 'asc' },
      select: {
        deviceId: true,
        at: true,
        roomTempC: true,
        targetTempC: true,
        isHeating: true,
        outdoorTempC: true,
        flowSetC: true,
      },
    });

    // Kuća sa dva termostata u dvije sobe nije jedan model: prosjek dvije sobe
    // nije ni jedna od njih. Zato fit koristi ISKLJUČIVO primarni uređaj —
    // onaj sa najviše uzoraka, a kod izjednačenja manji `id` (deterministički).
    const primaryDeviceId = pickPrimaryDevice(observations);
    const complete = observations.filter(
      (row) => row.deviceId == null || row.deviceId === primaryDeviceId,
    );

    const aggregates = aggregateByLocalDay(complete, zone.zone, todayLocal);

    const rows: DayRow[] = [];
    const rejectionCounts = new Map<DayRejection, number>();
    for (const aggregate of aggregates) {
      const result = buildDayRow(aggregate);
      if (result.ok) {
        rows.push(result.row);
      } else {
        rejectionCounts.set(
          result.reason,
          (rejectionCounts.get(result.reason) ?? 0) + 1,
        );
      }
    }

    const fit = fitDailyBalance(rows);
    const reasonSummary = summarize(rejectionCounts);

    const existing = await this.prisma.homeModel.findUnique({
      where: { homeProfileId },
      select: { slopeS: true },
    });

    const base = {
      daysEvaluated: aggregates.length,
      windowDays: FIT_WINDOW_DAYS,
      modelVersion: HOME_MODEL_VERSION,
      lastAttemptAt: now,
      sourceDeviceId: primaryDeviceId,
    };

    if (fit.status === 'ok') {
      // `u_day` se računa iz ostataka **istog** fita, pa ne može biti stariji od
      // nagiba. Kad dana nema dovoljno, procjena se briše: stari dobitak ne
      // smije nadživjeti dokaz koji ga je dao.
      const gain = estimateDayGain(
        dayGains(rows, { slopeS: fit.slope, internalGainC: fit.internalGainC }),
      );

      const data = {
        ...base,
        state: 'TRACKING' as const,
        reason: null,
        slopeS: fit.slope,
        slopeCiLow: fit.ciLow,
        slopeCiHigh: fit.ciHigh,
        internalGainC: fit.internalGainC,
        residualStd: fit.residualStd,
        days: fit.days,
        lastFitAt: now,
        uDayC: gain?.uDayC ?? null,
        uDayDays: gain?.days ?? null,
        uDayAt: gain ? now : null,
      };
      await this.upsert(homeProfileId, data);
      this.logger.log(
        `Model kuće ${homeProfileId}: s=${fit.slope.toFixed(3)} ` +
          `(CI ${fit.ciLow.toFixed(3)}–${fit.ciHigh.toFixed(3)}), ` +
          `${fit.days} dana, u_day ` +
          (gain
            ? `${gain.uDayC.toFixed(1)} K (${gain.days} dana` +
              `${gain.capped ? ', ograničen' : ''}).`
            : '— (premalo dana).'),
      );
      return {
        homeProfileId,
        state: 'TRACKING',
        slope: fit.slope,
        ciLow: fit.ciLow,
        ciHigh: fit.ciHigh,
        days: fit.days,
        daysEvaluated: aggregates.length,
        reason: null,
      };
    }

    // Nijedan broj se NE prepisuje: procjena koja nije nastala ne smije
    // zamijeniti onu koja jeste (`17` §6.4). Mijenja se samo stanje i razlog.
    const state: HomeModelState =
      fit.status === 'rejected'
        ? 'DEGRADED'
        : existing?.slopeS != null
          ? 'DEGRADED'
          : 'COLD_START';
    const reason =
      fit.status === 'rejected'
        ? `${fit.reason}:${fit.slope == null ? '' : fit.slope.toFixed(3)}`
        : `NOT_ENOUGH_DAYS:${fit.days}`;

    await this.upsert(homeProfileId, {
      ...base,
      state,
      reason: reasonSummary ? `${reason};${reasonSummary}` : reason,
      days: fit.days,
    });

    this.logger.log(
      `Model kuće ${homeProfileId}: ${state} (${reason}), ` +
        `${fit.days}/${aggregates.length} dana upotrebljivo.`,
    );

    return {
      homeProfileId,
      state,
      slope: null,
      ciLow: null,
      ciHigh: null,
      days: fit.days,
      daysEvaluated: aggregates.length,
      reason,
    };
  }

  private async upsert(
    homeProfileId: number,
    data: HomeModelFields,
  ): Promise<void> {
    await this.prisma.homeModel.upsert({
      where: { homeProfileId },
      create: { homeProfileId, ...data },
      update: data,
    });
  }
}

/**
 * Primarni uređaj: najviše uzoraka u prozoru, kod izjednačenja manji `id`.
 * Determinizam je obavezan — isti podaci moraju dati isti model.
 */
export function pickPrimaryDevice(
  observations: readonly ObservationSampleRow[],
): number | null {
  const counts = new Map<number, number>();
  for (const row of observations) {
    if (row.deviceId == null) continue;
    counts.set(row.deviceId, (counts.get(row.deviceId) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = -1;
  for (const [deviceId, count] of counts) {
    const better =
      count > bestCount ||
      (count === bestCount && (best === null || deviceId < best));
    if (better) {
      best = deviceId;
      bestCount = count;
    }
  }
  return best;
}

/** Kratak, stabilan zapis razloga odbacivanja dana — za dijagnostiku. */
function summarize(counts: Map<DayRejection, number>): string {
  if (counts.size === 0) return '';
  return [...counts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([reason, count]) => `${reason}=${count}`)
    .join(',');
}
