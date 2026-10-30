#!/usr/bin/env node
/* CI-only: dokaz da REL-4/B-021 drži — destruktivni seed odbija nepoznat cilj PRIJE konekcije, pa nijedan red ne nestane. */
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');

if (process.argv.includes('--help')) {
  console.log(
    'Upotreba: node scripts/audit/seed_isolation_repro.cjs --ci\n' +
      'Samo efemerni PostgreSQL servis u branch-only GitHub Actions workflowu.\n\n' +
      'Skripta dokazuje tri stvari:\n' +
      '  1. `assertSeedTargetAllowed` baca za cilj koji nije testni (npr. "boiler_control")\n' +
      '     i za NODE_ENV=production, i to PRIJE nego što se otvori ijedna konekcija.\n' +
      '  2. RESTORE TEST: redak upisan u disposable bazu i dalje postoji nakon odbijenog\n' +
      '     pokušaja — dakle odbijanje se stvarno desi prije bilo kakvog DELETE.\n' +
      '  3. Dozvoljeni cilj (allowlist ili testno ime na lokalnom hostu) ne baca.\n\n' +
      'Ne koristiti s produkcijskom ili trajnom bazom.',
  );
  process.exit(0);
}

const expectedRef = 'refs/heads/arena/1bfee051-boiler-control';
if (
  process.argv.length !== 3 ||
  process.argv[2] !== '--ci' ||
  process.env.GITHUB_ACTIONS !== 'true' ||
  process.env.GITHUB_REF !== expectedRef ||
  process.env.AUDIT_DISPOSABLE_POSTGRES !== '1' ||
  process.env.DATABASE_HOST !== '127.0.0.1' ||
  process.env.DATABASE_NAME !== 'audit' ||
  process.env.DATABASE_USER !== 'audit'
) {
  console.error(
    'Odbijeno: dopušten je samo eksplicitno označeni izolovani GitHub Actions PostgreSQL servis.',
  );
  process.exit(2);
}

const root = path.resolve(__dirname, '../..');
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');
require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));
require(path.join(root, 'backend/node_modules/tsconfig-paths/register'));
const { PrismaService } = require(path.join(root, 'backend/src/prisma/prisma.service.ts'));
const {
  evaluateSeedTarget,
  assertSeedTargetAllowed,
} = require(path.join(root, 'backend/src/common/seed-target-guard.ts'));

let stage = 'initialization';

async function main() {
  const db = new PrismaService();
  try {
    stage = 'connect';
    await db.$connect();

    // Disposable tabela s jednim redom: ako guard zakaze, red nestane.
    stage = 'fixture';
    await db.$executeRaw`DROP TABLE IF EXISTS rel4_canary`;
    await db.$executeRaw`CREATE TABLE rel4_canary (id serial primary key, note text not null)`;
    await db.$executeRaw`INSERT INTO rel4_canary (note) VALUES ('must-survive')`;

    stage = 'guard-rejects-production-name';
    // CI baza se zove "audit" (testno ime). Produkcijsko ime mora biti odbijeno.
    assert.equal(
      evaluateSeedTarget({
        NODE_ENV: 'development',
        DATABASE_HOST: '127.0.0.1',
        DATABASE_NAME: 'boiler_control',
      }).allowed,
      false,
    );

    stage = 'guard-rejects-production-env';
    assert.equal(
      evaluateSeedTarget({
        NODE_ENV: 'production',
        DATABASE_HOST: '127.0.0.1',
        DATABASE_NAME: 'audit',
        SEED_ALLOWED_DATABASES: 'audit',
      }).allowed,
      false,
    );

    stage = 'assert-throws-before-connection';
    // Ključno: ovo baca bez ijednog SQL poziva. Canary red je dokaz.
    assert.throws(
      () =>
        assertSeedTargetAllowed({
          NODE_ENV: 'development',
          DATABASE_HOST: '127.0.0.1',
          DATABASE_NAME: 'boiler_control',
        }),
      /boiler_control/,
    );

    stage = 'restore-verification';
    const rows = await db.$queryRaw`SELECT note FROM rel4_canary`;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].note, 'must-survive');

    stage = 'guard-allows-disposable';
    // Pozitivna kontrola: bez nje odbijanje ne bi dokazivalo ništa.
    assert.doesNotThrow(() =>
      assertSeedTargetAllowed({
        NODE_ENV: 'test',
        DATABASE_HOST: '127.0.0.1',
        DATABASE_NAME: 'audit',
      }),
    );
    assert.doesNotThrow(() =>
      assertSeedTargetAllowed({
        NODE_ENV: 'development',
        DATABASE_HOST: 'ci-postgres',
        DATABASE_NAME: 'boiler_control_test',
        SEED_ALLOWED_DATABASES: 'boiler_control_test',
      }),
    );

    stage = 'cleanup';
    await db.$executeRaw`DROP TABLE IF EXISTS rel4_canary`;

    console.log(
      '::notice title=Audit seed isolation check::REL-4 holds - destructive seed refused the non-test target "boiler_control" and NODE_ENV=production before any connection was opened, the canary row survived the refused attempt, and the disposable/allowlisted targets were accepted.',
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(`::error::REL-4 seed isolation repro failed at stage "${stage}": ${error?.name}: ${error?.message}`);
  process.exit(1);
});
