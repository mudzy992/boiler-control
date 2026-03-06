import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { addMinutes } from 'date-fns';
import {
  FlowTempInput,
  HeatingEventInput,
  IntervalLearningInput,
} from '../Heating/engine/types';
import { WeatherService } from '../Weather/weather.service';
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
  private readonly MIN_CURRENT_FLOW_TEMP = 48;
  private readonly MAX_CURRENT_FLOW_TEMP = 55;

  constructor(
    private prisma: PrismaService,
    private weatherService: WeatherService,
    private metricsService: MetricsService,
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

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      const weather = await this.weatherService.getTodayWeather(
        user?.homeLocation ?? this.DEFAULT_ANON_CITY,
      );
      tempMin = weather.temp_min!;
      tempMax = weather.temp_max!;
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
    let homeProfileInput = {
      floorArea: 150,
      learningOffset: 0,
      insulationFactor: 1,
      confidence: 0.1,
    };

    let homeProfileId: number | null = null;

    if (userId) {
      const profile = await this.prisma.homeProfile.findFirst({
        where: { userId },
      });

      if (profile) {
        homeProfileId = profile.id;
        homeProfileInput = {
          floorArea: profile.floorArea,
          learningOffset: profile.learningOffset,
          insulationFactor: 1,
          confidence: profile.learningConfidence,
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
          if (avgTemp > 16) { // 16°C cut-off
             return this.createOffResult(intervalKey, mode);
          }
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

  private createOffResult(intervalKey: string, mode: any): FlowTempCalculationResult {
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
<<<<<<< Updated upstream
=======

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
  async setCurrentTemp(
    userId: number,
    currentFlowTemp: number,
  ): Promise<SetCurrentTempResult> {
    if (
      currentFlowTemp < this.MIN_CURRENT_FLOW_TEMP ||
      currentFlowTemp > this.MAX_CURRENT_FLOW_TEMP
    ) {
      throw new Error(
        `Current flow temperature must be between ${this.MIN_CURRENT_FLOW_TEMP}°C and ${this.MAX_CURRENT_FLOW_TEMP}°C`,
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
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
}
