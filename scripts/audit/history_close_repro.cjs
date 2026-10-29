#!/usr/bin/env node
'use strict';
// Real polling end handler, synthetic in-memory fake DB. No network or real writes.
const path=require('node:path');
const Module=require('node:module');
const assert=require('node:assert/strict');
if(process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/history_close_repro.cjs\nStvarni poll end handler s lažnom bazom: dvije otvorene historije istog korisnika, zapis bez početka i drugi korisnik. Nema stvarne baze, schedulera, mreže ni slanja.');
  process.exit(0);
}
if(process.argv.length!==2){console.error('Nepoznat argument; koristite --help');process.exit(2);}
const root=path.resolve(__dirname,'../..');
process.env.TS_NODE_PROJECT=path.join(root,'backend/tsconfig.json');
class PrismaService {} class NotificationsService {} class BoilerService {} class HeatingRecommendationService {} class MetricsService {}
const substitutions={
  '../../prisma/prisma.service':{PrismaService},
  '../Notification/notifications.service':{NotificationsService},
  '../Boiler/boiler.service':{BoilerService},
  '../HeatingRecommendation/heating.recommendation.service':{HeatingRecommendationService},
  '../../common/metrics.service':{MetricsService},
  'src/generated/prisma':{NotificationType:{HEATING_ENDED:'HEATING_ENDED'}},
};
const original=Module._load;
Module._load=function(request,parent,isMain){
  if(parent?.filename.endsWith(path.join('ThermostatPoll','thermostat.polling.service.ts'))&&Object.hasOwn(substitutions,request)) return substitutions[request];
  return original.call(this,request,parent,isMain);
};
require(path.join(root,'backend/node_modules/ts-node/register/transpile-only'));
const {Logger}=require(path.join(root,'backend/node_modules/@nestjs/common'));Logger.overrideLogger(false);
const {ThermostatPollingService}=require(path.join(root,'backend/src/modules/ThermostatPoll/thermostat.polling.service.ts'));
async function main(){
  const start=new Date('2026-01-01T00:00:00Z');
  const events=[{id:11,timestampEnd:null},{id:12,timestampEnd:null}];
  const history=[{id:1,userId:1,heatingStart:start,heatingEnd:null},{id:2,userId:1,heatingStart:start,heatingEnd:null},{id:3,userId:1,heatingStart:null,heatingEnd:null},{id:4,userId:2,heatingStart:start,heatingEnd:null}];
  let updates=0;
  const db={
    heatingEvent:{updateMany:async({where,data})=>{let n=0;for(const row of events) if(row.id===where.id){Object.assign(row,data);n++;}return {count:n};}},
    boilerHistory:{updateMany:async({where,data})=>{for(const row of history) if(row.userId===where.userId && row.heatingEnd===where.heatingEnd){Object.assign(row,data);updates++;}return {count:updates};}},
    $transaction:async queries=>Promise.all(queries),
  };
  const service=new ThermostatPollingService(db,{}, {}, {notifyUser:async()=>{}},{processHeatingEvent:async()=>{}},{incrementCounter(){}});
  await service.handleHeatingEnd({id:10,userId:1},{id:11,timestampStart:start,roomCurrentTemp:19,roomTargetTemp:21},'synthetic');
  assert.equal(updates,3);assert(events[0].timestampEnd instanceof Date);assert.equal(events[1].timestampEnd,null);
  assert(history.slice(0,3).every(row=>row.heatingEnd instanceof Date));assert.equal(history[3].heatingEnd,null);
  console.log(JSON.stringify({scope:'actual polling end handler, fake DB with synthetic rows',closedEvents:1,otherEventStillOpen:true,historiesClosedForSameUser:updates,oneClosedHistoryHadNoStart:true,otherUserHistoryUnchanged:true,realDatabaseTransactionOrProviderTested:false},null,2));
}
main().catch(()=>{console.error('Reprodukcija nije uspjela; provjerite sintetički test i zavisnosti.');process.exitCode=1;});
