// heating/boiler.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { addMinutes } from 'date-fns';
import {
  FlowTempInput,
  HeatingEventInput,
  IntervalLearningInput,
} from '../Heating/engine/types';
import { FlowTemperatureEngine } from '../Heating/engine/flow-temperature.engine';

@Injectable()
export class BoilerService {
  private readonly logger = new Logger(BoilerService.name);

  constructor(private prisma: PrismaService) {}

  async getStartTemp(userId?: number): Promise<number> {
    let mode: FlowTempInput['mode'] = 'ANONYMOUS';
    let homeProfileInput = {
      floorArea: 150,
      learningOffset: 0,
      insulationFactor: 1,
      confidence: 0,
    };
    let intervalLearningInput: IntervalLearningInput | undefined = undefined;
    let recentEventsInput: HeatingEventInput[] | undefined = undefined;

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { homeProfiles: true },
      });
      if (!user) throw new Error('User not found');
      const home = user.homeProfiles[0];
      if (home) {
        homeProfileInput = {
          floorArea: home.floorArea,
          learningOffset: home.learningOffset,
          insulationFactor: 1,
          confidence: home.learningConfidence,
        };
        mode = 'PROFILE_ONLY';
      }

      const intervalKey = this.getIntervalKey();
      const intervalLearning =
        await this.prisma.heatingIntervalLearning.findUnique({
          where: {
            homeProfileId_intervalKey: {
              homeProfileId: home?.id ?? 0,
              intervalKey,
            },
          },
        });
      if (intervalLearning) {
        intervalLearningInput = {
          offset: intervalLearning.offset,
          confidence: intervalLearning.confidence,
        };
        mode = 'FULL';
      }

      const lastWeekEvents = await this.prisma.heatingEvent.findMany({
        where: {
          thermostat: { userId },
          timestampStart: { gte: addMinutes(new Date(), -7 * 24 * 60 * 60) },
        },
      });
      if (lastWeekEvents.length > 0) {
        recentEventsInput = lastWeekEvents.map((e) => ({
          delta: e.targetTemp - e.currentTemp,
          active: !e.timestampEnd,
        }));
      }
    }

    const input: FlowTempInput = {
      mode,
      homeProfile: homeProfileInput,
      intervalKey: this.getIntervalKey(),
      intervalLearning: intervalLearningInput,
      recentEvents: recentEventsInput,
      weather: { tempMin: 0, tempMax: 0 }, // fallback
    };

    const result = FlowTemperatureEngine.calculate(input);
    this.logger.log(
      `[Boiler] User ${userId ?? 'ANON'} | Mode: ${mode} | FinalTemp: ${result.finalTemp}`,
    );
    return result.finalTemp;
  }

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

  // heating/boiler.service.ts

  async createMorningBoilerHistory(userId: number) {
    const finalTemp = await this.getStartTemp(userId);

    const lastWeather = await this.prisma.weatherCache.findFirst({
      orderBy: { fetchedAt: 'desc' },
    });

    const externalTemp = lastWeather?.temp_min ?? 0;

    const history = await this.prisma.boilerHistory.create({
      data: {
        userId,
        externalTemp,
        suggestedTemp: finalTemp,
        actualTemp: null,
        heatingStart: null,
        heatingEnd: null,
      },
    });

    return history;
  }
}
