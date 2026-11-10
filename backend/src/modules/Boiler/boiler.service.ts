import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { addMinutes } from 'date-fns';
import {
  FlowTempInput,
  HeatingEventInput,
  HomeProfileInput,
  IntervalLearningInput,
} from '../Heating/engine/types';
import { WeatherService } from '../Weather/weather.service';
import { BoilerWeatherService } from '../Weather/boiler-weather.service';
import { FlowTemperatureEngine } from '../Heating/engine/flow-temperature.engine';
import { MetricsService } from '../../common/metrics.service';

export interface FlowTempCalculationResult {
  flowTemp: number;
  confidence: number;
  mode: 'ANONYMOUS' | 'PROFILE_ONLY' | 'FULL';
  expectedHeatTimeMin?: number;
  intervalKey: string;
}

export interface SetCurrentTempResult {
  userId: number;
  currentFlowTemp: number;
  setAt: Date;
  latestBoilerHistoryId: number | null;
  latestBoilerHistoryUpdated: boolean;
}

@Injectable()
export class BoilerService {
  private readonly logger = new Logger(BoilerService.name);
  private readonly DEFAULT_ANON_CITY = 'Visoko';
  /**
   * Granice koje važe kad dom nema svoje (`F13`).
   *
   * `SYSTEM_MIN` je zadana donja granica, a ne jedina: dom može imati nižu
   * (`HomeProfile.minHeatingFlowC`), jer je donja granica fizička i zavisi od
   * kotla i načina grijanja. Motor računa do 46, pa bi tvrda 48 značila da
   * korisnik dobija predlog koji ne može upisati.
   */
  private readonly SYSTEM_MIN_CURRENT_FLOW_TEMP = 48;
  private readonly SYSTEM_MAX_CURRENT_FLOW_TEMP = 55;
  /** Apsolutni raspon iz `flow-bounds.ts` — dom ga smije suziti, nikad proširiti. */
  private readonly ABSOLUTE_MIN_FLOW_C = 30;
  private readonly ABSOLUTE_MAX_FLOW_C = 55;

  constructor(
    private prisma: PrismaService,
    private weatherService: WeatherService,
    private metricsService: MetricsService,
    private readonly boilerWeather: BoilerWeatherService,
  ) {}

  /**
   * Calculate optimal boiler flow temperature based on
   * profile, interval learning, recent heating behavior and weather.
   *
   * ⚠️ Pure calculation only – NO persistence here.
   */
  async calculateFlowTemp(userId?: number): Promise<FlowTempCalculationResult> {
    const intervalKey = this.getIntervalKey();

    let mode: FlowTempInput['mode'] = 'ANONYMOUS';

    // -----------------------------
    // 1️⃣ Weather (mandatory)
    // -----------------------------
    let tempMin = 0;
    let tempMax = 0;
    // The same first profile drives the existing calculation and opt-in v2 weather.
    const profile = userId
      ? await this.prisma.homeProfile.findFirst({ where: { userId } })
      : null;

    if (userId) {
      const v2Weather = profile
        ? await this.boilerWeather.getV2WeatherInput(userId, profile.id)
        : null;
      if (v2Weather) {
        tempMin = v2Weather.tempMin;
        tempMax = v2Weather.tempMax;
      } else {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });
        const weather = await this.weatherService.getTodayWeather(
          user?.homeLocation ?? this.DEFAULT_ANON_CITY,
        );
        tempMin = weather.temp_min!;
        tempMax = weather.temp_max!;
      }
    } else {
      const weather = await this.weatherService.getTodayWeather(
        this.DEFAULT_ANON_CITY,
      );
      tempMin = weather.temp_min!;
      tempMax = weather.temp_max!;
    }

    // -----------------------------
    // 2️⃣ Home profile (optional)
    // -----------------------------
    let homeProfileInput: HomeProfileInput = {
      floorArea: 150,
      learningOffset: 0,
      insulationFactor: 1,
      confidence: 0.1,
    };

    let homeProfileId: number | null = null;

    if (profile) {
      homeProfileId = profile.id;
      homeProfileInput = {
        floorArea: profile.floorArea,
        learningOffset: profile.learningOffset,
        insulationFactor: 1,
        confidence: profile.learningConfidence,
        // F13: motor poštuje granice doma, pa predlog nikad nije ispod onoga
        // što korisnik smije upisati (uzrok „predlaže 46, a unos traži 48").
        minFlowC: profile.minHeatingFlowC ?? null,
        maxFlowC: profile.maxHeatingFlowC ?? null,
      };
      mode = 'PROFILE_ONLY';

      // --- SEASONALITY CHECK ---
      const { seasonMode } = profile;
      if (seasonMode === 'SUMMER') {
        return this.createOffResult(intervalKey, mode);
      }
      if (seasonMode === 'AUTO') {
        // Simple auto logic: if average of min/max > 15°C -> SUMMER
        const avgTemp = (tempMin + tempMax) / 2;
        if (avgTemp > 16) {
          // 16°C cut-off
          return this.createOffResult(intervalKey, mode);
        }
      }
    }

    // -----------------------------
    // 3️⃣ Interval learning (optional)
    // -----------------------------
    let intervalLearningInput: IntervalLearningInput | undefined = undefined;
    let expectedHeatTimeMin: number | undefined = undefined;

    if (homeProfileId) {
      const intervalLearning =
        await this.prisma.heatingIntervalLearning.findUnique({
          where: {
            homeProfileId_intervalKey: {
              homeProfileId,
              intervalKey,
            },
          },
        });

      if (intervalLearning) {
        intervalLearningInput = {
          offset: intervalLearning.offset,
          confidence: intervalLearning.confidence,
          avgReachTimeMin: intervalLearning.avgReachTimeMin,
          avgOvershoot: intervalLearning.avgOvershoot,
        };
        expectedHeatTimeMin = intervalLearning.avgReachTimeMin ?? undefined;
        mode = 'FULL';
      }
    }

    // -----------------------------
    // 4️⃣ Recent heating behavior (last 7 days)
    // -----------------------------
    let recentEventsInput: HeatingEventInput[] | undefined = undefined;

    if (userId) {
      const recentEvents = await this.prisma.heatingEvent.findMany({
        where: {
          thermostat: { userId },
          timestampStart: {
            gte: addMinutes(new Date(), -7 * 24 * 60),
          },
        },
        orderBy: { timestampStart: 'desc' },
        take: 10,
      });

      if (recentEvents.length > 0) {
        recentEventsInput = recentEvents.map((e) => ({
          delta: e.roomTargetTemp - e.roomCurrentTemp,
          active: !e.timestampEnd,
        }));
      }
    }

    // -----------------------------
    // 5️⃣ Build engine input
    // -----------------------------
    const input: FlowTempInput = {
      mode,
      intervalKey,
      homeProfile: homeProfileInput,
      intervalLearning: intervalLearningInput,
      recentEvents: recentEventsInput,
      weather: { tempMin, tempMax },
    };

    // -----------------------------
    // 6️⃣ Calculate
    // -----------------------------
    const result = FlowTemperatureEngine.calculate(input);

    this.logger.log(
      `[BoilerCalc] User=${userId ?? 'ANON'} | Mode=${mode} | Interval=${intervalKey} | FlowTemp=${result.finalTemp}`,
    );

    return {
      flowTemp: result.finalTemp,
      confidence: result.confidence,
      mode,
      expectedHeatTimeMin,
      intervalKey,
    };
  }

  private createOffResult(
    intervalKey: string,
    mode: any,
  ): FlowTempCalculationResult {
    this.logger.log(`[BoilerCalc] Seasonality -> HEATING OFF`);
    return {
      flowTemp: 0,
      confidence: 1,
      mode,
      expectedHeatTimeMin: 0,
      intervalKey,
    };
  }

  // -----------------------------
  // Interval key helper
  // -----------------------------
  private getIntervalKey(): string {
    const now = new Date();
    const hour = now.getHours();
    const weekday = now.getDay();

    let part = 'night';
    if (hour >= 6 && hour < 9) part = 'morning';
    else if (hour >= 9 && hour < 12) part = 'late_morning';
    else if (hour >= 12 && hour < 17) part = 'afternoon';
    else if (hour >= 17 && hour < 22) part = 'evening';

    const dayType = weekday === 0 || weekday === 6 ? 'weekend' : 'weekday';

    return `${dayType}_${part}`;
  }

  /**
   * Fetch boiler history for a user
   */
  async getBoilerHistory(userId: number) {
    try {
      const history = await this.prisma.boilerHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return history;
    } catch (error) {
      this.logger.error('Error fetching boiler history', error);
      return [];
    }
  }

  /**
   * Persist user-confirmed current boiler flow temperature and
   * sync it to the latest boiler history row (if one exists).
   */
  /**
   * Raspon u koji korisnik smije upisati polaznu (`F13`).
   *
   * Izvor je **dom**, ne konstanta: `minHeatingFlowC` je fizička granica tog
   * kotla/načina grijanja, a `maxHeatingFlowC` već postoji (`19` §2). Oba se
   * sijeku sa apsolutnim rasponom 30–55, pa neispravan zapis u bazi (npr.
   * 20 ili 70) ne može proširiti opseg — samo ga suziti.
   */
  async flowTempRange(userId: number): Promise<{
    min: number;
    max: number;
    source: 'HOME' | 'SYSTEM';
  }> {
    const home = await this.prisma.homeProfile.findFirst({
      where: { userId },
      select: { minHeatingFlowC: true, maxHeatingFlowC: true },
    });

    const requestedMin =
      home?.minHeatingFlowC ?? this.SYSTEM_MIN_CURRENT_FLOW_TEMP;
    const requestedMax =
      home?.maxHeatingFlowC ?? this.SYSTEM_MAX_CURRENT_FLOW_TEMP;

    const min = Math.max(this.ABSOLUTE_MIN_FLOW_C, requestedMin);
    const max = Math.min(this.ABSOLUTE_MAX_FLOW_C, requestedMax);

    // Dom koji je sam sebi okrenut naopačke (min > max) nije razlog da se
    // korisnik zaključa: vraća se sigurni sistemski raspon i to je vidljivo
    // kroz `source`.
    if (!(min <= max)) {
      return {
        min: this.SYSTEM_MIN_CURRENT_FLOW_TEMP,
        max: this.SYSTEM_MAX_CURRENT_FLOW_TEMP,
        source: 'SYSTEM',
      };
    }

    const source: 'HOME' | 'SYSTEM' =
      home?.minHeatingFlowC != null || home?.maxHeatingFlowC != null
        ? 'HOME'
        : 'SYSTEM';

    return { min, max, source };
  }

  async setCurrentTemp(
    userId: number,
    currentFlowTemp: number,
  ): Promise<SetCurrentTempResult> {
    const range = await this.flowTempRange(userId);
    if (currentFlowTemp < range.min || currentFlowTemp > range.max) {
      throw new Error(
        `Current flow temperature must be between ${range.min}°C and ${range.max}°C`,
      );
    }

    const setAt = new Date();

    const latestHistory = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          currentBoilerFlowTemp: currentFlowTemp,
          currentBoilerFlowTempSetAt: setAt,
        },
      });

      const latest = await tx.boilerHistory.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      if (latest) {
        await tx.boilerHistory.update({
          where: { id: latest.id },
          data: { actualFlowTemp: currentFlowTemp },
        });
      }

      return latest;
    });

    this.metricsService.incrementCounter('boiler_current_temp_updates_total');
    this.logger.log(
      `[BoilerCurrentTemp] User=${userId} Temp=${currentFlowTemp} SetAt=${setAt.toISOString()}`,
    );

    return {
      userId,
      currentFlowTemp,
      setAt,
      latestBoilerHistoryId: latestHistory?.id ?? null,
      latestBoilerHistoryUpdated: !!latestHistory,
    };
  }
}
