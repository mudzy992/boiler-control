#!/usr/bin/env node
'use strict';
// Real program synchronizer, deterministic in-memory repository, injected single write failure.
const path=require('node:path');
const Module=require('node:module');
const assert=require('node:assert/strict');
if(process.argv.includes('--help')){
  console.log('Upotreba: node scripts/audit/program_sync_partial_repro.cjs\nStvarni ProgramSyncService s fake bazom i sintetičkim rasporedom; ubrizgava jedan pad drugog upisa i provjerava ponovno pokretanje. Nema stvarne baze, uređaja, mreže ili stvarnih programa.');process.exit(0);
}
if(process.argv.length!==2){console.error('Nepoznat argument; koristite --help');process.exit(2);}
const root=path.resolve(__dirname,'../..');
process.env.TS_NODE_PROJECT=path.join(root,'backend/tsconfig.json');
const original=Module._load;
Module._load=function(request,parent,isMain){
  if(parent?.filename.endsWith(path.join('Boiler','adapter','program.sync.service.ts'))){
    if(request.includes('prisma/prisma.service'))return {PrismaService:class PrismaService{}};
    if(request==='src/generated/prisma')return {DayType:{WORKDAY:'WORKDAY',SATURDAY:'SATURDAY',SUNDAY:'SUNDAY'}};
  }
  return original.call(this,request,parent,isMain);
};
require(path.join(root,'backend/node_modules/ts-node/register/transpile-only'));
const {Logger}=require(path.join(root,'backend/node_modules/@nestjs/common'));Logger.overrideLogger(false);
const {ProgramSyncService}=require(path.join(root,'backend/src/modules/Boiler/adapter/program.sync.service.ts'));
const input={WORKDAY:[{dayType:'WORKDAY',orderIndex:0,startMinute:360,targetTemp:20},{dayType:'WORKDAY',orderIndex:1,startMinute:480,targetTemp:22}],SATURDAY:[],SUNDAY:[]};
function makeRepo(failOnce){
  let writes=0,cleanups=0,failed=false;
  const rows=[{deviceId:1,dayType:'WORKDAY',orderIndex:0,startMinute:360,targetTemp:18,programHash:'old'},{deviceId:1,dayType:'WORKDAY',orderIndex:1,startMinute:480,targetTemp:19,programHash:'old'},{deviceId:1,dayType:'WORKDAY',orderIndex:2,startMinute:600,targetTemp:18,programHash:'old'}];
  const db={thermostatProgram:{
    findMany:async({where})=>rows.filter(r=>r.deviceId===where.deviceId&&r.dayType===where.dayType).sort((a,b)=>a.orderIndex-b.orderIndex).map(r=>({...r})),
    upsert:async({where,update,create})=>{writes++;if(failOnce&&!failed&&where.deviceId_dayType_orderIndex.orderIndex===1){failed=true;throw Error('synthetic write failure');}const key=where.deviceId_dayType_orderIndex;const row=rows.find(r=>r.deviceId===key.deviceId&&r.dayType===key.dayType&&r.orderIndex===key.orderIndex);if(row)Object.assign(row,update);else rows.push({...create});},
    deleteMany:async({where})=>{cleanups++;for(let i=rows.length-1;i>=0;i--){const r=rows[i];if(r.deviceId===where.deviceId&&r.dayType===where.dayType&&!where.orderIndex.notIn.includes(r.orderIndex))rows.splice(i,1);}},
  }};
  return {db,rows,counts:()=>({writes,cleanups})};
}
async function main(){
  const fake=makeRepo(true),service=new ProgramSyncService(fake.db);
  await assert.rejects(()=>service.syncProgram(1,input),/synthetic write failure/);
  await service.syncProgram(1,input);
  assert.deepEqual(fake.rows.map(r=>r.targetTemp),[20,19,18]);
  assert.notEqual(fake.rows[0].programHash,fake.rows[1].programHash);
  assert.deepEqual(fake.counts(),{writes:2,cleanups:0});
  const control=makeRepo(false);await new ProgramSyncService(control.db).syncProgram(1,input);
  assert.deepEqual(control.rows.map(r=>r.targetTemp),[20,22]);assert.deepEqual(control.counts(),{writes:2,cleanups:1});
  console.log(JSON.stringify({scope:'actual ProgramSyncService, fake DB, no HTTP or real device',injectedFailureOnSecondUpsert:true,afterRetryFirstIntervalUpdated:true,afterRetrySecondIntervalStale:true,afterRetryRemovedIntervalStillPresent:true,afterRetryMixedHashes:true,controlWithoutFailureFullyUpdated:true,realDatabaseConcurrencyOrProviderTested:false},null,2));
}
main().catch(()=>{console.error('Reprodukcija nije uspjela; provjerite testni bootstrap i zavisnosti.');process.exitCode=1;});
