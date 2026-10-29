#!/usr/bin/env node
/* Public upstream SDK fixture, actual installed openmeteo parser; stubbed network only. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/openmeteo_fixture_replay.cjs\nDekodira javni upstream FlatBuffers testni fixture koristeći instalirani openmeteo SDK i lažni fetch; bez mrežnog poziva i bez produkcijskih podataka. Fixture sadrži samo satnu temperaturu, ne sunrise/sunset niti potpuni odgovor korišten u aplikaciji.');
  process.exit(0);
}
if (process.argv.length !== 2) { console.error('Nepoznat argument; koristite --help'); process.exit(2); }
const root = path.resolve(__dirname, '../..');
const bytes = fs.readFileSync(path.join(root, 'scripts/audit/fixtures/openmeteo-sdk-hourly.flatbuffers'));
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), '4ac0f695e5cf3d71436a0ae14ffbecf0f376a7db9b8ca153486b6a90ac3c657d');
const realFetch = global.fetch;
let calls = 0;
global.fetch = async () => { calls++; return new Response(bytes, {status:200}); };
const { fetchWeatherApi } = require(path.join(root, 'backend/node_modules/openmeteo'));
async function main() {
  try {
    const responses = await fetchWeatherApi('https://offline.invalid/forecast', {hourly:'temperature_2m'});
    assert.equal(calls, 1);
    assert.equal(responses.length, 2);
    const hourly = responses[0].hourly();
    const hourly2 = responses[1].hourly();
    assert.ok(hourly && hourly2);
    assert.equal(hourly.variablesLength(), 1);
    const values = hourly.variables(0).valuesArray();
    const values2 = hourly2.variables(0).valuesArray();
    assert.equal(values.length, 168); assert.equal(values2.length, 168);
    assert.ok(Math.abs(values[0] - 10.6455) < 0.0001);
    assert.ok(Math.abs(values2[0] - 22.45) < 0.0001);
    assert.equal(new Date((Number(hourly.time()) + responses[0].utcOffsetSeconds()) * 1000).toISOString(), '2023-11-02T00:00:00.000Z');
    assert.equal(responses[0].daily(), null);
    console.log(JSON.stringify({scope:'public upstream SDK fixture; real installed parser, stubbed fetch, no network', responseCount:responses.length, hourlyValuesPerResponse:[values.length,values2.length], firstValuesApprox:[10.6455,22.45], firstHourWithOffset:'2023-11-02T00:00:00.000Z', dailySectionPresent:false, sunriseSunsetVerified:false}, null, 2));
  } finally { global.fetch = realFetch; }
}
main().catch(() => { console.error('Dekodiranje fixturea nije uspjelo; provjerite SDK i hash.'); process.exitCode = 1; });
