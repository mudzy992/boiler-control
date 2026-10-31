import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  ANALYTICS_EXPORT_MAX_ROWS_FLAG,
  ANALYTICS_EXPORT_V2_FLAG,
} from '../../src/modules/Dashboard/analytics-export';

/**
 * FEAT-6 izolovani PostgreSQL HTTP test.
 *
 * Ne zamjenjuje APP_GUARD: koristi stvarni JwtAuthGuard na kontroleru.
 * Podaci su sintetički i brišu se u afterAll. CI ovo pokreće protiv
 * disposable `audit` baze iz backend-audit.yml.
 */
describe('Integration: GET /api/dashboard/export (FEAT-6)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let ownerToken: string;
  let otherToken: string;
  let ownerId: number;
  let otherId: number;
  let ownerProfileId: number;
  let otherProfileId: number;
  let ownerDeviceId: number;
  let otherDeviceId: number;
  const suffix = randomUUID();
  const originalV2 = process.env[ANALYTICS_EXPORT_V2_FLAG];
  const originalMax = process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG];

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
    jwt = moduleRef.get(JwtService);

    const owner = await prisma.user.create({
      data: {
        email: `feat6-owner-${suffix}@example.test`,
        username: `feat6-owner-${suffix}`,
        passwordHash: 'not-a-real-hash',
        plan: 'FULL',
      },
    });
    const other = await prisma.user.create({
      data: {
        email: `feat6-other-${suffix}@example.test`,
        username: `feat6-other-${suffix}`,
        passwordHash: 'not-a-real-hash',
        plan: 'FULL',
      },
    });
    ownerId = owner.id;
    otherId = other.id;
    ownerToken = jwt.sign({ userId: ownerId });
    otherToken = jwt.sign({ userId: otherId });

    const profileData = {
      floorArea: 150,
      ceilingHeight: 2.3,
      insulationType: 'EPS' as const,
      insulationThickness: 10,
      windowType: 'DOUBLE_GLAZED' as const,
      heatingType: 'RADIATOR' as const,
      constructionYear: 2020,
    };
    const ownerProfile = await prisma.homeProfile.create({
      data: { ...profileData, userId: ownerId },
    });
    const otherProfile = await prisma.homeProfile.create({
      data: { ...profileData, userId: otherId },
    });
    ownerProfileId = ownerProfile.id;
    otherProfileId = otherProfile.id;

    const ownerDevice = await prisma.thermostatDevice.create({
      data: {
        userId: ownerId,
        homeProfileId: ownerProfileId,
        vendor: 'tuya',
        deviceId: `feat6-owner-${suffix}`,
      },
    });
    const otherDevice = await prisma.thermostatDevice.create({
      data: {
        userId: otherId,
        homeProfileId: otherProfileId,
        vendor: 'tuya',
        deviceId: `feat6-other-${suffix}`,
      },
    });
    ownerDeviceId = ownerDevice.id;
    otherDeviceId = otherDevice.id;

    await prisma.heatingEvent.createMany({
      data: [
        {
          deviceId: ownerDevice.id,
          source: 'test',
          hvacAction: 'heating',
          timestampStart: new Date('2026-01-01T10:00:00Z'),
          timestampEnd: new Date('2026-01-01T10:30:00Z'),
          roomCurrentTemp: 20,
          roomTargetTemp: 22,
        },
        {
          deviceId: otherDevice.id,
          source: 'test',
          hvacAction: 'heating',
          timestampStart: new Date('2026-01-01T10:00:00Z'),
          timestampEnd: new Date('2026-01-01T11:00:00Z'),
          roomCurrentTemp: 99,
          roomTargetTemp: 99,
        },
      ],
    });
    await prisma.heatingIntervalLearning.createMany({
      data: [
        {
          homeProfileId: ownerProfileId,
          intervalKey: 'feat6-owner',
          avgReachTimeMin: 10,
          avgOvershoot: 0,
          confidence: 0.8,
          samples: 1,
          lastUpdated: new Date('2026-01-01T10:00:00Z'),
        },
        {
          homeProfileId: otherProfileId,
          intervalKey: 'feat6-other',
          avgReachTimeMin: 10,
          avgOvershoot: 0,
          confidence: 0.1,
          samples: 1,
          lastUpdated: new Date('2026-01-01T10:00:00Z'),
        },
      ],
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.heatingEvent.deleteMany({
        where: { deviceId: { in: [ownerDeviceId, otherDeviceId] } },
      });
      await prisma.heatingIntervalLearning.deleteMany({
        where: { homeProfileId: { in: [ownerProfileId, otherProfileId] } },
      });
      await prisma.thermostatDevice.deleteMany({
        where: { homeProfileId: { in: [ownerProfileId, otherProfileId] } },
      });
      await prisma.homeProfile.deleteMany({
        where: { id: { in: [ownerProfileId, otherProfileId] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [ownerId, otherId] } },
      });
      await prisma.$disconnect();
    }
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

  const query = () => ({
    homeProfileId: ownerProfileId,
    from: '2026-01-01T00:00:00Z',
    to: '2026-01-02T00:00:00Z',
  });

  it('anonimno 401, vlasnik 200, tudji/nepostojeci identican 404', async () => {
    const anonymous = await request(app.getHttpServer())
      .get('/api/dashboard/export')
      .query(query());
    expect(anonymous.status).toBe(401);

    const owner = await request(app.getHttpServer())
      .get('/api/dashboard/export')
      .set('Authorization', `Bearer ${ownerToken}`)
      .query(query());
    expect(owner.status).toBe(200);
    expect(owner.body.export.format).toBe('csv');
    expect(owner.body.summary.summary.totalCycles).toBe(1);
    expect(owner.body.export.content).toContain('2026-01-01,22,20,30,1');

    const foreign = await request(app.getHttpServer())
      .get('/api/dashboard/export')
      .set('Authorization', `Bearer ${ownerToken}`)
      .query({ ...query(), homeProfileId: otherProfileId });
    const missing = await request(app.getHttpServer())
      .get('/api/dashboard/export')
      .set('Authorization', `Bearer ${ownerToken}`)
      .query({ ...query(), homeProfileId: 2147483647 });
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);

    const otherOwner = await request(app.getHttpServer())
      .get('/api/dashboard/export')
      .set('Authorization', `Bearer ${otherToken}`)
      .query({ ...query(), homeProfileId: otherProfileId });
    expect(otherOwner.status).toBe(200);
    expect(otherOwner.body.summary.summary.totalCycles).toBe(1);
  });

  it('v2 flag off daje 503, on daje JSON sa zonom i owner scope-om', async () => {
    const off = await request(app.getHttpServer())
      .get('/api/dashboard/export')
      .set('Authorization', `Bearer ${ownerToken}`)
      .query({ ...query(), version: 2, format: 'json' });
    expect(off.status).toBe(503);

    process.env[ANALYTICS_EXPORT_V2_FLAG] = 'on';
    const on = await request(app.getHttpServer())
      .get('/api/dashboard/export')
      .set('Authorization', `Bearer ${ownerToken}`)
      .query({
        ...query(),
        version: 2,
        format: 'json',
        timeZone: 'Europe/Sarajevo',
      });
    expect(on.status).toBe(200);
    expect(on.body.meta.sourceRows).toEqual({
      heatingEvents: 1,
      learningIntervals: 1,
      total: 2,
    });
    const content = JSON.parse(on.body.export.content);
    expect(content.schemaVersion).toBe(2);
    expect(content.meta.timeZone).toBe('Europe/Sarajevo');
    expect(content.stats.buckets).toHaveLength(1);
    expect(content.stats.buckets[0].avgCurrentTemp).toBe(20);
  });

  it('v2 maxRows odbija prevelik izvoz sa 413', async () => {
    process.env[ANALYTICS_EXPORT_V2_FLAG] = 'on';
    process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG] = '1';
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/export')
      .set('Authorization', `Bearer ${ownerToken}`)
      .query({ ...query(), version: 2 });
    expect(res.status).toBe(413);
  });
});
