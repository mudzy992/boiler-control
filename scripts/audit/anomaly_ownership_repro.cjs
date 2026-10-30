#!/usr/bin/env node
/* Isolated service-level verification. No HTTP, network, database or devices.

   SEC-2 (B-009): ova skripta je PRIJE dokazivala RANJIVOST — asertirala je da
   servis čita i upisuje po samom `id`, bez konteksta vlasnika. Nakon popravke
   asertira NOVO, sigurno ponašanje. Stare asertije namjerno nisu zadržane:
   plan (docs/audit/backend/10-implementation-plan.md, korak 0.2) izričito kaže
   da se repro skripte moraju prilagoditi i da se stare ne smiju koristiti kao
   dokaz novog stanja. */
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');
const root = path.resolve(__dirname, '../..');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/anomaly_ownership_repro.cjs\nIzvršava stvarni anomaly servis nad lažnom bazom i lažnim saradnicima, bez JWT-a, HTTP-a, mreže i baze. Provjerava da owner scope postoji na servisnoj putanji (SEC-2), ne stvarni napad. Potrebne backend npm zavisnosti.');
  process.exit(0);
}
if (process.argv.length !== 2) { console.error('Nepoznat argument; koristite --help'); process.exit(2); }
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');
const original = Module._load;
const dummy = new Proxy({}, { get: (_, name) => name === 'StructuredLogger' ? class StructuredLogger { log() {} debug() {} error() {} warn() {} } : class Stub {} });
Module._load = function(request, parent, isMain) {
  if (parent?.filename.endsWith(path.join('HeatingAnomalyCheckerService', 'heating.anomayl.checker.service.ts')) && (request.startsWith('../../prisma/') || request.startsWith('../Notification/') || request.startsWith('../HeatingRecommendation/') || request.startsWith('../../common/') || request.startsWith('../../generated/'))) return dummy;
  return original.call(this, request, parent, isMain);
};
require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));
const { HeatingAnomalyCheckerService } = require(path.join(root, 'backend/src/modules/HeatingAnomalyCheckerService/heating.anomayl.checker.service.ts'));

const OWNER = 200;
const INTRUDER = 999;

function makeFixture() {
  const calls = [];
  const event = {
    id: 42,
    isAnomaly: true,
    proposedEndTime: new Date('2026-01-01T12:00:00Z'),
    roomCurrentTemp: 21,
    roomTargetTemp: 23,
    thermostat: { id: 3, userId: OWNER, homeProfileId: 4 },
  };
  const prisma = {
    heatingEvent: {
      // Novi kod koristi findFirst s owner scope-om; findUnique više nije put.
      findFirst: async (query) => {
        calls.push({ operation: 'read', where: query.where });
        return query.where?.thermostat?.userId === OWNER ? event : null;
      },
      findUnique: async (query) => {
        calls.push({ operation: 'readUnique', where: query.where });
        return event;
      },
      updateMany: async (query) => {
        calls.push({ operation: 'update', where: query.where });
        return { count: query.where?.thermostat?.userId === OWNER ? 1 : 0 };
      },
    },
    boilerHistory: { findFirst: async () => null },
  };
  const recommendationCalls = [];
  const service = new HeatingAnomalyCheckerService(
    prisma,
    {},
    { processHeatingEvent: async (p) => { recommendationCalls.push(p); } },
    {},
    {},
    { incrementCounter() {} },
    {},
    {},
  );
  return { service, calls, recommendationCalls };
}

async function main() {
  /* 1) Vlasnik prolazi, a owner filter je u OBA upita. */
  const own = makeFixture();
  const ownResult = await own.service.confirmOrUpdateAnomaly(42, { confirm: true }, OWNER);
  assert.equal(ownResult.success, true, 'vlasnik mora moći potvrditi vlastitu anomaliju');
  assert.deepEqual(own.calls[0].where, { id: 42, thermostat: { userId: OWNER } });
  assert.deepEqual(own.calls[1].where, { id: 42, isAnomaly: true, thermostat: { userId: OWNER } });
  assert.equal(own.recommendationCalls.length, 1);

  /* 2) Uljez je odbijen BEZ upisa i BEZ preporučnog side effecta. */
  const attack = makeFixture();
  const attackResult = await attack.service.confirmOrUpdateAnomaly(42, { confirm: true }, INTRUDER);
  assert.equal(attackResult.success, false, 'tuđa anomalija mora biti odbijena');
  assert.equal(attack.calls.some((c) => c.operation === 'update'), false, 'bez upisa za tuđi ID');
  assert.equal(attack.recommendationCalls.length, 0, 'bez preporučnog side effecta za tuđi ID');

  /* 3) Nedostajući userId se odbija — Prisma inače ignoriše `undefined` u where-u. */
  const anon = makeFixture();
  const anonResult = await anon.service.confirmOrUpdateAnomaly(42, { confirm: true }, undefined);
  assert.equal(anonResult.success, false, 'bez userId nema prolaza');
  assert.equal(anon.calls.length, 0, 'bez ijednog upita kad userId nedostaje');

  /* 4) Tuđi i nepostojeći ID daju isti odgovor. */
  const foreign = await makeFixture().service.confirmOrUpdateAnomaly(42, { confirm: true }, INTRUDER);
  const missing = await makeFixture().service.confirmOrUpdateAnomaly(9999, { confirm: true }, INTRUDER);
  assert.deepEqual(foreign, missing, 'odgovor ne smije otkrivati postoji li tuđa anomalija');

  console.log(JSON.stringify({
    scope: 'isolated actual service with fake DB; guard and HTTP not executed',
    syntheticOwnerId: OWNER,
    callerIdentityProvided: true,
    ownerResult: ownResult.success,
    intruderResult: attackResult.success,
    anonymousResult: anonResult.success,
    readFilter: Object.keys(own.calls[0].where),
    updateFilter: Object.keys(own.calls[1].where),
    ownerFilterPresent: true,
    intruderCausedWrite: attack.calls.some((c) => c.operation === 'update'),
    intruderCausedRecommendation: attack.recommendationCalls.length > 0,
    foreignAndMissingIndistinguishable: true,
  }, null, 2));
}
main().catch((error) => { console.error('Provjera nije uspjela:', error.message); process.exitCode = 1; });
