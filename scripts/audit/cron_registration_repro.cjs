#!/usr/bin/env node
/* Synthetic Nest module topology around actual GasReminderService and installed scheduler. */
'use strict';
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/cron_registration_repro.cjs\nPokreće sintetički Nest application context s dvije DI registracije stvarnog GasReminderService i instaliranim Nest schedulerom; ručno okida cron nad lažnom bazom bez korisnika. Ne koristi stvarnu bazu, push, mrežu ili puni AppModule i ne utvrđuje broj produkcijskih replika.');
  process.exit(0);
}
if (process.argv.length !== 2) { console.error('Nepoznat argument; koristite --help'); process.exit(2); }
const root = path.resolve(__dirname, '../..');
process.env.NODE_ENV = 'production';
delete process.env.GAS_REMINDER_CRON;
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');
class DummyPrisma {}
class DummyNotifications {}
const original = Module._load;
Module._load = function(request, parent, isMain) {
  if (parent?.filename.endsWith(path.join('Schedule','gas.reminder.service.ts'))) {
    if (request.includes('prisma/prisma.service')) return {PrismaService:DummyPrisma};
    if (request.includes('Notification/notifications.service')) return {NotificationsService:DummyNotifications};
    if (request === 'src/generated/prisma') return {NotificationType:{GAS_READING_REMINDER:'GAS_READING_REMINDER'}};
  }
  return original.call(this, request, parent, isMain);
};
require(path.join(root,'backend/node_modules/ts-node/register/transpile-only'));
const {Module: NestModule, Logger} = require(path.join(root,'backend/node_modules/@nestjs/common'));
const {Test} = require(path.join(root,'backend/node_modules/@nestjs/testing'));
const {ScheduleModule, SchedulerRegistry} = require(path.join(root,'backend/node_modules/@nestjs/schedule'));
const {GasReminderService} = require(path.join(root,'backend/src/modules/Schedule/gas.reminder.service.ts'));
Logger.overrideLogger(false);
async function main() {
  const calls = [0,0];
  class ModuleA {} class ModuleB {}
  const providers = i => [GasReminderService, {provide:DummyPrisma,useValue:{user:{findMany:async()=>{calls[i]++;return [];}}}}, {provide:DummyNotifications,useValue:{}}];
  NestModule({providers:providers(0)})(ModuleA);
  NestModule({providers:providers(1)})(ModuleB);
  const mod = await Test.createTestingModule({imports:[ScheduleModule.forRoot(),ModuleA,ModuleB]}).compile();
  const app = mod.createNestApplication({logger:false});
  try {
    await app.init();
    const first = app.select(ModuleA).get(GasReminderService,{strict:true});
    const second = app.select(ModuleB).get(GasReminderService,{strict:true});
    assert.notEqual(first,second);
    const registry = app.get(SchedulerRegistry);
    const jobs = [...registry.getCronJobs().keys()];
    assert.deepEqual(jobs,['gas-reading-reminder']);
    const job = registry.getCronJob('gas-reading-reminder');
    job.stop();
    await job.fireOnTick();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls[0]+calls[1],1);
    console.log(JSON.stringify({scope:'synthetic Nest module graph, real GasReminderService and scheduler; fake DB, no full AppModule', providerInstances:2, registeredNamedJobs:jobs.length, manualTicks:1, totalDbCalls:calls[0]+calls[1], crossProcessSchedulingTested:false},null,2));
  } finally { await app.close(); }
}
main().catch(() => { console.error('Reprodukcija scheduler registracije nije uspjela; provjerite testni bootstrap.'); process.exitCode=1; });
