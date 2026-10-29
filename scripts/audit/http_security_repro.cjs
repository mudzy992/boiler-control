#!/usr/bin/env node
/* Actual Nest controllers, JWT guard, notification service and ValidationPipe; fake database. */
'use strict';
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/http_security_repro.cjs\nIzolovana lokalna Nest/Supertest HTTP reprodukcija sa stvarnim JWT guardom, kontrolerima i notification servisom, lažnom bazom i sintetičkim korisnicima. Bez stvarne baze, providera, produkcijskih podataka ili mrežnih zahtjeva prema vani. Testni JWT ključ se generiše nasumično i ne ispisuje.');
  process.exit(0);
}
if (process.argv.length !== 2) { console.error('Nepoznat argument; koristite --help'); process.exit(2); }
const root = path.resolve(__dirname, '../..');
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');
class FakePrismaService {}
class FakeGasReminderService {}
class FakeExpoPushService {}
const original = Module._load;
Module._load = function(request, parent, isMain) {
  const from = parent?.filename || '';
  if (from.includes(path.join('src', 'modules')) && request.includes('prisma/prisma.service')) return {PrismaService:FakePrismaService};
  if (from.endsWith(path.join('Notification','notifications.controller.ts')) && request.includes('Schedule/gas.reminder.service')) return {GasReminderService:FakeGasReminderService};
  if (from.endsWith(path.join('Notification','notifications.service.ts')) && request.includes('ExpoPush/expo.push.notification.service')) return {ExpoPushService:FakeExpoPushService};
  if (from.includes(path.join('src','modules','Notification')) && request === 'src/generated/prisma') return {NotificationType:{}};
  if (from.endsWith(path.join('HeatingAnomalyCheckerService','heating.anomaly.checker.controller.ts')) && request.includes('heating.anomayl.checker.service')) return {HeatingAnomalyCheckerService:class HeatingAnomalyCheckerService {}};
  return original.call(this, request, parent, isMain);
};
require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));
const { Test } = require(path.join(root, 'backend/node_modules/@nestjs/testing'));
const { ValidationPipe } = require(path.join(root, 'backend/node_modules/@nestjs/common'));
const { Reflector } = require(path.join(root, 'backend/node_modules/@nestjs/core'));
const { JwtService } = require(path.join(root, 'backend/node_modules/@nestjs/jwt'));
const request = require(path.join(root, 'backend/node_modules/supertest'));
const { JwtAuthGuard } = require(path.join(root, 'backend/src/modules/Auth/jwt-auth.guard.ts'));
const { NotificationsController } = require(path.join(root, 'backend/src/modules/Notification/notifications.controller.ts'));
const { NotificationsService } = require(path.join(root, 'backend/src/modules/Notification/notifications.service.ts'));
const { HeatingAnomalyController } = require(path.join(root, 'backend/src/modules/HeatingAnomalyCheckerService/heating.anomaly.checker.controller.ts'));
// Metadata token comes from the same stub class loaded by the controller.
const checkerToken = Reflect.getMetadata('design:paramtypes', HeatingAnomalyController)[0];
async function main() {
  const row = {id:42,userId:2,isRead:false};
  let reminderCalls = 0, anomalyCalls = 0;
  const db = {
    user:{findUnique:async ({where}) => [1,2].includes(where.id) ? {id:where.id,role:'USER',plan:'FULL'} : null},
    notification:{
      findUnique:async ({where}) => where.id === row.id ? {...row} : null,
      update:async ({where,data}) => { assert.equal(where.id,row.id); Object.assign(row,data); return {...row}; },
    },
  };
  const jwt = new JwtService({secret:crypto.randomBytes(32).toString('hex')});
  const guard = new JwtAuthGuard(jwt, new Reflector(), db);
  const notificationService = new NotificationsService(db, {});
  const testing = await Test.createTestingModule({controllers:[NotificationsController, HeatingAnomalyController],providers:[
    {provide:JwtAuthGuard,useValue:guard},
    {provide:JwtService,useValue:jwt},
    {provide:NotificationsService,useValue:notificationService},
    {provide:FakePrismaService,useValue:db},
    {provide:FakeGasReminderService,useValue:{triggerDailyReminders:async () => {reminderCalls++; return {ok:true};}}},
    {provide:checkerToken,useValue:{confirmOrUpdateAnomaly:async () => {anomalyCalls++; return {success:true};}}},
  ]}).compile();
  const app = testing.createNestApplication({logger:false});
  app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true,transformOptions:{enableImplicitConversion:true}}));
  await app.init();
  try {
    const user1 = jwt.sign({userId:1});
    const unauthenticated = await request(app.getHttpServer()).post('/api/notifications/42/read');
    assert.equal(unauthenticated.status, 401); assert.equal(row.isRead,false);
    const otherUserRead = await request(app.getHttpServer()).post('/api/notifications/42/read').set('Authorization',`Bearer ${user1}`);
    assert.equal(otherUserRead.status,201); assert.equal(row.isRead,true);
    const reminder = await request(app.getHttpServer()).post('/api/notifications/test-trigger-all-gas-reminders').set('Authorization',`Bearer ${user1}`);
    assert.equal(reminder.status,201); assert.equal(reminderCalls,1);
    const anomaly = await request(app.getHttpServer()).patch('/api/anomalies/42').set('Authorization',`Bearer ${user1}`).send({confirm:true});
    assert.equal(anomaly.status,400); assert.equal(anomalyCalls,0);
    console.log(JSON.stringify({scope:'local Nest HTTP with actual JWT guard/controllers, actual notification service, fake DB and fake reminder/anomaly services; no real provider or database', unauthenticatedNotificationStatus:unauthenticated.status, crossUserNotificationStatus:otherUserRead.status, crossUserFakeRecordMarkedRead:row.isRead, ordinaryUserMassReminderStatus:reminder.status, fakeReminderInvocations:reminderCalls, anomalyPatchStatus:anomaly.status, fakeAnomalyInvocations:anomalyCalls}, null, 2));
  } finally { await app.close(); }
}
main().catch(() => { console.error('HTTP reprodukcija nije uspjela; provjerite zavisnosti i testni bootstrap.'); process.exitCode = 1; });
