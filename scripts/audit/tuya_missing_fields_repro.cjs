#!/usr/bin/env node
'use strict';
// Real snapshot normalization and poll decision, fake Tuya status and in-memory dependencies.
const path=require('node:path');
const Module=require('node:module');
const assert=require('node:assert/strict');
if(process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/tuya_missing_fields_repro.cjs\nStvarni Tuya snapshot i polling odluka s lažnim statusom/bazom: odsutni temperatura, cilj ili Power. Start/end handleri su zamijenjeni brojačima; ne poziva provider, bazu ni uređaje.');process.exit(0);
}
if(process.argv.length!==2){console.error('Nepoznat argument; koristite --help');process.exit(2);}
const root=path.resolve(__dirname,'../..');
process.env.TS_NODE_PROJECT=path.join(root,'backend/tsconfig.json');
class PrismaService{} class TuyaAuthService{} class ProgramSyncService{} class NotificationsService{} class BoilerService{} class HeatingRecommendationService{} class MetricsService{}
const original=Module._load;
Module._load=function(request,parent,isMain){
  const source=parent?.filename||'';
  if(source.endsWith(path.join('Boiler','adapter','tuya.adapter.ts'))){
    if(request.includes('Tuya/tuya.auth.service'))return {TuyaAuthService};
    if(request.includes('prisma/prisma.service'))return {PrismaService};
    if(request.includes('program.sync.service'))return {ProgramSyncService};
    if(request==='src/generated/prisma')return {DayType:{WORKDAY:'WORKDAY',SATURDAY:'SATURDAY',SUNDAY:'SUNDAY'}};
  }
  if(source.endsWith(path.join('ThermostatPoll','thermostat.polling.service.ts'))){
    const m={'../../prisma/prisma.service':{PrismaService},'../Notification/notifications.service':{NotificationsService},'../Boiler/boiler.service':{BoilerService},'../HeatingRecommendation/heating.recommendation.service':{HeatingRecommendationService},'../../common/metrics.service':{MetricsService},'src/generated/prisma':{NotificationType:{}}};
    if(Object.hasOwn(m,request))return m[request];
  }
  return original.call(this,request,parent,isMain);
};
require(path.join(root,'backend/node_modules/ts-node/register/transpile-only'));
const {Logger}=require(path.join(root,'backend/node_modules/@nestjs/common'));Logger.overrideLogger(false);
const {TuyaAdapter}=require(path.join(root,'backend/src/modules/Boiler/adapter/tuya.adapter.ts'));
const {ThermostatPollingService}=require(path.join(root,'backend/src/modules/ThermostatPoll/thermostat.polling.service.ts'));
async function run(status,isOpen){
  const lastEvent=isOpen?{id:1,timestampStart:new Date(Date.now()-5*60000),timestampEnd:null,roomTargetTemp:21}:null;
  let starts=0,ends=0,writes=[];
  const db={thermostatDevice:{findFirst:async()=>({id:1}),updateMany:async({data})=>{writes.push(data);return {count:1};}},heatingEvent:{findFirst:async()=>lastEvent}};
  const adapter=new TuyaAdapter({}, {}, db);
  adapter.fetchStatus=async()=>status; // No HTTP or credentials; actual normalization remains intact.
  const snapshot=await adapter.fetchSnapshot('synthetic');
  const service=new ThermostatPollingService(db,adapter,{calculateFlowTemp:async()=>({flowTemp:50})},{},{},{incrementCounter(){}});
  service.handleHeatingStart=async()=>{starts++;};service.handleHeatingEnd=async()=>{ends++;};service.handleTargetTempChange=async()=>{};
  await service.pollDevice({id:1,userId:1,deviceId:'synthetic',lastSnapshotAt:null,roomCurrentTemp:20,roomTargetTemp:21},'synthetic');
  return {currentTemp:snapshot.currentTemp,targetTemp:snapshot.targetTemp,powerOn:snapshot.powerOn,starts,ends,snapshotWrites:writes.length};
}
(async()=>{
  const missingCurrent=await run({Power:true,TempSet:21},false);
  const missingPower=await run({TempCurrent:40,TempSet:21},true);
  const missingTarget=await run({TempCurrent:40,Power:true},true);
  assert.deepEqual(missingCurrent,{currentTemp:0,targetTemp:21,powerOn:true,starts:1,ends:0,snapshotWrites:1});
  assert.deepEqual(missingPower,{currentTemp:20,targetTemp:21,powerOn:false,starts:0,ends:1,snapshotWrites:1});
  assert.deepEqual(missingTarget,{currentTemp:20,targetTemp:0,powerOn:true,starts:0,ends:1,snapshotWrites:1});
  console.log(JSON.stringify({scope:'actual Tuya snapshot normalization and pollDevice; fake status/database, start/end replaced with counters',missingCurrent,missingPower,missingTarget,realProviderSchedulerDatabaseOrPhysicalControlTested:false},null,2));
})().catch(()=>{console.error('Reprodukcija nije uspjela; provjerite sintetički bootstrap i zavisnosti.');process.exitCode=1;});
