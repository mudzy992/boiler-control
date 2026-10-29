#!/usr/bin/env node
/* Isolated service-level demonstration. No HTTP, network, database or devices. */
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');
const root = path.resolve(__dirname, '../..');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/anomaly_ownership_repro.cjs\nIzvršava stvarni anomaly servis nad lažnom bazom i lažnim saradnicima, bez JWT-a, HTTP-a, mreže i baze. Demonstrira nedostatak konteksta vlasnika na servisnoj putanji, ne stvarni napad. Potrebne backend npm zavisnosti.');
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
async function main() {
  const calls = [];
  const event = { id: 42, isAnomaly: true, proposedEndTime: new Date('2026-01-01T12:00:00Z'), thermostat: { id: 3, userId: 200, homeProfileId: 4 } };
  const prisma = {
    heatingEvent: {
      findUnique: async (query) => { calls.push({ operation: 'read', where: query.where }); return event; },
      updateMany: async (query) => { calls.push({ operation: 'update', where: query.where }); return { count: 1 }; },
    },
    boilerHistory: { findFirst: async () => null },
  };
  const metrics = { incrementCounter() {} };
  const service = new HeatingAnomalyCheckerService(prisma, {}, {}, {}, {}, metrics, {}, {});
  const result = await service.confirmOrUpdateAnomaly(42, { confirm: true });
  assert.equal(result.success, true);
  assert.deepEqual(calls[0].where, { id: 42 });
  assert.deepEqual(calls[1].where, { id: 42, isAnomaly: true });
  console.log(JSON.stringify({ scope: 'isolated actual service with fake DB; guard and HTTP not executed', syntheticOwnerId: 200, callerIdentityProvided: false, resultSuccess: result.success, readFilter: Object.keys(calls[0].where), updateFilter: Object.keys(calls[1].where), ownerFilterPresent: false }, null, 2));
}
main().catch((error) => { console.error('Reprodukcija nije uspjela:', error.message); process.exitCode = 1; });
