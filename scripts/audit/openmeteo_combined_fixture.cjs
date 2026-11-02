#!/usr/bin/env node
/*
 * Deterministic, generated Open-Meteo FlatBuffers fixtures.
 *
 * These are synthetic SDK inputs, not captures from the live provider. They
 * exercise the real installed parser and the application's real mapping code
 * without network access or user/location data.
 */
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const flatbuffers = require('../../backend/node_modules/flatbuffers');
const { Aggregation } = require('../../backend/node_modules/@openmeteo/sdk/aggregation');
const { Model } = require('../../backend/node_modules/@openmeteo/sdk/model');
const { Unit } = require('../../backend/node_modules/@openmeteo/sdk/unit');
const { Variable } = require('../../backend/node_modules/@openmeteo/sdk/variable');

const ROOT = path.resolve(__dirname, '../..');
const FIXTURE_DIR = path.join(ROOT, 'scripts/audit/fixtures');
const MISSING_INT64 = 9223372036854775807n;
const HOURLY_COUNT = 168;
const DAILY_COUNT = 7;

const SCENARIOS = {
  spring: {
    filename: 'openmeteo-generated-dst-spring.flatbuffers',
    timezone: 'America/New_York',
    abbreviation: 'EST',
    utcOffsetSeconds: -5 * 3600,
    currentTime: '2026-03-08T05:30:00.000Z',
    hourlyStart: '2026-03-08T05:00:00.000Z',
    dailyStart: '2026-03-08T05:00:00.000Z',
    firstSunrise: '2026-03-08T11:30:00.000Z',
    firstSunset: '2026-03-08T22:30:00.000Z',
  },
  fall: {
    filename: 'openmeteo-generated-dst-fall.flatbuffers',
    timezone: 'America/New_York',
    abbreviation: 'EDT',
    utcOffsetSeconds: -4 * 3600,
    currentTime: '2026-11-01T04:30:00.000Z',
    hourlyStart: '2026-11-01T04:00:00.000Z',
    dailyStart: '2026-11-01T04:00:00.000Z',
    firstSunrise: '2026-11-01T11:30:00.000Z',
    firstSunset: '2026-11-01T22:00:00.000Z',
  },
};

function seconds(iso) {
  const value = Date.parse(iso) / 1000;
  assert.ok(Number.isSafeInteger(value) && value > 0, `Invalid fixture instant: ${iso}`);
  return value;
}

function floatVector(builder, values) {
  builder.startVector(4, values.length, 4);
  for (let index = values.length - 1; index >= 0; index -= 1) {
    builder.addFloat32(values[index]);
  }
  return builder.endVector();
}

function int64Vector(builder, values) {
  builder.startVector(8, values.length, 8);
  for (let index = values.length - 1; index >= 0; index -= 1) {
    builder.addInt64(values[index]);
  }
  return builder.endVector();
}

function offsetVector(builder, values) {
  builder.startVector(4, values.length, 4);
  for (let index = values.length - 1; index >= 0; index -= 1) {
    builder.addOffset(values[index]);
  }
  return builder.endVector();
}

/**
 * Field slots come from flatbuffers/weather_api.fbs in open-meteo/sdk,
 * pinned review: d806856d3e54232695a4587e54238ad5105ecab6.
 */
function variable(builder, spec) {
  const values = spec.values ? floatVector(builder, spec.values) : 0;
  const valuesInt64 = spec.valuesInt64 ? int64Vector(builder, spec.valuesInt64) : 0;
  builder.startObject(13);
  builder.addFieldInt8(0, spec.variable, 0);
  builder.addFieldInt8(1, spec.unit, 0);
  builder.addFieldFloat32(2, spec.value ?? 0, 0);
  builder.addFieldOffset(3, values, 0);
  builder.addFieldOffset(4, valuesInt64, 0);
  builder.addFieldInt8(6, spec.aggregation ?? Aggregation.none, 0);
  return builder.endObject();
}

function block(builder, start, interval, count, specs) {
  const variables = specs.map((spec) => variable(builder, spec));
  const variablesOffset = offsetVector(builder, variables);
  builder.startObject(4);
  builder.addFieldInt64(0, BigInt(start), 0n);
  builder.addFieldInt64(1, BigInt(start + count * interval), 0n);
  builder.addFieldInt32(2, interval, 0);
  builder.addFieldOffset(3, variablesOffset, 0);
  return builder.endObject();
}

function repeated(count, value) {
  return Array.from({ length: count }, () => value);
}

function scenarioSpecs(scenario) {
  const sunriseStart = seconds(scenario.firstSunrise);
  const sunsetStart = seconds(scenario.firstSunset);
  const sunrise = Array.from({ length: DAILY_COUNT }, (_, index) =>
    index === 1 ? MISSING_INT64 : BigInt(sunriseStart + index * 86400),
  );
  const sunset = Array.from({ length: DAILY_COUNT }, (_, index) =>
    BigInt(sunsetStart + index * 86400),
  );
  const temperatures = Array.from({ length: HOURLY_COUNT }, (_, index) =>
    index === 1 ? 0 : 5 + (index % 3),
  );

  return {
    current: [
      { variable: Variable.temperature, unit: Unit.celsius, value: 0 },
      { variable: Variable.relative_humidity, unit: Unit.percentage, value: 50 },
      { variable: Variable.apparent_temperature, unit: Unit.celsius, value: -1 },
      { variable: Variable.weather_code, unit: Unit.wmo_code, value: 0 },
      { variable: Variable.is_day, unit: Unit.dimensionless, value: 0 },
      { variable: Variable.wind_speed, unit: Unit.kilometres_per_hour, value: 0 },
      { variable: Variable.wind_gusts, unit: Unit.kilometres_per_hour, value: Number.NaN },
      { variable: Variable.wind_direction, unit: Unit.degree_direction, value: 180 },
      { variable: Variable.pressure_msl, unit: Unit.hectopascal, value: 1013 },
      { variable: Variable.cloud_cover, unit: Unit.percentage, value: 0 },
    ],
    hourly: [
      { variable: Variable.temperature, unit: Unit.celsius, values: temperatures },
      { variable: Variable.apparent_temperature, unit: Unit.celsius, values: repeated(HOURLY_COUNT, -2) },
      { variable: Variable.relative_humidity, unit: Unit.percentage, values: repeated(HOURLY_COUNT, 50) },
      { variable: Variable.precipitation_probability, unit: Unit.percentage, values: repeated(HOURLY_COUNT, 0) },
      { variable: Variable.precipitation, unit: Unit.millimetre, values: repeated(HOURLY_COUNT, 0) },
      { variable: Variable.weather_code, unit: Unit.wmo_code, values: repeated(HOURLY_COUNT, 2) },
      { variable: Variable.wind_speed, unit: Unit.kilometres_per_hour, values: repeated(HOURLY_COUNT, 0) },
      { variable: Variable.wind_gusts, unit: Unit.kilometres_per_hour, values: repeated(HOURLY_COUNT, Number.NaN) },
      { variable: Variable.wind_direction, unit: Unit.degree_direction, values: repeated(HOURLY_COUNT, 180) },
      { variable: Variable.is_day, unit: Unit.dimensionless, values: repeated(HOURLY_COUNT, 0) },
    ],
    daily: [
      {
        variable: Variable.temperature,
        unit: Unit.celsius,
        aggregation: Aggregation.maximum,
        values: Array.from({ length: DAILY_COUNT }, (_, index) => 10 + index),
      },
      { variable: Variable.temperature, unit: Unit.celsius, aggregation: Aggregation.minimum, values: repeated(DAILY_COUNT, 0) },
      { variable: Variable.precipitation, unit: Unit.millimetre, aggregation: Aggregation.sum, values: repeated(DAILY_COUNT, 0) },
      { variable: Variable.precipitation_probability, unit: Unit.percentage, aggregation: Aggregation.maximum, values: repeated(DAILY_COUNT, 20) },
      { variable: Variable.weather_code, unit: Unit.wmo_code, aggregation: Aggregation.dominant, values: repeated(DAILY_COUNT, 999) },
      { variable: Variable.sunrise, unit: Unit.unix_time, valuesInt64: sunrise },
      { variable: Variable.sunset, unit: Unit.unix_time, valuesInt64: sunset },
      { variable: Variable.uv_index, unit: Unit.dimensionless, aggregation: Aggregation.maximum, values: repeated(DAILY_COUNT, 0) },
    ],
  };
}

function buildFixture(name) {
  const scenario = SCENARIOS[name];
  assert.ok(scenario, `Unknown fixture scenario: ${name}`);
  const specs = scenarioSpecs(scenario);
  const currentTime = seconds(scenario.currentTime);
  const hourlyStart = seconds(scenario.hourlyStart);
  const dailyStart = seconds(scenario.dailyStart);
  const builder = new flatbuffers.Builder(16384);
  const timezone = builder.createString(scenario.timezone);
  const abbreviation = builder.createString(scenario.abbreviation);
  const current = block(builder, currentTime, 900, 1, specs.current);
  const daily = block(builder, dailyStart, 86400, DAILY_COUNT, specs.daily);
  const hourly = block(builder, hourlyStart, 3600, HOURLY_COUNT, specs.hourly);

  builder.startObject(14);
  builder.addFieldFloat32(0, 40.7128, 0);
  builder.addFieldFloat32(1, -74.006, 0);
  builder.addFieldFloat32(2, 10, 0);
  builder.addFieldInt64(4, 0n, 0n);
  builder.addFieldInt8(5, Model.best_match, 0);
  builder.addFieldInt32(6, scenario.utcOffsetSeconds, 0);
  builder.addFieldOffset(7, timezone, 0);
  builder.addFieldOffset(8, abbreviation, 0);
  builder.addFieldOffset(9, current, 0);
  builder.addFieldOffset(10, daily, 0);
  builder.addFieldOffset(11, hourly, 0);
  const root = builder.endObject();
  builder.finishSizePrefixed(root);
  return Buffer.from(builder.asUint8Array());
}

function fixturePath(name) {
  const scenario = SCENARIOS[name];
  assert.ok(scenario, `Unknown fixture scenario: ${name}`);
  return path.join(FIXTURE_DIR, scenario.filename);
}

function manifest(write) {
  return Object.keys(SCENARIOS).map((name) => {
    const expected = buildFixture(name);
    const target = fixturePath(name);
    if (write) fs.writeFileSync(target, expected);
    const actual = fs.existsSync(target) ? fs.readFileSync(target) : null;
    assert.ok(actual, `Missing fixture: ${path.relative(ROOT, target)}; run --write`);
    assert.ok(
      actual.equals(expected),
      `Generated fixture is stale: ${path.relative(ROOT, target)}; run --write`,
    );
    return {
      scenario: name,
      file: path.relative(ROOT, target),
      bytes: actual.length,
      sha256: crypto.createHash('sha256').update(actual).digest('hex'),
    };
  });
}

function printHelp() {
  console.log(
    'Upotreba: node scripts/audit/openmeteo_combined_fixture.cjs [--write]\n' +
      'Generiše i provjerava deterministic current+hourly+daily SDK fixture za proljetni i jesenji DST.\n' +
      'Bez argumenata samo provjerava da su komitovani bajtovi usklađeni sa generatorom; --write ih regeneriše.\n' +
      'Nema mreže. Ovo su sintetički SDK ulazi, ne snimci živog providera.',
  );
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }
  if (args.some((arg) => arg !== '--write')) {
    console.error('Nepoznat argument; koristite --help');
    process.exit(2);
  }
  try {
    const write = args.includes('--write');
    console.log(JSON.stringify({ status: write ? 'written' : 'in_sync', liveProviderCapture: false, fixtures: manifest(write) }, null, 2));
  } catch (error) {
    console.error(`Fixture provjera nije uspjela: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { buildFixture, fixturePath, SCENARIOS };
