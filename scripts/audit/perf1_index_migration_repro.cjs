#!/usr/bin/env node
'use strict';

/**
 * PERF-1: disposable-CI migration/rollback regression.
 *
 * Assumes `prisma migrate deploy` has already applied the PERF-1 migration.
 * Verifies the accepted heating index exists, the legacy deviceId index is
 * retained, the deferred weather index is absent, and a transactional
 * DROP INDEX + re-apply + ROLLBACK leaves the public index and row count intact.
 * Does not touch production or persistent databases.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ALLOWED_REFS = [
  'refs/heads/arena/1bfee051-boiler-control',
  'refs/heads/arena/c9961f17-boiler-control',
];
const INDEX_NAME = 'HeatingEvent_deviceId_timestampStart_idx';
const WEATHER_INDEX_NAME = 'WeatherCache_city_fetchedAt_idx';
const MIGRATION_PATH = path.join(
  __dirname,
  '../../backend/prisma/migrations/20261101000000_perf1_heating_event_device_timestamp/migration.sql',
);

function isDisposableCi(env, argv) {
  return (
    Array.isArray(argv) &&
    argv.length === 1 &&
    argv[0] === '--ci' &&
    env.GITHUB_ACTIONS === 'true' &&
    ALLOWED_REFS.includes(env.GITHUB_REF) &&
    env.AUDIT_DISPOSABLE_POSTGRES === '1' &&
    env.NODE_ENV === 'test' &&
    env.DATABASE_HOST === '127.0.0.1' &&
    String(env.DATABASE_PORT) === '5432' &&
    env.DATABASE_NAME === 'audit' &&
    env.DATABASE_USER === 'audit'
  );
}

async function indexExists(client, indexName) {
  const result = await client.query(
    `SELECT 1
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'HeatingEvent'
       AND indexname = $1`,
    [indexName],
  );
  return result.rowCount > 0;
}

async function legacyIndexExists(client) {
  const result = await client.query(
    `SELECT 1
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'HeatingEvent'
       AND indexname IN ('HeatingEvent_deviceId_fkey', 'HeatingEvent_deviceId_idx')`,
  );
  return result.rowCount > 0;
}

async function weatherIndexExists(client) {
  const result = await client.query(
    `SELECT 1
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'WeatherCache'
       AND indexname = $1`,
    [WEATHER_INDEX_NAME],
  );
  return result.rowCount > 0;
}

async function rowCount(client) {
  const result = await client.query(
    'SELECT count(*)::bigint AS count FROM "HeatingEvent"',
  );
  return String(result.rows[0].count);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) {
    console.log(
      [
        'Usage: node scripts/audit/perf1_index_migration_repro.cjs --ci',
        'Disposable GitHub Actions PostgreSQL only. Verifies PERF-1 migration state and transactional DROP/re-apply/ROLLBACK.',
        'Does not inspect or modify production data.',
      ].join('\n'),
    );
    return 0;
  }
  if (!isDisposableCi(process.env, argv)) {
    console.error(
      'Refused: only the explicitly marked disposable GitHub Actions PostgreSQL service is allowed.',
    );
    return 2;
  }

  const { Client } = require(path.join(__dirname, '../../backend/node_modules/pg'));
  const client = new Client({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  try {
    await client.query("SET statement_timeout = '30s'");
    await client.query("SET lock_timeout = '5s'");

    assert.equal(await indexExists(client, INDEX_NAME), true);
    assert.equal(await legacyIndexExists(client), true);
    assert.equal(await weatherIndexExists(client), false);
    const before = await rowCount(client);

    const definition = await client.query(
      `SELECT indexdef
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'HeatingEvent'
         AND indexname = $1`,
      [INDEX_NAME],
    );
    assert.match(definition.rows[0].indexdef, /"deviceId"/);
    assert.match(definition.rows[0].indexdef, /"timestampStart" DESC/);

    const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(`DROP INDEX public."${INDEX_NAME}"`);
      assert.equal(await indexExists(client, INDEX_NAME), false);
      await client.query(migrationSql);
      assert.equal(await indexExists(client, INDEX_NAME), true);
    } finally {
      await client.query('ROLLBACK');
    }

    assert.equal(await indexExists(client, INDEX_NAME), true);
    assert.equal(await legacyIndexExists(client), true);
    assert.equal(await weatherIndexExists(client), false);
    assert.equal(await rowCount(client), before);

    console.log(
      '[perf1] migration rollback regression passed; public index and row count preserved',
    );
    if (process.env.GITHUB_ACTIONS === 'true') {
      console.log(
        '::notice title=PERF-1 migration rollback::DROP/re-apply/ROLLBACK preserved the accepted index, legacy index and row count; weather index remains deferred.',
      );
    }
    return 0;
  } finally {
    await client.end();
  }
}

module.exports = { isDisposableCi };

if (require.main === module) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`[perf1] migration regression failed: ${error.message}`);
      process.exitCode = 1;
    });
}
