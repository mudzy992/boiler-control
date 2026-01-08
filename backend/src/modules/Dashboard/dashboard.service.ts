import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserDashboard(userId: number) {
    const [homeProfiles, recommendations, latestWeather, latestBoilerHistory] =
      await Promise.all([
        this.getHomeProfiles(userId),
        this.getRecentRecommendations(userId),
        this.getLatestWeather(),
        this.getLatestBoilerHistory(userId),
      ]);

    const dashboardProfiles = await Promise.all(
      homeProfiles.map(async (profile) => {
        const thermostatIds = profile.thermostatDevices.map((t) => t.id);

        const recentHeatingEvents = await this.prisma.heatingEvent.findMany({
          where: {
            deviceId: { in: thermostatIds },
          },
          orderBy: { timestampStart: 'desc' },
          take: 5,
        });

        return {
          profile: {
            id: profile.id,
            floorArea: profile.floorArea,
            ceilingHeight: profile.ceilingHeight,
            insulationType: profile.insulationType,
            windowType: profile.windowType,
            heatingType: profile.heatingType,
            learningOffset: profile.learningOffset,
            learningConfidence: profile.learningConfidence,
          },

          thermostats: profile.thermostatDevices.map((t) => ({
            id: t.id,
            alias: t.alias,
            vendor: t.vendor,
            deviceId: t.deviceId,
            mode: t.mode,
            lastSeen: t.lastSeen,
          })),

          learningIntervals: profile.intervalLearnings.map((l) => ({
            intervalKey: l.intervalKey,
            avgReachTimeMin: l.avgReachTimeMin,
            avgOvershoot: l.avgOvershoot,
            offset: l.offset,
            confidence: l.confidence,
            samples: l.samples,
            lastUpdated: l.lastUpdated,
          })),

          recentHeatingEvents: recentHeatingEvents.map((e) => ({
            deviceId: e.deviceId,
            startedAt: e.timestampStart,
            endedAt: e.timestampEnd,
            currentTemp: e.currentTemp,
            targetTemp: e.targetTemp,
            hvacAction: e.hvacAction,
            source: e.source,
          })),

          systemStatus: {
            lastSuggestedFlowTemp: latestBoilerHistory?.suggestedTemp ?? null,
            lastActualFlowTemp: latestBoilerHistory?.actualTemp ?? null,
            lastExternalTemp: latestBoilerHistory?.externalTemp ?? null,
            lastHeatingStart: latestBoilerHistory?.heatingStart ?? null,
            lastHeatingEnd: latestBoilerHistory?.heatingEnd ?? null,
          },

          insights: {
            hasEnoughLearningData: profile.intervalLearnings.some(
              (l) => l.samples >= 5,
            ),
            averageConfidence:
              profile.intervalLearnings.length > 0
                ? profile.intervalLearnings.reduce(
                    (sum, l) => sum + l.confidence,
                    0,
                  ) / profile.intervalLearnings.length
                : 0,
          },
        };
      }),
    );

    return {
      system: {
        weather: latestWeather,
        recommendation: recommendations[0] ?? null,
        boiler: latestBoilerHistory,
      },
      homes: dashboardProfiles,
    };
  }

  // =========================
  // Internal helpers
  // =========================

  private getHomeProfiles(userId: number) {
    return this.prisma.homeProfile.findMany({
      where: { userId },
      include: {
        thermostatDevices: true,
        intervalLearnings: true,
      },
    });
  }

  private getRecentRecommendations(userId: number) {
    return this.prisma.recommendation.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 5,
    });
  }

  private getLatestWeather() {
    return this.prisma.weatherCache.findFirst({
      orderBy: { fetchedAt: 'desc' },
    });
  }

  private getLatestBoilerHistory(userId: number) {
    return this.prisma.boilerHistory.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
