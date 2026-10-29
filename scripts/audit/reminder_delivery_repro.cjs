#!/usr/bin/env node
/* Actual reminder and notification services, fake DB/push; no external calls. */
'use strict';
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/reminder_delivery_repro.cjs\nStvarni reminder i notification servisi s lažnom bazom i pushom: provjerava šta se izvještava kada nema tokena ili je preferenca isključena. Bez HTTP-a, mreže, stvarnog slanja ili baze.');
  process.exit(0);
}
if (process.argv.length !== 2) { console.error('Nepoznat argument; koristite --help'); process.exit(2); }
const root = path.resolve(__dirname, '../..');
process.env.NODE_ENV = 'test';
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');
const original = Module._load;
Module._load = function(request, parent, isMain) {
  const source = parent?.filename || '';
  if (source.includes(path.join('src','modules')) && request.includes('prisma/prisma.service')) return {PrismaService:class PrismaService {}};
  if (source.endsWith(path.join('Notification','notifications.service.ts')) && request.includes('ExpoPush/expo.push.notification.service')) return {ExpoPushService:class ExpoPushService {}};
  if (source.includes(path.join('src','modules')) && request === 'src/generated/prisma') return {NotificationType:{GAS_READING_REMINDER:'GAS_READING_REMINDER'}};
  return original.call(this, request, parent, isMain);
};
require(path.join(root,'backend/node_modules/ts-node/register/transpile-only'));
const { Logger } = require(path.join(root,'backend/node_modules/@nestjs/common'));
Logger.overrideLogger(false);
const { NotificationsService } = require(path.join(root,'backend/src/modules/Notification/notifications.service.ts'));
const { GasReminderService } = require(path.join(root,'backend/src/modules/Schedule/gas.reminder.service.ts'));
async function main() {
  let prefEnabled = true, pushCalls = 0, writes = 0;
  const db = {
    user:{findMany:async()=>[{id:1}],findUnique:async()=>({id:1})},
    notificationPreference:{findUnique:async()=>({enabled:prefEnabled})},
    notification:{findFirst:async()=>null,create:async()=>{writes++;}},
    userDevice:{findMany:async()=>[]},
  };
  const notifications = new NotificationsService(db,{sendPushToTokens:async()=>{pushCalls++;}});
  const service = new GasReminderService(db,notifications);
  const mass = await service.triggerDailyReminders();
  assert.equal(mass.success,true);
  assert.equal(mass.summary,'Sent to 1 users, 0 failed');
  assert.equal(pushCalls,0); assert.equal(writes,0);
  prefEnabled = false;
  const manual = await service.sendTestReminder(1);
  assert.equal(manual.success,true); assert.equal(pushCalls,0); assert.equal(writes,0);
  console.log(JSON.stringify({scope:'actual services, fake DB and fake push; no HTTP or external delivery', massSummaryCountsNoTokenAsSent:true, manualReturnsSuccessDespiteDisabledPreference:true, pushCalls, notificationWrites:writes},null,2));
}
main().catch(() => { console.error('Reprodukcija nije uspjela; provjerite sintetički test i zavisnosti.'); process.exitCode=1; });
