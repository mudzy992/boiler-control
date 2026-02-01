import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FlowTemperatureEngine } from '../Heating/engine/flow-temperature.engine';
import { FlowTempInput, FlowCalcMode } from '../Heating/engine/types';

export interface HeatingEventData {
  userId: number;
  deviceId: number;
  timestampStart: Date;
  timestampEnd?: Date;
  roomCurrentTemp: number;
  roomTargetTemp: number;
  boilerFlowTemp: number;
}

@Injectable()
export class HeatingRecommendationService {
  private readonly logger = new Logger(HeatingRecommendationService.name);

  constructor(private prisma: PrismaService) {}

  /** Process heating event (start or end) */
  async processHeatingEvent(event: HeatingEventData) {
    // 1️⃣ Fetch last interval learning for this device's home profile
    const device = await this.prisma.thermostatDevice.findUnique({
      where: { id: event.deviceId },
      include: { homeProfile: { include: { intervalLearnings: true } } },
    });
    if (!device || !device.homeProfile) return;

    const intervalKey = this.getIntervalKey();
    const intervalLearning = this.getOrCreateIntervalLearning(
      device.homeProfile,
      intervalKey,
    );

    // 2️⃣ Compute overshoot and reach time
    const overshoot =
      (event.roomCurrentTemp ?? 0) - (event.roomTargetTemp ?? 0);
    const reachTime =
      event.timestampEnd && event.timestampStart
        ? (event.timestampEnd.getTime() - event.timestampStart.getTime()) /
          60000
        : 0;

    // 3️⃣ Update interval learning if event ended
    if (event.timestampEnd) {
      const newSamples = (intervalLearning.samples ?? 0) + 1;

      const newAvgReach =
        ((intervalLearning.avgReachTimeMin ?? 0) *
          (intervalLearning.samples ?? 0) +
          reachTime) /
        newSamples;

      const newAvgOvershoot =
        ((intervalLearning.avgOvershoot ?? 0) *
          (intervalLearning.samples ?? 0) +
          overshoot) /
        newSamples;

      const newOffset =
        ((intervalLearning.offset ?? 0) * (intervalLearning.samples ?? 0) +
          overshoot) /
        newSamples;

      const newConfidence = Math.min(
        1,
        ((intervalLearning.confidence ?? 0.1) *
          (intervalLearning.samples ?? 0) +
          0.1) /
          newSamples,
      );

      await this.prisma.heatingIntervalLearning.updateMany({
        where: { id: intervalLearning.id },
        data: {
          avgReachTimeMin: newAvgReach,
          avgOvershoot: newAvgOvershoot,
          offset: newOffset,
          samples: newSamples,
          confidence: newConfidence,
          lastUpdated: new Date(),
        },
      });

      this.logger.debug(
        `[HeatingRecommendation] Updated IntervalLearning ${intervalKey} | reachTime=${reachTime.toFixed(
          2,
        )} | overshoot=${overshoot.toFixed(2)}`,
      );
    }

    const mode: FlowCalcMode = 'FULL';

    let tempMin = 0;
    let tempMax = 0;
    const weather = await this.prisma.weatherCache.findFirst({
      orderBy: { fetchedAt: 'desc' },
    });
    if (weather) {
      tempMin = weather.temp_min!;
      tempMax = weather.temp_max!;
    }

    // 4️⃣ Compute recommended flow temperature
    const input: FlowTempInput = {
      mode,
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
      weather: { tempMin, tempMax }, // fallback, može dodati stvarne temp kasnije
    };

    const flowResult = FlowTemperatureEngine.calculate(input);

    // 5️⃣ Upsert recommendation za danas
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.prisma.recommendation.findFirst({
      where: { userId: event.userId, date: { gte: today } },
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
          date: today,
        },
      });
    }

    this.logger.debug(
      `[HeatingRecommendation] User ${event.userId} | FlowTemp=${flowResult.finalTemp}`,
    );
  }

  /** Helper: get or create interval learning */
  private getOrCreateIntervalLearning(homeProfile: any, intervalKey: string) {
    let learning = homeProfile.intervalLearnings?.find(
      (i) => i.intervalKey === intervalKey,
    );
    if (!learning) {
      learning = {
        id: 0, // dummy, real create treba preko prisma ako želimo persist
        intervalKey,
        offset: 0,
        avgOvershoot: 0,
        avgReachTimeMin: 0,
        samples: 0,
        confidence: 0.1,
      };
      homeProfile.intervalLearnings.push(learning);
    }
    return learning;
  }

  /** Simple interval key based on time & day */
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
