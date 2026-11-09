import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FlowTemperatureEngine } from '../Heating/engine/flow-temperature.engine';
import type { FlowTempInput } from '../Heating/engine/types';
import { buildRecommendationBreakdown } from '../HeatingRecommendation/recommendation-breakdown';
import { RecommendationWeatherService } from '../Weather/recommendation-weather.service';
import {
  intervalKeyForLocalDate,
  isAutoOutOfSeason,
  isProposalDue,
  isWithinProposalWindow,
  localDateKey,
  resolveHomeTimeZone,
  type TimeZoneSource,
} from './proposal-schedule';
import { jsonSnapshot } from '../../common/json-snapshot';


/**
 * Verzija zapisa i proračuna koji ga je proizveo (`17` §11: svaki
 * `DailyRecord` mora biti preračunljiv). Mijenja se kad se promijeni bilo koje
 * polje zapisa ili formula koja ga puni — nikad tiho.
 */
export const DAILY_RECORD_MODEL_VERSION = 'daily-1';

/**
 * Granice predloga. Iste su kao granice unosa (`18` §1, `16` §4.5) i ovdje
 * stoje kao **posljednja brana**: ako motor jednog dana vrati broj izvan
 * raspona, takav broj ne smije u bazu ni uz grešku u motoru.
 */
export const FLOW_TEMP_MIN_C = 30;
export const FLOW_TEMP_MAX_C = 55;

export type DailyRecordSkipReason =
  /** `SUMMER`, ili `AUTO` sa dnevnim prosjekom iznad grijne granice. */
  | 'OUT_OF_SEASON'
  /** Lokalno je prošlo 12:00 — predlog više ne upravlja danom. */
  | 'MISSED_WINDOW'
  /** Nema prognoze ni iz v2 izvora ni iz keša grada. */
  | 'NO_WEATHER'
  /** Korisnik ima drugu aktivnu kuću; ova se ne predlaže. */
  | 'NOT_ACTIVE';

export type SeasonMode = 'WINTER' | 'SUMMER' | 'AUTO';

export type FlowSetSource = 'USER' | 'CARRIED' | 'UNKNOWN';

export interface FlowSetSnapshot {
  c: number | null;
  since: Date | null;
  source: FlowSetSource;
}

export interface DailyRecordWriteResult {
  /**
   * `created` — red je nastao u ovom pozivu;
   * `exists` — red za taj dan već postoji (idempotentno, nije greška);
   * `not-due` — lokalni dan još nije došao do 06:00, red ne treba;
   * `skipped` — red je nastao, ali bez predloga (`skipReason`);
   * `not-active` — kuća nije aktivna, red ne nastaje.
   */
  status: 'created' | 'exists' | 'not-due' | 'skipped' | 'not-active';
  localDate: string;
  timeZone: string;
  timeZoneSource: TimeZoneSource;
  userId: number;
  homeProfileId: number;
  proposedFlowTemp: number | null;
  skipReason: DailyRecordSkipReason | null;
}

export function clampFlowTemp(value: number): number {
  return Math.min(FLOW_TEMP_MAX_C, Math.max(FLOW_TEMP_MIN_C, value));
}

/** Prisma prijavljuje unique-violation kao `code === 'P2002'`. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/**
 * Polazna "na snazi" u trenutku pisanja.
 *
 * Ograničenje koje se ovdje vidi: `currentBoilerFlowTemp` danas stoji na
 * `User`, ne na kući, pa dva doma dijele istu vrijednost. Zato je izvor uvijek
 * `USER` ili `UNKNOWN`, nikad `CARRIED` — razlika "uneseno danas / naslijeđeno"
 * postaje mjerljiva tek sa `FlowSetEvent` (`18` §0.2), što je sljedeći korak.
 */
export function flowSetSnapshot(
  user:
    | {
        currentBoilerFlowTemp: number | null;
        currentBoilerFlowTempSetAt: Date | null;
      }
    | null
    | undefined,
): FlowSetSnapshot {
  if (!user || user.currentBoilerFlowTemp == null) {
    return { c: null, since: null, source: 'UNKNOWN' };
  }
  return {
    c: user.currentBoilerFlowTemp,
    since: user.currentBoilerFlowTempSetAt ?? null,
    source: 'USER',
  };
}

type RecordContext = {
  localDate: string;
  timeZone: string;
  timeZoneSource: TimeZoneSource;
  userId: number;
  homeProfileId: number;
};

type LoadedHome = {
  id: number;
  floorArea: number;
  learningOffset: number;
  learningConfidence: number | null;
  seasonMode: SeasonMode;
  weatherTimezone: string | null;
  user: {
    id: number;
    timezone: string | null;
    homeLocation: string | null;
    activeHomeProfileId: number | null;
    currentBoilerFlowTemp: number | null;
    currentBoilerFlowTempSetAt: Date | null;
  };
};

/**
 * JEDINI pisac `DailyRecord` redova (`17` §13 korak 1).
 *
 * Zašto jedan: predlog mora biti zamrznut. Ako bi ga pisalo više mjesta, drugo
 * pisanje bi prepisalo prvo i historija bi izgubila ono što je korisnik zaista
 * vidio u 06:00. Zato ovdje nema `update` — samo `create`, a drugi pokušaj
 * istog dana pada na `@@unique([homeProfileId, localDate])` i vraća `exists`.
 *
 * Red nastaje i kad predloga nema: tada `proposedFlowTemp` ostaje `null`, a
 * `skipReason` kaže zašto. Time se "procijenjeno, namjerno bez predloga"
 * razlikuje od "sistem nije radio" — u drugom slučaju reda uopšte nema, pa
 * učenje (korak 3) ne može pomiješati prazninu sa odlukom.
 */
@Injectable()
export class DailyRecordWriter {
  private readonly logger = new Logger(DailyRecordWriter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recommendationWeather: RecommendationWeatherService,
  ) {}

  async writeForHome(
    homeProfileId: number,
    now: Date = new Date(),
  ): Promise<DailyRecordWriteResult> {
    const home = (await this.prisma.homeProfile.findUnique({
      where: { id: homeProfileId },
      include: { user: true },
    })) as unknown as LoadedHome | null;

    if (!home) {
      throw new Error(`HomeProfile ${homeProfileId} ne postoji`);
    }

    const user = home.user;
    const zone = resolveHomeTimeZone({
      homeTimeZone: home.weatherTimezone,
      userTimeZone: user.timezone,
    });
    if (zone.source === 'DEFAULT') {
      this.logger.warn(
        `Kuća ${home.id} nema poznatu vremensku zonu — koristim ${zone.zone}.`,
      );
    }

    const context: RecordContext = {
      localDate: localDateKey(now, zone.zone),
      timeZone: zone.zone,
      timeZoneSource: zone.source,
      userId: user.id,
      homeProfileId: home.id,
    };
    const flowSet = flowSetSnapshot(user);

    if (!isProposalDue(now, zone.zone)) {
      return {
        status: 'not-due',
        ...context,
        proposedFlowTemp: null,
        skipReason: null,
      };
    }

    if (
      user.activeHomeProfileId != null &&
      user.activeHomeProfileId !== home.id
    ) {
      // Kuća nije aktivna: ne piše se ni red, jer bi to bio predlog za dom u
      // kojem korisnik ne boravi (`18` §3, greška 1). To nije odluka o danu,
      // nego o tome koji dom se uopšte razmatra.
      return {
        status: 'not-active',
        ...context,
        proposedFlowTemp: null,
        skipReason: 'NOT_ACTIVE',
      };
    }

    if (home.seasonMode === 'SUMMER') {
      return this.persistSkipped(
        context,
        home.seasonMode,
        'OUT_OF_SEASON',
        flowSet,
      );
    }

    if (!isWithinProposalWindow(now, zone.zone)) {
      return this.persistSkipped(
        context,
        home.seasonMode,
        'MISSED_WINDOW',
        flowSet,
      );
    }

    const weather = await this.loadWeather(user.id, home.id, user.homeLocation);
    if (!weather) {
      return this.persistSkipped(context, home.seasonMode, 'NO_WEATHER', flowSet);
    }

    if (home.seasonMode === 'AUTO' && isAutoOutOfSeason(weather)) {
      return this.persistSkipped(
        context,
        home.seasonMode,
        'OUT_OF_SEASON',
        flowSet,
      );
    }

    return this.persistProposal(context, home, weather, now, flowSet);
  }

  /**
   * Prognoza za dan. v2 izvor je prvi; ako ga nema, ostaje stari keš po gradu.
   * Ako nema ni jednog, vraća `null` — **ne** nulu. Ranije se nedostatak
   * prognoze tiho pretvarao u `0 °C`, što daje predlog za vrijeme koje nije
   * izmjereno.
   */
  private async loadWeather(
    userId: number,
    homeProfileId: number,
    city: string | null,
  ): Promise<{ tempMin: number; tempMax: number } | null> {
    const v2 = await this.recommendationWeather.getV2WeatherInput(
      userId,
      homeProfileId,
    );
    if (v2 && Number.isFinite(v2.tempMin) && Number.isFinite(v2.tempMax)) {
      return { tempMin: v2.tempMin, tempMax: v2.tempMax };
    }

    if (!city) return null;

    const cached = await this.prisma.weatherCache.findFirst({
      where: { city },
      orderBy: { fetchedAt: 'desc' },
    });
    // `temp_min`/`temp_max` su u šemi nullable, a `Number.isFinite` ne sužava
    // tip — pa se provjera piše tako da TypeScript vidi isto što i mi.
    const cachedMin = cached?.temp_min;
    const cachedMax = cached?.temp_max;
    if (
      typeof cachedMin === 'number' &&
      typeof cachedMax === 'number' &&
      Number.isFinite(cachedMin) &&
      Number.isFinite(cachedMax)
    ) {
      return { tempMin: cachedMin, tempMax: cachedMax };
    }

    return null;
  }

  private async persistProposal(
    context: RecordContext,
    home: LoadedHome,
    weather: { tempMin: number; tempMax: number },
    now: Date,
    flowSet: FlowSetSnapshot,
  ): Promise<DailyRecordWriteResult> {
    const intervalKey = intervalKeyForLocalDate(context.localDate);
    const intervalLearning = await this.prisma.heatingIntervalLearning.findUnique(
      {
        where: {
          homeProfileId_intervalKey: {
            homeProfileId: home.id,
            intervalKey,
          },
        },
      },
    );

    const input: FlowTempInput = {
      mode: intervalLearning ? 'FULL' : 'PROFILE_ONLY',
      homeProfile: {
        floorArea: home.floorArea,
        learningOffset: home.learningOffset,
        insulationFactor: 1,
        confidence: home.learningConfidence ?? 0.1,
      },
      intervalKey,
      intervalLearning: intervalLearning
        ? {
            offset: intervalLearning.offset,
            confidence: intervalLearning.confidence,
          }
        : undefined,
      // Za jutarnji predlog nema "recent events": dan još nije počeo.
      recentEvents: [],
      weather,
    };

    const result = FlowTemperatureEngine.calculate(input);
    const proposedFlowTemp = clampFlowTemp(result.finalTemp);
    const breakdown = buildRecommendationBreakdown(result, {
      mode: input.mode,
      intervalKey,
      samples: intervalLearning?.samples ?? null,
      expectedHeatTimeMin: 0,
    });

    // Sve što je motor dobio i vratio — da se isti broj može preračunati
    // (`17` §11, "reproducibilnost"). Bez ovoga je zapis tvrdnja bez dokaza.
    const params = jsonSnapshot({
      version: 1,
      timeZone: context.timeZone,
      timeZoneSource: context.timeZoneSource,
      input: {
        mode: input.mode,
        intervalKey,
        weather,
        homeProfile: input.homeProfile,
        intervalLearning: input.intervalLearning ?? null,
      },
      result,
      breakdown,
      clamp: {
        applied: proposedFlowTemp !== result.finalTemp,
        rawFinalTemp: result.finalTemp,
        minC: FLOW_TEMP_MIN_C,
        maxC: FLOW_TEMP_MAX_C,
      },
    });

    const base = {
      localDate: context.localDate,
      timeZone: context.timeZone,
      timeZoneSource: context.timeZoneSource,
      userId: context.userId,
      homeProfileId: context.homeProfileId,
    };

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.dailyRecord.create({
          data: {
            userId: context.userId,
            homeProfileId: context.homeProfileId,
            localDate: context.localDate,
            seasonMode: home.seasonMode,
            skipReason: null,
            proposedFlowTemp,
            proposedAt: now,
            flowSetC: flowSet.c,
            flowSetSince: flowSet.since,
            flowSetSource: flowSet.source,
            modelVersion: DAILY_RECORD_MODEL_VERSION,
            params,
          },
        });

        // Red koji klijenti danas čitaju. Nastaje u ISTOJ transakciji: ako
        // drugo padne, prvo se poništava — nikad zapis bez reda koji prikazuje.
        await tx.recommendation.create({
          data: {
            userId: context.userId,
            date: now,
            recommendedFlowTemp: proposedFlowTemp,
            expectedHeatTimeMin: 0,
            confidenceScore: result.confidence,
            breakdown,
          },
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return {
          status: 'exists',
          ...base,
          proposedFlowTemp: null,
          skipReason: null,
        };
      }
      throw error;
    }

    return { status: 'created', ...base, proposedFlowTemp, skipReason: null };
  }

  private async persistSkipped(
    context: RecordContext,
    seasonMode: SeasonMode,
    skipReason: DailyRecordSkipReason,
    flowSet: FlowSetSnapshot,
  ): Promise<DailyRecordWriteResult> {
    const base = {
      localDate: context.localDate,
      timeZone: context.timeZone,
      timeZoneSource: context.timeZoneSource,
      userId: context.userId,
      homeProfileId: context.homeProfileId,
      proposedFlowTemp: null,
      skipReason,
    };

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.dailyRecord.create({
          data: {
            userId: context.userId,
            homeProfileId: context.homeProfileId,
            localDate: context.localDate,
            seasonMode,
            skipReason,
            // Predloga nema: polja ostaju eksplicitno prazna, da se iz samog
            // reda vidi da nije riječ o neuspjelom upisu.
            proposedFlowTemp: null,
            proposedAt: null,
            flowSetC: flowSet.c,
            flowSetSince: flowSet.since,
            flowSetSource: flowSet.source,
            modelVersion: DAILY_RECORD_MODEL_VERSION,
            params: {
              version: 1,
              timeZone: context.timeZone,
              timeZoneSource: context.timeZoneSource,
              skipReason,
            },
          },
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { status: 'exists', ...base };
      }
      throw error;
    }

    return { status: 'skipped', ...base };
  }
}
