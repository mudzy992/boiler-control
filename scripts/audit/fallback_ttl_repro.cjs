#!/usr/bin/env node
/* Actual fallback cache, synthetic values and fake timers; no DB, network or devices. */
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/fallback_ttl_repro.cjs\nIzvršava stvarni FallbackStrategyService s lažnim satom i sintetičkim vrijednostima; provjerava dvije zamjene istog cache ključa. Bez baze, mreže i uređaja. Ne potvrđuje produkcijsku upotrebu servisa.');
  process.exit(0);
}
if (process.argv.length !== 2) { console.error('Nepoznat argument; koristite --help'); process.exit(2); }
const root = path.resolve(__dirname, '../..');
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');
require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));
const fakeTimers = require(path.join(root, 'backend/node_modules/@sinonjs/fake-timers'));
const { Logger } = require(path.join(root, 'backend/node_modules/@nestjs/common'));
const { FallbackStrategyService } = require(path.join(root, 'backend/src/common/fallback-strategy.service.ts'));
Logger.overrideLogger(false);
const clock = fakeTimers.install({now:Date.parse('2026-01-01T00:00:00Z'),toFake:['Date','setTimeout','clearTimeout']});
try {
  const service = new FallbackStrategyService({incrementCounter() {}});
  service.cacheSensorReading('tuya_temp_1', 50, 10);
  clock.tick(5*60*1000);
  service.cacheSensorReading('tuya_temp_1', 51, 10);
  const before = service.getTuyaFallback(1,1);
  clock.tick(5*60*1000);
  const after = service.getTuyaFallback(1,1);
  assert.equal(before.usedCache,true); assert.equal(before.fallbackValue,51);
  assert.equal(after.usedCache,false); assert.equal(after.fallbackValue,60);
  console.log(JSON.stringify({scope:'actual fallback service with synthetic data and fake clock; no app caller or production devices', firstWriteMinute:0, secondWriteMinute:5, secondTtlMinutes:10, beforeFirstExpiryUsesNewCache:true, atMinute10OldTimerDeletesNewValue:true, returnedFallback:after.fallbackValue},null,2));
} finally { clock.uninstall(); }
