#!/usr/bin/env node
'use strict';
// Real polling service, synthetic DB/dependencies; no network, DB or actual cron.
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/poll_metrics_repro.cjs\nRučno poziva stvarni polling servis s lažnom bazom, adapterom i metrikama. Poredi dva neuspjela uređaja sa greškom pri listanju; ne koristi produkciju, mrežu ili stvarni scheduler.');
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
  const counters = {}; let attempts = 0; let snapshots = 0;
  const db = {
    thermostatDevice:{findMany:async()=>{if(failListing) throw Error('synthetic listing failure'); return [{id:1,userId:1,deviceId:'synthetic-1'},{id:2,userId:2,deviceId:'synthetic-2'}];}},
    heatingEvent:{findFirst:async()=>{attempts++;throw Error('synthetic device failure');}},
  };
  const metrics = {incrementCounter:name=>{counters[name]=(counters[name]||0)+1;}};
  const service = new ThermostatPollingService(db,{fetchSnapshot:async()=>{snapshots++;}}, {}, {}, {}, metrics);
  await service.pollAll();
  return {attempts,snapshots,counters};
}
(async()=>{
  const deviceFailure=await run(false), listingFailure=await run(true);
  assert.deepEqual(deviceFailure,{attempts:2,snapshots:0,counters:{poll_runs_total:1,poll_runs_success:1}});
  assert.deepEqual(listingFailure,{attempts:0,snapshots:0,counters:{poll_runs_total:1,poll_runs_failed:1}});
  console.log(JSON.stringify({scope:'actual service, fake DB/adapter/metrics; manual invocation',deviceFailure,listingFailure,actualSchedulerOrProviderTested:false},null,2));
})().catch(()=>{console.error('Reprodukcija nije uspjela.');process.exitCode=1;});
