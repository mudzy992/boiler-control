import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));
jest.mock('../dashboard.service', () => ({ DashboardService: class {} }));

import { PrismaService } from '../../../prisma/prisma.service';
import { JwtAuthGuard } from '../../Auth/jwt-auth.guard';
import { DashboardController } from '../dashboard.controller';
import { DashboardService } from '../dashboard.service';

describe('Dashboard query DTO HTTP kompatibilnost', () => {
  let app: INestApplication;
  const getHeatingEvents = jest.fn();
  const getHeatingStats = jest.fn();
  const getHeatingSummary = jest.fn();
  const getLearningTrends = jest.fn();
  const validQuery = {
    homeProfileId: '17',
    from: '2026-01-01T00:00:00Z',
    to: '2026-01-02T00:00:00Z',
    bucket: 'day',
  };
  const validLearningQuery = {
    homeProfileId: validQuery.homeProfileId,
    from: validQuery.from,
    to: validQuery.to,
  };
  const validEventsQuery = { ...validLearningQuery };
  const eventsResponse = {
    data: [],
    meta: { page: 1, limit: 20, total: 0 },
  };
  const summaryResponse = {
    summary: {
      totalCycles: 0,
      totalDurationMin: 0,
      avgDurationMin: 0,
      avgIndoorTemp: 0,
    },
    buckets: [],
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: {
            getHeatingEvents,
            getHeatingStats,
            getHeatingSummary,
            getLearningTrends,
          },
        },
        { provide: PrismaService, useValue: {} },
        { provide: JwtService, useValue: { verify: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<{
            user?: { userId: number };
          }>();
          req.user = { userId: 42 };
          return true;
        },
      })
      .compile();

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
  });

  beforeEach(() => {
    getHeatingEvents.mockReset();
    getHeatingEvents.mockResolvedValue(eventsResponse);
    getHeatingStats.mockReset();
    getHeatingStats.mockResolvedValue({ buckets: [] });
    getHeatingSummary.mockReset();
    getHeatingSummary.mockResolvedValue(summaryResponse);
    getLearningTrends.mockReset();
    getLearningTrends.mockResolvedValue({ points: [] });
  });

  afterAll(async () => {
    await app.close();
  });

  it('numerički homeProfileId zadržava 200, response i servisne argumente', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/heating-stats')
      .query(validQuery);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ buckets: [] });
    expect(getHeatingStats).toHaveBeenCalledTimes(1);
    expect(getHeatingStats).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        ...validQuery,
        homeProfileId: 17,
      }),
    );
  });

  it('stats homeProfileId=0 vraća 400 prije servisnog poziva', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/heating-stats')
      .query({ ...validQuery, homeProfileId: '0' });

    expect(response.status).toBe(400);
    expect(getHeatingStats).not.toHaveBeenCalled();
  });

  it('negativan stats homeProfileId vraća 400 prije servisnog poziva', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/heating-stats')
      .query({ ...validQuery, homeProfileId: '-1' });

    expect(response.status).toBe(400);
    expect(getHeatingStats).not.toHaveBeenCalled();
  });

  it('numerički deviceId zadržava 200, response i servisne argumente', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/heating-stats')
      .query({ ...validQuery, deviceId: '23' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ buckets: [] });
    expect(getHeatingStats).toHaveBeenCalledTimes(1);
    expect(getHeatingStats).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        ...validQuery,
        homeProfileId: 17,
        deviceId: 23,
      }),
    );
  });

  it('prazan deviceId vraća 400 prije servisnog poziva', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/heating-stats')
      .query({ ...validQuery, deviceId: '' });

    expect(response.status).toBe(400);
    expect(getHeatingStats).not.toHaveBeenCalled();
  });

  it('prazan homeProfileId vraća 400 prije servisnog poziva', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/heating-stats')
      .query({ ...validQuery, homeProfileId: '' });

    expect(response.status).toBe(400);
    expect(getHeatingStats).not.toHaveBeenCalled();
  });

  it('numerički learning homeProfileId zadržava 200, response i servisne argumente', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/learning-trends')
      .query(validLearningQuery);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ points: [] });
    expect(getLearningTrends).toHaveBeenCalledTimes(1);
    expect(getLearningTrends).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        ...validLearningQuery,
        homeProfileId: 17,
      }),
    );
  });

  it('prazan learning homeProfileId vraća 400 prije servisnog poziva', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/learning-trends')
      .query({ ...validLearningQuery, homeProfileId: '' });

    expect(response.status).toBe(400);
    expect(getLearningTrends).not.toHaveBeenCalled();
  });

  it('numerički summary homeProfileId zadržava 200, response i servisne argumente', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/heating-summary')
      .query(validQuery);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(summaryResponse);
    expect(getHeatingSummary).toHaveBeenCalledTimes(1);
    expect(getHeatingSummary).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        ...validQuery,
        homeProfileId: 17,
      }),
    );
  });

  it('summary bez homeProfileId zadržava 200, response i servisne argumente', async () => {
    const query = {
      from: validQuery.from,
      to: validQuery.to,
      bucket: validQuery.bucket,
    };
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/heating-summary')
      .query(query);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(summaryResponse);
    expect(getHeatingSummary).toHaveBeenCalledTimes(1);
    expect(getHeatingSummary).toHaveBeenCalledWith(
      42,
      expect.objectContaining(query),
    );
    expect(getHeatingSummary.mock.calls[0][1].homeProfileId).toBeUndefined();
  });

  it('numerički summary deviceId zadržava 200, response i servisne argumente', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/heating-summary')
      .query({ ...validQuery, deviceId: '23' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(summaryResponse);
    expect(getHeatingSummary).toHaveBeenCalledTimes(1);
    expect(getHeatingSummary).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        ...validQuery,
        homeProfileId: 17,
        deviceId: 23,
      }),
    );
  });

  it('prazan summary deviceId vraća 400 prije servisnog poziva', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/heating-summary')
      .query({ ...validQuery, deviceId: '' });

    expect(response.status).toBe(400);
    expect(getHeatingSummary).not.toHaveBeenCalled();
  });

  it('prazan summary homeProfileId vraća 400 prije servisnog poziva', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/heating-summary')
      .query({ ...validQuery, homeProfileId: '' });

    expect(response.status).toBe(400);
    expect(getHeatingSummary).not.toHaveBeenCalled();
  });

  it('numerički events homeProfileId zadržava 200, response i servisne argumente', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/heating-events')
      .query(validEventsQuery);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(eventsResponse);
    expect(getHeatingEvents).toHaveBeenCalledTimes(1);
    expect(getHeatingEvents).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        ...validEventsQuery,
        homeProfileId: 17,
        page: 1,
        limit: 20,
      }),
    );
  });

  it('events bez homeProfileId zadržava 200, response i servisne argumente', async () => {
    const query = {
      from: validEventsQuery.from,
      to: validEventsQuery.to,
    };
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/heating-events')
      .query(query);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(eventsResponse);
    expect(getHeatingEvents).toHaveBeenCalledTimes(1);
    expect(getHeatingEvents).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ ...query, page: 1, limit: 20 }),
    );
    expect(getHeatingEvents.mock.calls[0][1].homeProfileId).toBeUndefined();
  });

  it('numerički events deviceId zadržava 200, response i servisne argumente', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/heating-events')
      .query({ ...validEventsQuery, deviceId: '23' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(eventsResponse);
    expect(getHeatingEvents).toHaveBeenCalledTimes(1);
    expect(getHeatingEvents).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        ...validEventsQuery,
        homeProfileId: 17,
        deviceId: 23,
        page: 1,
        limit: 20,
      }),
    );
  });

  it('prazan events deviceId vraća 400 prije servisnog poziva', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/heating-events')
      .query({ ...validEventsQuery, deviceId: '' });

    expect(response.status).toBe(400);
    expect(getHeatingEvents).not.toHaveBeenCalled();
  });

  it('prazan events homeProfileId vraća 400 prije servisnog poziva', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/heating-events')
      .query({ ...validEventsQuery, homeProfileId: '' });

    expect(response.status).toBe(400);
    expect(getHeatingEvents).not.toHaveBeenCalled();
  });
});
