#!/usr/bin/env node
/* Stvarni DashboardService nad sintetičkom lažnom bazom. Bez mreže/stvarne DB. */
'use strict';
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');

if (process.argv.includes('--help')) {
  console.log(
    'Upotreba: node scripts/audit/dashboard_repro.cjs\n' +
      'Stvarni DashboardService nad sintetičkom lažnom bazom, fiksna UTC zona.\n' +
      'Provjerava mapiranje temperatura po uređaju (B-019) i semantiku satnih\n' +
      'bucket-a (B-020) u oba načina rada zastavice DASHBOARD_BUCKET_V2_ENABLED.\n' +
      '\n' +
      'Skripta je ažurirana u FEAT-8. Prije toga asertirala je POGREŠNO\n' +
      'ponašanje (dokaz za B-019/B-020); sada asertira ispravljeno i, uz\n' +
      'isključenu zastavicu, dokumentuje zadržanu legacy semantiku bucket-a.\n' +
      'Idempotentna, read-only, bez tajni. Bez HTTP-a/guarda, stvarne baze,\n' +
      'mreže ili produkcijskih podataka.',
  );
  process.exit(0);
}
if (process.argv.length !== 2) {
  console.error('Nepoznat argument; koristite --help');
  process.exit(2);
}

process.env.TZ = 'UTC';
const root = path.resolve(__dirname, '../..');
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');

const original = Module._load;
Module._load = function (request, parent, isMain) {
  if (
    parent?.filename.endsWith(path.join('Dashboard', 'dashboard.service.ts')) &&
    (request.startsWith('../../prisma/') ||
      request.startsWith('../Boiler/') ||
      request.startsWith('../Weather/'))
  ) {
    return {
      PrismaService: class {},
      BoilerService: class {},
      WeatherService: class {},
    };
  }
  return original.call(this, request, parent, isMain);
};

require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));

const {
  DashboardService,
} = require(path.join(
  root,
  'backend/src/modules/Dashboard/dashboard.service.ts',
));

const DEVICES = [
  { id: 11, userId: 1, roomCurrentTemp: 25, roomTargetTemp: 26 },
  { id: 22, userId: 1, roomCurrentTemp: 18, roomTargetTemp: 19 },
];

const EVENTS = [
  { id: 1, deviceId: 11, timestampStart: new Date('2026-01-01T10:00:00Z'), timestampEnd: null, roomCurrentTemp: 19, roomTargetTemp: 21, hvacAction: 'heating', source: 'fake' },
  { id: 2, deviceId: 22, timestampStart: new Date('2026-01-02T10:00:00Z'), timestampEnd: null, roomCurrentTemp: 18, roomTargetTemp: 20, hvacAction: 'heating', source: 'fake' },
];

/** Lažna baza koja poštuje `id: { in: [...] }` i `homeProfile.userId`. */
function makeDb(events) {
  const lookups = [];
  const db = {
    thermostatDevice: {
      count: async ({ where }) => {
        lookups.push({ op: 'count', where });
        const uid = where?.homeProfile?.userId;
        return DEVICES.filter((d) => d.userId === uid).length;
      },
      findFirst: async ({ where }) => {
        lookups.push({ op: 'findFirst', where });
        return DEVICES.find((d) => d.id === where?.id) ?? null;
      },
      findMany: async ({ where }) => {
        lookups.push({ op: 'findMany', where });
        let out = [...DEVICES];
        if (where?.id?.in) out = out.filter((d) => where.id.in.includes(d.id));
        if (where?.homeProfile?.userId !== undefined) {
          out = out.filter((d) => d.userId === where.homeProfile.userId);
        }
        return out;
      },
    },
    heatingEvent: {
      findMany: async () => events,
      count: async () => events.length,
    },
    $transaction: async (operations) => Promise.all(operations),
  };
  return { db, lookups };
}

async function main() {
  const out = {
    scope:
      'stvarni servis s lažnom bazom, UTC; bez HTTP-a/guarda ili stvarne baze',
  };
  const query = {
    homeProfileId: 1,
    from: '2026-01-01T00:00:00Z',
    to: '2026-01-03T00:00:00Z',
    bucket: 'hour',
  };

  // ---------- B-019: temperatura po uređaju ----------
  delete process.env.DASHBOARD_BUCKET_V2_ENABLED;

  const run1 = makeDb(EVENTS);
  const service = new DashboardService(run1.db, {}, {}, {});
  const listed = await service.getHeatingEvents(1, query);

  const byDevice = new Map(listed.data.map((d) => [d.deviceId, d]));
  assert.equal(byDevice.get(11).curretTempThermostat, 25);
  assert.equal(byDevice.get(11).targetTempThermostat, 26);
  // Prije FEAT-8 uređaj 22 je dobijao 25/26 (vrijednosti uređaja iz events[0]).
  assert.equal(byDevice.get(22).curretTempThermostat, 18);
  assert.equal(byDevice.get(22).targetTempThermostat, 19);
  out.perDeviceTemps = { d11: 25, d22: 18 };

  const deviceQueries = run1.lookups.filter((l) => l.op !== 'count');
  assert.equal(deviceQueries.length, 1);
  assert.equal(deviceQueries[0].op, 'findMany');
  assert.equal(deviceQueries[0].where.homeProfile.userId, 1);
  assert.deepEqual(deviceQueries[0].where.id.in.slice().sort(), [11, 22]);
  out.deviceQueryCount = deviceQueries.length;

  // Prazna stranica: prije FEAT-8 `if (thermostatDeviceIds)` je bio true i za
  // prazan niz, pa je išao upit s `id: undefined`.
  const run2 = makeDb([]);
  const emptyRes = await new DashboardService(run2.db, {}, {}, {}).getHeatingEvents(1, query);
  assert.equal(emptyRes.data.length, 0);
  assert.equal(
    run2.lookups.filter((l) => l.op !== 'count').length,
    0,
  );
  out.emptyPageDeviceQueries = 0;

  // ---------- B-020: v1 (zadano) — legacy semantika ostaje ----------
  const stats = await new DashboardService(makeDb(EVENTS).db, {}, {}, {}).getHeatingStats(1, query);
  const summary = await new DashboardService(makeDb(EVENTS).db, {}, {}, {}).getHeatingSummary(1, query);
  assert.equal(stats.buckets.length, 1);
  assert.equal(stats.buckets[0].cycles, 2);
  assert.equal(summary.buckets.length, 1);
  assert.equal(summary.buckets[0].cycles, 2);
  out.v1HourBucketsMergeTwoDays = {
    stats: 1,
    summary: 1,
    napomena:
      'namjerno zadržano: isporučeni klijenti crtaju ovaj ugovor; v2 je iza zastavice',
  };

  // ---------- B-020: v2 — hronološki ključevi ----------
  process.env.DASHBOARD_BUCKET_V2_ENABLED = 'on';
  const statsV2 = await new DashboardService(makeDb(EVENTS).db, {}, {}, {}).getHeatingStats(1, query);
  const summaryV2 = await new DashboardService(makeDb(EVENTS).db, {}, {}, {}).getHeatingSummary(1, query);
  assert.equal(statsV2.buckets.length, 2);
  assert.equal(summaryV2.buckets.length, 2);
  assert.deepEqual(
    summaryV2.buckets.map((b) => b.label).sort(),
    ['2026-01-01T10:00Z', '2026-01-02T10:00Z'],
  );
  out.v2HourBucketsSplitDays = {
    stats: 2,
    summary: 2,
    labels: summaryV2.buckets.map((b) => b.label).sort(),
  };

  delete process.env.DASHBOARD_BUCKET_V2_ENABLED;
  console.log(JSON.stringify(out, null, 2));
}

main().catch((error) => {
  console.error('Reprodukcija nije uspjela:', error.message);
  process.exitCode = 1;
});
