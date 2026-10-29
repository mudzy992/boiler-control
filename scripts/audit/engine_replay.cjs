#!/usr/bin/env node
/* Offline engine replay on explicitly time-stamped, pre-aligned synthetic/de-identified snapshots. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Upotreba: node scripts/audit/engine_replay.cjs --demo | --input <anonimizirani.json>\nOffline pokreće postojeći FlowTemperatureEngine s unaprijed pripremljenim snapshotima. Ispisuje samo agregate; odbacuje ulaz s budućim vremenskim oznakama. Nema baze, mreže, upisa ni upravljanja kotlom. Ovo nije kauzalna procjena uštede niti validacija grijanja. Input koristiti samo uz odobrenje i anonimizaciju.');
  process.exit(0);
}
if (!((args.length === 1 && args[0] === '--demo') || (args.length === 2 && args[0] === '--input'))) { console.error('Neispravni argumenti; koristite --help.'); process.exit(2); }
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');
const original = Module._load;
Module._load = function(request, parent, isMain) {
  if (parent?.filename.endsWith(path.join('Heating', 'strategies', 'profile.strategy.ts')) && request === 'src/generated/prisma/') {
    return {
      HomeProfile_windowType: { TRIPLE_GLAZED: 'TRIPLE_GLAZED', DOUBLE_GLAZED: 'DOUBLE_GLAZED', SINGLE_GLAZED: 'SINGLE_GLAZED' },
      HomeProfile_heatingType: { UNDERFLOOR: 'UNDERFLOOR', RADIATOR: 'RADIATOR', MIXED: 'MIXED' },
      HomeProfile_insulationType: { ADVANCED: 'ADVANCED', MINERAL_WOOL: 'MINERAL_WOOL', EPS: 'EPS', STANDARD: 'STANDARD' },
    };
  }
  return original.call(this, request, parent, isMain);
};
require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));
const { FlowTemperatureEngine } = require(path.join(root, 'backend/src/modules/Heating/engine/flow-temperature.engine.ts'));
function utc(value) {
  if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/i.test(value)) return NaN;
  return Date.parse(value);
}
function allFinite(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allFinite);
  if (value && typeof value === 'object') return Object.values(value).every(allFinite);
  return true;
}
function replay(data) {
  if (!data || !Array.isArray(data.snapshots) || data.snapshots.length > 100000) throw new Error('invalid dataset');
  let invalid = 0, future = 0, matched = 0, sum = 0, sumAbs = 0, maxAbs = 0;
  for (const row of data.snapshots) {
    const when = utc(row?.eventAt);
    const input = row?.engineInput;
    const times = [row?.weatherAvailableAt, row?.profileAvailableAt, row?.baselineAvailableAt];
    if (input?.intervalLearning != null) times.push(row?.learningAvailableAt);
    if (input?.recentEvents != null) times.push(row?.eventsAvailableAt);
    const stamps = times.map(utc);
    if (!Number.isFinite(when) || stamps.some(x => !Number.isFinite(x)) || !input || !['ANONYMOUS','PROFILE_ONLY','FULL'].includes(input.mode) || !Number.isFinite(input.weather?.tempMin) || !Number.isFinite(input.weather?.tempMax) || !Number.isFinite(input.homeProfile?.floorArea) || !allFinite(input) || !Number.isFinite(row.recordedFlowTemp)) { invalid++; continue; }
    if (stamps.some(x => x > when)) { future++; continue; }
    // Caller asserts snapshots/identities are correctly aligned. This script cannot prove provenance.
    try {
      const output = FlowTemperatureEngine.calculate(input).finalTemp;
      if (!Number.isFinite(output)) { invalid++; continue; }
      const delta = output - row.recordedFlowTemp;
      matched++; sum += delta; sumAbs += Math.abs(delta); maxAbs = Math.max(maxAbs, Math.abs(delta));
    } catch { invalid++; }
  }
  const round = n => Number(n.toFixed(4));
  return {scope:'offline_existing_engine_replay_not_outcome_or_causal_backtest', total:data.snapshots.length, matched, invalid, futureRejected:future, meanDeltaC: matched ? round(sum/matched) : null, meanAbsoluteDeltaC: matched ? round(sumAbs/matched) : null, maxAbsoluteDeltaC: matched ? round(maxAbs) : null, warning:'Inputi su unaprijed povezani i njihove vremenske oznake su tvrdnje izvora, ne dokaz porijekla; poređenje s historijskom preporukom ne dokazuje uštedu ili sigurnost.'};
}
function demo() {
  const row = (temp, baseline, weatherAvailableAt) => ({eventAt:'2026-01-01T12:00:00Z', weatherAvailableAt, profileAvailableAt:'2026-01-01T11:00:00Z', baselineAvailableAt:'2026-01-01T11:30:00Z', recordedFlowTemp:baseline, engineInput:{mode:'ANONYMOUS', weather:{tempMin:temp,tempMax:temp},homeProfile:{floorArea:150}}});
  return {snapshots:[row(0,50,'2026-01-01T11:00:00Z'),row(10,47,'2026-01-01T11:00:00Z'),row(0,50,'2026-01-01T12:01:00Z')]};
}
try {
  const result = replay(args[0] === '--demo' ? demo() : JSON.parse(fs.readFileSync(args[1], 'utf8')));
  if (args[0] === '--demo') {
    assert.equal(result.matched, 2); assert.equal(result.futureRejected, 1); assert.equal(result.invalid, 0);
    assert.equal(result.meanDeltaC, 0); assert.equal(result.meanAbsoluteDeltaC, 1); assert.equal(result.maxAbsoluteDeltaC, 1);
  }
  console.log(JSON.stringify(result, null, 2));
} catch { console.error('Neispravan ili nedostupan ulaz; pogledajte --help.'); process.exitCode = 2; }
