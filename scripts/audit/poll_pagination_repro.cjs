#!/usr/bin/env node
/* PERF-2: bounded keyset thermostat polling, bez vanjskih servisa. */
const assert = require('node:assert/strict');
if (process.argv.includes('--help')) {
  console.log('Usage: node scripts/audit/poll_pagination_repro.cjs\nPERF-2 fake-DB regression: keyset batches, legacy rollback, partial-failure metrics.\nExit 0 = PASS, 1 = FAIL. No external services.');
  process.exit(0);
}
const path = require('node:path');
const Module = require('node:module');
const backend = path.join(__dirname, '../../backend');
require(path.join(backend, 'node_modules/ts-node')).register({
  project: path.join(backend, 'tsconfig.json'),
  transpileOnly: true,
});
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'src/generated/prisma') return { NotificationType: {} };
  if (request.endsWith('/prisma/prisma.service') || request === '../../prisma/prisma.service') {
    return { PrismaService: class PrismaService {} };
  }
  if (request.endsWith('/notifications.service')) return { NotificationsService: class {} };
  if (request.endsWith('/boiler.service')) return { BoilerService: class {} };
  if (request.endsWith('/heating.recommendation.service')) return { HeatingRecommendationService: class {} };
  return originalLoad.apply(this, arguments);
};
const { Logger } = require(path.join(backend, 'node_modules/@nestjs/common'));
Logger.overrideLogger(false);
const { ThermostatPollingService } = require(path.join(backend, 'src/modules/ThermostatPoll/thermostat.polling.service.ts'));
const { MetricsService } = require(path.join(backend, 'src/common/metrics.service.ts'));
const FLAG = 'POLL_PAGINATION_ENABLED';
const BATCH = 'POLL_BATCH_SIZE';
const originalFlag = process.env[FLAG];
const originalBatch = process.env[BATCH];
function restore() {
  if (originalFlag === undefined) delete process.env[FLAG]; else process.env[FLAG] = originalFlag;
  if (originalBatch === undefined) delete process.env[BATCH]; else process.env[BATCH] = originalBatch;
}
function device(id) {
  return { id, userId: id, deviceId: `dev-${id}`, lastSnapshotAt: null, roomCurrentTemp: null, roomTargetTemp: null };
}
function harness(devices, failListingOnCall) {
  const listingCalls = [];
  const snapshotCalls = [];
  let call = 0;
  const db = {
    thermostatDevice: {
      findMany: async (args) => {
        call += 1;
        listingCalls.push(args);
        if (failListingOnCall === call) throw new Error('synthetic listing failure');
        if (args?.include) return devices;
        const cursor = args?.where?.id?.gt ?? 0;
        const rows = devices.filter((d) => d.id > cursor).sort((a, b) => a.id - b.id);
        const taken = args?.take === undefined ? rows : rows.slice(0, args.take);
        if (args?.select) {
          return taken.map((row) => Object.fromEntries(Object.keys(args.select).map((k) => [k, row[k]])));
        }
        return taken;
      },
      updateMany: async () => ({ count: 1 }),
    },
    heatingEvent: { findFirst: async () => null },
  };
  const adapter = {
    fetchSnapshot: async (deviceId) => {
      snapshotCalls.push(deviceId);
      if (deviceId === 'dev-2') throw new Error('synthetic device failure');
      return { currentTemp: 20, targetTemp: 22, powerOn: false };
    },
  };
  const metrics = new MetricsService();
  const service = new ThermostatPollingService(db, adapter, { calculateFlowTemp: async () => ({ flowTemp: 45 }) }, {}, {}, metrics);
  return { service, metrics, listingCalls, snapshotCalls };
}
(async () => {
  delete process.env[FLAG];
  process.env[BATCH] = '2';
  const many = harness([device(1), device(2), device(3), device(4), device(5)]);
  await many.service.pollAll();
  assert.deepEqual(many.snapshotCalls, ['dev-1', 'dev-2', 'dev-3', 'dev-4', 'dev-5']);
  assert.equal(many.listingCalls.length, 3);
  assert.deepEqual(many.listingCalls.map((c) => c.where.id.gt), [0, 2, 4]);
  assert.ok(many.listingCalls.every((c) => c.take === 2 && c.orderBy.id === 'asc' && c.include === undefined));
  assert.equal(many.metrics.getMetrics().poll_devices_total, 5);
  assert.equal(many.metrics.getMetrics().poll_devices_failed, 1);
  assert.equal(many.metrics.getMetrics().poll_devices_success, 4);

  process.env[FLAG] = 'off';
  const legacy = harness([device(1), device(2), device(3)]);
  await legacy.service.pollAll();
  assert.equal(legacy.listingCalls.length, 1);
  assert.deepEqual(legacy.listingCalls[0].include, { user: true, homeProfile: { include: { intervalLearnings: true } } });
  assert.equal(legacy.metrics.getMetrics().poll_devices_total, 3);

  delete process.env[FLAG];
  const partial = harness([device(1), device(2), device(3), device(4), device(5)], 2);
  await partial.service.pollAll();
  assert.deepEqual(partial.snapshotCalls, ['dev-1', 'dev-2']);
  assert.equal(partial.metrics.getMetrics().poll_runs_failed, 1);
  assert.equal(partial.metrics.getMetrics().poll_runs_success, 0);
  assert.equal(partial.metrics.getMetrics().poll_devices_total, 2);
  assert.equal(partial.metrics.getMetrics().poll_devices_failed, 1);
  assert.equal(partial.metrics.getMetrics().poll_devices_success, 1);

  console.log('[poll-pagination] bounded keyset, legacy rollback i partial-failure metrics: PASS');
  restore();
})().catch((err) => {
  restore();
  console.error(`[poll-pagination] FAIL: ${err.message}`);
  process.exitCode = 1;
});
