#!/usr/bin/env node
'use strict';
// Actual notification service with an in-memory fake repository and fake Expo.
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/push_registration_repro.cjs\nStvarni NotificationsService s lažnom bazom i pushom: dvije registracije iste platforme, neaktivni zapis i slanje. Bez stvarnih tokena, mreže, HTTP-a ili baze; vrijednosti se ne ispisuju.');
  process.exit(0);
}
if (process.argv.length !== 2) { console.error('Nepoznat argument; koristite --help'); process.exit(2); }
const root = path.resolve(__dirname,'../..');
process.env.TS_NODE_PROJECT = path.join(root,'backend/tsconfig.json');
const original = Module._load;
Module._load = function(request,parent,isMain) {
  if (parent?.filename.endsWith(path.join('Notification','notifications.service.ts'))) {
    if (request.includes('prisma/prisma.service')) return {PrismaService:class PrismaService {}};
    if (request.includes('ExpoPush/expo.push.notification.service')) return {ExpoPushService:class ExpoPushService {}};
    if (request === 'src/generated/prisma') return {NotificationType:{}};
  }
  return original.call(this,request,parent,isMain);
};
require(path.join(root,'backend/node_modules/ts-node/register/transpile-only'));
const {NotificationsService} = require(path.join(root,'backend/src/modules/Notification/notifications.service.ts'));
async function main() {
  const rows = []; let sent = [], created = 0;
  const db = {
    userDevice:{
      findFirst:async({where})=>rows.find(row=>row.userId===where.userId && row.platform===where.platform) || null,
      create:async({data})=>{const row={id:rows.length+1,isActive:true,...data};rows.push(row);return row;},
      update:async({where,data})=>{const row=rows.find(r=>r.id===where.id);Object.assign(row,data);return row;},
      findMany:async({where})=>rows.filter(row=>row.userId===where.userId && (where.isActive===undefined || row.isActive===where.isActive)).map(row=>({expoPushToken:row.expoPushToken})),
    },
    notificationPreference:{findUnique:async()=>({enabled:true})},
    notification:{findFirst:async()=>null,create:async()=>{created++;}},
  };
  const service = new NotificationsService(db,{sendPushToTokens:async tokens=>{sent=[...tokens];}});
  const first='SYNTHETIC_DEVICE_ONE', second='SYNTHETIC_DEVICE_TWO';
  await service.registerToken(1,first,'android');
  await service.registerToken(1,second,'android');
  assert.equal(rows.length,1); assert.equal(rows[0].expoPushToken,second);
  rows[0].isActive=false;
  await service.registerToken(1,second,'android');
  assert.equal(rows[0].isActive,false);
  const tokens=await service.getUserTokens(1);
  assert.deepEqual(tokens,[second]);
  await service.notifyUser({userId:1,type:'SYNTHETIC_TYPE',title:'synthetic',message:'synthetic'});
  assert.deepEqual(sent,[second]); assert.equal(created,1);
  console.log(JSON.stringify({scope:'actual service; fake repository and push, synthetic data',samePlatformRegistrations:2,recordsAfterRegistration:rows.length,inactiveRemainsAfterReregistration:!rows[0].isActive,inactiveTokenPassedToFakePush:sent.length===1,notificationWrites:created,realDatabaseHttpExpoOrDeliveryTested:false},null,2));
}
main().catch(()=>{console.error('Reprodukcija nije uspjela; provjerite sintetički test i zavisnosti.');process.exitCode=1;});
