import { randomBytes } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MetricsController } from '../metrics.controller';
import { MetricsService } from '../metrics.service';
import { ReportingService } from '../reporting.service';
import {
  METRICS_AUTH_MIN_LENGTH,
  METRICS_AUTH_TOKEN_ENV,
  MetricsAuthGuard,
} from '../metrics-auth.guard';

/**
 * SEC-6 — dedicated metrics token, fail-closed.
 *
 * Actual Nest HTTP controller + guard + services, synthetic reporting data.
 * No database, no user JWT, no external monitoring stack.
 */
describe('SEC-6: metrics authentication', () => {
  let app: INestApplication;
  let reporting: ReportingService;
  const originalToken = process.env[METRICS_AUTH_TOKEN_ENV];
  const token = randomBytes(32).toString('hex');
  const routes = [
    '/metrics',
    '/metrics/json',
    '/metrics/reporting',
    '/metrics/reporting/json',
  ] as const;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [MetricsService, ReportingService, MetricsAuthGuard],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    reporting = moduleRef.get(ReportingService);

    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-01-02T00:00:00Z');
    const base = {
      anomaliesTotal: 12,
      anomaliesOvershoot: 12,
      anomaliesEarlyStop: 0,
      anomaliesProlongedIdle: 0,
      anomaliesRapidCycling: 0,
      fallbacksTotal: 6,
      fallbacksSensorFailure: 6,
      fallbacksAdapterTimeout: 0,
      fallbacksCachedState: 0,
      tuyaTimeouts: 1,
      weatherTimeouts: 0,
      circuitBreakerTrips: 0,
    };
    reporting.generateDailyReport(731001, 931002, 831003, start, end, base);
    reporting.generateDailyReport(731004, 931005, 831006, start, end, {
      ...base,
      anomaliesTotal: 0,
      fallbacksTotal: 0,
      tuyaTimeouts: 0,
    });
    reporting.checkAlertConditions(731001, 931002, 831003, {
      anomaliesPerHour: 6,
    });
  });

  afterAll(async () => {
    await app.close();
    if (originalToken === undefined) delete process.env[METRICS_AUTH_TOKEN_ENV];
    else process.env[METRICS_AUTH_TOKEN_ENV] = originalToken;
  });

  afterEach(() => {
    process.env[METRICS_AUTH_TOKEN_ENV] = token;
  });

  it.each(routes)(
    '%s fails closed with 503 when token is absent',
    async (route) => {
      delete process.env[METRICS_AUTH_TOKEN_ENV];
      const response = await request(app.getHttpServer()).get(route);
      expect(response.status).toBe(503);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.text).not.toContain('poll_runs_total');
      expect(response.text).not.toContain('reporting_home_health_score');
    },
  );

  it('weak or whitespace-containing token is treated as unconfigured', async () => {
    process.env[METRICS_AUTH_TOKEN_ENV] = 'short';
    let response = await request(app.getHttpServer()).get('/metrics');
    expect(response.status).toBe(503);

    process.env[METRICS_AUTH_TOKEN_ENV] = `${token} extra`;
    response = await request(app.getHttpServer()).get('/metrics');
    expect(response.status).toBe(503);

    process.env[METRICS_AUTH_TOKEN_ENV] = 'x'.repeat(
      METRICS_AUTH_MIN_LENGTH - 1,
    );
    response = await request(app.getHttpServer()).get('/metrics');
    expect(response.status).toBe(503);
  });

  it.each(routes)(
    '%s rejects missing, wrong and non-Bearer credentials',
    async (route) => {
      const server = app.getHttpServer();
      expect((await request(server).get(route)).status).toBe(401);
      expect(
        (await request(server).get(route).set('Authorization', 'Bearer wrong'))
          .status,
      ).toBe(401);
      expect(
        (
          await request(server)
            .get(route)
            .set('Authorization', `Basic ${token}`)
        ).status,
      ).toBe(401);
      expect((await request(server).get(route).query({ token })).status).toBe(
        401,
      );
      expect(
        (
          await request(server)
            .get(route)
            .set('Cookie', `metrics_token=${token}`)
        ).status,
      ).toBe(401);
      expect(
        (
          await request(server)
            .get(route)
            .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.synthetic.jwt')
        ).status,
      ).toBe(401);
    },
  );

  it.each(routes)(
    '%s accepts the dedicated Bearer token and disables caching',
    async (route) => {
      const response = await request(app.getHttpServer())
        .get(route)
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
    },
  );

  it('Bearer scheme is case-insensitive but the token is exact', async () => {
    const server = app.getHttpServer();
    expect(
      (
        await request(server)
          .get('/metrics')
          .set('Authorization', `bearer ${token}`)
      ).status,
    ).toBe(200);
    // HTTP header optional whitespace is trimmed by the parser; exactness is
    // asserted with a wrong suffix instead of relying on trailing spaces.
    expect(
      (
        await request(server)
          .get('/metrics')
          .set('Authorization', `Bearer ${token}x`)
      ).status,
    ).toBe(401);
  });

  it('rotating the configured token immediately invalidates the old one', async () => {
    const next = randomBytes(32).toString('hex');
    process.env[METRICS_AUTH_TOKEN_ENV] = next;
    const server = app.getHttpServer();
    expect(
      (
        await request(server)
          .get('/metrics')
          .set('Authorization', `Bearer ${token}`)
      ).status,
    ).toBe(401);
    expect(
      (
        await request(server)
          .get('/metrics')
          .set('Authorization', `Bearer ${next}`)
      ).status,
    ).toBe(200);
  });

  it('authorized Prometheus export has no ID labels and authorized JSON keeps shape', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const text = await request(app.getHttpServer())
      .get('/metrics/reporting')
      .set(auth);
    expect(text.status).toBe(200);
    expect(text.headers['content-type']).toContain('text/plain');
    expect(text.text).toContain('reporting_home_health_score');
    expect(text.text).not.toMatch(/deviceId=|userId=|homeProfileId=/);
    expect(text.text).not.toContain('731001');
    expect(text.text).not.toContain('931002');

    const json = await request(app.getHttpServer())
      .get('/metrics/json')
      .set(auth);
    expect(json.status).toBe(200);
    expect(json.body).toHaveProperty('poll_runs_total');
    expect(json.body).toHaveProperty('poll_devices_total');

    const summary = await request(app.getHttpServer())
      .get('/metrics/reporting/json')
      .set(auth);
    expect(summary.status).toBe(200);
    expect(summary.body).toEqual({
      totalDevices: 2,
      averageHealthScore: expect.any(Number),
      criticalDevices: expect.any(Number),
      warningDevices: expect.any(Number),
    });
  });
});
