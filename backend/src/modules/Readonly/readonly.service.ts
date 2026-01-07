import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReadonlyService {
  constructor(private prisma: PrismaService) {}

  async getWeatherCache(city?: string) {
    return this.prisma.weatherCache.findMany({
      where: city ? { city } : {},
      orderBy: { fetchedAt: 'desc' },
      take: 10,
    });
  }

  async getBoilerHistory(userId: number) {
    return this.prisma.boilerHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  async getRecommendations(userId: number) {
    return this.prisma.recommendation.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 5,
    });
  }

  async getIntervalLearnings(homeProfileId: number) {
    return this.prisma.heatingIntervalLearning.findMany({
      where: { homeProfileId },
      orderBy: { lastUpdated: 'desc' },
    });
  }
}
