#!/usr/bin/env node
'use strict';
// REL-8 (B-027) verifikacija: stvarni ProgramSyncService s fake repozitorijem
// koji MODELIRA lazy PrismaPromise i interaktivni $transaction s rollbackom.
//
// Zasto ovo postoji: postojeci `program_sync_partial_repro.cjs` definise upsert
// kao obicnu async funkciju koja se izvrsava ODMAH pri pozivu. Stvarni Prisma
// vraca PrismaPromise koji se NE izvrsava dok se ne await-uje ili preda
// $transaction. Zbog toga taj harness ne moze dokazati all-or-nothing.
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/program_sync_atomic_probe.cjs\nStvarni ProgramSyncService s fake bazom koja modelira lazy PrismaPromise i interaktivni $transaction s rollbackom. Ne poziva provider ni stvarnu bazu.');
  process.exit(0);
}
if (process.argv.length !== 2) { console.error('Nepoznat argument; koristite --help'); process.exit(2); }

const root = path.resolve(__dirname, '../..');
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');

class PrismaService {}
const original = Module._load;
Module._load = function (request, parent, isMain) {
  const source = parent?.filename || '';
  if (source.endsWith(path.join('Boiler', 'adapter', 'program.sync.service.ts'))) {
    if (request.includes('prisma/prisma.service')) return { PrismaService };
    if (request === 'src/generated/prisma') return { DayType: { WORKDAY: 'WORKDAY' } };
  }
  return original.call(this, request, parent, isMain);
};
require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));
const { Logger } = require(path.join(root, 'backend/node_modules/@nestjs/common'));
Logger.overrideLogger(false);
const { ProgramSyncService } = require(path.join(root, 'backend/src/modules/Boiler/adapter/program.sync.service.ts'));

// --- fake baza koja modelira lazy PrismaPromise -----------------------------
function makeDb(failOnOrderIndex) {
  const rows = [];
  let failed = false;

  function executeOp(op) {
    if (op.__op === 'upsert') {
      if (failOnOrderIndex !== null && !failed && op.where.deviceId_dayType_orderIndex.orderIndex === failOnOrderIndex) {
        failed = true;
        throw new Error('synthetic write failure');
      }
      const k = op.where.deviceId_dayType_orderIndex;
      const row = rows.find(r => r.deviceId === k.deviceId && r.dayType === k.dayType && r.orderIndex === k.orderIndex);
      if (row) Object.assign(row, op.update); else rows.push({ ...op.create });
    } else if (op.__op === 'deleteMany') {
      const w = op.where;
      for (let i = rows.length - 1; i >= 0; i--) {
        const r = rows[i];
        if (r.deviceId === w.deviceId && r.dayType === w.dayType && !w.orderIndex.notIn.includes(r.orderIndex)) rows.splice(i, 1);
      }
    } else if (op.__op === 'createMany') {
      for (const d of op.data) rows.push({ ...d });
    }
  }

  // PrismaPromise: thenable koji se izvrsava tek na await, ali nosi opis operacije
  const lazy = (op) => ({
    __op: op,
    then(res, rej) { return Promise.resolve().then(() => executeOp(op)).then(res, rej); },
  });

  const db = {
    rows,
    thermostatProgram: {
      findMany: async ({ where }) => rows.filter(r => r.deviceId === where.deviceId && r.dayType === where.dayType).sort((a, b) => a.orderIndex - b.orderIndex),
      createMany: ({ data }) => lazy({ __op: 'createMany', data }),
      upsert: (a) => lazy({ __op: 'upsert', ...a }),
      deleteMany: (a) => lazy({ __op: 'deleteMany', ...a }),
    },
    // all-or-nothing: snapshot pa rollback na padu interaktivnog callbacka
    $transaction: async (callback) => {
      const snapshot = rows.map(r => ({ ...r }));
      const tx = {
        thermostatProgram: db.thermostatProgram,
        $queryRaw: async () => [],
      };
      try { return await callback(tx); }
      catch (e) { rows.length = 0; rows.push(...snapshot); throw e; }
    },
  };
  return db;
}

const OLD = 'oldhash';
const seed = (db) => {
  db.rows.push(
    { deviceId: 1, dayType: 'WORKDAY', orderIndex: 0, startMinute: 0, targetTemp: 20, programHash: OLD },
    { deviceId: 1, dayType: 'WORKDAY', orderIndex: 1, startMinute: 480, targetTemp: 21, programHash: OLD },
    { deviceId: 1, dayType: 'WORKDAY', orderIndex: 2, startMinute: 1080, targetTemp: 18, programHash: OLD },
  );
};
// novi program: 2 intervala (orderIndex 2 mora biti obrisan)
const NEW = { WORKDAY: [
  { orderIndex: 0, startMinute: 0, targetTemp: 22 },
  { orderIndex: 1, startMinute: 480, targetTemp: 23 },
] };

const summarize = (db) => db.rows.map(r => `${r.orderIndex}:${r.startMinute}/${r.targetTemp}/${r.programHash === OLD ? 'OLD' : 'NEW'}`).join(',');

(async () => {
  // 1) ATOMSKI put: pad na drugom upsertu mora ostaviti bazu NETAKNUTU
  process.env.PROGRAM_SYNC_ATOMIC_ENABLED = 'on';
  const db = makeDb(1);
  seed(db);
  const svc = new ProgramSyncService(db);
  let threw = false;
  try { await svc.syncProgram(1, NEW); } catch { threw = true; }
  assert.equal(threw, true, 'ocekivan pad');
  const afterFail = summarize(db);
  assert.equal(afterFail, '0:0/20/OLD,1:480/21/OLD,2:1080/18/OLD',
    'ATOMSKI: baza mora ostati netaknuta nakon pada, dobijeno: ' + afterFail);

  // 2) retry mora stvarno zavrsiti posao (hash je i dalje OLD, pa ne preskace)
  const db2 = makeDb(null);
  db2.rows.push(...db.rows);
  const svc2 = new ProgramSyncService(db2);
  await svc2.syncProgram(1, NEW);
  const afterRetry = summarize(db2);
  assert.equal(afterRetry.split(',').length, 2, 'retry mora obrisati orderIndex 2: ' + afterRetry);
  assert.ok(afterRetry.includes('/22/NEW') && afterRetry.includes('/23/NEW'), 'retry mora upisati nove vrijednosti: ' + afterRetry);
  assert.ok(!afterRetry.includes('OLD'), 'nijedan red ne smije ostati na starom hashu: ' + afterRetry);

  // 3) KONTROLA - stari put (zastavica off) ostavlja mijesano stanje
  process.env.PROGRAM_SYNC_ATOMIC_ENABLED = 'off';
  const db3 = makeDb(1);
  seed(db3);
  const svc3 = new ProgramSyncService(db3);
  try { await svc3.syncProgram(1, NEW); } catch { /* expected */ }
  const mixed = summarize(db3);
  assert.ok(mixed.includes('0:0/22/NEW') && mixed.includes('1:480/21/OLD'),
    'KONTROLA: stari put mora ostaviti mijesano stanje (dokaz da test nesto hvata): ' + mixed);

  console.log(JSON.stringify({
    scope: 'stvarni ProgramSyncService; fake baza modelira lazy PrismaPromise i interaktivni $transaction rollback',
    atomicFailureLeavesDbUntouched: true,
    atomicRetryCompletesWork: true,
    legacyPathStillMixesState: true,
    afterFail, afterRetry, legacyMixed: mixed,
    realPostgresConcurrencyTested: false,
  }, null, 2));
})().catch(e => { console.error('PROBA PALA:', e && e.message); process.exitCode = 1; });
