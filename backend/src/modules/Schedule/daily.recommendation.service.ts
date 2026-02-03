// heating/daily.recommendation.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { FlowTemperatureEngine } from '../Heating/engine/flow-temperature.engine';
import type { FlowTempInput } from '../Heating/engine/types';
import { NotificationsService } from '../Notification/notifications.service';
import { NotificationType } from 'src/generated/prisma/enums';

@Injectable()
export class DailyRecommendationService {
  private readonly logger = new Logger(DailyRecommendationService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationsService,
  ) {}

  // svaki dan u 6:00
  @Cron('0 0 * * *', {
    name: 'daily-recommendations',
    disabled:
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test',
  })
  async generateDailyRecommendations() {
    this.logger.log('Starting daily boiler recommendations...');

    const users = await this.prisma.user.findMany({
      include: {
        homeProfiles: true,
        thermostatDevices: true,
      },
    });

    for (const user of users) {
      try {
        const home = user.homeProfiles[0];
        if (!home || !user.homeLocation) continue;

        // --- priprema inputa za FlowTemperatureEngine ---
        const intervalKey = this.getIntervalKey();
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
          recentEvents: [], // za jutarnju preporuku trenutno nema recent events
          weather: await this.getWeatherInput(user.homeLocation),
        };

        const flowResult = FlowTemperatureEngine.calculate(input);

        // --- spremanje preporuke u bazu ---
        await this.prisma.recommendation.create({
          data: {
            userId: user.id,
            date: new Date(),
            recommendedFlowTemp: flowResult.finalTemp,
            expectedHeatTimeMin: 0, // po potrebi može se dodati logika
            confidenceScore: flowResult.confidence,
          },
        });

        const alreadySent = await this.prisma.notification.findFirst({
          where: {
            userId: user.id,
            type: NotificationType.DAILY_RECOMMENDATION,
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        });

        if (alreadySent) {
          this.logger.warn(
            `Daily recommendation already sent for user ${user.id}`,
          );
          continue;
        }

        await this.notificationService.notifyUser({
          userId: user.id,
          type: NotificationType.DAILY_RECOMMENDATION,
          title: 'Preporučena temperatura',
          message: `Nova dnevna preporučena polazna temperatura kotla je ${flowResult.finalTemp}°C`,
          data: {
            type: NotificationType.DAILY_RECOMMENDATION,
            recommendedFlowTemp: flowResult.finalTemp,
            confidence: flowResult.confidence,
          },
        });

        this.logger.log(
          `User ${user.id} daily recommendation created | FlowTemp: ${flowResult.finalTemp}°C | Confidence: ${flowResult.confidence}`,
        );
      } catch (err) {
        this.logger.error(`Failed for user ${user.id}: ${err}`, err.stack);
      }
    }

    this.logger.log('Daily recommendations finished.');
  }

  private getIntervalKey(): string {
    const now = new Date();
    //const hour = now.getHours();
    const weekday = now.getDay();
    const part = 'morning';
    const dayType = weekday === 0 || weekday === 6 ? 'weekend' : 'weekday';
    return `${dayType}_${part}`;
  }

  private async getWeatherInput(city: string) {
    const weather = await this.prisma.weatherCache.findFirst({
      where: { city },
      orderBy: { fetchedAt: 'desc' },
    });
    return {
      tempMin: weather?.temp_min ?? 0,
      tempMax: weather?.temp_max ?? 0,
    };
  }
}
