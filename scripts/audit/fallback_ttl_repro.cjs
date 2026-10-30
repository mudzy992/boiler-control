#!/usr/bin/env node
/* Actual fallback cache, synthetic values and fake timers; no DB, network or devices. */
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
if (process.argv.includes('--help')) {
  console.log(
    'Upotreba: node scripts/audit/fallback_ttl_repro.cjs\n' +
      'Izvršava stvarni FallbackStrategyService s lažnim satom i sintetičkim\n' +
      'vrijednostima. Bez baze, mreže i uređaja.\n' +
      '\n' +
      'Skripta je ažurirana u REL-5. Prije toga asertirala je POGREŠNO ponašanje\n' +
      '(dokaz za B-022: upis u 0. i 5. minuti s TTL 10, pa u 10. minuti STARI timer\n' +
      'briše vrijednost staru 5 minuta i servis vraća nepotvrđeni default 60).\n' +
      'Sada asertira ispravljeno: osvježavanje istog ključa, clear pa ponovni upis,\n' +
      'broj zakazanih timera i poštivanje TTL-a iza zastavice.\n' +
      '\n' +
      'Idempotentna, read-only, bez tajni. Ne potvrđuje produkcijsku upotrebu\n' +
      'servisa: statička pretraga pokazuje da FallbackStrategyService jeste\n' +
      'injektovan u HeatingAnomalyCheckerService, ali se nijedna njegova metoda\n' +
      'tamo ne poziva.',
  );
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
const MIN = 60 * 1000;
const clock = fakeTimers.install({now:Date.parse('2026-01-01T00:00:00Z'),toFake:['Date','setTimeout','clearTimeout']});
const newService = () => new FallbackStrategyService({incrementCounter() {}});
try {
  // --- 1) osvježavanje istog ključa prije isteka (jezgro B-022) ---
  delete process.env.FALLBACK_STRICT_TTL_ENABLED;
  const service = newService();
  service.cacheSensorReading('tuya_temp_1', 50, 10);
  clock.tick(5*MIN);
  service.cacheSensorReading('tuya_temp_1', 51, 10);
  const before = service.getTuyaFallback(1,1);
  clock.tick(5*MIN);
  const after = service.getTuyaFallback(1,1);
  assert.equal(before.usedCache, true);
  assert.equal(before.fallbackValue, 51);
  // Prije REL-5 ovdje je bilo usedCache=false / 60: stari timer je brisao novi zapis.
  assert.equal(after.usedCache, true);
  assert.equal(after.fallbackValue, 51);

  // --- 2) ponovljeni upisi istog ključa ne gomilaju timere ---
  const timers = newService();
  for (let i = 0; i < 50; i += 1) timers.cacheSensorReading('tuya_temp_9', i, 10);
  const stats = timers.getCacheStats();
  assert.equal(stats.entries, 1);
  assert.equal(stats.pendingTimers, 1);

  // --- 3) clear pa ponovni upis: stari timer ne smije obrisati novi zapis ---
  const cleared = newService();
  cleared.cacheSensorReading('tuya_temp_1', 50, 10);
  clock.tick(1*MIN);
  cleared.clearCache();
  assert.equal(cleared.getCacheStats().pendingTimers, 0);
  cleared.cacheSensorReading('tuya_temp_1', 77, 10);
  clock.tick(9*MIN);
  assert.equal(cleared.getTuyaFallback(1,1).fallbackValue, 77);

  // --- 4) nepotvrđeni default je označen, ne prešutno siguran ---
  const dflt = newService().getTuyaFallback(999, 1);
  assert.equal(dflt.fallbackValue, 60);
  assert.equal(dflt.safeDefaultValidated, false);

  // --- 5) zastavica: zadano off (naslijeđeni prag 30 min) vs on (stvarni TTL) ---
  const legacy = newService();
  legacy.cacheSensorReading('tuya_temp_1', 50, 60);
  clock.tick(45*MIN);
  assert.equal(legacy.getTuyaFallback(1,1).usedCache, false);

  process.env.FALLBACK_STRICT_TTL_ENABLED = 'on';
  const strict = newService();
  strict.cacheSensorReading('tuya_temp_1', 50, 60);
  assert.equal(strict.getTuyaFallback(1,1).usedCache, true);
  strict.clearCache();
  delete process.env.FALLBACK_STRICT_TTL_ENABLED;

  console.log(JSON.stringify({
    scope:'stvarni fallback servis, lažni sat i sintetičke vrijednosti; bez baze, mreže i uređaja',
    refreshSameKey:{firstWriteMinute:0, secondWriteMinute:5, ttlMinutes:10, valueAtMinute10:after.fallbackValue, usedCache:after.usedCache},
    repeatedWrites:{writes:50, entries:stats.entries, pendingTimers:stats.pendingTimers},
    clearThenRewrite:{valueAfterOldExpiry:77, pendingTimersAfterClear:0},
    safeDefault:{value:dflt.fallbackValue, safeDefaultValidated:dflt.safeDefaultValidated},
    strictTtlFlag:{defaultOffUsableAt45min:false, onUsableAt45min:true},
    activeRuntimeCaller:false,
    napomena:'60 °C NIJE stručno potvrđena sigurna vrijednost; prije povezivanja fallbacka s engineom potrebne su stručne sigurnosne granice.',
  },null,2));
} finally { clock.uninstall(); }
