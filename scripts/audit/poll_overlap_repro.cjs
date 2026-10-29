#!/usr/bin/env node
'use strict';
// Real polling service and Nest scheduler inside an isolated synthetic module.
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/poll_overlap_repro.cjs\nStvarni polling servis i Nest scheduler u sintetičkom modulu; dva ručna ticka i lažna blokirana baza ispituju preklapanje unutar procesa. Nema prave baze, providera, mreže ni punog AppModule.');
  process.exit(0);
}
if (process.argv.length !== 2) { console.error('Nepoznat argument; koristite --help'); process.exit(2); }
const root=path.resolve(__dirname,'../..');
process.env.NODE_ENV='production';
process.env.TS_NODE_PROJECT=path.join(root,'backend/tsconfig.json');
class PrismaService {} class NotificationsService {} class BoilerService {} class HeatingRecommendationService {} class MetricsService {}
const substitutions={
  '../../prisma/prisma.service':{PrismaService},
  '../Notification/notifications.service':{NotificationsService},
  '../Boiler/boiler.service':{BoilerService},
  '../HeatingRecommendation/heating.recommendation.service':{HeatingRecommendationService},
  '../../common/metrics.service':{MetricsService},
  'src/generated/prisma':{NotificationType:{}},
};
const original=Module._load;
Module._load=function(request,parent,isMain) {
  if (parent?.filename.endsWith(path.join('ThermostatPoll','thermostat.polling.service.ts')) && Object.hasOwn(substitutions,request)) return substitutions[request];
  return original.call(this,request,parent,isMain);
};
require(path.join(root,'backend/node_modules/ts-node/register/transpile-only'));
const {Module:NestModule,Logger}=require(path.join(root,'backend/node_modules/@nestjs/common'));
const {Test}=require(path.join(root,'backend/node_modules/@nestjs/testing'));
const {ScheduleModule,SchedulerRegistry}=require(path.join(root,'backend/node_modules/@nestjs/schedule'));
const {ThermostatPollingService}=require(path.join(root,'backend/src/modules/ThermostatPoll/thermostat.polling.service.ts'));
Logger.overrideLogger(false);
async function main() {
  let release; const barrier=new Promise(resolve=>{release=resolve;});
  let calls=0,active=0,maxActive=0;
  const db={thermostatDevice:{findMany:async()=>{calls++;active++;maxActive=Math.max(maxActive,active);try {await barrier;return [];} finally {active--;}}}};
  class SyntheticModule {}
  NestModule({providers:[ThermostatPollingService,
    {provide:PrismaService,useValue:db}, {provide:'IThermostatAdapter',useValue:{}},
    {provide:BoilerService,useValue:{}}, {provide:NotificationsService,useValue:{}},
    {provide:HeatingRecommendationService,useValue:{}}, {provide:MetricsService,useValue:{incrementCounter(){}}},
  ]})(SyntheticModule);
  const mod=await Test.createTestingModule({imports:[ScheduleModule.forRoot(),SyntheticModule]}).compile();
  const app=mod.createNestApplication({logger:false});
  try {
    await app.init();
    const job=app.get(SchedulerRegistry).getCronJob('thermostat_polling');
    job.stop();
    assert.equal(job.waitForCompletion,false);
    await job.fireOnTick();
    await job.fireOnTick();
    for (let i=0;i<10 && calls<2;i++) await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls,2); assert.equal(maxActive,2); assert.equal(active,2);
    release();
    for (let i=0;i<10 && active;i++) await new Promise(resolve=>setImmediate(resolve));
    assert.equal(active,0);
    console.log(JSON.stringify({scope:'actual polling service and installed scheduler in synthetic Nest module',manualTicks:2,dbCalls:calls,maximumSimultaneousPolls:maxActive,waitForCompletion:job.waitForCompletion,fullAppRealTimeProviderOrCrossProcessTested:false},null,2));
  } finally { release(); await app.close(); }
}
main().catch(()=>{console.error('Reprodukcija nije uspjela; provjerite sintetički bootstrap i zavisnosti.');process.exitCode=1;});
