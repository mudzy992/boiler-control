import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FlowTemperatureEngine } from '../Heating/engine/flow-temperature.engine';
import type { FlowTempInput } from '../Heating/engine/types';
import { buildRecommendationBreakdown } from '../HeatingRecommendation/recommendation-breakdown';
import { describeFlowClamp } from './clamp-log';
import { RecommendationWeatherService } from '../Weather/recommendation-weather.service';
import type { DailyWeatherInput } from '../Weather/daily-weather-input';
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
 *
 * `daily-2` (F1): zapis nosi `nightMinC`, `dayMeanC`, `dayMaxC`, `degreeHours`
 * i izvor noćnog minimuma (`HOURLY` / `DAILY_MIN`). Stariji redovi nemaju ta
 * polja, pa se `daily-1` i `daily-2` ne smiju miješati u analizi: noć u
 * `daily-1` redu nije „nula", nego nije ni postojala.
 */
export const DAILY_RECORD_MODEL_VERSION = 'daily-2';

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
  /**
   * Granice doma (`F13`). `include: { user: true }` učitava cijeli profil, pa
   * su dostupne — tip ih je samo prećutkivao. Trebaju F5.5: bez njih se klamp
   * na granicu doma ne može razlikovati od klampa na fizičku granicu kotla.
   */
  minHeatingFlowC: number | null;
  maxHeatingFlowC: number | null;
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
      const forecast = await this.tryLoadWeather(
        user.id,
        home.id,
        user.homeLocation,
      );
      return this.persistSkipped(
        context,
        home.seasonMode,
        'OUT_OF_SEASON',
        flowSet,
        forecast,
      );
    }

    if (!isWithinProposalWindow(now, zone.zone)) {
      // Noć se čita i za promašen prozor: red tada nema predlog, ali ima ono
      // što je predlog trebao da pokrije. Čitanje je u `try` grani jer do sada
      // ovaj put nije dirao ni bazu ni keš — pad prognoze ne smije pretvoriti
      // „promašen prozor" u „red nije nastao".
      const forecast = await this.tryLoadWeather(
        user.id,
        home.id,
        user.homeLocation,
      );
      return this.persistSkipped(
        context,
        home.seasonMode,
        'MISSED_WINDOW',
        flowSet,
        forecast,
      );
    }

    const weather = await this.tryLoadWeather(
      user.id,
      home.id,
      user.homeLocation,
    );
    if (!weather) {
      return this.persistSkipped(
        context,
        home.seasonMode,
        'NO_WEATHER',
        flowSet,
      );
    }

    if (home.seasonMode === 'AUTO' && isAutoOutOfSeason(weather)) {
      return this.persistSkipped(
        context,
        home.seasonMode,
        'OUT_OF_SEASON',
        flowSet,
        weather,
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
  ): Promise<DailyWeatherInput | null> {
    const v2 = await this.recommendationWeather.getV2WeatherInput(
      userId,
      homeProfileId,
    );
    // v2 nosi i satnu prognozu, pa se vraća cijeli unos — ne samo min/max.
    if (v2 && Number.isFinite(v2.tempMin) && Number.isFinite(v2.tempMax)) {
      return v2;
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
      // Nema satne prognoze: noćni minimum je dnevni, i to je označeno. Polja
      // koja traže sate (`dayMeanC`, `dayMaxC`, `degreeHours`) ostaju `null`,
      // jer se iz dnevnog min/max ne mogu izvesti — a izmišljati ih bi značilo
      // da kontroler računa na broj koji niko nije izmjerio.
      return {
        tempMin: cachedMin,
        tempMax: cachedMax,
        nightMinC: cachedMin,
        nightMinSource: 'DAILY_MIN',
        nightHoursUsed: 0,
        dayMeanC: null,
        dayMaxC: null,
        degreeHours: null,
      };
    }

    return null;
  }

  /**
   * Prognoza za red koji nema predlog. Greška se ne diže dalje: takav red
   * nastaje i bez prognoze, pa bi pad keša oduzeo zapis koji je do sada
   * nastajao. Vraća `null` i to se u zapisu vidi kao „nema noći", ne kao nula.
   */
  private async tryLoadWeather(
    userId: number,
    homeProfileId: number,
    city: string | null,
  ): Promise<DailyWeatherInput | null> {
    try {
      return await this.loadWeather(userId, homeProfileId, city);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Prognoza nije pročitana za kuću ${homeProfileId} (${message}); ` +
          `red nastaje bez noćnog minimuma.`,
      );
      return null;
    }
  }

  private async persistProposal(
    context: RecordContext,
    home: LoadedHome,
    weather: DailyWeatherInput,
    now: Date,
    flowSet: FlowSetSnapshot,
  ): Promise<DailyRecordWriteResult> {
    const intervalKey = intervalKeyForLocalDate(context.localDate);
    const intervalLearning =
      await this.prisma.heatingIntervalLearning.findUnique({
        where: {
          homeProfileId_intervalKey: {
            homeProfileId: home.id,
            intervalKey,
          },
        },
      });

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
      // Motor i dalje traži samo min/max; noćni minimum i dnevni prosjek idu
      // u zapis, a formula ih (za sada) ne čita. To je namjerno: F1 uvodi
      // podatak, a ne mijenja predlog.
      weather: { tempMin: weather.tempMin, tempMax: weather.tempMax },
    };

    const result = FlowTemperatureEngine.calculate(input);
    const proposedFlowTemp = clampFlowTemp(result.finalTemp);

    // F5.5: klamp ide u **log**, ne samo u `params`. Tri različita razloga
    // (fizička granica, granica doma, dnevna promjena) do sada su izgledala
    // isto: „polazna je 55, traženo je 58". Bez imena se korisničko
    // podešavanje čita kao kvar motora, a dnevno usporavanje kao odsijecanje.
    const clampReport = describeFlowClamp({
      rawC: result.finalTemp,
      clampedC: proposedFlowTemp,
      systemMinC: FLOW_TEMP_MIN_C,
      systemMaxC: FLOW_TEMP_MAX_C,
      homeMinC: home.minHeatingFlowC ?? null,
      homeMaxC: home.maxHeatingFlowC ?? null,
    });
    if (clampReport.applied) {
      // `warn` a ne `log`: klamp na fizičkoj granici je signal da motor traži
      // nemoguće, a ne rutina. Granica doma je očekivana, ali se i ona mora
      // vidjeti — po tome se razlikuje „korisnik tako želi" od „motor griješi".
      this.logger.warn(
        `Kuća ${home.id} ${context.localDate}: ${clampReport.message} ` +
          `(mode ${input.mode}${intervalKey ? `, interval ${intervalKey}` : ''})`,
      );
    }
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
        // Motor je dobio samo min/max; ostalo su podaci zapisa, ne ulaz
        // formule — pa se ovdje razdvajaju da bi zapis bio preračunljiv.
        weather: { tempMin: weather.tempMin, tempMax: weather.tempMax },
        forecast: {
          nightMinC: weather.nightMinC ?? null,
          nightMinSource: weather.nightMinSource ?? null,
          nightHoursUsed: weather.nightHoursUsed ?? null,
          dayMeanC: weather.dayMeanC ?? null,
          dayMaxC: weather.dayMaxC ?? null,
          degreeHours: weather.degreeHours ?? null,
        },
        homeProfile: input.homeProfile,
        intervalLearning: input.intervalLearning ?? null,
      },
      result,
      breakdown,
      clamp: {
        // F5.5: `bound` je **isti** izvor kao log (`clamp-log.ts`), da zapis i
        // log ne mogu reći različito. `applied` dolazi iz istog izvještaja, pa
        // ni prag od 0,001 K nije dupliran.
        applied: clampReport.applied,
        bound: clampReport.bound,
        cutK: clampReport.cutK,
        rawFinalTemp: result.finalTemp,
        minC: FLOW_TEMP_MIN_C,
        maxC: FLOW_TEMP_MAX_C,
        homeMinC: home.minHeatingFlowC ?? null,
        homeMaxC: home.maxHeatingFlowC ?? null,
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
            // F1: ono što je predlog trebao da pokrije. Bez `nightMinC`
            // kontroler nikad nije imao ravnotežnu polaznu, pa noćni pod nije
            // postojao. `null` (ne nula) kad prognoza ne postoji.
            nightMinC: weather.nightMinC ?? null,
            dayMeanC: weather.dayMeanC ?? null,
            dayMaxC: weather.dayMaxC ?? null,
            degreeHours: weather.degreeHours ?? null,
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
    /**
     * Prognoza, kad je već pročitana. Red nastaje i bez nje (`MISSED_WINDOW`,
     * `NO_WEATHER`), pa je `null` normalno stanje — ali kad postoji, noć u
     * zapis ide i za preskočen dan: kontroler sutra pita „je li noć bila
     * pokrivena", a odgovor ne smije zavisiti od toga je li predlog teoretski
     * mogao nastati.
     */
    weather?: DailyWeatherInput | null,
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
            nightMinC: weather?.nightMinC ?? null,
            dayMeanC: weather?.dayMeanC ?? null,
            dayMaxC: weather?.dayMaxC ?? null,
            degreeHours: weather?.degreeHours ?? null,
            params: {
              version: 1,
              timeZone: context.timeZone,
              timeZoneSource: context.timeZoneSource,
              skipReason,
              forecast: weather
                ? {
                    nightMinC: weather.nightMinC ?? null,
                    nightMinSource: weather.nightMinSource ?? null,
                    nightHoursUsed: weather.nightHoursUsed ?? null,
                    dayMeanC: weather.dayMeanC ?? null,
                    dayMaxC: weather.dayMaxC ?? null,
                    degreeHours: weather.degreeHours ?? null,
                  }
                : null,
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
