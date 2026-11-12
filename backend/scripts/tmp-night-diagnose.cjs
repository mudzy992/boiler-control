#!/usr/bin/env node
/**
 * Dijagnostika: koliko uzoraka po danu postoji i odakle dolazi `nightMinC`.
 *
 * Privremena skripta za odgovor na jedno pitanje: **zašto F3.4 nema dana**, iako
 * `nightMinC` postoji na 302 dana. Moguća su tri uzroka i razlikuju se po
 * brojevima, ne po mišljenju:
 *
 *   1. uzoraka u noći nema (pa rezerva ne može ništa) — `samples` ≈ 0;
 *   2. uzoraka ima, ali van 22–06 (dan) — `nightSamples` ≈ 0 uz `samples` > 0;
 *   3. `nightMinC` je iz prognoze, a mjerenje nikad nije upisano — vidi se po
 *      `nightMinSource` / `modelVersion` i po tome što `outcome` fali.
 *
 * Samo SELECT. Briše se poslije odgovora; nije dio mjernog seta.
 */
'use strict';

const { Client } = require('pg');
const url = process.env.DATABASE_URL_READONLY;
if (!url) {
  console.error('DATABASE_URL_READONLY nije postavljen.');
  process.exit(2);
}

const SQL = `
  SELECT r."modelVersion",
         (r."nightMinOutdoorMeasuredC" IS NOT NULL) AS "hasMeasured",
         (r."outcomeAt" IS NOT NULL)                 AS "hasOutcome",
         count(*)::int AS days,
         min(r."localDate") AS "firstDay",
         max(r."localDate") AS "lastDay",
         count(*) FILTER (WHERE o."samples" > 0)::int     AS "daysWithSamples",
         round(avg(o."samples"))::int                     AS "avgSamples",
         round(avg(o."nightSamples"))::int                AS "avgNightSamples"
    FROM "DailyRecord" r
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS "samples",
             count(*) FILTER (
               WHERE (x."at" AT TIME ZONE 'Europe/Sarajevo')::time >= '22:00'
                  OR (x."at" AT TIME ZONE 'Europe/Sarajevo')::time <  '06:00'
             )::int AS "nightSamples"
        FROM "ThermostatObservation" x
       WHERE x."homeProfileId" = r."homeProfileId"
         AND to_char(x."at" AT TIME ZONE 'Europe/Sarajevo', 'YYYY-MM-DD') = r."localDate"
    ) o ON true
   GROUP BY 1, 2, 3
   ORDER BY 1, 2, 3
`;

async function main() {
  const client = new Client({ connectionString: url, ssl: false });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET TRANSACTION READ ONLY');
    const { rows } = await client.query(SQL);
    await client.query('COMMIT');

    console.log('| modelVersion | hasMeasured | hasOutcome | dana | prvi | zadnji | dana sa uzorcima | avg uzoraka | avg noćnih |');
    console.log('|---|---|---|---|---|---|---|---|---|');
    for (const r of rows) {
      console.log(
        `| ${r.modelVersion ?? '—'} | ${r.hasMeasured} | ${r.hasOutcome} | ${r.days} | ` +
          `${r.firstDay} | ${r.lastDay} | ${r.daysWithSamples} | ${r.avgSamples ?? '—'} | ${r.avgNightSamples ?? '—'} |`,
      );
    }

    // Koliko dana uopšte ima satne uzorke — nezavisno od DailyRecord.
    const obs = await client.query(`
      SELECT count(*)::int AS samples,
             count(DISTINCT to_char("at" AT TIME ZONE 'Europe/Sarajevo', 'YYYY-MM-DD'))::int AS days,
             min("at")::text AS first, max("at")::text AS last
        FROM "ThermostatObservation"
    `);
    const o = obs.rows[0];
    console.log('');
    console.log(
      `ThermostatObservation: ${o.samples} uzoraka na ${o.days} dana, ${o.first} → ${o.last}`,
    );
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
