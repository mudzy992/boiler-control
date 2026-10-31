import {
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';

jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));
jest.mock('../../Boiler/boiler.service', () => ({ BoilerService: class {} }));
jest.mock('../../Weather/weather.service', () => ({
  WeatherService: class {},
}));

import { DashboardService } from '../dashboard.service';
import {
  ANALYTICS_EXPORT_MAX_ROWS_FLAG,
  ANALYTICS_EXPORT_V2_FLAG,
} from '../analytics-export';

type EventRow = {
  id: number;
  deviceId: number;
  timestampStart: Date;
  timestampEnd: Date | null;
  roomCurrentTemp: number;
  roomTargetTemp: number;
};

type LearningRow = {
  id: number;
  homeProfileId: number;
  lastUpdated: Date;
  confidence: number;
};

function matchesOwner(row: EventRow, devices: any[], where: any): boolean {
  const device = devices.find((d) => d.id === row.deviceId);
  if (!device) return false;
  const profileFilter = where?.thermostat?.homeProfile;
  if (
    profileFilter?.userId !== undefined &&
    device.userId !== profileFilter.userId
  ) {
    return false;
  }
  if (
    profileFilter?.id !== undefined &&
    device.homeProfileId !== profileFilter.id
  ) {
    return false;
  }
  const range = where?.timestampStart;
  if (range?.gte && row.timestampStart < range.gte) return false;
  if (range?.lte && row.timestampStart > range.lte) return false;
  return true;
}

function makeDb() {
  const profiles = [
    { id: 10, userId: 1 },
    { id: 20, userId: 2 },
  ];
  const devices = [
    { id: 100, userId: 1, homeProfileId: 10 },
    { id: 200, userId: 2, homeProfileId: 20 },
  ];
  const events: EventRow[] = [
    {
      id: 1,
      deviceId: 100,
      timestampStart: new Date('2026-01-01T10:00:00Z'),
      timestampEnd: new Date('2026-01-01T10:30:00Z'),
      roomCurrentTemp: 20,
      roomTargetTemp: 22,
    },
    {
      id: 2,
      deviceId: 200,
      timestampStart: new Date('2026-01-01T10:00:00Z'),
      timestampEnd: new Date('2026-01-01T11:00:00Z'),
      roomCurrentTemp: 99,
      roomTargetTemp: 99,
    },
  ];
  const intervals: LearningRow[] = [
    {
      id: 1,
      homeProfileId: 10,
      lastUpdated: new Date('2026-01-01T10:00:00Z'),
      confidence: 0.8,
    },
    {
      id: 2,
      homeProfileId: 20,
      lastUpdated: new Date('2026-01-01T10:00:00Z'),
      confidence: 0.1,
    },
  ];
  const calls = {
    profileLookups: [] as any[],
    eventQueries: [] as any[],
    learningQueries: [] as any[],
  };
  const db = {
    homeProfile: {
      findFirst: jest.fn(async (args: any) => {
        await Promise.resolve();
        calls.profileLookups.push(args);
        return (
          profiles.find(
            (p) => p.id === args.where.id && p.userId === args.where.userId,
          ) ?? null
        );
      }),
    },
    thermostatDevice: {
      count: jest.fn(async ({ where }: any) => {
        await Promise.resolve();
        return devices.filter((d) => d.userId === where.homeProfile.userId)
          .length;
      }),
    },
    heatingEvent: {
      findMany: jest.fn(async (args: any) => {
        await Promise.resolve();
        calls.eventQueries.push(args);
        const rows = events
          .filter((e) => matchesOwner(e, devices, args.where))
          .sort(
            (a, b) =>
              a.timestampStart.getTime() - b.timestampStart.getTime() ||
              a.id - b.id,
          );
        return args.take === undefined ? rows : rows.slice(0, args.take);
      }),
    },
    heatingIntervalLearning: {
      findMany: jest.fn(async (args: any) => {
        await Promise.resolve();
        calls.learningQueries.push(args);
        const rows = intervals
          .filter((i) => {
            if (i.homeProfileId !== args.where.homeProfileId) return false;
            const profile = profiles.find((p) => p.id === i.homeProfileId);
            if (profile?.userId !== args.where.homeProfile?.userId)
              return false;
            const range = args.where.lastUpdated;
            if (range?.gte && i.lastUpdated < range.gte) return false;
            if (range?.lte && i.lastUpdated > range.lte) return false;
            return true;
          })
          .sort(
            (a, b) =>
              a.lastUpdated.getTime() - b.lastUpdated.getTime() || a.id - b.id,
          );
        return args.take === undefined ? rows : rows.slice(0, args.take);
      }),
    },
  };
  return { db, calls, events, intervals, profiles, devices };
}

const baseQuery = {
  homeProfileId: 10,
  from: '2026-01-01T00:00:00Z',
  to: '2026-01-02T00:00:00Z',
};

describe('DashboardService.exportAnalytics (FEAT-6)', () => {
  const originalV2 = process.env[ANALYTICS_EXPORT_V2_FLAG];
  const originalMax = process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG];
  const originalBucket = process.env.DASHBOARD_BUCKET_V2_ENABLED;

  beforeEach(() => {
    delete process.env[ANALYTICS_EXPORT_V2_FLAG];
    delete process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG];
    delete process.env.DASHBOARD_BUCKET_V2_ENABLED;
  });
  afterEach(() => {
    if (originalV2 === undefined) delete process.env[ANALYTICS_EXPORT_V2_FLAG];
    else process.env[ANALYTICS_EXPORT_V2_FLAG] = originalV2;
    if (originalMax === undefined)
      delete process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG];
    else process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG] = originalMax;
    if (originalBucket === undefined)
      delete process.env.DASHBOARD_BUCKET_V2_ENABLED;
    else process.env.DASHBOARD_BUCKET_V2_ENABLED = originalBucket;
    jest.restoreAllMocks();
  });

  function makeService() {
    const fake = makeDb();
    const service = new DashboardService(
      fake.db as any,
      {} as any,
      {} as any,
      {} as any,
    );
    return { service, ...fake };
  }

  it('legacy zadrzava omotnicu, kolone, LF i vlasnicki scope', async () => {
    const { service } = makeService();
    const result = await service.exportAnalytics(1, baseQuery);
    expect(Object.keys(result).sort()).toEqual([
      'export',
      'learning',
      'stats',
      'summary',
    ]);
    expect(result.export.format).toBe('csv');
    expect(result.export.contentType).toBe('text/csv');
    expect(result.export.filename).toMatch(/^analytics_10_.*\.csv$/);
    expect(result.export.content).toBe(
      'label,avgTargetTemp,avgCurrentTemp,totalDurationMin,cycles\n2026-01-01,22,20,30,1',
    );
    expect(result.summary.summary.totalCycles).toBe(1);
    expect(result.learning.points).toEqual([
      { date: '2026-01-01', avgConfidence: 0.8, samples: 1 },
    ]);
  });

  it('tudji i nepostojeci profil vracaju identican 404 prije analytics citanja', async () => {
    const { service, calls } = makeService();
    const foreign = await service
      .exportAnalytics(1, { ...baseQuery, homeProfileId: 20 } as any)
      .catch((e) => e);
    const missing = await service
      .exportAnalytics(1, { ...baseQuery, homeProfileId: 999 } as any)
      .catch((e) => e);
    expect(foreign).toBeInstanceOf(NotFoundException);
    expect(missing).toBeInstanceOf(NotFoundException);
    expect(foreign.getResponse()).toEqual(missing.getResponse());
    expect(calls.eventQueries).toHaveLength(0);
    expect(calls.learningQueries).toHaveLength(0);
  });

  it('legacy CSV neutralizira opasnu labelu kroz toCsv', async () => {
    const { service } = makeService();
    jest.spyOn(service, 'getHeatingStats').mockResolvedValue({
      buckets: [
        {
          label: ' =HYPERLINK("http://example.test")',
          avgTargetTemp: 22,
          avgCurrentTemp: -1,
          totalDurationMin: 30,
          cycles: 1,
        },
      ],
    });
    const result = await service.exportAnalytics(1, baseQuery);
    expect(result.export.content).toContain(
      '"\' =HYPERLINK(""http://example.test"")",22,-1,30,1',
    );
  });

  it('v2 bez zastavice vraca 503, a format/timeZone na v1 vraca 400', async () => {
    const { service } = makeService();
    await expect(
      service.exportAnalytics(1, { ...baseQuery, version: 2 } as any),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      service.exportAnalytics(1, { ...baseQuery, format: 'json' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.exportAnalytics(1, { ...baseQuery, timeZone: 'UTC' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('v2 CSV/JSON nose meta, zonu i vlasnicki scope', async () => {
    process.env[ANALYTICS_EXPORT_V2_FLAG] = 'on';
    const { service, calls } = makeService();
    const csv = await service.exportAnalytics(1, {
      ...baseQuery,
      version: 2,
      timeZone: 'Europe/Sarajevo',
    } as any);
    expect(csv.meta).toMatchObject({
      version: 2,
      homeProfileId: 10,
      timeZone: 'Europe/Sarajevo',
      bucket: 'day',
      sourceRows: { heatingEvents: 1, learningIntervals: 1, total: 2 },
    });
    expect(csv.export.content).toContain('2026-01-01,22,20,30,1');
    expect(csv.export.content).toContain('\r\n');
    const json = await service.exportAnalytics(1, {
      ...baseQuery,
      version: 2,
      format: 'json',
    } as any);
    expect(json.export.format).toBe('json');
    expect(json.export.contentType).toBe('application/json');
    expect(json.export.filename).toMatch(/\.json$/);
    const parsed = JSON.parse(json.export.content);
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.meta.timeZone).toBe('UTC');
    expect(parsed.stats.buckets).toHaveLength(1);
    expect(
      calls.eventQueries.every(
        (q) => q.where.thermostat.homeProfile.userId === 1,
      ),
    ).toBe(true);
    expect(
      calls.learningQueries.every((q) => q.where.homeProfile.userId === 1),
    ).toBe(true);
  });

  it('v2 odbija prevelik broj redova bez truncation-a', async () => {
    process.env[ANALYTICS_EXPORT_V2_FLAG] = 'on';
    process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG] = '1';
    const { service, events, intervals } = makeService();
    events.push({
      id: 3,
      deviceId: 100,
      timestampStart: new Date('2026-01-01T12:00:00Z'),
      timestampEnd: null,
      roomCurrentTemp: 20,
      roomTargetTemp: 22,
    });
    await expect(
      service.exportAnalytics(1, { ...baseQuery, version: 2 } as any),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);

    events.pop();
    intervals.push({
      id: 3,
      homeProfileId: 10,
      lastUpdated: new Date('2026-01-01T12:00:00Z'),
      confidence: 0.5,
    });
    await expect(
      service.exportAnalytics(1, { ...baseQuery, version: 2 } as any),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('v2 prazan profil daje header-only CSV i prazan JSON', async () => {
    process.env[ANALYTICS_EXPORT_V2_FLAG] = 'on';
    const { service, events, intervals } = makeService();
    events.length = 0;
    intervals.length = 0;
    const csv = await service.exportAnalytics(1, {
      ...baseQuery,
      version: 2,
    } as any);
    expect(csv.export.content).toBe(
      'label,avgTargetTemp,avgCurrentTemp,totalDurationMin,cycles',
    );
    expect(csv.meta.sourceRows.total).toBe(0);
    const json = await service.exportAnalytics(1, {
      ...baseQuery,
      version: 2,
      format: 'json',
    } as any);
    const parsed = JSON.parse(json.export.content);
    expect(parsed.summary.buckets).toEqual([]);
    expect(parsed.learning.points).toEqual([]);
  });

  it('v2 ne zahtijeva termostat za prazan vlastiti profil', async () => {
    process.env[ANALYTICS_EXPORT_V2_FLAG] = 'on';
    const { service, devices, events, intervals } = makeService();
    devices.length = 0;
    events.length = 0;
    intervals.length = 0;
    const result = await service.exportAnalytics(1, {
      ...baseQuery,
      version: 2,
    } as any);
    expect(result.meta.sourceRows.total).toBe(0);
  });
});
