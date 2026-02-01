import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FlowTemperatureEngine } from '../Heating/engine/flow-temperature.engine';
import { FlowTempInput, FlowCalcMode } from '../Heating/engine/types';

export interface HeatingEventData {
  userId: number;
  deviceId: number;
  timestampStart: Date;
  timestampEnd?: Date;
  currentTemp: number;
  targetTemp: number;
  flowTemp: number;
}

@Injectable()
export class HeatingRecommendationService {
  private readonly logger = new Logger(HeatingRecommendationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Called ONLY when heating STARTS or ENDS
   * No polling, no vendor API calls here
   */
  async processHeatingEvent(event: HeatingEventData): Promise<void> {
    /** 1️⃣ Load device + home profile */
    const device = await this.prisma.thermostatDevice.findUnique({
      where: { id: event.deviceId },
      include: { homeProfile: true },
    });

    if (!device?.homeProfile) {
      this.logger.warn(
        `[HeatingRecommendation] Device or HomeProfile not found (deviceId=${event.deviceId})`,
      );
      return;
    }

    /** 2️⃣ Resolve interval key */
    const intervalKey = this.getIntervalKey();
    const intervalLearning = this.getOrCreateIntervalLearning(
      device.homeProfile,
      intervalKey,
    );

    // 2️⃣ Compute overshoot and reach time
    const overshoot = (event.currentTemp ?? 0) - (event.targetTemp ?? 0);
    const reachTime =
      event.timestampEnd && event.timestampStart
        ? (event.timestampEnd.getTime() - event.timestampStart.getTime()) /
          60000
        : 0;

    /** 4️⃣ If event ENDED → update learning */
    if (event.timestampEnd) {
      const reachTimeMin =
        (event.timestampEnd.getTime() - event.timestampStart.getTime()) / 60000;

      const overshoot = event.currentTemp - event.targetTemp;

      const samples = intervalLearning.samples + 1;

      const avgReachTimeMin =
        (intervalLearning.avgReachTimeMin * intervalLearning.samples +
          reachTimeMin) /
        samples;

      const avgOvershoot =
        (intervalLearning.avgOvershoot * intervalLearning.samples + overshoot) /
        samples;

      const offset =
        (intervalLearning.offset * intervalLearning.samples + overshoot) /
        samples;

      const confidence = Math.min(
        1,
        (intervalLearning.confidence * intervalLearning.samples + 0.1) /
          samples,
      );

      await this.prisma.heatingIntervalLearning.update({
        where: { id: intervalLearning.id },
        data: {
          avgReachTimeMin,
          avgOvershoot,
          offset,
          confidence,
          samples,
          lastUpdated: new Date(),
        },
      });

      this.logger.debug(
        `[IntervalLearning] ${intervalKey} | reach=${reachTimeMin.toFixed(
          1,
        )}min overshoot=${overshoot.toFixed(2)}°C`,
      );
    }

    /** 5️⃣ Weather (cached only) */
    const weather = await this.prisma.weatherCache.findFirst({
      orderBy: { fetchedAt: 'desc' },
    });

    const mode: FlowCalcMode = 'FULL';
    const weatherInput = {
      tempMin: weather?.temp_min ?? 0,
      tempMax: weather?.temp_max ?? 0,
    };

    /** 6️⃣ Flow temperature calculation */
    const input: FlowTempInput = {
      mode: mode,
      homeProfile: {
        floorArea: device.homeProfile.floorArea,
        learningOffset: device.homeProfile.learningOffset,
        confidence: device.homeProfile.learningConfidence,
        insulationFactor: 1,
      },
      intervalKey,
      intervalLearning: {
        offset: intervalLearning.offset,
        confidence: intervalLearning.confidence,
        avgOvershoot: intervalLearning.avgOvershoot,
        avgReachTimeMin: intervalLearning.avgReachTimeMin,
      },
      recentEvents: [],
      weather: weatherInput,
    };

    const flowResult = FlowTemperatureEngine.calculate(input);

    /** 7️⃣ Upsert daily recommendation */
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.prisma.recommendation.findFirst({
      where: {
        userId: event.userId,
        date: today,
      },
    });

    if (!existing) {
      await this.prisma.recommendation.create({
        data: {
          userId: event.userId,
          date: today,
          recommendedFlowTemp: flowResult.finalTemp,
          expectedHeatTimeMin: intervalLearning.avgReachTimeMin ?? 0,
          confidenceScore: flowResult.confidence,
        },
      });
    } else {
      await this.prisma.recommendation.update({
        where: { id: existing.id },
        data: {
          recommendedFlowTemp: flowResult.finalTemp,
          expectedHeatTimeMin: intervalLearning.avgReachTimeMin ?? 0,
          confidenceScore: flowResult.confidence,
        },
      });
    }

    this.logger.debug(
      `[HeatingRecommendation] user=${event.userId} flow=${flowResult.finalTemp}°C`,
    );
  }

  /** Time-based learning bucket */
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
