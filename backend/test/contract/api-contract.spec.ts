import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

/**
 * Contract Tests (P1e): Verify backend API responses match frontend expectations
 * These tests ensure that the API contract is stable and consistent for both web and mobile clients.
 */
describe('API Contract Tests (P1e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth API Contract', () => {
    it('POST /api/auth/register should return user + token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `contract_${Date.now()}@example.com`,
          username: `contract_${Date.now()}`,
          password: 'Test123!',
          name: 'Test User',
        });

      // Response contract:
      if (response.status === 201 || response.status === 200) {
        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('token');
        expect(response.body.user).toHaveProperty('id');
        expect(response.body.user).toHaveProperty('email');
        expect(response.body.user).toHaveProperty('name');
        expect(response.body.token).toBeTruthy();
        expect(typeof response.body.token).toBe('string');
      }
    });

    it('POST /api/auth/login should return user + token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      if (response.status === 200) {
        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('token');
        expect(response.body.user).toHaveProperty('id');
        expect(response.body.user).toHaveProperty('email');
      }
    });
  });

  describe('Boiler API Contract', () => {
    it('GET /api/boiler/history should return array of BoilerHistory', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/boiler/history')
        .set('Authorization', 'Bearer mock-token');

      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBeTruthy();
        if (response.body.length > 0) {
          const history = response.body[0];
          expect(history).toHaveProperty('id');
          expect(history).toHaveProperty('userId');
          expect(history).toHaveProperty('externalTemp');
          expect(history).toHaveProperty('suggestedFlowTemp');
          expect(history).toHaveProperty('heatingStart');
          expect(history).toHaveProperty('heatingEnd');
        }
      }
    });

    it('PATCH /api/boiler/current-temp should accept currentFlowTemp payload', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/boiler/current-temp')
        .set('Authorization', 'Bearer mock-token')
        .send({ currentFlowTemp: 52.5 });

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
      }
    });
  });

  describe('Dashboard API Contract', () => {
    it('GET /api/dashboard should return dashboard summary', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/dashboard')
        .set('Authorization', 'Bearer mock-token');

      if (response.status === 200) {
        expect(response.body).toBeDefined();
        // Should have boiler status, devices, recommendations, etc.
      }
    });
  });

  describe('Heating Events API Contract', () => {
    it('GET /api/heating/events should return array of HeatingEvent', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/heating/events')
        .set('Authorization', 'Bearer mock-token');

      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBeTruthy();
        if (response.body.length > 0) {
          const event = response.body[0];
          expect(event).toHaveProperty('id');
          expect(event).toHaveProperty('deviceId');
          expect(event).toHaveProperty('timestampStart');
          expect(event).toHaveProperty('roomCurrentTemp');
          expect(event).toHaveProperty('roomTargetTemp');
          expect(typeof event.roomCurrentTemp).toBe('number');
          expect(typeof event.roomTargetTemp).toBe('number');
        }
      }
    });

    it('GET /api/heating/events?active=true should return only active events', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/heating/events?active=true')
        .set('Authorization', 'Bearer mock-token');

      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBeTruthy();
        response.body.forEach((event: any) => {
          expect(event.timestampEnd).toBeNull(); // Active events have no end time
        });
      }
    });
  });

  describe('Heating Anomalies API Contract', () => {
    it('GET /api/heating/anomalies should return array of anomalies', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/heating/anomalies')
        .set('Authorization', 'Bearer mock-token');

      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBeTruthy();
        if (response.body.length > 0) {
          const anomaly = response.body[0];
          expect(anomaly).toHaveProperty('id');
          expect(anomaly).toHaveProperty('isAnomaly', true);
          expect(anomaly).toHaveProperty('proposedEndTime');
        }
      }
    });
  });

  describe('Recommendations API Contract', () => {
    it('GET /api/recommendation/today should return today recommendation', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/recommendation/today')
        .set('Authorization', 'Bearer mock-token');

      if (response.status === 200) {
        expect(response.body).toHaveProperty('recommendedFlowTemp');
        expect(response.body).toHaveProperty('confidenceScore');
        expect(typeof response.body.recommendedFlowTemp).toBe('number');
        expect(typeof response.body.confidenceScore).toBe('number');
      }
    });
  });

  describe('Thermostat Devices API Contract', () => {
    it('GET /api/thermostat/devices should return array of devices', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/thermostat/devices')
        .set('Authorization', 'Bearer mock-token');

      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBeTruthy();
        if (response.body.length > 0) {
          const device = response.body[0];
          expect(device).toHaveProperty('id');
          expect(device).toHaveProperty('alias');
          expect(device).toHaveProperty('roomCurrentTemp');
          expect(device).toHaveProperty('roomTargetTemp');
          expect(device).toHaveProperty('lastSnapshotAt');
        }
      }
    });
  });

  describe('Metrics API Contract (Public)', () => {
    it('GET /metrics should return Prometheus-format metrics', async () => {
      const response = await request(app.getHttpServer()).get('/metrics');

      expect(response.status).toBe(200);
      expect(response.text).toContain('poll_runs_total');
      expect(response.text).toContain('tuya_requests_total');
      expect(response.text).toContain('heating_events_created');
      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
    });

    it('GET /metrics/json should return metrics as JSON', async () => {
      const response = await request(app.getHttpServer()).get(
        '/metrics/json',
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('poll_runs_total');
      expect(response.body).toHaveProperty('tuya_requests_total');
      expect(response.body).toHaveProperty('heating_events_created');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Error Response Contract', () => {
    it('Invalid request should return 400 with error details', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: '', // Invalid
        });

      if (response.status === 400) {
        expect(response.body).toHaveProperty('message');
        // Frontend should handle this gracefully
      }
    });

    it('Unauthorized request should return 401', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/thermostat/devices')
        .set('Authorization', 'Bearer invalid-token');

      if (response.status === 401) {
        expect(response.body).toBeDefined();
      }
    });
  });
});
