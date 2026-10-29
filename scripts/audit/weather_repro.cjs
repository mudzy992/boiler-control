#!/usr/bin/env node
/* Offline reproduction using WeatherService itself, synthetic SDK responses and fake DB.
 * No network, database, secrets, or application-source modifications. */
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');
const root = path.resolve(__dirname, '../..');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/weather_repro.cjs\nPokreće stvarni WeatherService nad sintetičkim Open-Meteo SDK odgovorom i lažnom bazom, offline. Potrebne su backend npm zavisnosti (npm ci). Ne upisuje podatke niti mijenja izvore. Rezultat je deterministički JSON i exit status.');
  process.exit(0);
}
if (process.argv.length !== 2) {
  console.error('Nepoznat argument; koristite --help.');
  process.exit(2);
}
process.env.TZ = 'UTC';
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');
const RealDate = Date;
const frozenNow = RealDate.parse('2026-01-16T12:00:00Z');
global.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [frozenNow])); }
  static now() { return frozenNow; }
};
const start = RealDate.parse('2026-01-15T23:00:00Z') / 1000;
const sunrise = RealDate.parse('2026-01-16T06:00:00Z') / 1000;
const values = (base) => Float32Array.from({ length: 24 }, (_, i) => base + i);
const series = [values(0), values(100), values(10), values(1000), values(40), values(200), values(300), values(20), values(1), values(0), values(0)];
const variable = (array) => ({ valuesArray: () => array });
const response = {
  utcOffsetSeconds: () => 3600,
  current: () => ({ variables: (i) => ({ value: () => [5, 60, 1, 1][i] }) }),
  hourly: () => ({ time: () => BigInt(start), timeEnd: () => BigInt(start + 24 * 3600), interval: () => 3600, variables: (i) => variable(series[i]) }),
  daily: () => ({ variables: (i) => ({ valuesArray: () => Float32Array.from([i === 0 ? 10 : -2]), valuesInt64: () => BigInt(i === 2 ? sunrise : sunrise + 9 * 3600) }) }),
};
let forecastFails = false;
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (parent?.filename.endsWith(path.join('Weather', 'weather.service.ts'))) {
    if (request === '../../prisma/prisma.service') return { PrismaService: class PrismaService {} };
    if (request === './weather-http.adapter') return { WeatherHttpAdapter: class WeatherHttpAdapter {} };
    if (request === 'openmeteo') return { fetchWeatherApi: async () => {
      if (forecastFails) throw new Error('synthetic provider failure');
      return [response];
    } };
  }
  return originalLoad.call(this, request, parent, isMain);
};
global.fetch = async () => ({ json: async () => ({ results: [{ latitude: 43.8, longitude: 18.1 }] }) });
require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));
const { WeatherService } = require(path.join(root, 'backend/src/modules/Weather/weather.service.ts'));
const adapter = { executeWithCircuitBreaker: (fn) => fn() };
async function run() {
  let record;
  const calls = [];
  const cache = {
    findFirst: async () => record ?? null,
    delete: async () => { calls.push('delete'); record = undefined; },
    create: async ({ data }) => { calls.push('create'); record = { ...data, id: 1 }; return record; },
  };
  const service = new WeatherService({ weatherCache: cache }, adapter);
  const mapped = await service.getTodayWeather('Synthetic City');
  const currentIndex = Math.floor((frozenNow / 1000 - start) / 3600);
  const expectedApparent = series[1][currentIndex];
  const expectedWind = series[5][currentIndex];
  const actualSunrise = new RealDate(sunrise * 1000).toISOString();
  assert.equal(currentIndex, 13);
  assert.equal(mapped.feelslike, 112);
  assert.equal(expectedApparent, 113);
  assert.equal(mapped.wind_kph, 223);
  assert.equal(expectedWind, 213);
  assert.equal(mapped.sunrise, '2026-01-16T07:00:00.000Z');
  assert.equal(actualSunrise, '2026-01-16T06:00:00.000Z');
  record = { id: 2, city: 'Synthetic City', fetchedAt: new RealDate(frozenNow - 11 * 60 * 1000), temperature: 5 };
  calls.length = 0;
  forecastFails = true;
  let threw = false;
  try { await service.getTodayWeather('Synthetic City'); } catch { threw = true; }
  assert.equal(threw, true);
  assert.deepEqual(calls, ['delete']);
  assert.equal(record, undefined);
  console.log(JSON.stringify({ fixture: 'synthetic SDK instants, 24 hourly samples, UTC server, offset +01:00', currentIndex, apparent: { actual: mapped.feelslike, expectedByInstant: expectedApparent }, wind: { actual: mapped.wind_kph, expectedByInstant: expectedWind }, sunrise: { stored: mapped.sunrise, fixtureInstant: actualSunrise }, failedRefresh: { threw, dbOperations: calls, retainedStale: !!record } }, null, 2));
}
run().catch((error) => { console.error('Reprodukcija nije uspjela:', error.message); process.exitCode = 1; });
