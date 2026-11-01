#!/usr/bin/env node
/* SEC-6: isolated local Nest HTTP regression for dedicated metrics token,
 * fail-closed config, aggregate reporting export and minimized reporting logs.
 * No database, no external monitoring stack, no production requests. */
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

if (process.argv.includes('--help')) {
  console.log(
    'Upotreba: node scripts/audit/metrics_auth_repro.cjs\n' +
      'Izolovani lokalni Nest/Supertest HTTP test sa stvarnim MetricsController,\n' +
      'MetricsAuthGuard, MetricsService i ReportingService. Koristi sintetičke\n' +
      'reporting podatke i nasumični token; bez baze, korisničkog JWT-a ili\n' +
      'produkcijskih mrežnih zahtjeva.',
  );
  process.exit(0);
}
if (process.argv.length !== 2) {
  console.error('Nepoznat argument; koristite --help');
  process.exit(2);
}

const root = path.resolve(__dirname, '../..');
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');
require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));
const { Test } = require(path.join(root, 'backend/node_modules/@nestjs/testing'));
const { Logger } = require(path.join(root, 'backend/node_modules/@nestjs/common'));
const request = require(path.join(root, 'backend/node_modules/supertest'));
const { MetricsController } = require(path.join(root, 'backend/src/common/metrics.controller.ts'));
const { MetricsService } = require(path.join(root, 'backend/src/common/metrics.service.ts'));
const { ReportingService } = require(path.join(root, 'backend/src/common/reporting.service.ts'));
const { MetricsAuthGuard, METRICS_AUTH_TOKEN_ENV } = require(path.join(root, 'backend/src/common/metrics-auth.guard.ts'));

async function main() {
  const token = crypto.randomBytes(32).toString('hex');
  const previous = process.env[METRICS_AUTH_TOKEN_ENV];
  process.env[METRICS_AUTH_TOKEN_ENV] = token;
  const logs = [];
  const originalLog = Logger.prototype.log;
  Logger.prototype.log = function (message) { logs.push(String(message)); };

  const moduleRef = await Test.createTestingModule({
    controllers: [MetricsController],
    providers: [MetricsService, ReportingService, MetricsAuthGuard],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  try {
    const reporting = moduleRef.get(ReportingService);
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-01-02T00:00:00Z');
    const base = {
      anomaliesTotal: 120, anomaliesOvershoot: 120, anomaliesEarlyStop: 0,
      anomaliesProlongedIdle: 0, anomaliesRapidCycling: 0,
      fallbacksTotal: 72, fallbacksSensorFailure: 72, fallbacksAdapterTimeout: 0,
      fallbacksCachedState: 0, tuyaTimeouts: 20, weatherTimeouts: 0,
      circuitBreakerTrips: 6,
    };
    reporting.generateDailyReport(731001, 931002, 831003, start, end, base);
    reporting.generateDailyReport(731004, 931005, 831006, start, end, {
      ...base, anomaliesTotal: 0, fallbacksTotal: 0, tuyaTimeouts: 0, circuitBreakerTrips: 0,
    });
    reporting.recordAnomaly(731001, 931002, 831003, 'OVERSHOOT', 0.8);
    reporting.recordFallback(731001, 931002, 831003, 'CACHED_STATE', 'timeout');
    reporting.checkAlertConditions(731001, 931002, 831003, { anomaliesPerHour: 6 });

    const routes = ['/metrics', '/metrics/json', '/metrics/reporting', '/metrics/reporting/json'];
    const unconfigured = {};
    delete process.env[METRICS_AUTH_TOKEN_ENV];
    for (const route of routes) {
      const r = await request(app.getHttpServer()).get(route);
      unconfigured[route] = r.status;
      assert.equal(r.status, 503);
      assert.equal(r.headers['cache-control'], 'no-store');
    }
    process.env[METRICS_AUTH_TOKEN_ENV] = token;

    const anonymous = {};
    const authorized = {};
    let reportingText = '';
    for (const route of routes) {
      const bad = await request(app.getHttpServer()).get(route);
      anonymous[route] = bad.status;
      assert.equal(bad.status, 401);
      const ok = await request(app.getHttpServer()).get(route).set('Authorization', `Bearer ${token}`);
      authorized[route] = ok.status;
      assert.equal(ok.status, 200);
      assert.equal(ok.headers['cache-control'], 'no-store');
      if (route === '/metrics/reporting') reportingText = ok.text;
    }
    assert.match(reportingText, /reporting_home_health_score 46/);
    assert.doesNotMatch(reportingText, /deviceId=|userId=|homeProfileId=/);
    assert.doesNotMatch(reportingText, /731001|931002|831003/);
    const joinedLogs = logs.join('\n');
    assert.doesNotMatch(joinedLogs, /731001|931002|831003|\[deviceId=|\[userId=/);

    console.log(JSON.stringify({
      scope: 'isolated local Nest HTTP, actual controller/guard/services, synthetic data; not production exposure',
      unconfiguredStatuses: unconfigured,
      anonymousStatuses: anonymous,
      authorizedStatuses: authorized,
      idLabelsPresent: false,
      rawIdsInReportingLogs: false,
      aggregateHealthScore: 46,
    }, null, 2));
  } finally {
    Logger.prototype.log = originalLog;
    if (previous === undefined) delete process.env[METRICS_AUTH_TOKEN_ENV];
    else process.env[METRICS_AUTH_TOKEN_ENV] = previous;
    await app.close();
  }
}
main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
