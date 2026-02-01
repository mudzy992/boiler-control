import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HeatingEventWhereInput } from '../../generated/prisma/models';
import {
  GetHeatingEventsDto,
  GetHeatingStatsDto,
  GetLearningTrendsDto,
} from './dto/dashboard.dto';
import type { IThermostatAdapter } from '../Boiler/adapter/thermostat-adapter.interface';
import { BoilerService } from '../Boiler/boiler.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boilerService: BoilerService,
    @Inject('IThermostatAdapter') private adapter: IThermostatAdapter,
  ) {}

  // ======================================================
  // MAIN DASHBOARD (anonymous / profile_only / full)
  // ======================================================

  async getDashboard(userId?: number) {
    // =====================
    // ANONYMOUS
    // =====================

    const weather = await this.getLatestWeather();
    const flowTemp = await this.boilerService.calculateFlowTemp(userId);

    if (!userId) {
      return {
        capabilities: {
          hasProfile: false,
          hasThermostat: false,
          hasLearning: false,
        },
        system: {
          weather,
          recommendation: {
            date: Date.now(),
            recommendedFlowTemp: flowTemp.flowTemp,

            source: 'LIVE_CALCULATION',
          },
        },
        homes: [],
      };
    }

    // =====================
    // REGISTERED USERS (PROFILE_ONLY / FULL)
    // =====================
    const homeProfiles = await this.getHomeProfiles(userId);

    const hasProfile = homeProfiles.length > 0;
    const hasThermostat = homeProfiles.some(
      (p) => p.thermostatDevices.length > 0,
    );
    const hasLearning = homeProfiles.some(
      (p) => p.intervalLearnings.length > 0,
    );

    const [latestWeather, latestBoilerHistory, recommendations] =
      await Promise.all([
        this.getLatestWeather(),
        hasThermostat ? this.getLatestBoilerHistory(userId) : null,
        this.getRecentRecommendations(userId),
      ]);

    const homes = await Promise.all(
      homeProfiles.map(async (profile) => {
        const thermostatIds = profile.thermostatDevices.map((t) => t.id);
        let currentTemp: number | null = null;
        let targetTemp: number | null = null;
        if (hasThermostat && profile.thermostatDevices.length > 0) {
          // INFO: uzimamo samo prvi termostat za prikaz trenutnih vrijednosti
          const thermostat = profile.thermostatDevices[0];
          currentTemp =
            thermostat.roomCurrentTemp !== null
              ? thermostat.roomCurrentTemp / 2
              : null; // ako treba skaliranje
          targetTemp =
            thermostat.roomTargetTemp !== null
              ? thermostat.roomTargetTemp
              : null;
        }

        const recentHeatingEvents =
          thermostatIds.length > 0
            ? await this.prisma.heatingEvent.findMany({
                where: { deviceId: { in: thermostatIds } },
                orderBy: { timestampStart: 'desc' },
                take: 5,
              })
            : [];

        return {
          profile: {
            id: profile.id,
            floorArea: profile.floorArea,
            ceilingHeight: profile.ceilingHeight,
            insulationType: profile.insulationType,
            windowType: profile.windowType,
            heatingType: profile.heatingType,
          },

          thermostats: profile.thermostatDevices.map((t) => ({
            id: t.id,
            alias: t.alias,
            vendor: t.vendor,
            deviceId: t.deviceId,
            mode: t.mode,
            lastSeen: t.lastSeen,
            currentTemp: currentTemp,
            targetTemp: targetTemp,

            program: t.thermostatProgram.map((p) => ({
              dayType: p.dayType,
              startMinute: p.startMinute,
              targetTemp: p.targetTemp,
              orderIndex: p.orderIndex,
            })),
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
            targetTemp: e.roomTargetTemp,
            targetTempThermostat: targetTemp,
            currentTemp: e.roomCurrentTemp,
            curretTempThermostat: currentTemp,
            hvacAction: e.hvacAction,
            source: e.source,
            durationMinutes: e.timestampEnd
              ? Math.round(
                  (e.timestampEnd.getTime() - e.timestampStart.getTime()) /
                    60000,
                )
              : 0,
            isAnomaly: e.isAnomaly || false,
            proposedEndTime: e.proposedEndTime ?? null,
          })),
        };
      }),
    );

    return {
      capabilities: {
        hasProfile,
        hasThermostat,
        hasLearning,
      },
      system: {
        weather: latestWeather,
        boiler: latestBoilerHistory,
        recommendation: recommendations[0] ?? null,
      },
      homes,
    };
  }

  // ======================================================
  // FULL-ONLY ENDPOINTS
  // ======================================================

  async getHeatingEvents(userId: number, query: GetHeatingEventsDto) {
    await this.assertUserHasThermostat(userId);

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

    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    const [events, total] = await this.prisma.$transaction([
      this.prisma.heatingEvent.findMany({
        where,
        orderBy: { timestampStart: 'desc' },
        skip,
        take,
      }),
      this.prisma.heatingEvent.count({ where }),
    ]);

    const thermostatDeviceIds = events.map((t) => t.deviceId);

    let currentTemp;
    let targetTemp;
    if (thermostatDeviceIds) {
      const thermostat = await this.prisma.thermostatDevice.findFirst({
        where: {
          id: thermostatDeviceIds[0],
        },
      });

      if (thermostat) {
        currentTemp =
          thermostat?.roomCurrentTemp !== undefined
            ? thermostat.roomCurrentTemp
            : null;
        targetTemp =
          thermostat?.roomTargetTemp !== undefined
            ? thermostat.roomTargetTemp
            : null;
      }
    }

    return {
      data: events.map((e) => ({
        deviceId: e.deviceId,
        startedAt: e.timestampStart,
        endedAt: e.timestampEnd,
        currentTemp: e.roomCurrentTemp,
        targetTemp: e.roomTargetTemp,
        curretTempThermostat: currentTemp,
        targetTempThermostat: targetTemp,
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

  async getHeatingStats(userId: number, query: GetHeatingStatsDto) {
    await this.assertUserHasThermostat(userId);
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

      b.totalTarget += e.roomTargetTemp;
      b.totalCurrent += e.roomCurrentTemp;
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

  async getLearningTrends(userId: number, query: GetLearningTrendsDto) {
    await this.assertUserHasThermostat(userId);
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

  // ======================================================
  // INTERNAL HELPERS
  // ======================================================

  private getHomeProfiles(userId: number) {
    return this.prisma.homeProfile.findMany({
      where: { userId },
      include: {
        thermostatDevices: {
          include: {
            thermostatProgram: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
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

  private async assertUserHasThermostat(userId: number) {
    const count = await this.prisma.thermostatDevice.count({
      where: {
        homeProfile: { userId },
      },
    });

    if (!count) {
      throw new Error('Ovaj endpoint zahtijeva barem jedan termostat.');
    }
  }
}
