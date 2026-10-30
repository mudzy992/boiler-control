#!/usr/bin/env node
'use strict';
// Stvarni polling servis, sintetička baza/zavisnosti; bez mreže, DB ili stvarnog cron-a.
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
if (process.argv.includes('--help')) {
  console.log(
    'Upotreba: node scripts/audit/poll_metrics_repro.cjs\n' +
      'Ručno poziva stvarni polling servis s lažnom bazom, adapterom i metrikama.\n' +
      'Poredi dva neuspjela uređaja sa greškom pri listanju; ne koristi produkciju,\n' +
      'mrežu ili stvarni scheduler.\n' +
      '\n' +
      'Skripta je ažurirana u OBS-1. Prije toga asertirala je POGREŠNO ponašanje\n' +
      '(dokaz za B-023: dva uređaja bace, a brojač kaže success=1). Sada asertira\n' +
      'ispravljeno — ishodi po uređaju se broje odvojeno od završetka ciklusa, a\n' +
      'stari `poll_runs_*` nazivi i značenje ostaju jer ih Grafana panel koristi.\n' +
      'Idempotentna, read-only, bez tajni.',
  );
  process.exit(0);
}
if (process.argv.length !== 2) { console.error('Nepoznat argument; koristite --help'); process.exit(2); }
const root = path.resolve(__dirname, '../..');
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');
const original = Module._load;
const mocks = {
  '../../prisma/prisma.service': {PrismaService:class PrismaService {}},
  '../Notification/notifications.service': {NotificationsService:class NotificationsService {}},
  '../Boiler/boiler.service': {BoilerService:class BoilerService {}},
  '../HeatingRecommendation/heating.recommendation.service': {HeatingRecommendationService:class HeatingRecommendationService {}},
  '../../common/metrics.service': {MetricsService:class MetricsService {}},
  'src/generated/prisma': {NotificationType:{}},
};
Module._load = function(request, parent, isMain) {
  if (parent?.filename.endsWith(path.join('ThermostatPoll','thermostat.polling.service.ts')) && Object.hasOwn(mocks,request)) return mocks[request];
  return original.call(this,request,parent,isMain);
};
require(path.join(root,'backend/node_modules/ts-node/register/transpile-only'));
const {Logger} = require(path.join(root,'backend/node_modules/@nestjs/common'));
const {ThermostatPollingService} = require(path.join(root,'backend/src/modules/ThermostatPoll/thermostat.polling.service.ts'));
Logger.overrideLogger(false);
async function run(failListing) {
  const counters = {}; const gauges = {}; let attempts = 0; let snapshots = 0;
  const db = {
    thermostatDevice:{findMany:async()=>{if(failListing) throw Error('synthetic listing failure'); return [{id:1,userId:1,deviceId:'synthetic-1'},{id:2,userId:2,deviceId:'synthetic-2'}];}},
    heatingEvent:{findFirst:async()=>{attempts++;throw Error('synthetic device failure');}},
  };
  // Lažna metrika MORA poštovati `value` i imati `setGauge` — servis ih sada zove.
  const metrics = {
    incrementCounter:(name, value = 1)=>{counters[name]=(counters[name]||0)+value;},
    setGauge:(name, value)=>{gauges[name]=value;},
  };
  const service = new ThermostatPollingService(db,{fetchSnapshot:async()=>{snapshots++;}}, {}, {}, {}, metrics);
  await service.pollAll();
  return {attempts,snapshots,counters,gauges};
}
(async()=>{
  const deviceFailure=await run(false), listingFailure=await run(true);

  // Dva uređaja bace: ciklus je završio (poll_runs_success=1), ali NIJEDAN uređaj
  // nije obrađen. Prije OBS-1 ovo je bio jedini signal i operater bi mislio da
  // je sve u redu.
  assert.deepEqual(deviceFailure.attempts, 2);
  assert.deepEqual(deviceFailure.snapshots, 0);
  assert.deepEqual(deviceFailure.counters, {
    poll_runs_total: 1,
    poll_devices_total: 2,
    poll_devices_success: 0,
    poll_devices_failed: 2,
    poll_devices_skipped: 0,
    poll_devices_no_snapshot: 0,
    poll_devices_incomplete: 0,
    poll_runs_success: 1,
  });
  // Svježina se ne pomjera kad ništa nije uspješno obrađeno.
  assert.deepEqual(deviceFailure.gauges, {});

  // Greška listanja: cijeli ciklus pada, nema brojača po uređaju.
  assert.deepEqual(listingFailure.attempts, 0);
  assert.deepEqual(listingFailure.snapshots, 0);
  assert.deepEqual(listingFailure.counters, {
    poll_runs_total: 1,
    poll_runs_failed: 1,
  });
  assert.deepEqual(listingFailure.gauges, {});

  console.log(JSON.stringify({
    scope:'stvarni servis, lažna baza/adapter/metrike; ručni poziv',
    deviceFailure,
    listingFailure,
    napomena:'poll_runs_success i dalje znači "ciklus završen", ne "uređaji obrađeni" — za drugo gledati poll_devices_*',
    actualSchedulerOrProviderTested:false,
  },null,2));
})().catch((error)=>{console.error('Reprodukcija nije uspjela:', error.message);process.exitCode=1;});
