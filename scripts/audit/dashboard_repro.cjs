#!/usr/bin/env node
/* Actual dashboard service on synthetic in-memory fake DB. No network/real DB. */
'use strict';
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/dashboard_repro.cjs\nStvarni DashboardService nad sintetičkom lažnom bazom, fiksna UTC zona; demonstrira mapiranje temperatura, satne buckete i filter prazne stranice. Bez HTTP-a/guarda, stvarne baze, mreže ili produkcijskih podataka.');
  process.exit(0);
}
if (process.argv.length !== 2) { console.error('Nepoznat argument; koristite --help'); process.exit(2); }
process.env.TZ = 'UTC';
const root = path.resolve(__dirname, '../..');
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');
const original = Module._load;
Module._load = function(request, parent, isMain) {
  if (parent?.filename.endsWith(path.join('Dashboard', 'dashboard.service.ts')) && (request.startsWith('../../prisma/') || request.startsWith('../Boiler/') || request.startsWith('../Weather/'))) return { PrismaService: class {}, BoilerService: class {}, WeatherService: class {} };
  return original.call(this, request, parent, isMain);
};
require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));
const { DashboardService } = require(path.join(root, 'backend/src/modules/Dashboard/dashboard.service.ts'));
async function main() {
  const events = [
    {id: 1, deviceId: 11, timestampStart: new Date('2026-01-01T10:00:00Z'), timestampEnd: null, roomCurrentTemp: 19, roomTargetTemp: 21, hvacAction: 'heating', source: 'fake'},
    {id: 2, deviceId: 22, timestampStart: new Date('2026-01-02T10:00:00Z'), timestampEnd: null, roomCurrentTemp: 18, roomTargetTemp: 20, hvacAction: 'heating', source: 'fake'},
  ];
  const lookups = [];
  let returnedEvents = events;
  const db = {
    thermostatDevice: {
      count: async () => 2,
      findFirst: async ({where}) => { lookups.push(where); return where.id === 11 ? {roomCurrentTemp: 25, roomTargetTemp: 26} : null; },
    },
    heatingEvent: {findMany: async () => returnedEvents, count: async () => returnedEvents.length},
    $transaction: async (operations) => Promise.all(operations),
  };
  const service = new DashboardService(db, {}, {}, {});
  const query = {homeProfileId: 1, from: '2026-01-01T00:00:00Z', to: '2026-01-03T00:00:00Z', bucket: 'hour'};
  const listed = await service.getHeatingEvents(1, query);
  const stats = await service.getHeatingStats(1, query);
  const summary = await service.getHeatingSummary(1, query);
  returnedEvents = [];
  await service.getHeatingEvents(1, query);
  assert.equal(listed.data[0].curretTempThermostat, 25);
  assert.equal(listed.data[1].deviceId, 22);
  assert.equal(listed.data[1].curretTempThermostat, 25);
  assert.equal(stats.buckets.length, 1);
  assert.equal(stats.buckets[0].cycles, 2);
  assert.equal(summary.buckets.length, 1);
  assert.equal(summary.buckets[0].cycles, 2);
  assert.equal(lookups.length, 2);
  assert.equal(lookups[1].id, undefined);
  console.log(JSON.stringify({scope:'actual service with fake DB, UTC, no HTTP/guard or real DB', deviceCount:2, bothEventRowsUseFirstDeviceTemp:true, twoDaysMergedInHourlyStats:true, twoDaysMergedInHourlySummary:true, emptyPageStillQueriesUndefinedId:true}, null, 2));
}
main().catch(error => { console.error('Reprodukcija nije uspjela:', error.message); process.exitCode = 1; });
