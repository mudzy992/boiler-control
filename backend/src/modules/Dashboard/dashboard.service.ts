import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  HeatingEventsQuery,
  HeatingStatsQuery,
  LearningTrendsQuery,
} from './dashboard.controller';
import { HeatingEventWhereInput } from 'src/generated/prisma/models';

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

        const thermostatPrograms = await this.prisma.thermostatProgram.findMany(
          {
            where: { deviceId: { in: thermostatIds } },
            orderBy: [{ dayType: 'asc' }, { orderIndex: 'asc' }],
          },
        );

        const programsByDevice: Record<number, any[]> = {};
        thermostatPrograms.forEach((p) => {
          if (!programsByDevice[p.deviceId]) programsByDevice[p.deviceId] = [];
          programsByDevice[p.deviceId].push({
            dayType: p.dayType,
            startMinute: p.startMinute,
            targetTemp: p.targetTemp,
            orderIndex: p.orderIndex,
          });
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
            program: programsByDevice[t.id] ?? [],
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

  async getHeatingEvents(userId: number, query: HeatingEventsQuery) {
    const {
      homeProfileId,
      deviceId,
      hvacAction,
      source,
      from,
      to,
      page = 1,
      limit = 20,
    } = query;

    if (!from || !to) {
      throw new Error("Parametri 'from' i 'to' su obavezni");
    }

    const where: HeatingEventWhereInput = {
      thermostat: {
        homeProfile: {
          userId,
          ...(homeProfileId && { id: Number(homeProfileId) }),
        },
      },
    };

    if (deviceId) where.deviceId = Number(deviceId);
    if (hvacAction) where.hvacAction = hvacAction;
    if (source) where.source = source;

    where.timestampStart = {
      gte: new Date(from),
      lte: new Date(to),
    };

    const take = Number(limit) > 0 ? Number(limit) : undefined;
    const skip = take ? (Number(page) - 1) * take : undefined;

    const [events, total] = await this.prisma.$transaction([
      this.prisma.heatingEvent.findMany({
        where,
        orderBy: { timestampStart: 'desc' },
        skip,
        take,
      }),
      this.prisma.heatingEvent.count({ where }),
    ]);

    return {
      data: events.map((e) => ({
        deviceId: e.deviceId,
        startedAt: e.timestampStart,
        endedAt: e.timestampEnd,
        currentTemp: e.currentTemp,
        targetTemp: e.targetTemp,
        hvacAction: e.hvacAction,
        source: e.source,
        durationMinutes: e.timestampEnd
          ? Math.round(
              (e.timestampEnd.getTime() - e.timestampStart.getTime()) / 60000,
            )
          : 0,
      })),
      meta: {
        page: Number(page),
        limit: take ?? total,
        total,
      },
    };
  }

  async getHeatingStats(userId: number, query: HeatingStatsQuery) {
    const { homeProfileId, deviceId, from, to, bucket = 'day' } = query;

    if (!from || !to) throw new Error("'from' i 'to' su obavezni");

    const events = await this.prisma.heatingEvent.findMany({
      where: {
        thermostat: {
          homeProfile: { userId, id: Number(homeProfileId) },
        },
        ...(deviceId && { deviceId: Number(deviceId) }),
        timestampStart: { gte: new Date(from), lte: new Date(to) },
      },
      orderBy: { timestampStart: 'asc' },
    });

    const bucketsMap = new Map<
      string,
      {
        totalTarget: number;
        totalCurrent: number;
        totalDuration: number;
        count: number;
      }
    >();

    for (const e of events) {
      const date = new Date(e.timestampStart);
      const label =
        bucket === 'hour'
          ? `${date.getHours().toString().padStart(2, '0')}:00`
          : date.toISOString().split('T')[0];

      if (!bucketsMap.has(label))
        bucketsMap.set(label, {
          totalTarget: 0,
          totalCurrent: 0,
          totalDuration: 0,
          count: 0,
        });
      const b = bucketsMap.get(label)!;

      b.totalTarget += e.targetTemp;
      b.totalCurrent += e.currentTemp;
      b.count++;
      if (e.timestampEnd)
        b.totalDuration +=
          (e.timestampEnd.getTime() - e.timestampStart.getTime()) / 60000;
    }

    return {
      buckets: Array.from(bucketsMap.entries()).map(([label, b]) => ({
        label,
        avgTargetTemp: b.count
          ? Number((b.totalTarget / b.count).toFixed(2))
          : 0,
        avgCurrentTemp: b.count
          ? Number((b.totalCurrent / b.count).toFixed(2))
          : 0,
        totalDurationMin: Math.round(b.totalDuration),
        cycles: b.count,
      })),
    };
  }

  async getLearningTrends(userId: number, query: LearningTrendsQuery) {
    const { homeProfileId, from, to } = query;
    if (!from || !to) throw new Error("'from' i 'to' su obavezni");

    const intervals = await this.prisma.heatingIntervalLearning.findMany({
      where: {
        homeProfileId: Number(homeProfileId),
        homeProfile: { userId },
        lastUpdated: { gte: new Date(from), lte: new Date(to) },
      },
      orderBy: { lastUpdated: 'asc' },
    });

    const map = new Map<string, { total: number; samples: number }>();
    intervals.forEach((i) => {
      const date = i.lastUpdated.toISOString().split('T')[0];
      if (!map.has(date)) map.set(date, { total: 0, samples: 0 });
      const d = map.get(date)!;
      d.total += i.confidence;
      d.samples++;
    });

    return {
      points: Array.from(map.entries()).map(([date, v]) => ({
        date,
        avgConfidence: v.samples ? Number((v.total / v.samples).toFixed(2)) : 0,
        samples: v.samples,
      })),
    };
  }
}
