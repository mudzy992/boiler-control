#!/usr/bin/env node
'use strict';
// Real polling end handler, recommendation service and engine; synthetic in-memory collaborators.
const path=require('node:path');
const Module=require('node:module');
const assert=require('node:assert/strict');
if(process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/learning_end_repro.cjs\nPoziva stvarni poll end handler, recommendation servis i engine s lažnom bazom i sintetičkim podacima. Provjerava ulaz za overshoot i trenutni zapis preporuke; bez cron-a, stvarne baze, vanjskih uređaja ili mreže.');
  process.exit(0);
}
if(process.argv.length!==2){console.error('Nepoznat argument; koristite --help');process.exit(2);}
const root=path.resolve(__dirname,'../..');
process.env.TS_NODE_PROJECT=path.join(root,'backend/tsconfig.json');
class PrismaService {} class NotificationsService {} class BoilerService {} class MetricsService {}
const original=Module._load;
Module._load=function(request,parent,isMain){
  const source=parent?.filename||'';
  if(source.includes(path.join('src','modules')) && request.includes('prisma/prisma.service')) return {PrismaService};
  if(source.endsWith(path.join('ThermostatPoll','thermostat.polling.service.ts'))) {
    if(request.includes('Notification/notifications.service')) return {NotificationsService};
    if(request.includes('Boiler/boiler.service')) return {BoilerService};
    if(request.includes('common/metrics.service')) return {MetricsService};
    if(request==='src/generated/prisma') return {NotificationType:{HEATING_ENDED:'HEATING_ENDED'}};
  }
  if(source.endsWith(path.join('Heating','strategies','profile.strategy.ts')) && request==='src/generated/prisma/') return {
    HomeProfile_windowType:{TRIPLE_GLAZED:'TRIPLE_GLAZED',DOUBLE_GLAZED:'DOUBLE_GLAZED',SINGLE_GLAZED:'SINGLE_GLAZED'},
    HomeProfile_heatingType:{UNDERFLOOR:'UNDERFLOOR',RADIATOR:'RADIATOR',MIXED:'MIXED'},
    HomeProfile_insulationType:{ADVANCED:'ADVANCED',MINERAL_WOOL:'MINERAL_WOOL',EPS:'EPS',STANDARD:'STANDARD'},
  };
  return original.call(this,request,parent,isMain);
};
require(path.join(root,'backend/node_modules/ts-node/register/transpile-only'));
const {Logger}=require(path.join(root,'backend/node_modules/@nestjs/common')); Logger.overrideLogger(false);
const {HeatingRecommendationService}=require(path.join(root,'backend/src/modules/HeatingRecommendation/heating.recommendation.service.ts'));
const {ThermostatPollingService}=require(path.join(root,'backend/src/modules/ThermostatPoll/thermostat.polling.service.ts'));
async function main(){
  const learning={id:1,intervalKey:'synthetic_afternoon',samples:1,avgReachTimeMin:10,avgOvershoot:0,offset:0,confidence:0.1};
  let learningData, recommendationData, notificationCalls=0;
  const db={
    thermostatDevice:{findUnique:async()=>({homeProfile:{floorArea:150,learningOffset:0,learningConfidence:0.1,intervalLearnings:[{...learning}]}})},
    heatingEvent:{updateMany:async()=>({count:1})}, boilerHistory:{updateMany:async()=>({count:1})},
    heatingIntervalLearning:{updateMany:async({data})=>{learningData=data;return {count:1};}},
    weatherCache:{findFirst:async()=>null},
    recommendation:{findFirst:async()=>null,create:async({data})=>{recommendationData=data;}},
    $transaction:async queries=>Promise.all(queries),
  };
  const recommendations=new HeatingRecommendationService(db);
  recommendations.getIntervalKey=()=>learning.intervalKey; // Avoid dependency on wall-clock interval.
  const poll=new ThermostatPollingService(db,{}, {},{notifyUser:async()=>{notificationCalls++;}},recommendations,{incrementCounter(){}});
  const now=Date.now();
  await poll.handleHeatingEnd({id:1,userId:1},{id:1,timestampStart:new Date(now-60*60*1000),roomCurrentTemp:19,roomTargetTemp:21},'synthetic');
  // One previous sample with overshoot 0; start reading 19 - target 21 = -2.
  assert.equal(learningData.avgOvershoot,-1);
  assert.equal(learningData.samples,2);
  assert(learningData.avgReachTimeMin>34 && learningData.avgReachTimeMin<36);
  assert.equal(recommendationData.expectedHeatTimeMin,10);
  assert.equal(notificationCalls,1);
  console.log(JSON.stringify({scope:'actual polling end handler, recommendation service and engine; fake DB/push',startMinusTargetC:-2,newAverageOvershootC:learningData.avgOvershoot,previousReachAverageMin:10,newReachAverageApproxMin:Math.round(learningData.avgReachTimeMin),recommendationExpectedTimeMin:recommendationData.expectedHeatTimeMin,endSnapshotSuppliedToHandler:false,realSchedulerDatabaseProviderOrDeviceTested:false},null,2));
}
main().catch(()=>{console.error('Reprodukcija nije uspjela; provjerite sintetički bootstrap i zavisnosti.');process.exitCode=1;});
