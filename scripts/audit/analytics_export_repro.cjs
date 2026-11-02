#!/usr/bin/env node
/* FEAT-6: stvarni Dashboard HTTP sloj nad laznom bazom, bez mreze/Prisma baze. */
'use strict';
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

if (process.argv.includes('--help')) {
  console.log(
    'Upotreba: node scripts/audit/analytics_export_repro.cjs\n' +
      'Stvarni DashboardController, DashboardService, JwtAuthGuard i ValidationPipe,\n' +
      'lazna baza i sinteticki korisnici. Provjerava anonimno 401, vlasnicki 200,\n' +
      'tudji/nepostojeci identican 404, legacy CSV, v2 flag/JSON/zonu i maxRows 413.\n' +
      'Bez stvarne baze, provajdera, produkcijskih podataka ili vanjske mreze.',
  );
  process.exit(0);
}
if (process.argv.length !== 2) {
  console.error('Nepoznat argument; koristite --help');
  process.exit(2);
}

const root = path.resolve(__dirname, '../..');
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');
class FakePrismaService {}
class FakeBoilerService {}
class FakeWeatherService {}
class FakeDashboardWeatherService {}
const original = Module._load;
Module._load = function (request, parent, isMain) {
  const from = parent?.filename || '';
  if (from.includes(path.join('src', 'modules')) && request.includes('prisma/prisma.service')) {
    return { PrismaService: FakePrismaService };
  }
  if (from.endsWith(path.join('Dashboard', 'dashboard.service.ts')) && request === '../Boiler/boiler.service') {
    return { BoilerService: FakeBoilerService };
  }
  if (from.endsWith(path.join('Dashboard', 'dashboard.service.ts')) && request === '../Weather/weather.service') {
    return { WeatherService: FakeWeatherService };
  }
  if (from.endsWith(path.join('Dashboard', 'dashboard.service.ts')) && request === '../Weather/dashboard-weather.service') {
    return { DashboardWeatherService: FakeDashboardWeatherService };
  }
  return original.call(this, request, parent, isMain);
};
require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));
const { Test } = require(path.join(root, 'backend/node_modules/@nestjs/testing'));
const { ValidationPipe } = require(path.join(root, 'backend/node_modules/@nestjs/common'));
const { Reflector } = require(path.join(root, 'backend/node_modules/@nestjs/core'));
const { JwtService } = require(path.join(root, 'backend/node_modules/@nestjs/jwt'));
const request = require(path.join(root, 'backend/node_modules/supertest'));
const { DashboardController } = require(path.join(root, 'backend/src/modules/Dashboard/dashboard.controller.ts'));
const { DashboardService } = require(path.join(root, 'backend/src/modules/Dashboard/dashboard.service.ts'));
const { JwtAuthGuard } = require(path.join(root, 'backend/src/modules/Auth/jwt-auth.guard.ts'));
const { ANALYTICS_EXPORT_V2_FLAG, ANALYTICS_EXPORT_MAX_ROWS_FLAG } = require(path.join(root, 'backend/src/modules/Dashboard/analytics-export.ts'));

async function main() {
  const profiles = [{ id: 10, userId: 1 }, { id: 20, userId: 2 }];
  const devices = [{ id: 100, userId: 1, homeProfileId: 10 }, { id: 200, userId: 2, homeProfileId: 20 }];
  const events = [{ id: 1, deviceId: 100, timestampStart: new Date('2026-01-01T10:00:00Z'), timestampEnd: new Date('2026-01-01T10:30:00Z'), roomCurrentTemp: 20, roomTargetTemp: 22 }];
  const learning = [{ id: 1, homeProfileId: 10, lastUpdated: new Date('2026-01-01T10:00:00Z'), confidence: 0.8 }];
  const db = {
    user: { findUnique: async ({ where }) => [1, 2].includes(where.id) ? { id: where.id, role: 'USER', plan: 'FULL' } : null },
    homeProfile: { findFirst: async ({ where }) => profiles.find((p) => p.id === where.id && p.userId === where.userId) ?? null },
    thermostatDevice: { count: async ({ where }) => devices.filter((d) => d.userId === where.homeProfile.userId).length },
    heatingEvent: {
      findMany: async ({ where, take }) => {
        const rows = events.filter((e) => {
          const device = devices.find((d) => d.id === e.deviceId);
          const filter = where?.thermostat?.homeProfile;
          if (!device) return false;
          if (filter?.userId !== undefined && device.userId !== filter.userId) return false;
          if (filter?.id !== undefined && device.homeProfileId !== filter.id) return false;
          const range = where?.timestampStart;
          if (range?.gte && e.timestampStart < range.gte) return false;
          if (range?.lte && e.timestampStart > range.lte) return false;
          return true;
        });
        return take === undefined ? rows : rows.slice(0, take);
      },
    },
    heatingIntervalLearning: {
      findMany: async ({ where, take }) => {
        const rows = learning.filter((i) => {
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
  const jwt = new JwtService({ secret: crypto.randomBytes(32).toString('hex') });
  const moduleRef = await Test.createTestingModule({
    controllers: [DashboardController],
    providers: [
      DashboardService,
      JwtAuthGuard,
      Reflector,
      { provide: JwtService, useValue: jwt },
      { provide: FakePrismaService, useValue: db },
      { provide: FakeBoilerService, useValue: {} },
      { provide: FakeWeatherService, useValue: {} },
      { provide: FakeDashboardWeatherService, useValue: {} },
      { provide: 'IThermostatAdapter', useValue: {} },
    ],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
  await app.init();
  const originalV2 = process.env[ANALYTICS_EXPORT_V2_FLAG];
  const originalMax = process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG];
  delete process.env[ANALYTICS_EXPORT_V2_FLAG];
  delete process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG];
  const query = { homeProfileId: 10, from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z' };
  const token = jwt.sign({ userId: 1 });
  try {
    const anonymous = await request(app.getHttpServer()).get('/api/dashboard/export').query(query);
    assert.equal(anonymous.status, 401);
    const owner = await request(app.getHttpServer()).get('/api/dashboard/export').set('Authorization', `Bearer ${token}`).query(query);
    assert.equal(owner.status, 200);
    assert.equal(owner.body.export.format, 'csv');
    assert.ok(owner.body.export.content.includes('2026-01-01,22,20,30,1'));
    assert.equal(owner.body.meta, undefined);
    const foreign = await request(app.getHttpServer()).get('/api/dashboard/export').set('Authorization', `Bearer ${token}`).query({ ...query, homeProfileId: 20 });
    const missing = await request(app.getHttpServer()).get('/api/dashboard/export').set('Authorization', `Bearer ${token}`).query({ ...query, homeProfileId: 999 });
    assert.equal(foreign.status, 404);
    assert.equal(missing.status, 404);
    assert.deepEqual(foreign.body, missing.body);
    const disabled = await request(app.getHttpServer()).get('/api/dashboard/export').set('Authorization', `Bearer ${token}`).query({ ...query, version: 2, format: 'json' });
    assert.equal(disabled.status, 503);
    process.env[ANALYTICS_EXPORT_V2_FLAG] = 'on';
    const v2 = await request(app.getHttpServer()).get('/api/dashboard/export').set('Authorization', `Bearer ${token}`).query({ ...query, version: 2, format: 'json', timeZone: 'Europe/Sarajevo' });
    assert.equal(v2.status, 200);
    assert.equal(v2.body.meta.timeZone, 'Europe/Sarajevo');
    assert.equal(JSON.parse(v2.body.export.content).schemaVersion, 2);
    process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG] = '1';
    learning.push({ id: 2, homeProfileId: 10, lastUpdated: new Date('2026-01-01T12:00:00Z'), confidence: 0.5 });
    const oversized = await request(app.getHttpServer()).get('/api/dashboard/export').set('Authorization', `Bearer ${token}`).query({ ...query, version: 2 });
    assert.equal(oversized.status, 413);
    console.log(JSON.stringify({ scope: 'FEAT-6 local Nest HTTP, fake DB, real guard/controller/pipe', anonymous: anonymous.status, owner: owner.status, foreign: foreign.status, missing: missing.status, identicalNotFound: true, v2Disabled: disabled.status, v2Json: v2.status, oversized: oversized.status }, null, 2));
  } finally {
    await app.close();
    if (originalV2 === undefined) delete process.env[ANALYTICS_EXPORT_V2_FLAG]; else process.env[ANALYTICS_EXPORT_V2_FLAG] = originalV2;
    if (originalMax === undefined) delete process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG]; else process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG] = originalMax;
  }
}
main().catch((error) => {
  console.error('FEAT-6 reprodukcija nije uspjela:', error?.message || error);
  process.exitCode = 1;
});
