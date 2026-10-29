#!/usr/bin/env node
/* Offline reproducible check of installed Nest throttler storage with fake time. */
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/throttle_repro.cjs\nProvjerava jedinicu TTL-a u lokalno instaliranom @nestjs/throttler storageu, s lažnim satom; bez HTTP-a, mreže i baze. Potreban npm ci u backend/.');
  process.exit(0);
}
if (process.argv.length !== 2) { console.error('Nepoznat argument; koristite --help'); process.exit(2); }
const { ThrottlerStorageService } = require(path.resolve(__dirname, '../../backend/node_modules/@nestjs/throttler/dist/throttler.service.js'));
const realNow = Date.now, realTimeout = global.setTimeout, realClear = global.clearTimeout;
let now = 100000, seq = 0;
const timers = new Map();
Date.now = () => now;
global.setTimeout = (fn, delay) => { const id = ++seq; timers.set(id, { fn, time: now + delay }); return id; };
global.clearTimeout = (id) => timers.delete(id);
function advance(ms) {
  now += ms;
  for (const [id, timer] of [...timers]) if (timer.time <= now && timers.has(id)) { timers.delete(id); timer.fn(); }
}
async function main() {
  const store = new ThrottlerStorageService();
  let result;
  for (let i = 0; i < 101; i++) result = await store.increment('synthetic-key', 60, 100, 60, 'default');
  assert.equal(result.isBlocked, true);
  advance(61);
  result = await store.increment('synthetic-key', 60, 100, 60, 'default');
  assert.equal(result.isBlocked, false);
  assert.equal(result.totalHits, 1);
  console.log(JSON.stringify({ ttlConfigured: 60, unit: 'milliseconds', blockedAtRequest: 101, afterElapsedMs: 61, blockedAfterWait: result.isBlocked, hitsAfterWait: result.totalHits, scope: 'installed default storage; synthetic key/fake time; no HTTP/proxy' }, null, 2));
  store.onApplicationShutdown();
}
main().catch((error) => { console.error('Reprodukcija nije uspjela:', error.message); process.exitCode = 1; }).finally(() => { Date.now = realNow; global.setTimeout = realTimeout; global.clearTimeout = realClear; });
