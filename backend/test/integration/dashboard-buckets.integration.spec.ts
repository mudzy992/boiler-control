import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
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
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const ownerPassword = `Own${randomUUID().replaceAll('-', '')}!A1`;
    const otherPassword = `Oth${randomUUID().replaceAll('-', '')}!A1`;
    const ownerEmail = `it-dashboard-buckets-owner-${randomUUID()}@example.test`;
    const otherEmail = `it-dashboard-buckets-other-${randomUUID()}@example.test`;

    ownerId = (
      await prisma.user.create({
        data: {
          email: ownerEmail,
          password: ownerPassword,
          role: 'OWNER',
          name: 'Dashboard bucket integration owner',
          verified: true,
        },
      })
    ).id;
    otherUserId = (
      await prisma.user.create({
        data: {
          email: otherEmail,
          password: otherPassword,
          role: 'USER',
          name: 'Dashboard bucket integration other',
          verified: true,
        },
      })
    ).id;
    ownerProfileId = (
      await prisma.homeProfile.create({
        data: { userId: ownerId, name: 'Dashboard bucket owner home' },
      })
    ).id;
    otherProfileId = (
      await prisma.homeProfile.create({
        data: { userId: otherUserId, name: 'Dashboard bucket other home' },
      })
    ).id;

    ownerHourDeviceId = (
      await prisma.thermostatDevice.create({
        data: { homeProfileId: ownerProfileId, tuyaDeviceId: randomUUID() },
      })
    ).id;
    ownerDayDeviceId = (
      await prisma.thermostatDevice.create({
        data: { homeProfileId: ownerProfileId, tuyaDeviceId: randomUUID() },
      })
    ).id;
    otherDeviceId = (
      await prisma.thermostatDevice.create({
        data: { homeProfileId: otherProfileId, tuyaDeviceId: randomUUID() },
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
          outsideTemp: 1,
          hvacMode: 'heat',
          source: 'SCHEDULE',
        },
        {
          deviceId: ownerHourDeviceId,
          timestampStart: new Date('2026-01-02T10:00:00.000Z'),
          timestampEnd: new Date('2026-01-02T10:45:00.000Z'),
          roomTargetTemp: 20,
          roomCurrentTemp: 18,
          outsideTemp: 2,
          hvacMode: 'heat',
          source: 'SCHEDULE',
        },
        {
          deviceId: ownerDayDeviceId,
          timestampStart: new Date('2026-01-01T23:30:00.000Z'),
          timestampEnd: new Date('2026-01-01T23:45:00.000Z'),
          roomTargetTemp: 23,
          roomCurrentTemp: 21,
          outsideTemp: 0,
          hvacMode: 'heat',
          source: 'MANUAL',
        },
        {
          deviceId: otherDeviceId,
          timestampStart: new Date('2026-01-03T10:00:00.000Z'),
          timestampEnd: new Date('2026-01-03T11:00:00.000Z'),
          roomTargetTemp: 99,
          roomCurrentTemp: 99,
          outsideTemp: 0,
          hvacMode: 'heat',
          source: 'MANUAL',
        },
      ],
    });

    ownerToken = await login(ownerEmail, ownerPassword);
    otherToken = await login(otherEmail, otherPassword);
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

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });
    expect(response.status).toBe(201);
    expect(typeof response.body.access_token).toBe('string');
    return response.body.access_token as string;
  }

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
