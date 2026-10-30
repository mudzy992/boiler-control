#!/usr/bin/env node
/* CI-only: regresijski dokaz da SEC-1 (IDOR) drži + demonstracija i dalje otvorenog nalaza za masovni gas reminder. Svi sintetički upisi se rollbackuju. */
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/http_postgres_repro.cjs --ci\nSamo efemerni PostgreSQL servis u branch-only GitHub Actions workflowu: stvarni JWT guard, kontroler, servis i Prisma transakcija s dva sintetička korisnika. Svi upisi se namjerno rollbackuju; bez Expo/vanjske mreže.\n\nSkripta je REGRESIJSKI DOKAZ, ne demonstracija propusta: SEC-1 je ispravio IDOR na POST /api/notifications/:id/read, pa cross-user pokušaj sada mora vratiti 404 i NE smije promijeniti zapis, dok vlasnik i dalje uspješno označava svoju notifikaciju (pozitivna kontrola). Masovni gas reminder se i dalje demonstrira kao OTVOREN nalaz: endpoint dokumentuje "admin only" ali nema RolesGuard, pa ga može pozvati svaki prijavljeni korisnik.\n\nNe koristiti s produkcijskom ili trajnom bazom.');
  process.exit(0);
}
if (process.argv.length !== 3 || process.argv[2] !== '--ci' || process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REF !== 'refs/heads/arena/1bfee051-boiler-control' || process.env.AUDIT_DISPOSABLE_POSTGRES !== '1' || process.env.DATABASE_HOST !== '127.0.0.1' || process.env.DATABASE_NAME !== 'audit' || process.env.DATABASE_USER !== 'audit') {
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
  let userIds = [];
  let notificationId;
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
        // SEC-3: administrator za pozitivnu kontrolu masovnog remindera.
        const admin = await tx.user.create({data:{email:`audit-admin-${nonce}@example.invalid`,passwordHash:'not-a-real-hash',role:'ADMIN'}});
        const notice = await tx.notification.create({data:{userId:b.id,type:'SYSTEM_ALERT',title:'synthetic',message:'synthetic',isRead:false}});
        userIds = [a.id, b.id, admin.id];
        notificationId = notice.id;
        const jwt = new JwtService({secret:crypto.randomBytes(32).toString('hex')});
        let reminderCalls = 0;
        // Plain wrapper prevents Nest lifecycle scanning on Prisma's interactive-transaction proxy.
        // Delegates still execute real SQL through the same rollback-only transaction.
        const prisma = {user:tx.user, notification:tx.notification};
        stage = 'nest-bootstrap';
        const testing = await Test.createTestingModule({controllers:[NotificationsController],providers:[
          JwtAuthGuard,
          {provide:JwtService,useValue:jwt},
          {provide:PrismaService,useValue:prisma},
          {provide:NotificationsService,useValue:new NotificationsService(prisma,{})},
          {provide:GasReminderService,useValue:{triggerDailyReminders:async()=>{reminderCalls++;return {ok:true};}}},
        ]}).compile();
        stage = 'nest-create-app';
        const app = testing.createNestApplication({logger:false});
        app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true,transformOptions:{enableImplicitConversion:true}}));
        stage = 'nest-init';
        await app.init();
        try {
          stage = 'http-unauthenticated';
          const auth = jwt.sign({userId:a.id});
          const missing = await request(app.getHttpServer()).post(`/api/notifications/${notice.id}/read`);
          assert.equal(missing.status,401);
          stage = 'http-cross-user';
          // SEC-1: IDOR je ispravljen. Servis radi atomski updateMany po {id, userId}
          // i baca NotFoundException kad je count 0 -- 404 namjerno umjesto 403, da
          // odgovor ne otkrije postojanje tudjeg zapisa.
          const result = await request(app.getHttpServer()).post(`/api/notifications/${notice.id}/read`).set('Authorization',`Bearer ${auth}`);
          assert.equal(result.status,404);
          stage = 'database-readback';
          // Kljucni dokaz: nije dovoljno da HTTP odgovor bude 404 -- upis se stvarno
          // ne smije desiti. Zapis i dalje pripada B i ostaje neprocitan.
          const stored = await tx.notification.findUnique({where:{id:notice.id}});
          assert.equal(stored.userId,b.id); assert.equal(stored.isRead,false);
          stage = 'http-owner';
          // Pozitivna kontrola: bez nje 404 ne bi dokazivao autorizaciju, jer bi bio
          // jednako objasnjiv pokvarenim endpointom. Vlasnik mora proci.
          const ownerAuth = jwt.sign({userId:b.id});
          const own = await request(app.getHttpServer()).post(`/api/notifications/${notice.id}/read`).set('Authorization',`Bearer ${ownerAuth}`);
          assert.equal(own.status,201);
          const readByOwner = await tx.notification.findUnique({where:{id:notice.id}});
          assert.equal(readByOwner.isRead,true);
          stage = 'http-reminder';
          // SEC-3 / B-007: endpoint JE zasticen. @Roles(UserRole.ADMIN) +
          // @UseGuards(RolesGuard) na kontroleru; role dolazi iz baze preko
          // JwtAuthGuard (jwt-auth.guard.ts:41-56). Obican korisnik mora biti
          // odbijen, a servis se uopste ne smije pozvati.
          const reminder = await request(app.getHttpServer()).post('/api/notifications/test-trigger-all-gas-reminders').set('Authorization',`Bearer ${auth}`);
          assert.equal(reminder.status,403); assert.equal(reminderCalls,0);
          // Pozitivna kontrola: bez nje 403 ne bi dokazivao autorizaciju, jer bi
          // bio jednako objasnjiv pokvarenim endpointom. Admin mora proci.
          const adminAuth = jwt.sign({userId:admin.id});
          const adminReminder = await request(app.getHttpServer()).post('/api/notifications/test-trigger-all-gas-reminders').set('Authorization',`Bearer ${adminAuth}`);
          assert.equal(adminReminder.status,201); assert.equal(reminderCalls,1);
          completed = true;
        } finally { await app.close(); }
        throw ROLLBACK;
      },{timeout:30000});
      throw new Error('Expected rollback did not occur');
    } catch (error) { if (error !== ROLLBACK) throw error; }
    assert.equal(completed,true);
    stage = 'rollback-verification';
    assert.equal(await db.user.count({where:{id:{in:userIds}}}), 0);
    assert.equal(await db.notification.count({where:{id:notificationId}}), 0);
    console.log('::notice title=Audit security regression check::SEC-1 holds in isolated PostgreSQL - cross-user POST /api/notifications/:id/read returned 404 and left the record unread, while the owner still succeeded. SEC-3 also holds: test-trigger-all-gas-reminders returned 403 for a USER without invoking the mock mass reminder, and 201 for an ADMIN. Transaction rolled back and record absence verified.');
  } finally { await db.$disconnect(); }
}
main().catch(error => {
  const known = ['AssertionError','PrismaClientInitializationError','PrismaClientKnownRequestError','PrismaClientValidationError','TypeError','Error'];
  const name = known.includes(error?.name) ? error.name : 'OtherError';
  const code = /^P\d{4}$/.test(error?.code || '') ? ` ${error.code}` : '';
  const numeric = error?.name === 'AssertionError' && Number.isInteger(error.actual) && Number.isInteger(error.expected) ? ` actual=${error.actual} expected=${error.expected}` : '';
  const property = String(error?.message || '').match(/^Cannot read properties of (undefined|null) \(reading '([A-Za-z_][A-Za-z_0-9]*)'\)/);
  const hint = property ? `; read ${property[2]} of ${property[1]}` : '';
  console.log(`::error title=Audit security reproduction::Stage ${stage}; ${name}${code}${numeric}${hint}. No values or messages emitted.`);
  process.exitCode = 1;
});
