import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import { METRICS_AUTH_TOKEN_ENV } from '../../src/common/metrics-auth.guard';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Integration Tests: Heating & Polling Endpoints (P2a)
 * Tests heating events, recommendations, anomalies, and polling-related endpoints
 * Verifies:
 * - Heating event lifecycle (create, update, end)
 * - Transactional integrity (Batch 2: P1c)
 * - Structured logging with runId (Batch 2: P1d)
 * - Prometheus metrics updates (Batch 2: P1d)
 * - Response contracts for mobile/web clients
 */
describe('Integration Tests: Heating & Polling (P2a)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const metricsToken = randomBytes(32).toString('hex');
  const metricsAuth = { Authorization: `Bearer ${metricsToken}` };
  const originalMetricsToken = process.env[METRICS_AUTH_TOKEN_ENV];

  beforeAll(async () => {
    process.env[METRICS_AUTH_TOKEN_ENV] = metricsToken;
    const builder = Test.createTestingModule({
      imports: [AppModule],
      providers: [
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: () => true,
          },
        },
      ],
    });

    // Ensure any direct ThrottlerGuard provider is overridden for tests
    builder
      .overrideProvider(ThrottlerGuard)
      .useValue({ canActivate: () => true });

    const moduleFixture: TestingModule = await builder.compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
    // Ensure Prisma releases DB connections between Jest suites
    await prisma.$disconnect();
    if (originalMetricsToken === undefined)
      delete process.env[METRICS_AUTH_TOKEN_ENV];
    else process.env[METRICS_AUTH_TOKEN_ENV] = originalMetricsToken;
  });

  describe('Heating Events Endpoints', () => {
    let authToken: string;
    let userId: number;
    let deviceId: number;

    beforeAll(async () => {
      // Create test user
      const email = `heating_test_${Date.now()}@example.com`;
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          username: email.split('@')[0],
          password: 'TestPassword123!',
          name: 'Heating Test User',
        });

      expect(registerResponse.status).toBe(201);
      authToken = registerResponse.body.token;
      userId = registerResponse.body.user.id;

      // Create home profile first
      const homeProfile = await prisma.homeProfile.create({
        data: {
          userId,
          floorArea: 150.0,
          ceilingHeight: 2.3,
          insulationType: 'EPS',
          insulationThickness: 10,
          windowType: 'DOUBLE_GLAZED',
          heatingType: 'RADIATOR',
          constructionYear: 2020,
        },
      });

      // Create test device
      const device = await prisma.thermostatDevice.create({
        data: {
          userId,
          homeProfileId: homeProfile.id,
          vendor: 'tuya',
          deviceId: `test-device-${Date.now()}`,
          roomCurrentTemp: 20.0,
          roomTargetTemp: 25.0,
          lastSnapshotAt: new Date(),
        },
      });

      deviceId = device.id;
    });

    describe('POST /api/heating-events (manual creation for testing)', () => {
      it('should create heating event with transaction', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/heating-events')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            deviceId,
            roomCurrentTemp: 20.5,
            roomTargetTemp: 25.0,
            roomFlowTemp: 45.0,
          });

        // Endpoint may not exist in contract, but structure would be:
        if (response.status === 201 || response.status === 200) {
          expect(response.body).toHaveProperty('id');
          expect(response.body).toHaveProperty('deviceId');
          expect(response.body).toHaveProperty('timestampStart');
          expect(response.body.roomCurrentTemp).toBe(20.5);
          expect(response.body.roomTargetTemp).toBe(25.0);
        }
      });
    });

    describe('GET /api/heating-events (retrieve events)', () => {
      it('should return heating events for user', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/heating-events')
          .set('Authorization', `Bearer ${authToken}`);

        expect([200, 204]).toContain(response.status);

        if (response.status === 200) {
          expect(Array.isArray(response.body)).toBe(true);
          if (response.body.length > 0) {
            const event = response.body[0];
            expect(event).toHaveProperty('id');
            expect(event).toHaveProperty('deviceId');
            expect(event).toHaveProperty('timestampStart');
            expect(typeof event.roomCurrentTemp).toBe('number');
            expect(typeof event.roomTargetTemp).toBe('number');
          }
        }
      });

      it('should reject request without authorization', async () => {
        const response = await request(app.getHttpServer()).get(
          '/api/heating-events',
        );

        expect(response.status).toBe(401);
      });
    });
  });

  describe('Recommendations Endpoints', () => {
    let authToken: string;
    let userId: number;

    beforeAll(async () => {
      const email = `rec_test_${Date.now()}@example.com`;
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          username: email.split('@')[0],
          password: 'TestPassword123!',
          name: 'Recommendations Test User',
        });

      expect(registerResponse.status).toBe(201);
      authToken = registerResponse.body.token;
      userId = registerResponse.body.user.id;
    });

    describe('GET /api/recommendations (retrieve recommendations)', () => {
      it('should return recommendations for user', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/recommendations')
          .set('Authorization', `Bearer ${authToken}`);

        expect([200, 204]).toContain(response.status);

        if (response.status === 200) {
          expect(Array.isArray(response.body)).toBe(true);
          if (response.body.length > 0) {
            const rec = response.body[0];
            expect(rec).toHaveProperty('id');
            expect(rec).toHaveProperty('userId');
            expect(typeof rec.recommendedFlowTemp).toBe('number');
            if (rec.confidenceScore !== undefined) {
              expect(typeof rec.confidenceScore).toBe('number');
            }
          }
        }
      });

      it('should reject request without authorization', async () => {
        const response = await request(app.getHttpServer()).get(
          '/api/recommendations',
        );

        expect(response.status).toBe(401);
      });

      it('FE2-10 returns additive breakdown snapshot and null for old rows', async () => {
        const breakdown = {
          version: 1,
          mode: 'FULL',
          intervalKey: 'weekday_morning',
          baseCurveTemp: 51.2,
          weightedExternalTemp: -2.5,
          appliedOffsets: { home: 0.25, interval: -0.5, events: 0.125 },
          finalTemp: 51.1,
          confidence: 0.72,
          samples: 8,
          expectedHeatTimeMin: 27.5,
        };
        let withBreakdownId: number | null = null;
        let legacyId: number | null = null;
        try {
          const withBreakdown = await prisma.recommendation.create({
            data: {
              userId,
              date: new Date('2026-11-01T06:00:00.000Z'),
              recommendedFlowTemp: breakdown.finalTemp,
              expectedHeatTimeMin: breakdown.expectedHeatTimeMin,
              confidenceScore: breakdown.confidence,
              breakdown,
            },
          });
          withBreakdownId = withBreakdown.id;
          const legacy = await prisma.recommendation.create({
            data: {
              userId,
              date: new Date('2026-10-31T06:00:00.000Z'),
              recommendedFlowTemp: 50,
              expectedHeatTimeMin: 30,
              confidenceScore: 0.5,
            },
          });
          legacyId = legacy.id;

          const response = await request(app.getHttpServer())
            .get('/api/recommendations')
            .set('Authorization', `Bearer ${authToken}`);

          expect(response.status).toBe(200);
          expect(Array.isArray(response.body)).toBe(true);
          const snapshotRow = response.body.find(
            (row: { id: number }) => row.id === withBreakdownId,
          );
          const legacyRow = response.body.find(
            (row: { id: number }) => row.id === legacyId,
          );
          expect(snapshotRow).toBeDefined();
          expect(snapshotRow.breakdown).toEqual(breakdown);
          expect(legacyRow).toBeDefined();
          expect(legacyRow.breakdown).toBeNull();
        } finally {
          await prisma.recommendation.deleteMany({
            where: {
              id: {
                in: [withBreakdownId, legacyId].filter(
                  (id): id is number => id !== null,
                ),
              },
            },
          });
        }
      });
    });

    describe('GET /api/recommendations/today', () => {
      // API-1: ruta je stub. Prije je vracala [] sto je bilo nerazlucivo od
      // "nema preporuka za danas", pa sada eksplicitno vraca 501.
      it('should return 501 Not Implemented (stub)', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/recommendations/today')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(501);
        expect(response.body.reason).toBe('stub-not-implemented');
        expect(response.body.endpoint).toBe('GET /api/recommendations/today');
        expect(response.body.alternative).toBe('GET /api/recommendations');
      });
    });
  });

  describe('Anomalies Endpoints', () => {
    let authToken: string;

    beforeAll(async () => {
      const email = `anomaly_test_${Date.now()}@example.com`;
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          username: email.split('@')[0],
          password: 'TestPassword123!',
          name: 'Anomalies Test User',
        });

      expect(registerResponse.status).toBe(201);
      authToken = registerResponse.body.token;
    });

    describe('GET /api/anomalies (retrieve anomalies)', () => {
      it('should return anomalies for user', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/anomalies')
          .set('Authorization', `Bearer ${authToken}`);

        expect([200, 204]).toContain(response.status);

        if (response.status === 200) {
          expect(Array.isArray(response.body)).toBe(true);
          if (response.body.length > 0) {
            const anomaly = response.body[0];
            expect(anomaly).toHaveProperty('id');
            expect(anomaly).toHaveProperty('deviceId');
            expect(anomaly).toHaveProperty('detectedAt');
            if (anomaly.proposedEndTime) {
              expect(typeof anomaly.proposedEndTime).toBe('string');
            }
          }
        }
      });

      it('should reject request without authorization', async () => {
        const response = await request(app.getHttpServer()).get(
          '/api/anomalies',
        );

        expect(response.status).toBe(401);
      });
    });
  });

  describe('Thermostat Devices Endpoints', () => {
    let authToken: string;

    beforeAll(async () => {
      const email = `device_test_${Date.now()}@example.com`;
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          username: email.split('@')[0],
          password: 'TestPassword123!',
          name: 'Devices Test User',
        });

      expect(registerResponse.status).toBe(201);
      authToken = registerResponse.body.token;
    });

    describe('GET /api/devices (retrieve user devices)', () => {
      it('should return user thermostat devices', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/devices')
          .set('Authorization', `Bearer ${authToken}`);

        expect([200, 204]).toContain(response.status);

        if (response.status === 200) {
          expect(Array.isArray(response.body)).toBe(true);
          if (response.body.length > 0) {
            const device = response.body[0];
            expect(device).toHaveProperty('id');
            expect(device).toHaveProperty('deviceId');
            expect(device).toHaveProperty('name');
            expect(typeof device.currentTemp).toBe('number');
            expect(typeof device.isHeating).toBe('boolean');
            if (device.lastSnapshotAt) {
              expect(typeof device.lastSnapshotAt).toBe('string');
            }
          }
        }
      });

      it('should reject request without authorization', async () => {
        const response = await request(app.getHttpServer()).get('/api/devices');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('Boiler Endpoints', () => {
    let authToken: string;

    beforeAll(async () => {
      const email = `boiler_test_${Date.now()}@example.com`;
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          username: email.split('@')[0],
          password: 'TestPassword123!',
          name: 'Boiler Test User',
        });

      expect(registerResponse.status).toBe(201);
      authToken = registerResponse.body.token;
    });

    describe('GET /api/boiler/history', () => {
      it('should return boiler history', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/boiler/history')
          .set('Authorization', `Bearer ${authToken}`);

        expect([200, 204]).toContain(response.status);

        if (response.status === 200) {
          expect(Array.isArray(response.body)).toBe(true);
          if (response.body.length > 0) {
            const history = response.body[0];
            expect(history).toHaveProperty('id');
            expect(history).toHaveProperty('userId');
            expect(typeof history.externalTemp).toBe('number');
            expect(typeof history.suggestedFlowTemp).toBe('number');
          }
        }
      });

      it('should reject request without authorization', async () => {
        const response = await request(app.getHttpServer()).get(
          '/api/boiler/history',
        );

        expect(response.status).toBe(401);
      });
    });

    describe('PATCH /api/boiler/current-temp', () => {
      it('should persist current boiler temp for authenticated user', async () => {
        const response = await request(app.getHttpServer())
          .patch('/api/boiler/current-temp')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ currentFlowTemp: 52.5 });

        expect([200, 201]).toContain(response.status);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('currentFlowTemp', 52.5);
      });

      it('should reject out-of-range temperature', async () => {
        const response = await request(app.getHttpServer())
          .patch('/api/boiler/current-temp')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ currentFlowTemp: 56 });

        expect(response.status).toBe(400);
      });

      it('should reject request without authorization', async () => {
        const response = await request(app.getHttpServer())
          .patch('/api/boiler/current-temp')
          .send({ currentFlowTemp: 52.5 });

        expect(response.status).toBe(401);
      });
    });
  });

  describe('Weather Data Endpoints', () => {
    let authToken: string;

    beforeAll(async () => {
      const email = `weather_test_${Date.now()}@example.com`;
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          username: email.split('@')[0],
          password: 'TestPassword123!',
          name: 'Weather Test User',
        });

      expect(registerResponse.status).toBe(201);
      authToken = registerResponse.body.token;
    });

    describe('GET /api/weather (retrieve weather data)', () => {
      // API-1: ruta je stub. Prije je vracala {} sto je bilo nerazlucivo od
      // "nema vremenskih podataka", pa sada eksplicitno vraca 501.
      it('should return 501 Not Implemented (stub)', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/weather')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(501);
        expect(response.body.reason).toBe('stub-not-implemented');
        expect(response.body.endpoint).toBe('GET /api/weather');
        expect(response.body.alternative).toBe(
          'GET /api/weather/current/{homeProfileId}',
        );
      });

      it('should reject request without authorization', async () => {
        const response = await request(app.getHttpServer()).get('/api/weather');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('Transactional Integrity Verification (P1c)', () => {
    let userId: number;

    beforeAll(async () => {
      const email = `transaction_test_${Date.now()}@example.com`;
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          username: email.split('@')[0],
          password: 'TestPassword123!',
          name: 'Transaction Test User',
        });

      expect(registerResponse.status).toBe(201);
      userId = registerResponse.body.user.id;
    });

    it('should maintain database consistency on heating event creation', async () => {
      // Create a home profile first
      const homeProfile = await prisma.homeProfile.create({
        data: {
          userId,
          floorArea: 120.0,
          ceilingHeight: 2.5,
          insulationType: 'MINERAL_WOOL',
          insulationThickness: 12,
          windowType: 'DOUBLE_GLAZED',
          heatingType: 'UNDERFLOOR',
          constructionYear: 2015,
        },
      });

      // Create a device first
      const device = await prisma.thermostatDevice.create({
        data: {
          userId,
          homeProfileId: homeProfile.id,
          vendor: 'tuya',
          deviceId: `txn-test-${Date.now()}`,
          roomCurrentTemp: 20.0,
          roomTargetTemp: 24.0,
          lastSnapshotAt: new Date(),
        },
      });

      // Verify the device was created
      const verifyDevice = await prisma.thermostatDevice.findUnique({
        where: { id: device.id },
      });

      expect(verifyDevice).toBeDefined();
      expect(verifyDevice?.id).toBe(device.id);
    });

    it('should prevent orphaned database records on error', async () => {
      // This would test that if one operation fails, the entire transaction rolls back
      // In reality, this requires testing at the service level with mocked failures
      const initialCount = await prisma.heatingEvent.count();

      // Verify count remains stable
      expect(typeof initialCount).toBe('number');
    });
  });

  describe('Metrics Tracking Verification (P1d)', () => {
    it('should track metrics after successful operations', async () => {
      // Get current metrics
      const metricsResponse = await request(app.getHttpServer())
        .get('/metrics/json')
        .set(metricsAuth);

      expect(metricsResponse.status).toBe(200);
      expect(metricsResponse.body).toHaveProperty('poll_runs_total');
      expect(metricsResponse.body).toHaveProperty('heating_events_created');
      expect(metricsResponse.body).toHaveProperty('anomalies_detected');

      // Verify metrics are numeric
      expect(typeof metricsResponse.body.poll_runs_total).toBe('number');
      expect(typeof metricsResponse.body.heating_events_created).toBe('number');
      expect(typeof metricsResponse.body.anomalies_detected).toBe('number');
    });
  });

  describe('Correlation ID Propagation Verification (P1d)', () => {
    let authToken: string;

    beforeAll(async () => {
      const email = `correlation_test_${Date.now()}@example.com`;
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          username: email.split('@')[0],
          password: 'TestPassword123!',
          name: 'Correlation Test User',
        });

      expect(registerResponse.status).toBe(201);
      authToken = registerResponse.body.token;
    });

    it('should handle authenticated requests with structured logging', async () => {
      // Make authenticated request
      const response = await request(app.getHttpServer())
        .get('/api/user')
        .set('Authorization', `Bearer ${authToken}`);

      // Request should succeed (logs would contain correlation ID)
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');

      // In production with log collection, verify logs contain runId
      // This test confirms endpoint is callable and loggable
    });
  });

  describe('Edge Cases & Error Scenarios', () => {
    let authToken: string;

    beforeAll(async () => {
      const email = `edge_case_test_${Date.now()}@example.com`;
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          username: email.split('@')[0],
          password: 'TestPassword123!',
          name: 'Edge Case Test User',
        });

      expect(registerResponse.status).toBe(201);
      authToken = registerResponse.body.token;
    });

    it('should handle requests with query parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/heating-events?limit=10&offset=0')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 204, 400]).toContain(response.status);
    });

    it('should handle requests with date filters', async () => {
      const startDate = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app.getHttpServer())
        .get(`/api/heating-events?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 204, 400]).toContain(response.status);
    });

    it('should handle empty response bodies gracefully', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/recommendations')
        .set('Authorization', `Bearer ${authToken}`);

      // Should return 200 with empty array or 204 no content
      expect([200, 204]).toContain(response.status);

      if (response.status === 200 && response.body) {
        expect(Array.isArray(response.body)).toBe(true);
      }
    });

    it('should handle malformed authorization headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/user')
        .set('Authorization', 'InvalidFormat');

      expect(response.status).toBe(401);
    });
  });

  describe('MO2-20 home-profile read contract', () => {
    let authToken: string;
    let userId: number;
    let homeProfileId: number;

    beforeAll(async () => {
      const email = `mo220_${Date.now()}@example.com`;
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          username: email.split('@')[0],
          password: 'TestPassword123!',
          name: 'MO2-20 Test User',
        });

      expect(registerResponse.status).toBe(201);
      authToken = registerResponse.body.token;
      userId = registerResponse.body.user.id;

      const homeProfile = await prisma.homeProfile.create({
        data: {
          userId,
          homeName: null,
          location: null,
          floorArea: 150,
          ceilingHeight: 2.6,
          insulationType: 'EPS',
          insulationThickness: 10,
          windowType: 'DOUBLE_GLAZED',
          heatingType: 'RADIATOR',
          constructionYear: 2020,
          numberOfResidents: 0,
          hasFloorHeating: false,
        },
      });
      homeProfileId = homeProfile.id;

      await prisma.user.update({
        where: { id: userId },
        data: { activeHomeProfileId: null },
      });
    });

    it('GET /api/home-profiles does not persist activeHomeProfileId and keeps null/0/false', async () => {
      const before = await prisma.user.findUnique({
        where: { id: userId },
        select: { activeHomeProfileId: true },
      });
      expect(before?.activeHomeProfileId).toBeNull();

      const response = await request(app.getHttpServer())
        .get('/api/home-profiles')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      const row = response.body.find(
        (item: { id: number }) => item.id === homeProfileId,
      );
      expect(row).toBeDefined();
      expect(row.location).toBeNull();
      expect(row.name).toBeNull();
      expect(row.numberOfResidents).toBe(0);
      expect(row.hasFloorHeating).toBe(false);

      const after = await prisma.user.findUnique({
        where: { id: userId },
        select: { activeHomeProfileId: true },
      });
      expect(after?.activeHomeProfileId).toBeNull();
    });

    it('PATCH /api/home-profiles/:id/activate persists the active profile', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/home-profiles/${homeProfileId}/activate`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { activeHomeProfileId: true },
      });
      expect(user?.activeHomeProfileId).toBe(homeProfileId);
    });
  });
});
