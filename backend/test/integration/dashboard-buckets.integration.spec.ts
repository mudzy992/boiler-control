import { randomUUID } from 'node:crypto';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

const FLAG = 'DASHBOARD_BUCKET_V2_ENABLED';
const originalFlag = process.env[FLAG];

function restoreFlag() {
  if (originalFlag === undefined) delete process.env[FLAG];
  else process.env[FLAG] = originalFlag;
}

describe('Dashboard heating summary/stats buckets (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerId: number;
  let otherUserId: number;
  let ownerProfileId: number;
  let otherProfileId: number;
  let ownerHourDeviceId: number;
  let ownerDayDeviceId: number;
  let otherDeviceId: number;
  let ownerToken: string;
  let otherToken: string;
  const suffix = randomUUID();

  const rangeQuery = {
    from: '2026-01-01T00:00:00.000Z',
    to: '2026-01-04T00:00:00.000Z',
  };
  const zeroSummary = {
    totalCycles: 0,
    totalDurationMin: 0,
    avgDurationMin: 0,
    avgIndoorTemp: 0,
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    prisma = moduleRef.get(PrismaService);
    const jwt = moduleRef.get(JwtService);

    const owner = await prisma.user.create({
      data: {
        email: `feat8-buckets-owner-${suffix}@example.test`,
        username: `feat8-buckets-owner-${suffix}`,
        passwordHash: 'synthetic-not-a-real-hash',
      },
    });
    const other = await prisma.user.create({
      data: {
        email: `feat8-buckets-other-${suffix}@example.test`,
        username: `feat8-buckets-other-${suffix}`,
        passwordHash: 'synthetic-not-a-real-hash',
      },
    });
    ownerId = owner.id;
    otherUserId = other.id;
    ownerToken = jwt.sign({ userId: ownerId });
    otherToken = jwt.sign({ userId: otherUserId });

    const profileData = {
      floorArea: 120,
      ceilingHeight: 2.5,
      insulationType: 'EPS' as const,
      insulationThickness: 10,
      windowType: 'DOUBLE_GLAZED' as const,
      heatingType: 'RADIATOR' as const,
      constructionYear: 2020,
    };
    ownerProfileId = (
      await prisma.homeProfile.create({
        data: { ...profileData, userId: ownerId },
      })
    ).id;
    otherProfileId = (
      await prisma.homeProfile.create({
        data: { ...profileData, userId: otherUserId },
      })
    ).id;

    ownerHourDeviceId = (
      await prisma.thermostatDevice.create({
        data: {
          userId: ownerId,
          homeProfileId: ownerProfileId,
          vendor: 'tuya',
          deviceId: `feat8-buckets-owner-hour-${suffix}`,
        },
      })
    ).id;
    ownerDayDeviceId = (
      await prisma.thermostatDevice.create({
        data: {
          userId: ownerId,
          homeProfileId: ownerProfileId,
          vendor: 'tuya',
          deviceId: `feat8-buckets-owner-day-${suffix}`,
        },
      })
    ).id;
    otherDeviceId = (
      await prisma.thermostatDevice.create({
        data: {
          userId: otherUserId,
          homeProfileId: otherProfileId,
          vendor: 'tuya',
          deviceId: `feat8-buckets-other-${suffix}`,
        },
      })
    ).id;

    await prisma.heatingEvent.createMany({
      data: [
        {
          deviceId: ownerHourDeviceId,
          timestampStart: new Date('2026-01-01T10:00:00.000Z'),
          timestampEnd: new Date('2026-01-01T10:30:00.000Z'),
          roomTargetTemp: 22,
          roomCurrentTemp: 20,
          hvacAction: 'heating',
          source: 'feat8-buckets-integration',
        },
        {
          deviceId: ownerHourDeviceId,
          timestampStart: new Date('2026-01-02T10:00:00.000Z'),
          timestampEnd: new Date('2026-01-02T10:45:00.000Z'),
          roomTargetTemp: 20,
          roomCurrentTemp: 18,
          hvacAction: 'heating',
          source: 'feat8-buckets-integration',
        },
        {
          deviceId: ownerDayDeviceId,
          timestampStart: new Date('2026-01-01T23:30:00.000Z'),
          timestampEnd: new Date('2026-01-01T23:45:00.000Z'),
          roomTargetTemp: 23,
          roomCurrentTemp: 21,
          hvacAction: 'heating',
          source: 'feat8-buckets-integration',
        },
        {
          deviceId: otherDeviceId,
          timestampStart: new Date('2026-01-03T10:00:00.000Z'),
          timestampEnd: new Date('2026-01-03T11:00:00.000Z'),
          roomTargetTemp: 99,
          roomCurrentTemp: 99,
          hvacAction: 'heating',
          source: 'feat8-buckets-integration',
        },
      ],
    });
  }, 60_000);

  beforeEach(() => {
    delete process.env[FLAG];
  });

  afterEach(() => {
    restoreFlag();
  });

  afterAll(async () => {
    restoreFlag();
    const userIds = [ownerId, otherUserId].filter((id): id is number =>
      Number.isInteger(id),
    );
    if (prisma && userIds.length) {
      await prisma.heatingEvent.deleteMany({
        where: { thermostat: { homeProfile: { userId: { in: userIds } } } },
      });
      await prisma.thermostatDevice.deleteMany({
        where: { homeProfile: { userId: { in: userIds } } },
      });
      await prisma.homeProfile.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (app) await app.close();
  });

  function getSummary(token: string, query: Record<string, string | number>) {
    return request(app.getHttpServer())
      .get('/api/dashboard/heating-summary')
      .set('Authorization', `Bearer ${token}`)
      .query(query);
  }

  function getStats(token: string, query: Record<string, string | number>) {
    return request(app.getHttpServer())
      .get('/api/dashboard/heating-stats')
      .set('Authorization', `Bearer ${token}`)
      .query(query);
  }

  function ownerHourQuery() {
    return {
      ...rangeQuery,
      homeProfileId: ownerProfileId,
      deviceId: ownerHourDeviceId,
      bucket: 'hour',
    };
  }

  it('rejects anonymous summary and stats requests', async () => {
    for (const path of [
      '/api/dashboard/heating-summary',
      '/api/dashboard/heating-stats',
    ]) {
      const response = await request(app.getHttpServer())
        .get(path)
        .query(ownerHourQuery());
      expect(response.status).toBe(401);
    }
  });

  it('default v1 intentionally combines the same hour on different days for summary and stats', async () => {
    expect(process.env[FLAG]).toBeUndefined();

    const summary = await getSummary(ownerToken, ownerHourQuery());
    const stats = await getStats(ownerToken, ownerHourQuery());

    expect(summary.status).toBe(200);
    expect(summary.body).toEqual({
      summary: {
        totalCycles: 2,
        totalDurationMin: 75,
        avgDurationMin: 37.5,
        avgIndoorTemp: 19,
      },
      buckets: [
        {
          label: '10:00',
          totalDurationMin: 75,
          cycles: 2,
          avgTargetTemp: 21,
          avgCurrentTemp: 19,
        },
      ],
    });
    expect(stats.status).toBe(200);
    expect(stats.body).toEqual({ buckets: summary.body.buckets });
  });

  it('opt-in v2 keeps chronological UTC date-hour buckets for summary and stats', async () => {
    process.env[FLAG] = 'on';

    const summary = await getSummary(ownerToken, ownerHourQuery());
    const stats = await getStats(ownerToken, ownerHourQuery());

    expect(summary.status).toBe(200);
    expect(summary.body).toEqual({
      summary: {
        totalCycles: 2,
        totalDurationMin: 75,
        avgDurationMin: 37.5,
        avgIndoorTemp: 19,
      },
      buckets: [
        {
          label: '2026-01-01T10:00Z',
          totalDurationMin: 30,
          cycles: 1,
          avgTargetTemp: 22,
          avgCurrentTemp: 20,
        },
        {
          label: '2026-01-02T10:00Z',
          totalDurationMin: 45,
          cycles: 1,
          avgTargetTemp: 20,
          avgCurrentTemp: 18,
        },
      ],
    });
    expect(stats.status).toBe(200);
    expect(stats.body).toEqual({ buckets: summary.body.buckets });
  });

  it('opt-in v2 uses the same UTC day around midnight for summary and stats', async () => {
    process.env[FLAG] = 'on';
    const query = {
      ...rangeQuery,
      homeProfileId: ownerProfileId,
      deviceId: ownerDayDeviceId,
      bucket: 'day',
    };

    const summary = await getSummary(ownerToken, query);
    const stats = await getStats(ownerToken, query);

    expect(summary.status).toBe(200);
    expect(summary.body).toEqual({
      summary: {
        totalCycles: 1,
        totalDurationMin: 15,
        avgDurationMin: 15,
        avgIndoorTemp: 21,
      },
      buckets: [
        {
          label: '2026-01-01',
          totalDurationMin: 15,
          cycles: 1,
          avgTargetTemp: 23,
          avgCurrentTemp: 21,
        },
      ],
    });
    expect(stats.status).toBe(200);
    expect(stats.body).toEqual({ buckets: summary.body.buckets });
  });

  it('foreign, missing and no-data queries return identical empty shapes without hiding the other owner fixture', async () => {
    const missingProfileId = 2_147_483_647;
    const summaryQuery = { ...rangeQuery, bucket: 'hour' };

    for (const homeProfileId of [otherProfileId, missingProfileId]) {
      const summary = await getSummary(ownerToken, {
        ...summaryQuery,
        homeProfileId,
      });
      const stats = await getStats(ownerToken, {
        ...summaryQuery,
        homeProfileId,
      });
      expect(summary.status).toBe(200);
      expect(summary.body).toEqual({ summary: zeroSummary, buckets: [] });
      expect(stats.status).toBe(200);
      expect(stats.body).toEqual({ buckets: [] });
    }

    const otherStats = await getStats(otherToken, {
      ...rangeQuery,
      homeProfileId: otherProfileId,
      deviceId: otherDeviceId,
      bucket: 'hour',
    });
    expect(otherStats.status).toBe(200);
    expect(otherStats.body).toEqual({
      buckets: [
        {
          label: '10:00',
          totalDurationMin: 60,
          cycles: 1,
          avgTargetTemp: 99,
          avgCurrentTemp: 99,
        },
      ],
    });
  });
});
