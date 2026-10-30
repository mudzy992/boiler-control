#!/usr/bin/env node
/* Run production ValidationPipe settings with actual DTO; no HTTP or database. */
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/anomaly_validation_repro.cjs\nOffline pokreće stvarni DTO i ValidationPipe s opcijama iz main.ts na sintetičkim tijelima i provjerava OCJEKIVANA stanja nakon SEC-2 popravke. Ne pokreće HTTP/guard, ne koristi mrežu ni bazu. Potrebne backend npm zavisnosti.');
  process.exit(0);
}
if (process.argv.length !== 2) { console.error('Nepoznat argument; koristite --help'); process.exit(2); }
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');
require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));
const { ValidationPipe } = require(path.join(root, 'backend/node_modules/@nestjs/common'));
const { UpdateHeatingAnomalyDto } = require(path.join(root, 'backend/src/modules/HeatingAnomalyCheckerService/dto/heating-anomaly.dto.ts'));
async function main() {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } });
  /* SEC-2 (B-010): ova skripta je PRIJE asertirala da SVAKI od ovih slučajeva
     daje 400 — to je bila reprodukcija BUGA (DTO bez ijednog dekoratora uz
     whitelist: true skidao je sva polja). Sada asertira očekivano ponašanje
     nakon popravke: legitimni zahtjevi prolaze, neispravni su odbijeni. */
  const cases = [
    ['empty object', {}, 'accepted'],
    ['confirm true', { confirm: true }, 'accepted'],
    ['iso proposedEndTime', { proposedEndTime: '2026-01-01T12:00:00Z' }, 'accepted'],
    ['both fields', { confirm: true, proposedEndTime: '2026-01-01T12:00:00Z' }, 'accepted'],
    // `null`/`undefined` tijelo Nest propušta (nema polja za whitelist); servis
    // tada radi kao "potvrdi predloženo vrijeme". Nije sigurnosni problem jer
    // owner scope i dalje vrijedi.
    ['explicit null', null, 'accepted'],
    ['absent value', undefined, 'accepted'],
    ['malformed date', { proposedEndTime: 'not-a-date' }, 400],
    // POZNATO OGRANIČENJE (nije specifično za SEC-2): `main.ts` ima
    // `enableImplicitConversion: true`, a class-transformer konvertuje PRIJE
    // `@Transform`, pa `Boolean('false') === true`. String 'maybe'/'false'
    // dakle postaje `true` i `@IsBoolean()` prolazi. Empirijski potvrđeno
    // sondom. Utječe na SVAKI boolean DTO u API-ju, pa se ne može popraviti
    // unutar ovog DTO-a bez globalne promjene. Zabilježeno kao B-023.
    ['confirm string coerced (B-023)', { confirm: 'false' }, 'accepted'],
    ['extra field', { confirm: true, userId: 999 }, 400],
  ];
  const results = [];
  for (const [name, value, expected] of cases) {
    try {
      await pipe.transform(value, { type: 'body', metatype: UpdateHeatingAnomalyDto });
      results.push({ name, status: 'accepted', expected });
    } catch (error) {
      results.push({ name, status: error.getStatus?.() ?? 'unknown', expected });
    }
  }
  for (const result of results) {
    assert.equal(result.status, result.expected, `${result.name}: očekivano ${result.expected}, dobijeno ${result.status}`);
  }
  const transformed = await pipe.transform({ proposedEndTime: '2026-01-01T12:00:00Z' }, { type: 'body', metatype: UpdateHeatingAnomalyDto });
  assert.ok(transformed.proposedEndTime instanceof Date, 'ISO string mora postati Date, ne ostati string');

  // Eksplicitan dokaz B-023: string 'false' postaje boolean true.
  const coerced = await pipe.transform({ confirm: 'false' }, { type: 'body', metatype: UpdateHeatingAnomalyDto });
  const b023 = coerced.confirm === true;
  console.log(JSON.stringify({ scope: 'isolated pipe and DTO, no HTTP or guard', dateCoercedTo: transformed.proposedEndTime.constructor.name, b023StringFalseBecomesTrue: b023, results }, null, 2));
}
main().catch(error => { console.error('Reprodukcija nije uspjela:', error.message); process.exitCode = 1; });
