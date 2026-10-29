#!/usr/bin/env node
/* Local Nest HTTP test using actual auth/user controllers, services, JWT guard; fake DB. */
'use strict';
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/auth_session_repro.cjs\nIzolovani Nest HTTP test stvarnih auth/user kontrolera, servisa i JWT guarda sa sintetičkim neaktivnim korisnikom i fake bazom. Bez stvarne baze, produkcije i vanjske mreže. Nasumične testne lozinke, hash i JWT ne ispisuju se.');
  process.exit(0);
}
if (process.argv.length !== 2) { console.error('Nepoznat argument; koristite --help'); process.exit(2); }
const root = path.resolve(__dirname,'../..');
process.env.TS_NODE_PROJECT = path.join(root,'backend/tsconfig.json');
class FakePrismaService {}
const original = Module._load;
Module._load = function(request,parent,isMain) {
  if (parent?.filename.includes(path.join('src','modules')) && request.includes('prisma/prisma.service')) return {PrismaService:FakePrismaService};
  return original.call(this,request,parent,isMain);
};
require(path.join(root,'backend/node_modules/ts-node/register/transpile-only'));
const {Test} = require(path.join(root,'backend/node_modules/@nestjs/testing'));
const {ValidationPipe} = require(path.join(root,'backend/node_modules/@nestjs/common'));
const {JwtService} = require(path.join(root,'backend/node_modules/@nestjs/jwt'));
const supertest = require(path.join(root,'backend/node_modules/supertest'));
const bcrypt = require(path.join(root,'backend/node_modules/bcryptjs'));
const {JwtAuthGuard} = require(path.join(root,'backend/src/modules/Auth/jwt-auth.guard.ts'));
const {AuthController} = require(path.join(root,'backend/src/modules/Auth/auth.controller.ts'));
const {AuthService} = require(path.join(root,'backend/src/modules/Auth/auth.service.ts'));
const {UserController} = require(path.join(root,'backend/src/modules/User/user.controller.ts'));
const {UserService} = require(path.join(root,'backend/src/modules/User/user.service.ts'));
async function main() {
  const passwords = [0,1,2].map(() => crypto.randomBytes(18).toString('hex'));
  const user = {id:1,email:'synthetic@example.invalid',username:'synthetic',passwordHash:await bcrypt.hash(passwords[0],4),isActive:false,role:'USER',plan:'FREE',gasPriceExVat:null};
  const project = (row, select) => !select ? {...row} : Object.fromEntries(Object.entries(select).filter(([k,v])=>v===true && k in row).map(([k])=>[k,row[k]]));
  const db = {
    user:{
      findFirst:async () => ({...user}),
      findUnique:async ({where,select}) => where.id === user.id ? project(user,select) : null,
      update:async ({where,data,select}) => {assert.equal(where.id,user.id); Object.assign(user,data); return project(user,select);},
    },
    $transaction:async (callback) => callback(db),
  };
  const jwt = new JwtService({secret:crypto.randomBytes(32).toString('hex'),signOptions:{expiresIn:'24h'}});
  const testing = await Test.createTestingModule({controllers:[AuthController,UserController],providers:[
    JwtAuthGuard, {provide:JwtService,useValue:jwt}, {provide:FakePrismaService,useValue:db},
    {provide:AuthService,useValue:new AuthService(db,jwt)}, {provide:UserService,useValue:new UserService(db)},
  ]}).compile();
  const app = testing.createNestApplication({logger:false});
  app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true,transformOptions:{enableImplicitConversion:true}}));
  await app.init();
  try {
    const login = await supertest(app.getHttpServer()).post('/api/auth/login').send({email:user.email,password:passwords[0]});
    assert.equal(login.status,200); assert.equal(user.isActive,false);
    const token = login.body.token;
    assert.equal(typeof token,'string');
    const auth = `Bearer ${token}`;
    const me = await supertest(app.getHttpServer()).get('/api/auth/me').set('Authorization',auth);
    assert.equal(me.status,200);
    const change = await supertest(app.getHttpServer()).post('/api/auth/change-password').set('Authorization',auth).send({currentPassword:passwords[0],newPassword:passwords[1]});
    assert.equal(change.status,200); assert.equal(await bcrypt.compare(passwords[1],user.passwordHash),true);
    const oldToken = await supertest(app.getHttpServer()).get('/api/auth/me').set('Authorization',auth);
    assert.equal(oldToken.status,200);
    const profileUpdate = await supertest(app.getHttpServer()).put('/api/user').set('Authorization',auth).send({password:passwords[2]});
    assert.equal(profileUpdate.status,200); assert.equal(await bcrypt.compare(passwords[2],user.passwordHash),true);
    const oldTokenAgain = await supertest(app.getHttpServer()).get('/api/auth/me').set('Authorization',auth);
    assert.equal(oldTokenAgain.status,200);
    const noToken = await supertest(app.getHttpServer()).get('/api/auth/me');
    assert.equal(noToken.status,401);
    console.log(JSON.stringify({scope:'actual auth/user controllers, services and JWT guard; synthetic inactive user and fake DB; no AppModule or production', inactiveUserLoginStatus:login.status, inactiveTokenMeStatus:me.status, normalPasswordChangeStatus:change.status, preChangeTokenStillAccepted:oldToken.status, profilePasswordChangeWithoutOldPassword:profileUpdate.status, preChangeTokenAcceptedAfterSecondChange:oldTokenAgain.status, anonymousMeStatus:noToken.status},null,2));
  } finally { await app.close(); }
}
main().catch(() => { console.error('Autentifikacijska reprodukcija nije uspjela; provjerite sintetički bootstrap i zavisnosti.'); process.exitCode=1; });
