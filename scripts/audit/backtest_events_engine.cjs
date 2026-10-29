#!/usr/bin/env node
'use strict';
// Offline audit harness: actual current engine + conservatively joined synthetic/de-identified records.
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const assert=require('node:assert/strict');
const args=process.argv.slice(2);
if(args.includes('--help')){
  console.log('Upotreba: node scripts/audit/backtest_events_engine.cjs --demo | --input <odobreni-anonimni.json>\nOffline pokreće stvarni postojeći engine i poravnava event, uređaj, raniju historiju i prethodno pripremljeni engineInput. Samo agregati, bez DB/mreže/upisa; odbacuje future, multi-device i dvosmislene slučajeve. Nije dokaz fizičkog ishoda, uštede ni sigurne temperature.');process.exit(0);
}
if(!((args.length===1&&args[0]==='--demo')||(args.length===2&&args[0]==='--input'))){console.error('Neispravni argumenti; koristite --help.');process.exit(2);}
const root=path.resolve(__dirname,'../..');process.env.TS_NODE_PROJECT=path.join(root,'backend/tsconfig.json');
const original=Module._load;
Module._load=function(request,parent,isMain){
  if(parent?.filename.endsWith(path.join('Heating','strategies','profile.strategy.ts'))&&request==='src/generated/prisma/')return {
    HomeProfile_windowType:{TRIPLE_GLAZED:'TRIPLE_GLAZED',DOUBLE_GLAZED:'DOUBLE_GLAZED',SINGLE_GLAZED:'SINGLE_GLAZED'},
    HomeProfile_heatingType:{UNDERFLOOR:'UNDERFLOOR',RADIATOR:'RADIATOR',MIXED:'MIXED'},
    HomeProfile_insulationType:{ADVANCED:'ADVANCED',MINERAL_WOOL:'MINERAL_WOOL',EPS:'EPS',STANDARD:'STANDARD'},
  };
  return original.call(this,request,parent,isMain);
};
require(path.join(root,'backend/node_modules/ts-node/register/transpile-only'));
const {FlowTemperatureEngine}=require(path.join(root,'backend/src/modules/Heating/engine/flow-temperature.engine.ts'));
const stamp=x=>typeof x==='string'&&/(Z|[+-]\d\d:\d\d)$/i.test(x)?Date.parse(x):NaN;
function finiteDeep(x){if(typeof x==='number')return Number.isFinite(x);if(Array.isArray(x))return x.every(finiteDeep);if(x&&typeof x==='object')return Object.values(x).every(finiteDeep);return true;}
function onePerId(rows){const out=new Map();for(const row of rows){if(row?.id===undefined||out.has(row.id))throw Error('invalid id');out.set(row.id,row);}return out;}
function run(data){
  for(const key of ['devices','heatingEvents','boilerHistories','snapshots'])if(!Array.isArray(data?.[key])||data[key].length>100000)throw Error('invalid rows');
  const devices=onePerId(data.devices),events=onePerId(data.heatingEvents),snaps=new Map();
  for(const row of data.snapshots){if(row?.eventId===undefined||snaps.has(row.eventId))throw Error('duplicate snapshot');snaps.set(row.eventId,row);}
  const deviceCounts=new Map();for(const d of devices.values())deviceCounts.set(d.userId,(deviceCounts.get(d.userId)||0)+1);
  const c={matched:0,missingDevice:0,multiDevice:0,missingSnapshot:0,invalidSnapshot:0,futureInput:0,noPriorHistory:0,ambiguousHistory:0};let sum=0,abs=0;
  for(const e of events.values()){
    const d=devices.get(e.deviceId);if(!d||d.userId===undefined){c.missingDevice++;continue;}
    if(deviceCounts.get(d.userId)!==1){c.multiDevice++;continue;}
    const snap=snaps.get(e.id);if(!snap){c.missingSnapshot++;continue;}
    const t=stamp(e.timestampStart),input=snap.engineInput,dates=[snap.profileAvailableAt,snap.weatherAvailableAt];
    if(input?.intervalLearning!=null)dates.push(snap.learningAvailableAt);
    if(input?.recentEvents!=null)dates.push(snap.eventsAvailableAt);
    const times=dates.map(stamp);
    if(!Number.isFinite(t)||times.some(x=>!Number.isFinite(x))||!input||!['ANONYMOUS','PROFILE_ONLY','FULL'].includes(input.mode)||!Number.isFinite(input.weather?.tempMin)||!Number.isFinite(input.weather?.tempMax)||!Number.isFinite(input.homeProfile?.floorArea)||!finiteDeep(input)){c.invalidSnapshot++;continue;}
    if(times.some(x=>x>t)){c.futureInput++;continue;}
    const candidates=[];
    for(const h of data.boilerHistories){
      if(h.userId!==d.userId||!Number.isFinite(h.suggestedFlowTemp))continue;
      const created=stamp(h.createdAt),start=stamp(h.heatingStart||h.createdAt);
      if(!Number.isFinite(created)||!Number.isFinite(start)||created>t||start>t)continue;
      const effective=Math.max(created,start);if(t-effective<=60*60000)candidates.push({effective,value:h.suggestedFlowTemp});
    }
    if(!candidates.length){c.noPriorHistory++;continue;}
    const latest=Math.max(...candidates.map(x=>x.effective)),matches=candidates.filter(x=>x.effective===latest);
    if(matches.length!==1){c.ambiguousHistory++;continue;}
    try{const result=FlowTemperatureEngine.calculate(input).finalTemp;if(!Number.isFinite(result))throw Error();const diff=result-matches[0].value;sum+=diff;abs+=Math.abs(diff);c.matched++;}catch{c.invalidSnapshot++;}
  }
  return {scope:'offline current engine vs prior historical suggestion; not outcomes or causal backtest',events:events.size,...c,meanDeltaC:c.matched?Number((sum/c.matched).toFixed(4)):null,meanAbsoluteDeltaC:c.matched?Number((abs/c.matched).toFixed(4)):null,warning:'Input snapshots, identiteti, vrijeme dostupnosti i historija su tvrdnje izvora; približno spajanje po korisniku čak i s jednim uređajem nije dokazana veza događaja. Bez mjerenja ishoda, sigurnosti ili uštede.'};
}
function demo(){
  const input={mode:'ANONYMOUS',homeProfile:{floorArea:150},weather:{tempMin:0,tempMax:0}};
  const snapshot=(id,when='2026-01-01T11:00:00Z')=>({eventId:id,profileAvailableAt:'2026-01-01T11:00:00Z',weatherAvailableAt:when,engineInput:input});
  return {devices:[{id:1,userId:1},{id:2,userId:2},{id:3,userId:2},{id:4,userId:3}],heatingEvents:[{id:1,deviceId:1,timestampStart:'2026-01-01T12:00:00Z'},{id:2,deviceId:1,timestampStart:'2026-01-01T12:00:00Z'},{id:3,deviceId:2,timestampStart:'2026-01-01T12:00:00Z'},{id:4,deviceId:4,timestampStart:'2026-01-01T12:00:00Z'},{id:5,deviceId:1,timestampStart:'2025-12-31T12:00:00Z'}],snapshots:[snapshot(1),snapshot(2,'2026-01-01T12:01:00Z'),snapshot(3),snapshot(4),snapshot(5,'2025-12-31T11:00:00Z')],boilerHistories:[{userId:1,createdAt:'2026-01-01T11:30:00Z',heatingStart:'2026-01-01T11:30:00Z',suggestedFlowTemp:50},{userId:3,createdAt:'2026-01-01T11:30:00Z',suggestedFlowTemp:50},{userId:3,createdAt:'2026-01-01T11:30:00Z',suggestedFlowTemp:51}]};
}
try{
  const result=run(args[0]==='--demo'?demo():JSON.parse(fs.readFileSync(args[1],'utf8')));
  if(args[0]==='--demo'){assert.equal(result.events,5);assert.equal(result.matched,1);assert.equal(result.futureInput,2);assert.equal(result.multiDevice,1);assert.equal(result.ambiguousHistory,1);assert.equal(result.meanDeltaC,1);}
  console.log(JSON.stringify(result,null,2));
}catch{console.error('Neispravan ulaz ili test; pogledajte --help.');process.exitCode=2;}
