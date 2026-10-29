#!/usr/bin/env node
/* Test Redis primitives in the disposable branch-only Actions service, not app/queue logic. */
'use strict';
const {execFile, execFileSync} = require('node:child_process');
const {promisify} = require('node:util');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const execAsync = promisify(execFile);
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/redis_lease_ci.cjs --ci\nSamo efemerni GitHub Actions Redis servis: SET NX PX, konkurentni vlasnici, istek/novi vlasnik i atomski compare-delete. Sintetički slučajni ključevi se uklanjaju; nema produkcijskog Redisa, BullMQ-a, stvarnih workera, failovera ni dokaza exactly-once.');
  process.exit(0);
}
const container = process.env.AUDIT_REDIS_CONTAINER || '';
if (process.argv.length !== 3 || process.argv[2] !== '--ci' || process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REF !== 'refs/heads/arena/94541967-boiler-control' || process.env.AUDIT_DISPOSABLE_REDIS !== '1' || !/^[a-f0-9]{12,64}$/i.test(container)) {
  console.error('Odbijeno: potreban je eksplicitni izolovani Actions Redis servis.'); process.exit(2);
}
const prefix = `audit-lease-${crypto.randomBytes(16).toString('hex')}`;
const lock = `${prefix}-lock`, counter = `${prefix}-counter`;
const a = crypto.randomBytes(16).toString('hex'), b = crypto.randomBytes(16).toString('hex');
const releaseScript = "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end";
function cmd(...args) { return execFileSync('docker',['exec',container,'redis-cli','--raw',...args],{encoding:'utf8',timeout:10000}).trim(); }
async function cmdAsync(...args) { const {stdout} = await execAsync('docker',['exec',container,'redis-cli','--raw',...args],{encoding:'utf8',timeout:10000}); return stdout.trim(); }
let stage = 'initialization';
async function main() {
  try {
    stage = 'parallel-acquire';
    const results = await Promise.all([cmdAsync('SET',lock,a,'NX','PX','60000'),cmdAsync('SET',lock,b,'NX','PX','60000')]);
    assert.equal(results.filter(v=>v==='OK').length,1);
    assert.equal(results.filter(v=>v==='').length,1);
    const old = results[0] === 'OK' ? a : b;
    const next = old === a ? b : a;
    stage = 'ttl-expiry-and-reacquire';
    const ttl = Number(cmd('PTTL',lock));
    assert.ok(ttl > 0 && ttl <= 60000);
    // Force expiry deterministically; avoids relying on wall-clock sleep.
    assert.equal(cmd('PEXPIRE',lock,'0'),'1');
    assert.equal(cmd('SET',lock,next,'NX','PX','60000'),'OK');
    stage = 'compare-delete';
    assert.equal(cmd('EVAL',releaseScript,'1',lock,old),'0');
    assert.equal(cmd('GET',lock),next);
    stage = 'stale-client-side-effect';
    // Generic counter illustrates that Redis lock does not fence unguarded side effects.
    assert.equal(cmd('INCR',counter),'1');
    assert.equal(cmd('GET',lock),next);
    assert.equal(cmd('EVAL',releaseScript,'1',lock,next),'1');
    assert.equal(cmd('EXISTS',lock),'0');
    console.log('::notice title=Redis primitive audit::Concurrent NX admits one owner; stale compare-delete cannot remove new owner; unguarded synthetic side effect still runs after loss. No app/queue or failover tested.');
  } finally {
    // Delete only the two unpredictable keys created by this test, never flush a database.
    try { cmd('DEL',lock,counter); } catch { stage = 'cleanup'; throw new Error('cleanup failed'); }
  }
}
main().catch(error => {
  const name = ['AssertionError','Error','TypeError'].includes(error?.name) ? error.name : 'OtherError';
  console.log(`::error title=Redis primitive audit::Stage ${stage}; ${name}. No keys, token values or raw messages emitted.`);
  process.exitCode = 1;
});
