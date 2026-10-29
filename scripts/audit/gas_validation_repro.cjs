#!/usr/bin/env node
/* Synthetic DTO/ValidationPipe reproduction; no HTTP, DB, network or credentials. */
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/gas_validation_repro.cjs\nProvjerava stvarne gas DTO-e s opcijama produkcijskog ValidationPipea i gas servis nad lažnom bazom; bez HTTP-a, guarda, stvarne baze ili mreže. Potrebne backend npm zavisnosti.');
  process.exit(0);
}
if (process.argv.length !== 2) { console.error('Nepoznat argument; koristite --help'); process.exit(2); }
const root = path.resolve(__dirname, '../..');
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (parent?.filename.endsWith(path.join('Gas', 'gas.reading.service.ts')) && (request.startsWith('../../prisma/') || request.startsWith('../../common/file-storage'))) return { PrismaService: class {}, FileStorageService: class {} };
  return originalLoad.call(this, request, parent, isMain);
};
require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));
const { GasReadingService } = require(path.join(root, 'backend/src/modules/Gas/gas.reading.service.ts'));
const { ValidationPipe } = require(path.join(root, 'backend/node_modules/@nestjs/common'));
const { UpdateGasReferenceDto } = require(path.join(root, 'backend/src/modules/Gas/dto/update-gas-reference.dto.ts'));
const { CreateGasReadingDto } = require(path.join(root, 'backend/src/modules/Gas/dto/create-gas-reading.dto.ts'));
async function main() {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } });
  const cases = [
    ['reference boolean false', UpdateGasReferenceDto, { isReference: false }, 'isReference'],
    ['reference string false', UpdateGasReferenceDto, { isReference: 'false' }, 'isReference'],
    ['reference invalid string', UpdateGasReferenceDto, { isReference: 'not-a-boolean' }, 'isReference'],
    ['reference zero', UpdateGasReferenceDto, { isReference: 0 }, 'isReference'],
    ['reading negative', CreateGasReadingDto, { counterValue: -1, readingDate: '2026-01-01' }, 'counterValue'],
    ['reading empty string', CreateGasReadingDto, { counterValue: '', readingDate: '2026-01-01' }, 'counterValue'],
  ];
  const results = [];
  for (const [name, metatype, input, field] of cases) {
    try { const value = await pipe.transform(input, { type: 'body', metatype }); results.push({ name, status: 'accepted', value: value[field] }); }
    catch (error) { results.push({ name, status: error.getStatus?.() ?? 'unknown' }); }
  }
  assert.deepEqual(results.map(({status, value}) => [status, value]), [
    ['accepted', false], ['accepted', true], ['accepted', true], ['accepted', false], ['accepted', -1], ['accepted', 0],
  ]);
  let created;
  const fakeDb = {
    user: { findUnique: async () => ({ id: 1 }) },
    gasReading: {
      findFirst: async () => null,
      create: async ({data}) => (created = { id: 1, ...data }),
      findUnique: async () => created,
    },
  };
  const dto = await pipe.transform({ counterValue: -1, readingDate: '2026-01-01' }, { type: 'body', metatype: CreateGasReadingDto });
  const serviceResult = await new GasReadingService(fakeDb, {}).create(1, dto);
  assert.equal(created.counterValue, -1);
  assert.equal(serviceResult.counterValue, -1);
  const backdatedDb = {
    user: { findUnique: async () => ({ id: 1 }) },
    gasReading: { findFirst: async (query) => query.orderBy ? { counterValue: 200, readingDate: new Date('2026-02-01') } : null },
  };
  let backdatedStatus;
  try {
    await new GasReadingService(backdatedDb, {}).create(1, { counterValue: 100, readingDate: '2026-01-01' });
    backdatedStatus = 'accepted';
  } catch (error) { backdatedStatus = error.getStatus?.() ?? 'unknown'; }
  assert.equal(backdatedStatus, 400);
  console.log(JSON.stringify({ scope: 'isolated pipe and actual service with fake DB; no HTTP, guards or real persistence', results, fakeFirstReadingWritten: created.counterValue, backdatedEarlierLowerCounterStatus: backdatedStatus }, null, 2));
}
main().catch(error => { console.error('Reprodukcija nije uspjela:', error.message); process.exitCode = 1; });
