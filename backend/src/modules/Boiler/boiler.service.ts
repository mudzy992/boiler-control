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

export interface FlowTempCalculationResult {
  flowTemp: number;
  confidence: number;
  mode: 'ANONYMOUS' | 'PROFILE_ONLY' | 'FULL';
  expectedHeatTimeMin?: number;
  intervalKey: string;
}

@Injectable()
export class BoilerService {
  private readonly logger = new Logger(BoilerService.name);
  private readonly DEFAULT_ANON_CITY = 'Visoko';

  constructor(
    private prisma: PrismaService,
    private weatherService: WeatherService,
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
          delta: e.targetTemp - e.currentTemp,
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
}
