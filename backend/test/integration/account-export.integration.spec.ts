import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  ACCOUNT_EXPORT_ENABLED_FLAG,
  ACCOUNT_EXPORT_MAX_BYTES_FLAG,
  ACCOUNT_EXPORT_MAX_ROWS_FLAG,
} from '../../src/modules/Auth/account-export.config';

const ENV_KEYS = [
  ACCOUNT_EXPORT_ENABLED_FLAG,
  ACCOUNT_EXPORT_MAX_ROWS_FLAG,
  ACCOUNT_EXPORT_MAX_BYTES_FLAG,
] as const;
const savedEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

describe('Integration: GET /api/auth/export (PRIV-1A)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let otherToken: string;
  let ownerId: number;
  let otherId: number;
  let ownerGasReadingId: number;
  const suffix = randomUUID();
  const ownerMarker = `priv-owner-${suffix}`;
  const otherMarker = `priv-other-${suffix}`;
  const profileIds: number[] = [];
  const deviceIds: number[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    prisma = moduleRef.get(PrismaService);
    const jwt = moduleRef.get(JwtService);

    for (const [role, marker] of [
      ['owner', ownerMarker],
      ['other', otherMarker],
    ] as const) {
      const user = await prisma.user.create({
        data: {
          email: `${marker}@example.test`,
          username: marker,
          passwordHash: `${marker}-password-hash-secret`,
          gasPriceExVat: role === 'owner' ? 1.25 : 2.5,
        },
      });
      if (role === 'owner') {
        ownerId = user.id;
        ownerToken = jwt.sign({ userId: user.id });
      } else {
        otherId = user.id;
        otherToken = jwt.sign({ userId: user.id });
      }

      const profile = await prisma.homeProfile.create({
        data: {
          userId: user.id,
          floorArea: 100,
          ceilingHeight: 2.5,
          insulationType: 'EPS',
          insulationThickness: 10,
          windowType: 'DOUBLE_GLAZED',
          heatingType: 'RADIATOR',
          constructionYear: 2020,
          homeName: `${marker}-home`,
        },
      });
      profileIds.push(profile.id);
      const device = await prisma.thermostatDevice.create({
        data: {
          userId: user.id,
          homeProfileId: profile.id,
          vendor: 'tuya',
          deviceId: `${marker}-thermostat`,
          alias: `${marker}-device`,
        },
      });
      deviceIds.push(device.id);

      await prisma.heatingIntervalLearning.create({
        data: {
          homeProfileId: profile.id,
          intervalKey: `${marker}-learning`,
          avgReachTimeMin: 10,
          avgOvershoot: 0,
          confidence: 0.8,
          samples: 1,
        },
      });
      await prisma.thermostatProgram.create({
        data: {
          deviceId: device.id,
          dayType: 'WORKDAY',
          startMinute: 360,
          targetTemp: 22,
          orderIndex: 0,
          programHash: `${marker}-program`,
        },
      });
      await prisma.heatingEvent.create({
        data: {
          deviceId: device.id,
          roomCurrentTemp: 20,
          roomTargetTemp: 22,
          source: `${marker}-event`,
          hvacAction: 'heating',
          timestampStart: new Date('2026-01-01T10:00:00.000Z'),
        },
      });
      await prisma.recommendation.create({
        data: {
          userId: user.id,
          recommendedFlowTemp: 55,
          expectedHeatTimeMin: 30,
          confidenceScore: 0.9,
          date: new Date('2026-01-01T00:00:00.000Z'),
          breakdown: { marker: `${marker}-recommendation` },
        },
      });
      await prisma.boilerHistory.create({
        data: {
          userId: user.id,
          externalTemp: 5,
          suggestedFlowTemp: 55,
          actualFlowTemp: 54,
        },
      });
      const gasReading = await prisma.gasReading.create({
        data: {
          userId: user.id,
          readingDate: new Date('2026-01-01T00:00:00.000Z'),
          counterValue: 100,
          meterImagePath: `private/${marker}-meter-path-secret.jpg`,
          meterImageMime: 'image/jpeg',
          meterImageOriginalName: `${marker}-meter.jpg`,
          invoicePdfPath: `private/${marker}-invoice-path-secret.pdf`,
          invoicePdfMime: 'application/pdf',
          invoicePdfOriginalName: `${marker}-invoice.pdf`,
        },
      });
      if (role === 'owner') ownerGasReadingId = gasReading.id;
      await prisma.gasPriceHistory.create({
        data: {
          userId: user.id,
          gasReadingId: gasReading.id,
          priceExVat: 1.25,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          source: `${marker}-gas-price`,
        },
      });
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'SYSTEM_ALERT',
          title: `${marker}-notification`,
          message: 'Synthetic export fixture',
          sourceRef: `${marker}-notification`,
        },
      });
      await prisma.notificationPreference.create({
        data: { userId: user.id, type: 'SYSTEM_ALERT', enabled: true },
      });
      await prisma.userDevice.create({
        data: {
          userId: user.id,
          platform: 'android',
          expoPushToken: `${marker}-push-token`,
        },
      });
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: `${marker}-refresh-hash-secret`,
          expiresAt: new Date('2027-01-01T00:00:00.000Z'),
          userAgent: `${marker}-session-agent`,
          ipAddress: '203.0.113.10',
        },
      });
    }

    await prisma.tuyaToken.create({
      data: {
        accessToken: `${ownerMarker}-global-tuya-secret`,
        expiresAt: new Date('2027-01-01T00:00:00.000Z'),
      },
    });
    await prisma.weatherCache.create({
      data: {
        city: `${ownerMarker}-weather-secret`,
        temperature: 10,
        condition_text: `${ownerMarker}-legacy-weather-secret`,
      },
    });
    await prisma.weatherV2Cache.create({
      data: {
        cacheKey: `${ownerMarker}-weather-v2`,
        provider: 'test',
        fetchedAt: new Date('2026-01-01T00:00:00.000Z'),
        payload: { secret: `${ownerMarker}-weather-v2-secret` },
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      const userIds = [ownerId, otherId].filter(Number.isInteger);
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.userDevice.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.notificationPreference.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.notification.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.gasPriceHistory.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.gasReading.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.boilerHistory.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.recommendation.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.heatingEvent.deleteMany({
        where: { deviceId: { in: deviceIds } },
      });
      await prisma.thermostatProgram.deleteMany({
        where: { deviceId: { in: deviceIds } },
      });
      await prisma.heatingIntervalLearning.deleteMany({
        where: { homeProfileId: { in: profileIds } },
      });
      await prisma.thermostatDevice.deleteMany({
        where: { id: { in: deviceIds } },
      });
      await prisma.homeProfile.deleteMany({
        where: { id: { in: profileIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.tuyaToken.deleteMany({
        where: { accessToken: `${ownerMarker}-global-tuya-secret` },
      });
      await prisma.weatherCache.deleteMany({
        where: { city: `${ownerMarker}-weather-secret` },
      });
      await prisma.weatherV2Cache.deleteMany({
        where: { cacheKey: `${ownerMarker}-weather-v2` },
      });
      await prisma.$disconnect();
    }
    await app?.close();
    for (const key of ENV_KEYS) {
      const value = savedEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  beforeEach(() => {
    process.env[ACCOUNT_EXPORT_ENABLED_FLAG] = 'on';
    delete process.env[ACCOUNT_EXPORT_MAX_ROWS_FLAG];
    delete process.env[ACCOUNT_EXPORT_MAX_BYTES_FLAG];
  });

  const exportRequest = (token?: string) => {
    const pending = request(app.getHttpServer()).get('/api/auth/export');
    return token ? pending.set('Authorization', `Bearer ${token}`) : pending;
  };

  it('requires JWT and hides the route while the flag is off', async () => {
    process.env[ACCOUNT_EXPORT_ENABLED_FLAG] = 'off';
    expect((await exportRequest()).status).toBe(401);
    expect((await exportRequest(ownerToken)).status).toBe(404);
  });

  it('exports all owner collections without foreign, secret, cache or raw-path data', async () => {
    const owner = await exportRequest(ownerToken);
    const other = await exportRequest(otherToken);
    expect(owner.status).toBe(200);
    expect(other.status).toBe(200);
    expect(owner.headers['cache-control']).toBe('no-store');
    expect(owner.headers['content-disposition']).toContain(
      'account-export-v1.json',
    );
    expect(owner.body.format).toBe('boiler-control.account-export');
    expect(owner.body.version).toBe(1);
    expect(owner.body.account.id).toBe(ownerId);
    expect(other.body.account.id).toBe(otherId);

    for (const rows of Object.values(owner.body.collections)) {
      expect(rows).toHaveLength(1);
    }
    expect(owner.body.collections.gasReadings[0].downloads).toEqual({
      meterImage: `/api/gas/reading/${ownerGasReadingId}/meter-image`,
      invoicePdf: `/api/gas/reading/${ownerGasReadingId}/invoice`,
    });
    expect(owner.body.collections.sessions[0]).not.toHaveProperty('tokenHash');

    const raw = JSON.stringify(owner.body);
    const otherRaw = JSON.stringify(other.body);
    expect(raw).toContain(ownerMarker);
    expect(raw).not.toContain(otherMarker);
    expect(otherRaw).toContain(otherMarker);
    expect(otherRaw).not.toContain(ownerMarker);
    for (const forbidden of [
      'password-hash-secret',
      'refresh-hash-secret',
      'global-tuya-secret',
      'legacy-weather-secret',
      'weather-v2-secret',
      'meter-path-secret',
      'invoice-path-secret',
    ]) {
      expect(raw).not.toContain(forbidden);
    }
  });

  it('returns 413 without a partial export above the row bound', async () => {
    await prisma.notification.create({
      data: {
        userId: ownerId,
        type: 'SYSTEM_ALERT',
        title: 'Overflow fixture',
        message: 'Second row',
        sourceRef: `${ownerMarker}-overflow`,
      },
    });
    process.env[ACCOUNT_EXPORT_MAX_ROWS_FLAG] = '1';

    const response = await exportRequest(ownerToken);
    expect(response.status).toBe(413);
    expect(response.body.format).toBeUndefined();
    expect(response.body.collections).toBeUndefined();
  });

  it('returns 413 without a partial export above the byte bound', async () => {
    process.env[ACCOUNT_EXPORT_MAX_BYTES_FLAG] = '1024';
    const response = await exportRequest(ownerToken);
    expect(response.status).toBe(413);
    expect(response.body.format).toBeUndefined();
    expect(response.body.collections).toBeUndefined();
  });
});
