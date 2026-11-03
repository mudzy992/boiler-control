#!/usr/bin/env node
/* SEC-4: deterministička konkurentna rotacija stvarnog servisa uz fake DB.
   Nema HTTP-a, mreže, PostgreSQL-a, stvarnih korisnika ni ispisa tokena. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { UnauthorizedException } = require('../../backend/node_modules/@nestjs/common');
const root = path.resolve(__dirname, '../..');

if (process.argv.includes('--help')) {
  console.log(
    'Upotreba: node scripts/audit/refresh_token_concurrency_repro.cjs\n' +
      'Dvije kontrolisane konkurentne rotacije istog sintetičkog tokena moraju dati jedan uspjeh i jedan 401, opozvati sve vlasnikove sesije i sačuvati tuđu. Koristi stvarni RefreshTokenService i fake DB; ne dokazuje HTTP ili PostgreSQL locking.',
  );
  process.exit(0);
}
if (process.argv.length !== 2) {
  console.error('Nepoznat argument; koristite --help');
  process.exit(2);
}

process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (
    parent?.filename.endsWith(path.join('Auth', 'refresh-token.service.ts')) &&
    request.startsWith('../../prisma/')
  ) {
    return { PrismaService: class PrismaService {} };
  }
  return originalLoad.call(this, request, parent, isMain);
};
require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));
const { RefreshTokenService } = require(path.join(
  root,
  'backend/src/modules/Auth/refresh-token.service.ts',
));

function fakePrisma() {
  const rows = [];
  let nextId = 1;
  let reads = 0;
  let releaseReads;
  const bothReads = new Promise((resolve) => {
    releaseReads = resolve;
  });
  const refreshToken = {
    create: async ({ data }) => {
      const row = {
        id: nextId++,
        revokedAt: null,
        userAgent: null,
        ipAddress: null,
        createdAt: new Date(),
        ...data,
      };
      rows.push(row);
      return row;
    },
    findUnique: async ({ where }) => {
      reads += 1;
      if (reads === 2) releaseReads();
      await bothReads;
      return rows.find((row) => row.tokenHash === where.tokenHash) ?? null;
    },
    update: async ({ where, data }) => {
      await new Promise((resolve) => setImmediate(resolve));
      const row = rows.find((candidate) => candidate.id === where.id);
      if (!row) throw new Error('synthetic row missing');
      Object.assign(row, data);
      return row;
    },
    updateMany: async ({ where, data }) => {
      const matches = rows.filter(
        (row) =>
          (where.id === undefined || row.id === where.id) &&
          (where.userId === undefined || row.userId === where.userId) &&
          (where.revokedAt === null ? row.revokedAt === null : true),
      );
      for (const row of matches) Object.assign(row, data);
      return { count: matches.length };
    },
  };
  const prisma = {
    rows,
    refreshToken,
    $transaction: async (callback) => callback({ refreshToken }),
  };
  return prisma;
}

async function main() {
  const prisma = fakePrisma();
  const first = new RefreshTokenService(prisma);
  const second = new RefreshTokenService(prisma);
  const original = await first.issue(7);
  await first.issue(8);

  const results = await Promise.allSettled([
    first.rotate(original.token),
    second.rotate(original.token),
  ]);
  const statuses = results.map((result) => result.status).sort();
  const rejected = results.find((result) => result.status === 'rejected');
  const ownerRows = prisma.rows.filter((row) => row.userId === 7);
  const otherActive = prisma.rows.filter(
    (row) => row.userId === 8 && row.revokedAt === null,
  );

  assert.deepEqual(
    statuses,
    ['fulfilled', 'rejected'],
    'isti token smije imati tačno jedan uspješan claim',
  );
  assert.ok(
    rejected?.reason instanceof UnauthorizedException,
    'izgubljeni claim mora završiti postojećim 401 reuse tokom',
  );
  assert.equal(ownerRows.length, 2, 'smije postojati samo stari i jedan novi red');
  assert.ok(
    ownerRows.every((row) => row.revokedAt !== null),
    'reuse mora opozvati sve vlasnikove tokene, uključujući novog nasljednika',
  );
  assert.equal(otherActive.length, 1, 'tuđa aktivna sesija mora ostati netaknuta');

  console.log(
    JSON.stringify(
      {
        scope: 'actual RefreshTokenService with barrier-controlled fake DB; no HTTP or PostgreSQL',
        statuses,
        ownerRows: ownerRows.length,
        ownerActiveRows: ownerRows.filter((row) => row.revokedAt === null).length,
        otherActiveRows: otherActive.length,
        tokenValuesPrinted: false,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error?.message || 'refresh concurrency repro failed');
  process.exitCode = 1;
});
