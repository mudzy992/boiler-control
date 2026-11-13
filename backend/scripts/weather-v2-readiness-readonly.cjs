#!/usr/bin/env node
/**
 * Je li F3.4/F3.1 blokiran **samo** flagom, ili i podacima? (read-only)
 *
 * **Zašto ovo mjerenje postoji.** `WEATHER_POLL_V2` je zadano `off`, pa
 * `PollingWeatherService.getV2CurrentTemperature` vraća `null`, pa
 * `ThermostatObservation.outdoorTempC` ostaje prazan, pa
 * `DailyRecord.nightMinOutdoorMeasuredC` nikad ne nastane — i F3.4 nema šta
 * mjeriti. Ali prije nego se flag uključi, mora se znati **koliko koraka do
 * broja ima**. Tri su mogućnosti, i razlikuju se po tome šta treba uraditi:
 *
 *   FLAG_DOVOLJAN    lokacija potvrđena, keš punjenja ima put -> uključi flag
 *                    (`WEATHER_LOCATION_V2=on` + `WEATHER_POLL_V2=on`) i broj
 *                    nastaje sam
 *   TREBA_LOKACIJU   koordinate postoje, potvrde nema -> korisnik mora
 *                    potvrditi lokaciju u aplikaciji (POST …/confirm);
 *                    flag sam ne pomaže
 *   TREBA_PODATKE    nema ni koordinata -> mora se odabrati lokacija
 *                    (GET …/locations?query= pa confirm)
 *
 * **Šta se NE tvrdi.** Ne mjeri se kvalitet lokacije niti to da li je
 * provajder dostupan. Mjeri se **koliko je polja potvrde popunjeno**, jer
 * `confirmedLocation()` (`weather-v2.service.ts:86`) traži **svih osam** i
 * vraća `null` ako ijedno fali. Šest popunjenih je isto što i nula.
 *
 * Skripta je **samo čitanje**: `SET TRANSACTION READ ONLY`, samo `SELECT`.
 *
 * Upotreba:
 *   DATABASE_URL_READONLY=... node scripts/weather-v2-readiness-readonly.cjs
 *   ... --json  ... --self-test
 */
'use strict';

const { Client } = require('pg');

/** Svih osam polja koje `confirmedLocation()` traži. */
const REQUIRED_FIELDS = [
  'weatherLatitude',
  'weatherLongitude',
  'weatherTimezone',
  'weatherLocationProvider',
  'weatherLocationProviderId',
  'weatherLocationLabel',
  'weatherLocationName',
  'weatherLocationConfirmedAt',
];

if (process.argv.includes('--help')) {
  console.log(`Upotreba: DATABASE_URL_READONLY=... node scripts/weather-v2-readiness-readonly.cjs [opcije]

  --json           mašinski čitljiv izlaz
  --self-test      provjeri presudu na sintetici, bez baze
  --help           ova poruka

Mjeri koliko HomeProfile redova ima POTVRDJENU lokaciju (svih 8 polja).
Samo SELECT.`);
  process.exit(0);
}

/**
 * Presuda za jedan profil.
 *
 * Polja se ne broje kao „6 od 8 je skoro" — `confirmedLocation()` je sve ili
 * ništa, pa i presuda mora biti. Inače bi izlaz govorio „skoro sve" tamo gdje
 * kod vraća `location_confirmation_required`.
 */
function classifyProfile(row) {
  const missing = REQUIRED_FIELDS.filter((f) => {
    const value = row[f];
    return value === null || value === undefined || value === '';
  });

  if (missing.length === 0) return 'CONFIRMED';

  // Ima li barem koordinate? To razlikuje „treba potvrditi" od „treba odabrati".
  const hasCoords =
    row.weatherLatitude !== null &&
    row.weatherLatitude !== undefined &&
    row.weatherLongitude !== null &&
    row.weatherLongitude !== undefined;

  return hasCoords ? 'PARTIAL_CONFIRMATION' : 'NO_LOCATION';
}

function summarize(rows) {
  const buckets = { CONFIRMED: 0, PARTIAL_CONFIRMATION: 0, NO_LOCATION: 0 };
  const perProfile = rows.map((row) => {
    const status = classifyProfile(row);
    buckets[status]++;
    const missing = REQUIRED_FIELDS.filter((f) => {
      const value = row[f];
      return value === null || value === undefined || value === '';
    });
    return { homeProfileId: row.id, status, missing };
  });

  return {
    profiles: rows.length,
    confirmed: buckets.CONFIRMED,
    partial: buckets.PARTIAL_CONFIRMATION,
    noLocation: buckets.NO_LOCATION,
    cacheRows: rows.reduce((sum, r) => sum + Number(r.cacheRows ?? 0), 0),
    perProfile,
  };
}

function verdict(summary) {
  if (summary.profiles === 0) {
    return { verdict: 'NO_PROFILES', reason: 'nijedan HomeProfile red' };
  }
  if (summary.confirmed === summary.profiles) {
    return {
      verdict: 'FLAG_DOVOLJAN',
      reason:
        `svih ${summary.profiles} profila ima potvrđenu lokaciju (8/8 polja) — ` +
        `uključivanje WEATHER_LOCATION_V2 + WEATHER_POLL_V2 je dovoljno; ` +
        `prvi outdoorTempC nastaje u sljedećem polling ciklusu`,
    };
  }
  if (summary.partial > 0) {
    return {
      verdict: 'TREBA_POTVRDU',
      reason:
        `${summary.partial}/${summary.profiles} profila ima koordinate ali NE i ` +
        `potvrdu — flag ne pomaže, lokacija se mora potvrditi u aplikaciji ` +
        `(POST /weather/v2/locations/:id/confirm)`,
    };
  }
  return {
    verdict: 'TREBA_LOKACIJU',
    reason:
      `${summary.noLocation}/${summary.profiles} profila nema ni koordinate — ` +
      `prvo odabir lokacije (GET /weather/v2/locations/:id?query=), pa potvrda, ` +
      `pa flag`,
  };
}

/**
 * Koliko brzo broj nastaje poslije flaga.
 *
 * Nije dio presude nego rok: F3.4 traži `MIN_DAYS` noći sa i prognozom i
 * mjerenjem. Ovaj broj se **ne izmišlja** — `MIN_DAYS` se čita iz iste
 * konstante koju skripta koristi, pa se ovdje navodi kao zavisnost.
 */
const OUTCOME_NOTE =
  'poslije flaga: polling piše outdoorTempC u svakom ciklusu, ali ' +
  'nightMinOutdoorMeasuredC popunjava daily-outcome za ZAVRŠENE dane ' +
  '(outcomeAt), pa se prvi parovi noći broje od sljedeće noći — ne odmah';

async function runSelfTest() {
  let failed = 0;
  const ok = (cond, label) => {
    if (!cond) failed++;
    console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}`);
  };

  const full = Object.fromEntries(REQUIRED_FIELDS.map((f) => [f, f === 'weatherLatitude' || f === 'weatherLongitude' ? 44.2 : 'x']));

  ok(classifyProfile({ ...full, id: 1 }) === 'CONFIRMED', 'svih 8 polja -> CONFIRMED');

  // Jedno polje fali -> NIJE confirmed. Ovo je kljucna provjera: "6 od 8"
  // mora pasti u PARTIAL, ne u CONFIRMED.
  ok(
    classifyProfile({ ...full, weatherLocationConfirmedAt: null, id: 1 }) ===
      'PARTIAL_CONFIRMATION',
    'jedno polje fali -> PARTIAL (ne CONFIRMED)',
  );

  ok(
    classifyProfile({
      id: 1,
      weatherLatitude: null,
      weatherLongitude: null,
      weatherTimezone: null,
      weatherLocationProvider: null,
      weatherLocationProviderId: null,
      weatherLocationLabel: null,
      weatherLocationName: null,
      weatherLocationConfirmedAt: null,
    }) === 'NO_LOCATION',
    'nista popunjeno -> NO_LOCATION',
  );

  // Prazan string nije potvrda (kod trazi truthy).
  ok(
    classifyProfile({ ...full, weatherLocationName: '', id: 1 }) !== 'CONFIRMED',
    'prazan string nije potvrda',
  );

  const v1 = verdict(summarize([{ ...full, id: 1 }]));
  ok(v1.verdict === 'FLAG_DOVOLJAN', 'jedan potvrdjen -> FLAG_DOVOLJAN');

  const v2 = verdict(
    summarize([{ ...full, id: 1 }, { ...full, weatherLocationConfirmedAt: null, id: 2 }]),
  );
  ok(v2.verdict === 'TREBA_POTVRDU', 'jedan bez potvrde -> TREBA_POTVRDU');

  const v3 = verdict(summarize([]));
  ok(v3.verdict === 'NO_PROFILES', 'prazno -> NO_PROFILES');

  if (failed > 0) {
    console.error(`\n${failed} slucajeva nije proslo.`);
    process.exit(1);
  }
  console.log('\nSvi slucajevi prolaze.');
  process.exit(0);
}

async function main() {
  if (process.argv.includes('--self-test')) {
    await runSelfTest();
    return;
  }

  const url = process.env.DATABASE_URL_READONLY;
  if (!url) {
    console.error('Nema DATABASE_URL_READONLY. Skripta samo čita; postavi read-only URL.');
    process.exit(2);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query('SET TRANSACTION READ ONLY');
    await client.query('BEGIN');

    /*
     * `cacheRows` je podupit, ne join: `WeatherV2Cache` nije vezan za profil
     * (kešira se po lokaciji), pa bi join umnožio redove i brojevi bi lagali.
     * Ovdje je to samo informacija — keš se puni tek kad neko otvori
     * `/weather/v2/current`, a `getCachedWeather` ga **ne** dohvata sam.
     */
    const { rows } = await client.query(
      `SELECT
         h.id,
         h."weatherLatitude"::float8 AS "weatherLatitude",
         h."weatherLongitude"::float8 AS "weatherLongitude",
         h."weatherTimezone",
         h."weatherLocationProvider",
         h."weatherLocationProviderId",
         h."weatherLocationLabel",
         h."weatherLocationName",
         h."weatherLocationConfirmedAt",
         (SELECT count(*)::int FROM "WeatherV2Cache") AS "cacheRows"
       FROM "HomeProfile" h
       ORDER BY h.id`,
    );

    await client.query('COMMIT');

    const summary = summarize(rows);
    const decision = verdict(summary);

    if (process.argv.includes('--json')) {
      console.log(JSON.stringify({ summary, ...decision, note: OUTCOME_NOTE }, null, 2));
      return;
    }

    console.log(
      `  SAZETAK: ${decision.verdict} — ${summary.confirmed}/${summary.profiles} profila potvrđeno`,
    );
    console.log('WEATHER_POLL_V2 — koliko je koraka do prvog outdoorTempC');
    console.log(`  profila:                 ${summary.profiles}`);
    console.log(`  potvrđena lokacija:      ${summary.confirmed}`);
    console.log(`  koordinate bez potvrde:  ${summary.partial}`);
    console.log(`  bez lokacije:            ${summary.noLocation}`);
    console.log(`  WeatherV2Cache redova:   ${summary.cacheRows}`);

    for (const p of summary.perProfile) {
      if (p.status === 'CONFIRMED') continue;
      console.log(`    profil ${p.homeProfileId}: ${p.status} — fali ${p.missing.join(', ')}`);
    }

    console.log(`\n  ${decision.verdict}: ${decision.reason}`);
    console.log(`\n  rok: ${OUTCOME_NOTE}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
