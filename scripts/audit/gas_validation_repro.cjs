#!/usr/bin/env node
/* Gas DTO/service reproduction; no HTTP, real DB, network or credentials. */
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');

if (process.argv.includes('--help')) {
  console.log(
    'Upotreba: node scripts/audit/gas_validation_repro.cjs\n' +
      'Provjerava stvarne gas DTO-e s opcijama produkcijskog ValidationPipea i gas servis nad lažnom bazom; bez HTTP-a, guarda, stvarne baze ili mreže. Potrebne backend npm zavisnosti.\n' +
      '\n' +
      'Skripta je ažurirana u FEAT-7. Prije toga asertirala je POGREŠNO ponašanje\n' +
      '(dokaz za B-015/B-016/B-017); sada asertira ispravljeno ponašanje i, pod\n' +
      'GAS_STRICT_VALIDATION=off, dokazuje da rollback put vraća staro ponašanje.\n' +
      'Idempotentna, read-only, bez tajni.',
  );
  process.exit(0);
}
if (process.argv.length !== 2) {
  console.error('Nepoznat argument; koristite --help');
  process.exit(2);
}

const root = path.resolve(__dirname, '../..');
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (
    parent?.filename.endsWith(path.join('Gas', 'gas.reading.service.ts')) &&
    (request.startsWith('../../prisma/') ||
      request.startsWith('../../common/file-storage'))
  ) {
    return { PrismaService: class {}, FileStorageService: class {} };
  }
  return originalLoad.call(this, request, parent, isMain);
};

require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));

const {
  GasReadingService,
} = require(path.join(root, 'backend/src/modules/Gas/gas.reading.service.ts'));
const {
  ValidationPipe,
} = require(path.join(root, 'backend/node_modules/@nestjs/common'));
const {
  UpdateGasReferenceDto,
} = require(path.join(root, 'backend/src/modules/Gas/dto/update-gas-reference.dto.ts'));
const {
  CreateGasReadingDto,
} = require(path.join(root, 'backend/src/modules/Gas/dto/create-gas-reading.dto.ts'));

// `main.ts:29-38`.
function makePipe() {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });
}

const CASES = [
  ['reference boolean false', UpdateGasReferenceDto, { isReference: false }, 'isReference'],
  ['reference string false', UpdateGasReferenceDto, { isReference: 'false' }, 'isReference'],
  ['reference invalid string', UpdateGasReferenceDto, { isReference: 'not-a-boolean' }, 'isReference'],
  ['reference zero', UpdateGasReferenceDto, { isReference: 0 }, 'isReference'],
  ['reading negative', CreateGasReadingDto, { counterValue: -1, readingDate: '2026-01-01' }, 'counterValue'],
  ['reading empty string', CreateGasReadingDto, { counterValue: '', readingDate: '2026-01-01' }, 'counterValue'],
];

async function runPipeCases() {
  const pipe = makePipe();
  const results = [];
  for (const [name, metatype, input, field] of CASES) {
    try {
      const value = await pipe.transform(input, { type: 'body', metatype });
      results.push({ name, status: 'accepted', value: value[field] });
    } catch (error) {
      results.push({ name, status: error.getStatus?.() ?? 'unknown' });
    }
  }
  return results.map(({ status, value }) => [status, value]);
}

/** Lažna baza koja podržava i strogi put ($transaction) i legacy put. */
function makeFakeDb(existing) {
  let created;
  const rows = [...existing];
  const db = {
    user: { findUnique: async () => ({ id: 1 }) },
    gasReading: {
      findFirst: async (query) => {
        const where = query?.where ?? {};
        let out = rows.filter((r) => r.userId === where.userId);
        const f = where.readingDate;
        if (f) {
          out = out.filter((r) => {
            const t = r.readingDate.getTime();
            if (f.lt && !(t < f.lt.getTime())) return false;
            if (f.gt && !(t > f.gt.getTime())) return false;
            if (f.gte && !(t >= f.gte.getTime())) return false;
            if (f.lte && !(t <= f.lte.getTime())) return false;
            return true;
          });
        }
        const dir = query?.orderBy?.readingDate;
        if (dir) {
          out.sort((a, b) =>
            dir === 'asc'
              ? a.readingDate - b.readingDate
              : b.readingDate - a.readingDate,
          );
        }
        return out[0] ?? null;
      },
      create: async ({ data }) => {
        created = { id: rows.length + 1, userId: 1, createdAt: new Date(), isInvoiceReference: false, referenceMonth: null, meterImagePath: null, invoicePdfPath: null, invoiceUploadedAt: null, invoiceGasPriceExVat: null, ...data };
        rows.push(created);
        return created;
      },
      update: async ({ where, data }) => {
        const row = rows.find((r) => r.id === where.id);
        Object.assign(row, data);
        return row;
      },
      findUnique: async ({ where }) => rows.find((r) => r.id === where.id) ?? created,
    },
    $transaction: async (fn) => fn(db),
  };
  return { db, get created() { return created; }, rows };
}

async function backdatedStatus(existing, dto) {
  const { db } = makeFakeDb(existing);
  try {
    await new GasReadingService(db, {}).create(1, dto);
    return 'accepted';
  } catch (error) {
    return error.getStatus?.() ?? 'unknown';
  }
}

async function main() {
  const out = { scope: 'isolated pipe and actual service with fake DB; no HTTP, guards or real persistence' };

  // ---------- STROGI NAČIN (zadano) ----------
  delete process.env.GAS_STRICT_VALIDATION;

  const strict = await runPipeCases();
  // FEAT-7: string 'false', nepoznat string, 0, negativan i prazan unos se
  // odbijaju s 400 umjesto da tiho postanu true/false/0.
  assert.deepEqual(strict, [
    ['accepted', false], // pravi boolean i dalje radi
    ['accepted', false], // B-015 ispravljen: 'false' je sada false, a ne true
    [400, undefined], // nepoznat string se odbija
    [400, undefined], // 0 se odbija (nije boolean)
    [400, undefined], // B-016 ispravljen: negativan se odbija
    [400, undefined], // B-016 ispravljen: prazan se ne guta kao 0
  ]);
  out.strictPipeResults = strict;

  // Ispravan unos i dalje prolazi.
  const okPipe = await makePipe().transform(
    { counterValue: '12345.67', readingDate: '2026-01-01' },
    { type: 'body', metatype: CreateGasReadingDto },
  );
  assert.equal(okPipe.counterValue, 12345.67);

  // B-017: postoje kasnije očitanje 200; unos ranijeg datuma sa 100 je
  // hronološki ispravan (100 -> 200) i sada se PRIHVATA.
  const later = { id: 9, userId: 1, readingDate: new Date('2026-02-01'), counterValue: 200, consumption: 0 };
  const strictBackdated = await backdatedStatus([later], {
    counterValue: 100,
    readingDate: '2026-01-01',
  });
  assert.equal(strictBackdated, 'accepted');
  out.strictBackdatedEarlierLowerCounterStatus = strictBackdated;

  // Monotonost se i dalje čuva u oba smjera.
  const strictTooLow = await backdatedStatus(
    [{ id: 8, userId: 1, readingDate: new Date('2025-12-01'), counterValue: 300, consumption: 0 }],
    { counterValue: 100, readingDate: '2026-01-01' },
  );
  assert.equal(strictTooLow, 400);
  const strictTooHigh = await backdatedStatus(
    [{ id: 8, userId: 1, readingDate: new Date('2026-03-01'), counterValue: 200, consumption: 0 }],
    { counterValue: 500, readingDate: '2026-01-01' },
  );
  assert.equal(strictTooHigh, 400);
  out.strictMonotonicityViolationsRejected = [strictTooLow, strictTooHigh];

  // ---------- LEGACY NAČIN (rollback) ----------
  process.env.GAS_STRICT_VALIDATION = 'off';

  const legacy = await runPipeCases();
  // Dokaz da rollback put zaista vraća STARO ponašanje. Ovo nije poželjno
  // stanje nego sigurnosni ventil za deploy bez novog koda.
  assert.deepEqual(legacy, [
    ['accepted', false],
    ['accepted', true], // B-015 se ponovo pojavljuje
    ['accepted', true],
    ['accepted', false],
    ['accepted', -1], // B-016 se ponovo pojavljuje
    ['accepted', 0],
  ]);
  out.legacyPipeResults = legacy;

  const legacyBackdated = await backdatedStatus([later], {
    counterValue: 100,
    readingDate: '2026-01-01',
  });
  assert.equal(legacyBackdated, 400); // B-017 se ponovo pojavljuje
  out.legacyBackdatedEarlierLowerCounterStatus = legacyBackdated;

  delete process.env.GAS_STRICT_VALIDATION;
  console.log(JSON.stringify(out, null, 2));
}

main().catch((error) => {
  console.error('Reprodukcija nije uspjela:', error.message);
  process.exitCode = 1;
});
