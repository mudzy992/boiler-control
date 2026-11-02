import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ExportAnalyticsDto,
  GetHeatingEventsDto,
  GetHeatingSummaryDto,
  GetHeatingStatsDto,
  GetLearningTrendsDto,
} from './dto/dashboard.dto';
import type { IThermostatAdapter } from '../Boiler/adapter/thermostat-adapter.interface';
import { BoilerService } from '../Boiler/boiler.service';
import { WeatherService } from '../Weather/weather.service';
import { bucketKey } from '../../common/dashboard-bucket';
import { toCsv } from '../../common/csv';
import {
  aggregateAnalyticsExport,
  analyticsExportMaxRows,
  analyticsExportV2Enabled,
  parseExportRange,
  resolveExportTimeZone,
} from './analytics-export';
import {
  HEALTH_EVENT_SAMPLE,
  HEALTH_WEIGHTS,
  HEALTH_NO_DATA_SCORE,
  FLOW_DELTA_PENALTY_PER_C,
  buildHealthWarnings,
  clampScore,
  computeThermostatFreshnessScore,
  computeWeightedHealthScore,
  type HealthComponent,
} from '../../common/heating-health';

@Injectable()
export class DashboardService {
  private readonly DEFAULT_CITY = 'Visoko';

  constructor(
    private readonly prisma: PrismaService,
    private readonly boilerService: BoilerService,
    private readonly weatherService: WeatherService,
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

    const heatingStatus: Array<{ deviceId: number; isHeatingNow: boolean }> =
      hasThermostat ? await this.getHeatingStatus(userId) : [];

    const homes = await Promise.all(
      homeProfiles.map(async (profile) => {
        const thermostatIds = profile.thermostatDevices.map((t) => t.id);

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

          thermostats: profile.thermostatDevices.map((t) => {
            const status = heatingStatus.find((s) => s.deviceId === t.id);
            return {
              id: t.id,
              alias: t.alias,
              vendor: t.vendor,
              deviceId: t.deviceId,
              mode: t.mode,
              lastSeen: t.lastSeen,
              currentTemp: t.roomCurrentTemp,
              targetTemp: t.roomTargetTemp,
              isHeatingNow: status?.isHeatingNow ?? false,

              program: t.thermostatProgram.map((p) => ({
                dayType: p.dayType,
                startMinute: p.startMinute,
                targetTemp: p.targetTemp,
                orderIndex: p.orderIndex,
              })),
            };
          }),

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
            targetTempThermostat:
              profile.thermostatDevices.find((t) => t.id === e.deviceId)
                ?.roomTargetTemp ?? null,
            currentTemp: e.roomCurrentTemp,
            curretTempThermostat:
              profile.thermostatDevices.find((t) => t.id === e.deviceId)
                ?.roomCurrentTemp ?? null,
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

    const where: any = {
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

    // FEAT-8 / B-019: temperatura se mapira PO UREĐAJU, vlasnički filtrirano,
    // i samo kada postoje redovi. Prije toga uziman je `events[0].deviceId`,
    // ista vrijednost davala se svakom događaju, a `if (thermostatDeviceIds)`
    // je bio true i za prazan niz pa je išao upit s `id: undefined` i bez
    // ikakvog owner scope-a.
    const deviceIds = [...new Set(events.map((e) => e.deviceId))];
    type DeviceTemps = {
      id: number;
      roomCurrentTemp?: number | null;
      roomTargetTemp?: number | null;
    };
    const devices: DeviceTemps[] = deviceIds.length
      ? await this.prisma.thermostatDevice.findMany({
          where: {
            id: { in: deviceIds },
            homeProfile: { userId },
          },
        })
      : [];
    // Eksplicitan tuple: bez njega TS iz `(number | DeviceTemps)[][]` izvodi
    // beskoristan tip vrijednosti mape.
    const deviceById = new Map<number, DeviceTemps>(
      devices.map((d): [number, DeviceTemps] => [d.id, d]),
    );

    return {
      data: events.map((e) => ({
        id: e.id,
        deviceId: e.deviceId,
        startedAt: e.timestampStart,
        endedAt: e.timestampEnd,
        currentTemp: e.roomCurrentTemp,
        targetTemp: e.roomTargetTemp,
        curretTempThermostat:
          deviceById.get(e.deviceId)?.roomCurrentTemp ?? null,
        targetTempThermostat:
          deviceById.get(e.deviceId)?.roomTargetTemp ?? null,
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

  async getHeatingSummary(userId: number, query: GetHeatingSummaryDto) {
    await this.assertUserHasThermostat(userId);

    const { homeProfileId, deviceId, from, to, bucket } = query;

    if (!from || !to) throw new Error("'from' i 'to' su obavezni");

    const events = await this.prisma.heatingEvent.findMany({
      where: {
        thermostat: {
          homeProfile: {
            userId,
            ...(homeProfileId && { id: Number(homeProfileId) }),
          },
        },
        ...(deviceId && { deviceId: Number(deviceId) }),
        timestampStart: { gte: new Date(from), lte: new Date(to) },
      },
      orderBy: { timestampStart: 'asc' },
    });

    const totalCycles = events.length;
    const totalDurationMin = events.reduce((acc, e) => {
      if (!e.timestampEnd) return acc;
      return (
        acc + (e.timestampEnd.getTime() - e.timestampStart.getTime()) / 60000
      );
    }, 0);

    const avgDurationMin = totalCycles
      ? Number((totalDurationMin / totalCycles).toFixed(2))
      : 0;

    const avgIndoorTemp = totalCycles
      ? Number(
          (
            events.reduce((acc, e) => acc + (e.roomCurrentTemp ?? 0), 0) /
            totalCycles
          ).toFixed(2),
        )
      : 0;

    const bucketType = bucket ?? 'day';
    const bucketsMap = new Map<
      string,
      {
        totalDuration: number;
        cycles: number;
        totalTarget: number;
        totalCurrent: number;
      }
    >();

    for (const e of events) {
      const date = new Date(e.timestampStart);
      // FEAT-8 / B-020: ključ je izdvojen u `common/dashboard-bucket`.
      // v1 (zadano) čuva postojeću semantiku: `HH:00` bez datuma i
      // server-local dan. v2 iza zastavice daje hronološke UTC ključeve.
      const label = bucketKey(date, bucketType, 'server-local');

      if (!bucketsMap.has(label)) {
        bucketsMap.set(label, {
          totalDuration: 0,
          cycles: 0,
          totalTarget: 0,
          totalCurrent: 0,
        });
      }

      const b = bucketsMap.get(label)!;
      b.cycles += 1;
      b.totalTarget += e.roomTargetTemp;
      b.totalCurrent += e.roomCurrentTemp;
      if (e.timestampEnd) {
        b.totalDuration +=
          (e.timestampEnd.getTime() - e.timestampStart.getTime()) / 60000;
      }
    }

    return {
      summary: {
        totalCycles,
        totalDurationMin: Math.round(totalDurationMin),
        avgDurationMin,
        avgIndoorTemp,
      },
      buckets: Array.from(bucketsMap.entries()).map(([label, b]) => ({
        label,
        totalDurationMin: Math.round(b.totalDuration),
        cycles: b.cycles,
        avgTargetTemp: b.cycles
          ? Number((b.totalTarget / b.cycles).toFixed(2))
          : 0,
        avgCurrentTemp: b.cycles
          ? Number((b.totalCurrent / b.cycles).toFixed(2))
          : 0,
      })),
    };
  }

  async getHeatingStatus(userId: number) {
    await this.assertUserHasThermostat(userId);

    const thermostats = await this.prisma.thermostatDevice.findMany({
      where: {
        homeProfile: { userId },
      },
    });

    const statusPromises = thermostats.map(async (thermostat) => {
      const lastEvent = await this.prisma.heatingEvent.findFirst({
        where: {
          deviceId: thermostat.id,
        },
        orderBy: {
          timestampStart: 'desc',
        },
      });

      return {
        deviceId: thermostat.id,
        isHeatingNow: lastEvent?.timestampEnd === null,
      };
    });

    return Promise.all(statusPromises);
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
      // FEAT-8 / B-020: v1 ovdje koristi UTC dan (za razliku od summary),
      // što je upravo nejednakost koju v2 uklanja.
      const label = bucketKey(date, bucket === 'hour' ? 'hour' : 'day', 'utc');

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

  async exportAnalytics(userId: number, query: ExportAnalyticsDto) {
    const {
      homeProfileId,
      from,
      to,
      bucket = 'day',
      version = 1,
      format,
      timeZone,
    } = query;

    // FEAT-6: vlasnistvo se provjerava prije bilo kojeg analytics citanja i
    // prije feature flag-a, tako da tudji i nepostojeci profil vracaju isti 404.
    const profile = await this.prisma.homeProfile.findFirst({
      where: { id: homeProfileId, userId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException('Home profile not found');
    }

    if (version !== 2) {
      if (format !== undefined || timeZone !== undefined) {
        throw new BadRequestException('format and timeZone require version=2');
      }
      const [summary, stats, learning] = await Promise.all([
        this.getHeatingSummary(userId, { homeProfileId, from, to, bucket }),
        this.getHeatingStats(userId, { homeProfileId, from, to, bucket }),
        this.getLearningTrends(userId, { homeProfileId, from, to }),
      ]);

      const header = [
        'label',
        'avgTargetTemp',
        'avgCurrentTemp',
        'totalDurationMin',
        'cycles',
      ];
      // Legacy zadrzava LF i isti redoslijed kolona; toCsv samo neutralizira
      // opasne tekstualne celije i pravilno citira zareze/navodnike/newline.
      const csv = toCsv(
        [header, ...stats.buckets.map((b) => Object.values(b))],
        '\n',
      );
      const timestamp = new Date().toISOString().replace(/[:]/g, '-');
      const filename = `analytics_${homeProfileId}_${timestamp}.csv`;

      return {
        summary,
        stats,
        learning,
        export: {
          format: 'csv' as const,
          contentType: 'text/csv',
          filename,
          content: csv,
        },
      };
    }

    if (!analyticsExportV2Enabled()) {
      throw new ServiceUnavailableException('Analytics export v2 is disabled');
    }
    const zone = resolveExportTimeZone(timeZone);
    const range = parseExportRange(from, to);
    const maxRows = analyticsExportMaxRows();

    const events = await this.prisma.heatingEvent.findMany({
      where: {
        thermostat: { homeProfile: { userId, id: homeProfileId } },
        timestampStart: { gte: range.from, lte: range.to },
      },
      select: {
        timestampStart: true,
        timestampEnd: true,
        roomCurrentTemp: true,
        roomTargetTemp: true,
      },
      orderBy: [{ timestampStart: 'asc' }, { id: 'asc' }],
      take: maxRows + 1,
    });
    if (events.length > maxRows) {
      throw new PayloadTooLargeException(
        `Analytics export exceeds maxRows (${maxRows})`,
      );
    }
    const remaining = maxRows - events.length;
    const intervals = await this.prisma.heatingIntervalLearning.findMany({
      where: {
        homeProfileId,
        homeProfile: { userId },
        lastUpdated: { gte: range.from, lte: range.to },
      },
      select: { lastUpdated: true, confidence: true },
      orderBy: [{ lastUpdated: 'asc' }, { id: 'asc' }],
      take: remaining + 1,
    });
    if (intervals.length > remaining) {
      throw new PayloadTooLargeException(
        `Analytics export exceeds maxRows (${maxRows})`,
      );
    }

    const { summary, stats, learning } = aggregateAnalyticsExport(
      events,
      intervals,
      zone,
      bucket,
    );
    const meta = {
      version: 2 as const,
      homeProfileId,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      timeZone: zone,
      bucket,
      sourceRows: {
        heatingEvents: events.length,
        learningIntervals: intervals.length,
        total: events.length + intervals.length,
      },
      maxRows,
    };
    const header = [
      'label',
      'avgTargetTemp',
      'avgCurrentTemp',
      'totalDurationMin',
      'cycles',
    ];
    const rows = [header, ...stats.buckets.map((b) => Object.values(b))];
    const wantsJson = format === 'json';
    const content = wantsJson
      ? JSON.stringify(
          { schemaVersion: 2, meta, summary, stats, learning },
          null,
          2,
        )
      : toCsv(rows);
    const extension = wantsJson ? 'json' : 'csv';
    const filename = `analytics_${homeProfileId}_${range.from.toISOString().replace(/[:]/g, '-')}.${extension}`;

    return {
      summary,
      stats,
      learning,
      meta,
      export: {
        format: wantsJson ? ('json' as const) : ('csv' as const),
        contentType: wantsJson ? 'application/json' : 'text/csv',
        filename,
        content,
      },
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

  private async getLatestWeather() {
    try {
      const weatherData = await this.weatherService.getTodayWeather(
        this.DEFAULT_CITY,
      );
      return this.transformWeather(weatherData);
    } catch {
      // Fallback to cache if fetch fails
      const cached = await this.prisma.weatherCache.findFirst({
        where: { city: this.DEFAULT_CITY },
        orderBy: { fetchedAt: 'desc' },
      });
      return cached ? this.transformWeather(cached) : null;
    }
  }

  private transformWeather(data: any) {
    if (!data) return null;
    return {
      temp: data.temperature ?? null,
      feelsLike: data.feelslike ?? null,
      condition: data.condition_text ?? null,
      humidity: data.humidity ?? null,
      windSpeed: data.wind_kph ?? null,
      pressure: data.pressure_mb ?? null,
      uvIndex: data.uv_index ?? null,
      sunrise: data.sunrise ?? null,
      sunset: data.sunset ?? null,
    };
  }

  private getLatestBoilerHistory(userId: number) {
    return this.prisma.boilerHistory.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ======================================================
  // HEALTH (FE2-14 / FE-010) — JEDAN IZVOR ZA WEB I MOBILE
  // ======================================================

  /**
   * Health score i pravila upozorenja.
   *
   * Prije FE2-14 ovo su računali klijenti, i to **različito**: web
   * `max(0, 100 - anomalije×15)`, mobile ponderisanu formulu. Za isti ulaz
   * davali su različit broj. Logika je sada ovdje, u `common/heating-health.ts`.
   *
   * Anonimni korisnik nema profila ni uređaja, pa nema nijednog signala —
   * vraća se `HEALTH_NO_DATA_SCORE` bez komponenti i upozorenja.
   */
  async getHealth(userId?: number) {
    const computedAt = new Date().toISOString();

    if (!userId) {
      return {
        score: HEALTH_NO_DATA_SCORE,
        learningConfidence: 0,
        components: [] as HealthComponent[],
        warnings: [],
        computedAt,
      };
    }

    const homeProfiles = await this.getHomeProfiles(userId);
    const devices = homeProfiles.flatMap((p) => p.thermostatDevices);
    const thermostatIds = devices.map((t) => t.id);

    const recentEvents =
      thermostatIds.length > 0
        ? await this.prisma.heatingEvent.findMany({
            where: { deviceId: { in: thermostatIds } },
            orderBy: { timestampStart: 'desc' },
            take: HEALTH_EVENT_SAMPLE,
          })
        : [];

    const latestBoiler = await this.getLatestBoilerHistory(userId);

    const components: HealthComponent[] = [];

    // 1. Samopouzdanje učenja (intervalLearnings.confidence je 0..1)
    const learnings = homeProfiles.flatMap((p) => p.intervalLearnings);
    let learningConfidence = 0;
    if (learnings.length > 0) {
      const avg =
        learnings.reduce((sum, l) => sum + l.confidence, 0) / learnings.length;
      learningConfidence = clampScore(avg * 100);
      components.push({
        key: 'learningConfidence',
        score: learningConfidence,
        weight: HEALTH_WEIGHTS.learningConfidence,
      });
    }

    // 2. Odstupanje stvarne od preporučene temperature polaznog voda.
    // `actualFlowTemp` je nullable u shemi, pa se signal izostavlja bez njega.
    if (latestBoiler && typeof latestBoiler.actualFlowTemp === 'number') {
      const delta = Math.abs(
        latestBoiler.actualFlowTemp - latestBoiler.suggestedFlowTemp,
      );
      components.push({
        key: 'flowDelta',
        score: clampScore(100 - delta * FLOW_DELTA_PENALTY_PER_C),
        weight: HEALTH_WEIGHTS.flowDelta,
      });
    }

    // 3. Svježina termostata (udio uređaja viđenih unutar 10 min)
    if (devices.length > 0) {
      components.push({
        key: 'thermostatFreshness',
        score: computeThermostatFreshnessScore(devices.map((d) => d.lastSeen)),
        weight: HEALTH_WEIGHTS.thermostatFreshness,
      });
    }

    // 4. Stopa anomalija + pravila upozorenja na istom uzorku.
    // `durationMinutes` koristi ISTU semantiku kao getHeatingEvents():
    // round((end - start) / 60000), odnosno 0 kad ciklus još traje.
    const eventInputs = recentEvents.map((e) => ({
      durationMinutes: e.timestampEnd
        ? Math.round(
            (e.timestampEnd.getTime() - e.timestampStart.getTime()) / 60000,
          )
        : 0,
      targetTemp: e.roomTargetTemp,
      currentTemp: e.roomCurrentTemp,
      isAnomaly: e.isAnomaly,
    }));

    if (eventInputs.length > 0) {
      const anomalyCount = eventInputs.filter((e) => e.isAnomaly).length;
      components.push({
        key: 'anomalyRate',
        score: clampScore(100 - (anomalyCount / eventInputs.length) * 100),
        weight: HEALTH_WEIGHTS.anomalyRate,
      });
    }

    return {
      score: computeWeightedHealthScore(components),
      learningConfidence,
      components,
      warnings: buildHealthWarnings(eventInputs),
      computedAt,
    };
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
