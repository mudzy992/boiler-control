#!/usr/bin/env node
'use strict';

/**
 * PERF-1: mjerenje kandidata indeksa prije promjene seme.
 *
 * Skripta radi iskljucivo nad efemernim GitHub Actions PostgreSQL servisom.
 * Kreira TEMP tabele kopirane iz javne seme, puni ih sintetickim podacima,
 * mjeri baseline/kandidate u ABBA redoslijedu i na kraju radi ROLLBACK.
 * Ne koristi produkcijske podatke, ne mijenja javne tabele i ne zove HTTP.
 *
 * Rezultat je JSON artefakt + sazetak. Ovo nije produkcijski p95 dokaz.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ALLOWED_REFS = [
  'refs/heads/arena/1bfee051-boiler-control',
  'refs/heads/arena/c9961f17-boiler-control',
];

const THRESHOLDS = Object.freeze({
  minReadImprovementPct: 20,
  maxWriteRegressionPct: 10,
});

const INDEXES = Object.freeze({
  heating: Object.freeze({
    table: 'HeatingEvent',
    name: 'HeatingEvent_deviceId_timestampStart_idx',
    columns: '"deviceId", "timestampStart" DESC',
  }),
  weather: Object.freeze({
    table: 'WeatherCache',
    name: 'WeatherCache_city_fetchedAt_idx',
    columns: '"city", "fetchedAt" DESC',
  }),
});

// SQL oblici odgovaraju Prisma findFirst upitima: filter + order + limit 1.
// SELECT * zadrzava isti red/sirinu kao trenutni Prisma upit.
const QUERIES = Object.freeze({
  heatingLast:
    'SELECT * FROM "HeatingEvent" WHERE "deviceId" = $1 ORDER BY "timestampStart" DESC LIMIT 1',
  heatingMinute:
    'SELECT * FROM "HeatingEvent" WHERE "deviceId" = $1 AND "timestampStart" >= $2 LIMIT 1',
  weatherCity:
    'SELECT * FROM "WeatherCache" WHERE "city" = $1 ORDER BY "fetchedAt" DESC LIMIT 1',
  weatherGlobal:
    'SELECT * FROM "WeatherCache" ORDER BY "fetchedAt" DESC LIMIT 1',
});

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
    env.DATABASE_USER === 'audit' &&
    typeof env.RUNNER_TEMP === 'string' &&
    env.RUNNER_TEMP.length > 0
  );
}

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('percentile requires a non-empty array');
  }
  if (!Number.isFinite(p) || p <= 0 || p > 100) {
    throw new Error('percentile requires 0 < p <= 100');
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

function timingStats(samples) {
  assert.ok(samples.length > 0, 'timing samples must not be empty');
  return {
    samples,
    count: samples.length,
    minMs: samples.reduce((a, b) => Math.min(a, b), Infinity),
    p50Ms: percentile(samples, 50),
    p95Ms: percentile(samples, 95),
    p99Ms: percentile(samples, 99),
    maxMs: samples.reduce((a, b) => Math.max(a, b), -Infinity),
  };
}

function combineTiming(phases, key) {
  return timingStats(phases.flatMap((phase) => phase.timings[key].samples));
}

function walkPlan(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const child of node.Plans || []) walkPlan(child, visit);
}

function summarizePlan(explainJson) {
  const entry = Array.isArray(explainJson) ? explainJson[0] : explainJson;
  const root = entry && entry.Plan;
  assert.ok(root, 'EXPLAIN JSON must contain Plan');
  const nodeTypes = [];
  const indexNames = [];
  let sortCount = 0;
  let sharedHitBlocks = 0;
  let sharedReadBlocks = 0;
  let localHitBlocks = 0;
  let localReadBlocks = 0;
  walkPlan(root, (node) => {
    if (typeof node['Node Type'] === 'string') {
      nodeTypes.push(node['Node Type']);
      if (node['Node Type'] === 'Sort') sortCount += 1;
    }
    if (typeof node['Index Name'] === 'string') {
      indexNames.push(node['Index Name']);
    }
    sharedHitBlocks = Math.max(
      sharedHitBlocks,
      Number(node['Shared Hit Blocks'] || 0),
    );
    sharedReadBlocks = Math.max(
      sharedReadBlocks,
      Number(node['Shared Read Blocks'] || 0),
    );
    localHitBlocks = Math.max(
      localHitBlocks,
      Number(node['Local Hit Blocks'] || 0),
    );
    localReadBlocks = Math.max(
      localReadBlocks,
      Number(node['Local Read Blocks'] || 0),
    );
  });
  return {
    nodeTypes,
    indexNames,
    sortCount,
    sharedHitBlocks,
    sharedReadBlocks,
    localHitBlocks,
    localReadBlocks,
    bufferBlocks:
      sharedHitBlocks + sharedReadBlocks + localHitBlocks + localReadBlocks,
    planningTimeMs: Number(entry['Planning Time'] || 0),
    executionTimeMs: Number(entry['Execution Time'] || 0),
    rootActualTotalTimeMs: Number(root['Actual Total Time'] || 0),
    planRows: Number(root['Plan Rows'] || 0),
  };
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function evaluateCandidate(input) {
  const {
    beforeReadP95Ms,
    afterReadP95Ms,
    beforeWriteP95Ms,
    afterWriteP95Ms,
    beforeBufferBlocks,
    afterBufferBlocks,
    beforeSortCount,
    afterSortCount,
    afterUsesCandidateIndex,
    resultsEqual,
  } = input;
  assert.ok(beforeReadP95Ms > 0, 'baseline read p95 must be positive');
  assert.ok(beforeWriteP95Ms > 0, 'baseline write p95 must be positive');
  const readImprovementPct =
    ((beforeReadP95Ms - afterReadP95Ms) / beforeReadP95Ms) * 100;
  const writeRegressionPct =
    ((afterWriteP95Ms - beforeWriteP95Ms) / beforeWriteP95Ms) * 100;
  const reasons = [];
  if (!resultsEqual) reasons.push('query_results_changed');
  if (!afterUsesCandidateIndex) reasons.push('candidate_index_not_used');
  if (!(beforeSortCount > 0 && afterSortCount === 0)) {
    reasons.push('sort_not_removed');
  }
  if (afterBufferBlocks > beforeBufferBlocks) {
    reasons.push('buffer_blocks_increased');
  }
  if (readImprovementPct < THRESHOLDS.minReadImprovementPct) {
    reasons.push('read_p95_improvement_below_threshold');
  }
  if (writeRegressionPct > THRESHOLDS.maxWriteRegressionPct) {
    reasons.push('write_p95_regression_above_threshold');
  }
  return {
    eligible: reasons.length === 0,
    reasons,
    readImprovementPct,
    writeRegressionPct,
    beforeReadP95Ms,
    afterReadP95Ms,
    beforeWriteP95Ms,
    afterWriteP95Ms,
    beforeBufferBlocks,
    afterBufferBlocks,
    beforeSortCount,
    afterSortCount,
    afterUsesCandidateIndex,
    resultsEqual,
    thresholds: THRESHOLDS,
  };
}

function elapsedMs(start) {
  return Number(process.hrtime.bigint() - start) / 1e6;
}

async function timeQuery(client, sql, paramsList, samples, warmup) {
  assert.ok(paramsList.length > 0, 'paramsList must not be empty');
  const values = [];
  for (let i = 0; i < warmup + samples; i += 1) {
    const params = paramsList[i % paramsList.length];
    const start = process.hrtime.bigint();
    await client.query(sql, params);
    const ms = elapsedMs(start);
    if (i >= warmup) values.push(ms);
  }
  return timingStats(values);
}

async function timeWrite(client, sql, paramsList, samples, warmup) {
  assert.ok(paramsList.length > 0, 'paramsList must not be empty');
  const values = [];
  for (let i = 0; i < warmup + samples; i += 1) {
    const params = paramsList[i % paramsList.length];
    await client.query('SAVEPOINT perf1_write');
    try {
      const start = process.hrtime.bigint();
      await client.query(sql, params);
      const ms = elapsedMs(start);
      if (i >= warmup) values.push(ms);
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT perf1_write');
      await client.query('RELEASE SAVEPOINT perf1_write');
    }
  }
  return timingStats(values);
}

async function explainQuery(client, sql, params) {
  const result = await client.query(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,
    params,
  );
  const json = result.rows[0]['QUERY PLAN'];
  return { summary: summarizePlan(json), raw: json };
}

async function explainMedian(client, sql, params, repetitions = 3) {
  const runs = [];
  for (let i = 0; i < repetitions; i += 1) {
    runs.push(await explainQuery(client, sql, params));
  }
  runs.sort(
    (a, b) => a.summary.executionTimeMs - b.summary.executionTimeMs,
  );
  return runs[Math.floor(runs.length / 2)];
}

async function setCandidateIndex(client, index, present) {
  if (present) {
    await client.query(
      `CREATE INDEX IF NOT EXISTS "${index.name}" ON pg_temp."${index.table}" (${index.columns})`,
    );
  } else {
    await client.query(`DROP INDEX IF EXISTS pg_temp."${index.name}"`);
  }
  await client.query(`ANALYZE pg_temp."${index.table}"`);
}

async function relationSizes(client, table, candidateName) {
  const result = await client.query(
    `SELECT
       pg_relation_size($1::regclass) AS table_bytes,
       pg_total_relation_size($1::regclass) AS total_bytes,
       COALESCE(pg_relation_size(to_regclass($2)), 0) AS candidate_bytes`,
    [`pg_temp."${table}"`, `pg_temp."${candidateName}"`],
  );
  const row = result.rows[0];
  return {
    tableBytes: Number(row.table_bytes),
    totalBytes: Number(row.total_bytes),
    indexBytes: Number(row.total_bytes) - Number(row.table_bytes),
    candidateIndexBytes: Number(row.candidate_bytes),
  };
}

function heatingDeviceMix() {
  // 20% hot, 20% warm, 50% cold, 10% missing. Namjerno nije uniformno.
  return [
    1, 1, 1, 1, 5, 6, 7, 8, 150, 151, 152, 153, 154, 155, 156, 157, 158,
    159, 999, 998,
  ];
}

function heatingMinuteThreshold(deviceId) {
  const eventCount = deviceId === 1 ? 50000 : deviceId <= 10 ? 2000 : 200;
  const latest =
    Date.UTC(2024, 0, 1) +
    eventCount * 60000 +
    deviceId * 1000;
  return new Date(latest - 30 * 60000);
}

async function heatingCorrectness(client) {
  const hashes = {};
  for (const deviceId of [1, 5, 150, 999]) {
    const last = await client.query(QUERIES.heatingLast, [deviceId]);
    hashes[`last_${deviceId}`] = stableHash(last.rows);
    const minute = await client.query(QUERIES.heatingMinute, [
      deviceId,
      heatingMinuteThreshold(deviceId),
    ]);
    // Postojanje je poslovni rezultat; red unutar minute nije stabilno narucen.
    hashes[`minute_${deviceId}`] = stableHash({
      exists: minute.rows.length > 0,
      deviceId: minute.rows[0]?.deviceId ?? null,
    });
  }
  return hashes;
}

async function measureHeatingPhase(client, label, candidatePresent) {
  await setCandidateIndex(client, INDEXES.heating, candidatePresent);
  const devices = heatingDeviceMix();
  const lastParams = devices.map((id) => [id]);
  const minuteParams = devices.map((id) => [id, heatingMinuteThreshold(id)]);
  const insertParams = Array.from({ length: 120 }, (_, i) => [
    1000000000 + i,
    devices[i % devices.length],
    20,
    21,
    'PERF1_BENCH',
    new Date(Date.UTC(2024, 0, 1)),
    'HEATING_ON',
    new Date(Date.UTC(2024, 0, 1) + (100000 + i) * 60000),
    false,
    false,
  ]);
  const timings = {
    lastEvent: await timeQuery(
      client,
      QUERIES.heatingLast,
      lastParams,
      240,
      24,
    ),
    minuteSlot: await timeQuery(
      client,
      QUERIES.heatingMinute,
      minuteParams,
      240,
      24,
    ),
    insert: await timeWrite(
      client,
      `INSERT INTO "HeatingEvent"
         (id, "deviceId", "currentTemp", "targetTemp", source, "createdAt",
          "hvacAction", "timestampStart", "isAnomaly", "userConfimed")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      insertParams,
      120,
      12,
    ),
  };
  const plans = {
    lastHot: await explainMedian(client, QUERIES.heatingLast, [1]),
    lastCold: await explainMedian(client, QUERIES.heatingLast, [150]),
    minuteSlot: await explainMedian(client, QUERIES.heatingMinute, [
      1,
      heatingMinuteThreshold(1),
    ]),
  };
  return {
    label,
    candidatePresent,
    timings,
    plans,
    correctness: await heatingCorrectness(client),
    sizes: await relationSizes(
      client,
      INDEXES.heating.table,
      INDEXES.heating.name,
    ),
  };
}

function weatherCityName(cityId) {
  return `perf1_city_${String(cityId).padStart(3, '0')}`;
}

async function populateWeather(client, dataset) {
  await client.query('TRUNCATE TABLE "WeatherCache"');
  const cities = dataset === 'normal' ? 100 : 200;
  const rowsPerCity = dataset === 'normal' ? 1 : 100;
  await client.query(
    `INSERT INTO "WeatherCache" (id, city, "fetchedAt", temperature)
     SELECT c.id * 1000 + r.n,
            'perf1_city_' || lpad(c.id::text, 3, '0'),
            TIMESTAMP '2024-01-01 00:00:00' + ((c.id - 1) * 1000 + r.n) * INTERVAL '1 second',
            10 + (r.n % 10)
     FROM generate_series(1, $1) AS c(id)
     CROSS JOIN generate_series(1, $2) AS r(n)`,
    [cities, rowsPerCity],
  );
  await client.query('ANALYZE "WeatherCache"');
  return { cities, rowsPerCity, rows: cities * rowsPerCity };
}

async function weatherCorrectness(client) {
  const hashes = {};
  for (const cityId of [1, 150, 999]) {
    const result = await client.query(QUERIES.weatherCity, [
      weatherCityName(cityId),
    ]);
    hashes[`city_${cityId}`] = stableHash(result.rows);
  }
  const global = await client.query(QUERIES.weatherGlobal);
  hashes.global = stableHash(global.rows);
  return hashes;
}

async function measureWeatherPhase(client, label, candidatePresent, dataset) {
  await setCandidateIndex(client, INDEXES.weather, candidatePresent);
  const cityIds = [1, 2, 3, 50, 150, 999];
  const cityParams = cityIds.map((id) => [weatherCityName(id)]);
  const insertParams = Array.from({ length: 120 }, (_, i) => [
    1000000000 + i,
    `perf1_write_${i % 100}`,
    new Date(Date.UTC(2024, 0, 1) + (1000000 + i) * 1000),
    12,
  ]);
  const deleteParams = Array.from({ length: 120 }, (_, i) => [
    ((i % 100) + 1) * 1000 + 1,
  ]);
  const timings = {
    cityLatest: await timeQuery(
      client,
      QUERIES.weatherCity,
      cityParams,
      240,
      24,
    ),
    globalLatest: await timeQuery(
      client,
      QUERIES.weatherGlobal,
      [[]],
      120,
      12,
    ),
    insert: await timeWrite(
      client,
      `INSERT INTO "WeatherCache" (id, city, "fetchedAt", temperature)
       VALUES ($1,$2,$3,$4)`,
      insertParams,
      120,
      12,
    ),
    delete: await timeWrite(
      client,
      'DELETE FROM "WeatherCache" WHERE id = $1',
      deleteParams,
      120,
      12,
    ),
  };
  const plans = {
    cityLatest: await explainMedian(client, QUERIES.weatherCity, [
      weatherCityName(1),
    ]),
    globalLatest: await explainMedian(client, QUERIES.weatherGlobal, []),
  };
  return {
    label,
    dataset,
    candidatePresent,
    timings,
    plans,
    correctness: await weatherCorrectness(client),
    sizes: await relationSizes(
      client,
      INDEXES.weather.table,
      INDEXES.weather.name,
    ),
  };
}

function correctnessEqual(phases) {
  const first = JSON.stringify(phases[0].correctness);
  return phases.every((phase) => JSON.stringify(phase.correctness) === first);
}

function summarizeHeating(phases) {
  const baseline = phases.filter((p) => !p.candidatePresent);
  const candidate = phases.filter((p) => p.candidatePresent);
  const beforeRead = combineTiming(baseline, 'lastEvent');
  const afterRead = combineTiming(candidate, 'lastEvent');
  const beforeWrite = combineTiming(baseline, 'insert');
  const afterWrite = combineTiming(candidate, 'insert');
  const beforePlan = baseline[0].plans.lastHot.summary;
  const afterPlan = candidate[0].plans.lastHot.summary;
  return evaluateCandidate({
    beforeReadP95Ms: beforeRead.p95Ms,
    afterReadP95Ms: afterRead.p95Ms,
    beforeWriteP95Ms: beforeWrite.p95Ms,
    afterWriteP95Ms: afterWrite.p95Ms,
    beforeBufferBlocks: beforePlan.bufferBlocks,
    afterBufferBlocks: afterPlan.bufferBlocks,
    beforeSortCount: beforePlan.sortCount,
    afterSortCount: afterPlan.sortCount,
    afterUsesCandidateIndex: afterPlan.indexNames.includes(INDEXES.heating.name),
    resultsEqual: correctnessEqual(phases),
  });
}

function summarizeWeather(phases) {
  const baseline = phases.filter((p) => !p.candidatePresent);
  const candidate = phases.filter((p) => p.candidatePresent);
  const beforeRead = combineTiming(baseline, 'cityLatest');
  const afterRead = combineTiming(candidate, 'cityLatest');
  const beforeWriteP95Ms = Math.max(
    combineTiming(baseline, 'insert').p95Ms,
    combineTiming(baseline, 'delete').p95Ms,
  );
  const afterWriteP95Ms = Math.max(
    combineTiming(candidate, 'insert').p95Ms,
    combineTiming(candidate, 'delete').p95Ms,
  );
  const beforePlan = baseline[0].plans.cityLatest.summary;
  const afterPlan = candidate[0].plans.cityLatest.summary;
  return evaluateCandidate({
    beforeReadP95Ms: beforeRead.p95Ms,
    afterReadP95Ms: afterRead.p95Ms,
    beforeWriteP95Ms,
    afterWriteP95Ms,
    beforeBufferBlocks: beforePlan.bufferBlocks,
    afterBufferBlocks: afterPlan.bufferBlocks,
    beforeSortCount: beforePlan.sortCount,
    afterSortCount: afterPlan.sortCount,
    afterUsesCandidateIndex: afterPlan.indexNames.includes(INDEXES.weather.name),
    resultsEqual: correctnessEqual(phases),
  });
}

async function createTempTables(client) {
  await client.query('SET LOCAL search_path = pg_temp, public');
  await client.query(
    `CREATE TEMP TABLE "HeatingEvent"
       (LIKE public."HeatingEvent" INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING STORAGE)
     ON COMMIT DROP`,
  );
  await client.query(
    'ALTER TABLE "HeatingEvent" ADD PRIMARY KEY (id)',
  );
  await client.query(
    'CREATE INDEX "HeatingEvent_deviceId_fkey" ON "HeatingEvent" ("deviceId")',
  );
  await client.query(
    `CREATE TEMP TABLE "WeatherCache"
       (LIKE public."WeatherCache" INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING STORAGE)
     ON COMMIT DROP`,
  );
  await client.query('ALTER TABLE "WeatherCache" ADD PRIMARY KEY (id)');
}

async function populateHeating(client) {
  await client.query(
    `INSERT INTO "HeatingEvent"
       (id, "deviceId", "currentTemp", "targetTemp", source, "createdAt",
        "hvacAction", "timestampStart", "isAnomaly", "userConfimed")
     SELECT d.id * 100000 + r.n,
            d.id,
            20 + (r.n % 5),
            21,
            'PERF1_BENCH',
            TIMESTAMP '2024-01-01 00:00:00',
            'HEATING_ON',
            TIMESTAMP '2024-01-01 00:00:00' + r.n * INTERVAL '1 minute' + d.id * INTERVAL '1 second',
            false,
            false
     FROM generate_series(1, 200) AS d(id)
     CROSS JOIN LATERAL generate_series(
       1,
       CASE WHEN d.id = 1 THEN 50000 WHEN d.id <= 10 THEN 2000 ELSE 200 END
     ) AS r(n)`,
  );
  await client.query('ANALYZE "HeatingEvent"');
  const result = await client.query(
    'SELECT count(*)::int AS rows, count(DISTINCT "deviceId")::int AS devices FROM "HeatingEvent"',
  );
  return result.rows[0];
}

async function runBenchmark(client) {
  await client.query('BEGIN');
  try {
    await createTempTables(client);
    const heatingDataset = await populateHeating(client);
    const heatingPhases = [];
    heatingPhases.push(
      await measureHeatingPhase(client, 'baseline_1', false),
    );
    heatingPhases.push(
      await measureHeatingPhase(client, 'candidate_1', true),
    );
    heatingPhases.push(
      await measureHeatingPhase(client, 'baseline_2', false),
    );
    heatingPhases.push(
      await measureHeatingPhase(client, 'candidate_2', true),
    );

    const weatherDatasets = {};
    const weatherPhases = {};
    for (const dataset of ['normal', 'stress']) {
      weatherDatasets[dataset] = await populateWeather(client, dataset);
      const phases = [];
      phases.push(
        await measureWeatherPhase(client, 'baseline_1', false, dataset),
      );
      phases.push(
        await measureWeatherPhase(client, 'candidate_1', true, dataset),
      );
      phases.push(
        await measureWeatherPhase(client, 'baseline_2', false, dataset),
      );
      phases.push(
        await measureWeatherPhase(client, 'candidate_2', true, dataset),
      );
      weatherPhases[dataset] = phases;
    }

    const heating = summarizeHeating(heatingPhases);
    const weatherNormal = summarizeWeather(weatherPhases.normal);
    const weatherStress = summarizeWeather(weatherPhases.stress);
    assert.ok(heating.resultsEqual, 'heating query results changed');
    assert.ok(weatherNormal.resultsEqual, 'normal weather query results changed');
    assert.ok(weatherStress.resultsEqual, 'stress weather query results changed');

    const version = await client.query('SELECT version() AS version');
    return {
      schemaVersion: 1,
      kind: 'perf1-synthetic-index-benchmark',
      generatedAt: new Date().toISOString(),
      postgresVersion: version.rows[0].version,
      disclaimer:
        'Synthetic CI measurement only; not production p95, not a production schema inspection.',
      thresholds: THRESHOLDS,
      datasets: {
        heating: heatingDataset,
        weather: weatherDatasets,
      },
      decision: {
        heatingIndexRecommended: heating.eligible,
        weatherIndexRecommended: weatherNormal.eligible,
        weatherStressOnlyIsNotSufficient: true,
      },
      evaluations: {
        heating,
        weatherNormal,
        weatherStress,
      },
      phases: {
        heating: heatingPhases,
        weather: weatherPhases,
      },
    };
  } finally {
    await client.query('ROLLBACK');
  }
}

function printSummary(report) {
  const lines = [
    '[perf1] synthetic CI benchmark completed; no public tables were changed',
    `[perf1] heating: recommended=${report.decision.heatingIndexRecommended} readImprovement=${report.evaluations.heating.readImprovementPct.toFixed(1)}% writeRegression=${report.evaluations.heating.writeRegressionPct.toFixed(1)}%`,
    `[perf1] weather normal: recommended=${report.decision.weatherIndexRecommended} readImprovement=${report.evaluations.weatherNormal.readImprovementPct.toFixed(1)}% writeRegression=${report.evaluations.weatherNormal.writeRegressionPct.toFixed(1)}%`,
    `[perf1] weather stress: eligible=${report.evaluations.weatherStress.eligible}; stress alone is not sufficient`,
  ];
  for (const line of lines) console.log(line);
  if (process.env.GITHUB_ACTIONS === 'true') {
    const compact = {};
    for (const key of ['heating', 'weatherNormal', 'weatherStress']) {
      const e = report.evaluations[key];
      compact[key] = {
        eligible: e.eligible,
        reasons: e.reasons,
        readBeforeP95Ms: e.beforeReadP95Ms,
        readAfterP95Ms: e.afterReadP95Ms,
        writeBeforeP95Ms: e.beforeWriteP95Ms,
        writeAfterP95Ms: e.afterWriteP95Ms,
        readImprovementPct: e.readImprovementPct,
        writeRegressionPct: e.writeRegressionPct,
        buffersBefore: e.beforeBufferBlocks,
        buffersAfter: e.afterBufferBlocks,
        sortBefore: e.beforeSortCount,
        sortAfter: e.afterSortCount,
        candidateIndexUsed: e.afterUsesCandidateIndex,
      };
    }
    console.log(
      `::notice title=PERF-1 measurements::${JSON.stringify(compact)}`,
    );
  }
}

function selfTest() {
  assert.equal(percentile([10, 1, 2, 3, 4], 95), 10);
  assert.equal(percentile([1, 2, 3, 4], 50), 2);
  assert.throws(() => percentile([], 95));
  assert.throws(() => percentile([1], 0));
  const plan = summarizePlan([
    {
      Plan: {
        'Node Type': 'Limit',
        'Shared Hit Blocks': 5,
        'Shared Read Blocks': 2,
        'Local Hit Blocks': 3,
        'Local Read Blocks': 1,
        Plans: [
          {
            'Node Type': 'Sort',
            Plans: [
              {
                'Node Type': 'Index Scan',
                'Index Name': 'candidate_idx',
                'Shared Hit Blocks': 4,
              },
            ],
          },
        ],
      },
      'Planning Time': 0.1,
      'Execution Time': 0.2,
    },
  ]);
  assert.equal(plan.sortCount, 1);
  assert.ok(plan.indexNames.includes('candidate_idx'));
  assert.equal(plan.bufferBlocks, 11);
  assert.equal(plan.localHitBlocks, 3);
  assert.equal(plan.localReadBlocks, 1);
  const good = evaluateCandidate({
    beforeReadP95Ms: 10,
    afterReadP95Ms: 5,
    beforeWriteP95Ms: 2,
    afterWriteP95Ms: 2.1,
    beforeBufferBlocks: 100,
    afterBufferBlocks: 10,
    beforeSortCount: 1,
    afterSortCount: 0,
    afterUsesCandidateIndex: true,
    resultsEqual: true,
  });
  assert.equal(good.eligible, true);
  const bad = evaluateCandidate({
    ...good,
    beforeReadP95Ms: 10,
    afterReadP95Ms: 9.5,
    afterWriteP95Ms: 3,
    afterUsesCandidateIndex: false,
    resultsEqual: false,
  });
  assert.equal(bad.eligible, false);
  assert.ok(bad.reasons.includes('query_results_changed'));
  assert.ok(bad.reasons.includes('candidate_index_not_used'));
  assert.ok(bad.reasons.includes('read_p95_improvement_below_threshold'));
  assert.ok(bad.reasons.includes('write_p95_regression_above_threshold'));
  const ciEnv = {
    GITHUB_ACTIONS: 'true',
    GITHUB_REF: ALLOWED_REFS[1],
    AUDIT_DISPOSABLE_POSTGRES: '1',
    NODE_ENV: 'test',
    DATABASE_HOST: '127.0.0.1',
    DATABASE_PORT: '5432',
    DATABASE_NAME: 'audit',
    DATABASE_USER: 'audit',
    RUNNER_TEMP: '/tmp/runner',
  };
  assert.equal(isDisposableCi(ciEnv, ['--ci']), true);
  assert.equal(isDisposableCi({ ...ciEnv, NODE_ENV: 'production' }, ['--ci']), false);
  assert.equal(isDisposableCi({ ...ciEnv, DATABASE_NAME: 'prod' }, ['--ci']), false);
  assert.equal(isDisposableCi(ciEnv, []), false);
  console.log('[perf1] self-test passed');
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) {
    console.log(
      [
        'Usage: node scripts/audit/perf1_index_benchmark.cjs --ci | --self-test',
        'PERF-1 synthetic index benchmark. --ci is restricted to the disposable GitHub Actions PostgreSQL service.',
        'Creates TEMP tables, measures baseline/candidate indexes in ABBA order, writes a JSON artifact, then rolls back.',
        'Does not inspect or modify production data. Synthetic CI results are not production p95 claims.',
      ].join('\n'),
    );
    return 0;
  }
  if (argv.includes('--self-test')) {
    selfTest();
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
    await client.query("SET statement_timeout = '120s'");
    await client.query("SET lock_timeout = '5s'");
    const report = await runBenchmark(client);
    const outputPath = path.join(
      process.env.RUNNER_TEMP,
      'perf1-index-benchmark.json',
    );
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    printSummary(report);
    console.log(`[perf1] report written to ${outputPath}`);
    return 0;
  } finally {
    await client.end();
  }
}

module.exports = {
  ALLOWED_REFS,
  THRESHOLDS,
  INDEXES,
  QUERIES,
  isDisposableCi,
  percentile,
  timingStats,
  summarizePlan,
  evaluateCandidate,
  stableHash,
};

if (require.main === module) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`[perf1] benchmark failed: ${error.message}`);
      process.exitCode = 1;
    });
}
