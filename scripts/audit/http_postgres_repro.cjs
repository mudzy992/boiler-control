#!/usr/bin/env node
/* CI-only, intentional vulnerability demonstration; all synthetic DB writes roll back. */
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/http_postgres_repro.cjs --ci\nSamo efemerni PostgreSQL servis u branch-only GitHub Actions workflowu: stvarni JWT guard, kontroler, servis i Prisma transakcija s dva sintetička korisnika. Svi upisi se namjerno rollbackuju; bez Expo/vanjske mreže. Skripta pokazuje postojeći propust, NIJE regresijski test ispravljenog ponašanja. Ne koristiti s produkcijskom ili trajnom bazom.');
  process.exit(0);
}
if (process.argv.length !== 3 || process.argv[2] !== '--ci' || process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REF !== 'refs/heads/arena/94541967-boiler-control' || process.env.AUDIT_DISPOSABLE_POSTGRES !== '1' || process.env.DATABASE_HOST !== '127.0.0.1' || process.env.DATABASE_NAME !== 'audit' || process.env.DATABASE_USER !== 'audit') {
  console.error('Odbijeno: dopušten je samo eksplicitno označeni izolovani GitHub Actions PostgreSQL servis.'); process.exit(2);
}
const root = path.resolve(__dirname, '../..');
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');
require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));
require(path.join(root, 'backend/node_modules/tsconfig-paths/register'));
const { Test } = require(path.join(root, 'backend/node_modules/@nestjs/testing'));
const { ValidationPipe } = require(path.join(root, 'backend/node_modules/@nestjs/common'));
const { JwtService } = require(path.join(root, 'backend/node_modules/@nestjs/jwt'));
const request = require(path.join(root, 'backend/node_modules/supertest'));
const { PrismaService } = require(path.join(root, 'backend/src/prisma/prisma.service.ts'));
const { JwtAuthGuard } = require(path.join(root, 'backend/src/modules/Auth/jwt-auth.guard.ts'));
const { NotificationsController } = require(path.join(root, 'backend/src/modules/Notification/notifications.controller.ts'));
const { NotificationsService } = require(path.join(root, 'backend/src/modules/Notification/notifications.service.ts'));
const { GasReminderService } = require(path.join(root, 'backend/src/modules/Schedule/gas.reminder.service.ts'));
const ROLLBACK = new Error('AUDIT_ROLLBACK');
let stage = 'initialization';
async function main() {
  const db = new PrismaService();
  let completed = false;
  try {
    stage = 'connect';
    await db.$connect();
    stage = 'transaction';
    try {
      await db.$transaction(async tx => {
        stage = 'synthetic-fixtures';
        const nonce = crypto.randomBytes(12).toString('hex');
        const a = await tx.user.create({data:{email:`audit-a-${nonce}@example.invalid`,passwordHash:'not-a-real-hash'}});
        const b = await tx.user.create({data:{email:`audit-b-${nonce}@example.invalid`,passwordHash:'not-a-real-hash'}});
        const notice = await tx.notification.create({data:{userId:b.id,type:'SYSTEM_ALERT',title:'synthetic',message:'synthetic',isRead:false}});
        const jwt = new JwtService({secret:crypto.randomBytes(32).toString('hex')});
        let reminderCalls = 0;
        stage = 'nest-bootstrap';
        const testing = await Test.createTestingModule({controllers:[NotificationsController],providers:[
          JwtAuthGuard,
          {provide:JwtService,useValue:jwt},
          {provide:PrismaService,useValue:tx},
          {provide:NotificationsService,useValue:new NotificationsService(tx,{})},
          {provide:GasReminderService,useValue:{triggerDailyReminders:async()=>{reminderCalls++;return {ok:true};}}},
        ]}).compile();
        const app = testing.createNestApplication({logger:false});
        app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true,transformOptions:{enableImplicitConversion:true}}));
        await app.init();
        try {
          stage = 'http-unauthenticated';
          const auth = jwt.sign({userId:a.id});
          const missing = await request(app.getHttpServer()).post(`/api/notifications/${notice.id}/read`);
          assert.equal(missing.status,401);
          stage = 'http-cross-user';
          const result = await request(app.getHttpServer()).post(`/api/notifications/${notice.id}/read`).set('Authorization',`Bearer ${auth}`);
          assert.equal(result.status,201);
          stage = 'database-readback';
          const stored = await tx.notification.findUnique({where:{id:notice.id}});
          assert.equal(stored.userId,b.id); assert.equal(stored.isRead,true);
          stage = 'http-reminder';
          const reminder = await request(app.getHttpServer()).post('/api/notifications/test-trigger-all-gas-reminders').set('Authorization',`Bearer ${auth}`);
          assert.equal(reminder.status,201); assert.equal(reminderCalls,1);
          completed = true;
        } finally { await app.close(); }
        throw ROLLBACK;
      },{timeout:30000});
      throw new Error('Expected rollback did not occur');
    } catch (error) { if (error !== ROLLBACK) throw error; }
    assert.equal(completed,true);
    console.log('::notice title=Audit security reproduction::Synthetic user A modified user B notification in isolated PostgreSQL; USER invoked mock mass reminder. Transaction rolled back.');
  } finally { await db.$disconnect(); }
}
main().catch(error => {
  const known = ['AssertionError','PrismaClientInitializationError','PrismaClientKnownRequestError','PrismaClientValidationError','TypeError','Error'];
  const name = known.includes(error?.name) ? error.name : 'OtherError';
  const code = /^P\d{4}$/.test(error?.code || '') ? ` ${error.code}` : '';
  const numeric = error?.name === 'AssertionError' && Number.isInteger(error.actual) && Number.isInteger(error.expected) ? ` actual=${error.actual} expected=${error.expected}` : '';
  console.log(`::error title=Audit security reproduction::Stage ${stage}; ${name}${code}${numeric}. No values or messages emitted.`);
  process.exitCode = 1;
});
