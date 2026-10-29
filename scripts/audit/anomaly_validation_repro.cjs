#!/usr/bin/env node
/* Run production ValidationPipe settings with actual DTO; no HTTP or database. */
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/anomaly_validation_repro.cjs\nOffline pokreće stvarni DTO i ValidationPipe s opcijama iz main.ts na sintetičkim tijelima. Ne pokreće HTTP/guard, ne koristi mrežu ni bazu. Potrebne backend npm zavisnosti.');
  process.exit(0);
}
if (process.argv.length !== 2) { console.error('Nepoznat argument; koristite --help'); process.exit(2); }
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');
require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));
const { ValidationPipe } = require(path.join(root, 'backend/node_modules/@nestjs/common'));
const { UpdateHeatingAnomalyDto } = require(path.join(root, 'backend/src/modules/HeatingAnomalyCheckerService/dto/heating-anomaly.dto.ts'));
async function main() {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } });
  const cases = [['empty object', {}], ['confirm true', { confirm: true }], ['explicit null', null], ['absent value', undefined]];
  const results = [];
  for (const [name, value] of cases) {
    try { await pipe.transform(value, { type: 'body', metatype: UpdateHeatingAnomalyDto }); results.push({ name, status: 'accepted' }); }
    catch (error) { results.push({ name, status: error.getStatus?.() ?? 'unknown' }); }
  }
  for (const result of results) assert.equal(result.status, 400);
  console.log(JSON.stringify({ scope: 'isolated pipe and DTO, no HTTP or guard', results }, null, 2));
}
main().catch(error => { console.error('Reprodukcija nije uspjela:', error.message); process.exitCode = 1; });
