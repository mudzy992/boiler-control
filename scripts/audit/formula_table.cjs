#!/usr/bin/env node
/* Execute the existing engine, offline, with synthetic fixtures only. */
'use strict';
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '../..');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/formula_table.cjs [--json]\nIzvršava postojeći FlowTemperatureEngine nad sintetičkim ulazima i prikazuje tabelu. Bez mreže, baze, tajni i izmjena aplikacije. Zahtijeva instalirane backend npm zavisnosti. Rezultati nisu upute za upravljanje grijanjem.');
  process.exit(0);
}
if (process.argv.slice(2).some(a => a !== '--json')) { console.error('Nepoznat argument; koristite --help'); process.exit(2); }
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (parent?.filename.endsWith(path.join('Heating', 'strategies', 'profile.strategy.ts')) && request === 'src/generated/prisma/') {
    return {
      HomeProfile_windowType: { TRIPLE_GLAZED: 'TRIPLE_GLAZED', DOUBLE_GLAZED: 'DOUBLE_GLAZED', SINGLE_GLAZED: 'SINGLE_GLAZED' },
      HomeProfile_heatingType: { UNDERFLOOR: 'UNDERFLOOR', RADIATOR: 'RADIATOR', MIXED: 'MIXED' },
      HomeProfile_insulationType: { ADVANCED: 'ADVANCED', MINERAL_WOOL: 'MINERAL_WOOL', EPS: 'EPS', STANDARD: 'STANDARD' },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));
const { FlowTemperatureEngine } = require(path.join(root, 'backend/src/modules/Heating/engine/flow-temperature.engine.ts'));
const base = { mode: 'ANONYMOUS', weather: { tempMin: 0, tempMax: 0 }, homeProfile: { floorArea: 150 } };
const cases = [
  ['ext=-15', { weather: {tempMin:-15, tempMax:-15} }],
  ['ext=-14.999', { weather: {tempMin:-14.999, tempMax:-14.999} }],
  ['ext=0', {}],
  ['ext=9.999', { weather: {tempMin:9.999, tempMax:9.999} }],
  ['ext=10', { weather: {tempMin:10, tempMax:10} }],
  ['ext=-5..+5', { weather: {tempMin:-5, tempMax:5} }],
  ['profile area=100', { mode:'PROFILE_ONLY', homeProfile:{ floorArea:100 } }],
  ['profile area=150', { mode:'PROFILE_ONLY', homeProfile:{ floorArea:150 } }],
  ['profile area=200', { mode:'PROFILE_ONLY', homeProfile:{ floorArea:200 } }],
  ['profile height=2.5 (m)', { mode:'PROFILE_ONLY', homeProfile:{ floorArea:150, ceilingHeight:2.5 } }],
  ['profile height=250 (cm)', { mode:'PROFILE_ONLY', homeProfile:{ floorArea:150, ceilingHeight:250 } }],
  ['profile offset=2 confidence=.5', { mode:'PROFILE_ONLY', homeProfile:{ floorArea:150, learningOffset:2, confidence:0.5 } }],
  ['full overshoot=2 reach=20', { mode:'FULL', homeProfile:{floorArea:150, confidence:0.5}, intervalKey:'weekday_afternoon', intervalLearning:{offset:0,confidence:0.5,avgOvershoot:2,avgReachTimeMin:20} }],
  ['full overshoot=2 reach=40', { mode:'FULL', homeProfile:{floorArea:150, confidence:0.5}, intervalKey:'weekday_afternoon', intervalLearning:{offset:0,confidence:0.5,avgOvershoot:2,avgReachTimeMin:40} }],
  ['full weekday_late_morning', { mode:'FULL', homeProfile:{floorArea:150, confidence:0.5}, intervalKey:'weekday_late_morning', intervalLearning:{offset:1,confidence:0.5,avgOvershoot:0,avgReachTimeMin:30} }],
];
const rows = cases.map(([scenario, overrides]) => ({ scenario, ...FlowTemperatureEngine.calculate({ ...base, ...overrides }) }));
if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
else {
  console.log('| Ulaz | Ponderisano °C | Krivulja °C | Home / interval / događaji °C | Confidence | Final °C |');
  console.log('|---|---:|---:|---|---:|---:|');
  for (const r of rows) console.log(`| ${r.scenario} | ${r.weightedExternalTemp} | ${Number(r.baseCurveTemp.toFixed(4))} | ${r.appliedOffsets.home.toFixed(3)} / ${r.appliedOffsets.interval.toFixed(3)} / ${r.appliedOffsets.events.toFixed(3)} | ${r.confidence} | ${r.finalTemp} |`);
}
