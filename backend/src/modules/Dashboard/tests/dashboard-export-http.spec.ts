import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));
jest.mock('../../Boiler/boiler.service', () => ({ BoilerService: class {} }));
jest.mock('../../Weather/weather.service', () => ({
  WeatherService: class {},
}));

import { PrismaService } from '../../../prisma/prisma.service';
import { JwtAuthGuard } from '../../Auth/jwt-auth.guard';
import { BoilerService } from '../../Boiler/boiler.service';
import { WeatherService } from '../../Weather/weather.service';
import { DashboardWeatherService } from '../../Weather/dashboard-weather.service';
import { DashboardController } from '../dashboard.controller';
import { DashboardService } from '../dashboard.service';
import {
  ANALYTICS_EXPORT_MAX_ROWS_FLAG,
  ANALYTICS_EXPORT_V2_FLAG,
} from '../analytics-export';

/**
 * FEAT-6 HTTP sloj: stvarni DashboardController, JwtAuthGuard i produkcijski
 * ValidationPipe, lažna baza. Dokazuje 401/400/404/413/503 bez PostgreSQL-a.
 * Stvarna PostgreSQL varijanta je u test/integration/analytics-export.integration.spec.ts.
 */
describe('GET /api/dashboard/export HTTP (FEAT-6)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let eventRows: any[];
  let learningRows: any[];
  const originalV2 = process.env[ANALYTICS_EXPORT_V2_FLAG];
  const originalMax = process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG];

  beforeAll(async () => {
    const profiles = [
      { id: 10, userId: 1 },
      { id: 20, userId: 2 },
    ];
    const devices = [
      { id: 100, userId: 1, homeProfileId: 10 },
      { id: 200, userId: 2, homeProfileId: 20 },
    ];
    eventRows = [
      {
        id: 1,
        deviceId: 100,
        timestampStart: new Date('2026-01-01T10:00:00Z'),
        timestampEnd: new Date('2026-01-01T10:30:00Z'),
        roomCurrentTemp: 20,
        roomTargetTemp: 22,
      },
    ];
    learningRows = [
      {
        id: 1,
        homeProfileId: 10,
        lastUpdated: new Date('2026-01-01T10:00:00Z'),
        confidence: 0.8,
      },
    ];
    const db = {
      user: {
        findUnique: async ({ where }: any) => {
          await Promise.resolve();
          return [1, 2].includes(where.id)
            ? { id: where.id, role: 'USER', plan: 'FULL' }
            : null;
        },
      },
      homeProfile: {
        findFirst: async ({ where }: any) => {
          await Promise.resolve();
          return (
            profiles.find(
              (p) => p.id === where.id && p.userId === where.userId,
            ) ?? null
          );
        },
      },
      thermostatDevice: {
        count: async ({ where }: any) => {
          await Promise.resolve();
          return devices.filter((d) => d.userId === where.homeProfile.userId)
            .length;
        },
      },
      heatingEvent: {
        findMany: async ({ where, take }: any) => {
          await Promise.resolve();
          const rows = eventRows.filter((e) => {
            const device = devices.find((d) => d.id === e.deviceId);
            const filter = where?.thermostat?.homeProfile;
            if (!device) return false;
            if (filter?.userId !== undefined && device.userId !== filter.userId)
              return false;
            if (filter?.id !== undefined && device.homeProfileId !== filter.id)
              return false;
            const range = where?.timestampStart;
            if (range?.gte && e.timestampStart < range.gte) return false;
            if (range?.lte && e.timestampStart > range.lte) return false;
            return true;
          });
          return take === undefined ? rows : rows.slice(0, take);
        },
      },
      heatingIntervalLearning: {
        findMany: async ({ where, take }: any) => {
          await Promise.resolve();
          const rows = learningRows.filter((i) => {
            if (i.homeProfileId !== where.homeProfileId) return false;
            const profile = profiles.find((p) => p.id === i.homeProfileId);
            if (profile?.userId !== where.homeProfile?.userId) return false;
            const range = where?.lastUpdated;
            if (range?.gte && i.lastUpdated < range.gte) return false;
            if (range?.lte && i.lastUpdated > range.lte) return false;
            return true;
          });
          return take === undefined ? rows : rows.slice(0, take);
        },
      },
    };
    jwt = new JwtService({ secret: randomBytes(32).toString('hex') });
    const moduleRef = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        DashboardService,
        JwtAuthGuard,
        Reflector,
        { provide: JwtService, useValue: jwt },
        { provide: PrismaService, useValue: db },
        { provide: BoilerService, useValue: {} },
        { provide: WeatherService, useValue: {} },
        { provide: DashboardWeatherService, useValue: {} },
        { provide: 'IThermostatAdapter', useValue: {} },
      ],
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
  });

  afterAll(async () => {
    await app?.close();
    if (originalV2 === undefined) delete process.env[ANALYTICS_EXPORT_V2_FLAG];
    else process.env[ANALYTICS_EXPORT_V2_FLAG] = originalV2;
    if (originalMax === undefined)
      delete process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG];
    else process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG] = originalMax;
  });

  beforeEach(() => {
    delete process.env[ANALYTICS_EXPORT_V2_FLAG];
    delete process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG];
  });

  const query = {
    homeProfileId: 10,
    from: '2026-01-01T00:00:00Z',
    to: '2026-01-02T00:00:00Z',
  };

  it('anonimni zahtjev vraca 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/export')
      .query(query);
    expect(res.status).toBe(401);
  });

  it('vlasnik dobija legacy CSV omotnicu', async () => {
    const token = jwt.sign({ userId: 1 });
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/export')
      .set('Authorization', `Bearer ${token}`)
      .query(query);
    expect(res.status).toBe(200);
    expect(res.body.export.format).toBe('csv');
    expect(res.body.export.content).toContain('2026-01-01,22,20,30,1');
    expect(res.body.meta).toBeUndefined();
  });

  it('tudji i nepostojeci profil imaju identican 404 body', async () => {
    const token = jwt.sign({ userId: 1 });
    const foreign = await request(app.getHttpServer())
      .get('/api/dashboard/export')
      .set('Authorization', `Bearer ${token}`)
      .query({ ...query, homeProfileId: 20 });
    const missing = await request(app.getHttpServer())
      .get('/api/dashboard/export')
      .set('Authorization', `Bearer ${token}`)
      .query({ ...query, homeProfileId: 999 });
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
  });

  it('ValidationPipe odbija neispravan homeProfileId, version i nepoznato polje', async () => {
    const token = jwt.sign({ userId: 1 });
    for (const bad of [
      { homeProfileId: 0 },
      { homeProfileId: -1 },
      { version: 3 },
      { format: 'xml' },
      { surprise: true },
    ]) {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/export')
        .set('Authorization', `Bearer ${token}`)
        .query({ ...query, ...bad });
      expect(res.status).toBe(400);
    }
  });

  it('v2 je 503 dok je flag off, a 200 JSON kad je on', async () => {
    const token = jwt.sign({ userId: 1 });
    const off = await request(app.getHttpServer())
      .get('/api/dashboard/export')
      .set('Authorization', `Bearer ${token}`)
      .query({ ...query, version: 2, format: 'json' });
    expect(off.status).toBe(503);
    process.env[ANALYTICS_EXPORT_V2_FLAG] = 'on';
    const on = await request(app.getHttpServer())
      .get('/api/dashboard/export')
      .set('Authorization', `Bearer ${token}`)
      .query({
        ...query,
        version: 2,
        format: 'json',
        timeZone: 'Europe/Sarajevo',
      });
    expect(on.status).toBe(200);
    expect(on.body.export.format).toBe('json');
    expect(on.body.meta.timeZone).toBe('Europe/Sarajevo');
    expect(JSON.parse(on.body.export.content).schemaVersion).toBe(2);
  });

  it('v2 vraca 413 kad source redovi prelaze maxRows', async () => {
    process.env[ANALYTICS_EXPORT_V2_FLAG] = 'on';
    process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG] = '1';
    learningRows.push({
      id: 2,
      homeProfileId: 10,
      lastUpdated: new Date('2026-01-01T12:00:00Z'),
      confidence: 0.5,
    });
    const token = jwt.sign({ userId: 1 });
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/export')
      .set('Authorization', `Bearer ${token}`)
      .query({ ...query, version: 2 });
    expect(res.status).toBe(413);
    learningRows.pop();
  });
});
