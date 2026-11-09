#!/usr/bin/env node
/**
 * Koliko se `DailyRecord`-a može rekonstruisati iz podataka koji **već postoje**
 * — mjerenje, ne obećanje (`20`, `21`).
 *
 * Zašto zasebna skripta: prije nego se napiše ijedan backfill red, mora se
 * znati koliko dana uopšte ima podatke za svaku grupu kolona. Backfill koji
 * popuni sve redove a pola kolona izmišlja je gori od prazne tabele, jer izgleda
 * kao mjerenje.
 *
 * Skripta je **samo čitanje**: `DATABASE_URL_READONLY`, `read only` sesija na
 * strani servera, samo `SELECT`. Ne piše ništa i ne mijenja šemu.
 *
 * Izlaz: tabela po izvoru (koliko dana pokriva) + anotacije za CI.
 */

const { Client } = require('pg');

const url = process.env.DATABASE_URL_READONLY;
if (!url) {
  console.error('DATABASE_URL_READONLY nije postavljen.');
  process.exit(2);
}

const lines = [];
const out = (line = '') => {
  lines.push(line);
  console.log(line);
};
const notice = (message) => {
  const flat = String(message).replace(/[\r\n]+/g, ' ').replace(/%/g, '%25');
  console.log(`::notice::${flat}`);
};
const num = (value, digits = 0) =>
  value == null || Number.isNaN(Number(value))
    ? '—'
    : Number(value).toFixed(digits);
const day = (value) => (value == null ? '—' : new Date(value).toISOString().slice(0, 10));

async function main() {
  const client = new Client({ connectionString: url, ssl: false });
  await client.connect();

  const q = async (sql, params = []) => (await client.query(sql, params)).rows;
  const soft = async (label, sql, params = []) => {
    try {
      return await q(sql, params);
    } catch (error) {
      out(`- ⚠️ **${label}**: \`${error.message}\``);
      return null;
    }
  };

  try {
    await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
    const ro = (await q('SHOW transaction_read_only'))[0].transaction_read_only;

    out('# Koliko se `DailyRecord` može rekonstruisati (samo čitanje)');
    out();
    out(`Read-only sesija: **${ro === 'on' ? 'da' : 'NE'}**`);
    out();

    // --- šta postoji u DailyRecord sada ---------------------------------
    const existing = await soft(
      'DailyRecord',
      `SELECT count(*) AS rows, min("localDate") AS first_date, max("localDate") AS last_date
         FROM "DailyRecord"`,
    );
    if (existing) {
      out(
        `Postojeći \`DailyRecord\`: **${existing[0].rows}** redova ` +
          `(${day(existing[0].first_date)} → ${day(existing[0].last_date)})`,
      );
      out();
    }

    /*
     * Porijeklo upisanih redova — provjera da je backfill obilježio sve što je
     * napisao. Bez ovoga bi 301 rekonstruisan dan bio nerazlučiv od mjerenog, a
     * to je jedina stvar koja backfill čini poštenim.
     */
    const origins = await soft(
      'DailyRecord porijeklo',
      `SELECT coalesce("modelVersion", '(bez oznake)') AS model,
              coalesce("outcomeVersion", '(bez oznake)') AS outcome,
              count(*) AS days
         FROM "DailyRecord"
        GROUP BY 1, 2
        ORDER BY days DESC`,
    );
    if (origins) {
      for (const row of origins) {
        // `notice` da se vidi i u CI anotacijama, ne samo u logu.
        const line = `porijeklo: model=${row.model} outcome=${row.outcome} → **${row.days}** dana`;
        out(line);
        notice(line);
      }
      out();
    }

    // --- izvor 1: ciklusi grijanja --------------------------------------
    const events = await soft(
      'HeatingEvent po danu',
      `SELECT date_trunc('day', "timestampStart")::date AS d,
              count(*) AS cycles,
              sum(EXTRACT(EPOCH FROM (COALESCE("timestampEnd", "timestampStart") - "timestampStart"))) / 3600.0 AS hours,
              count(CASE WHEN "timestampEnd" IS NULL THEN 1 END) AS open_events
         FROM "HeatingEvent"
         GROUP BY 1 ORDER BY 1`,
    );
    if (events) {
      const days = events.length;
      const totalCycles = events.reduce((sum, row) => sum + Number(row.cycles), 0);
      const totalHours = events.reduce((sum, row) => sum + Number(row.hours ?? 0), 0);
      const firstDay = events[0]?.d;
      const lastDay = events[events.length - 1]?.d;
      out('## Izvor: ciklusi grijanja (`HeatingEvent`)');
      out();
      out(
        `- dana sa bar jednim ciklusom: **${days}** ` +
          `(${day(firstDay)} → ${day(lastDay)}), ${totalCycles} ciklusa, ${num(totalHours, 1)} h`,
      );
      out(
        '- iz ovoga se mogu rekonstruisati: `cycles`, `medianCycleMin`, `dutyPercent`, ' +
          '`overshootC` / `undershootC` (na osnovu `roomCurrentTemp` / `roomTargetTemp` u događaju)',
      );
      const sparse = events.filter((row) => Number(row.cycles) < 2).length;
      out(
        `- ⚠️ ${sparse} dana ima < 2 ciklusa: tu \`dutyPercent\` i medijana trajanja nisu mjerljivi ` +
          'iz ciklusa (nedostatak je `null`, ne nula)',
      );
      out();
      notice(
        `ciklusi: ${days} dana, ${totalCycles} ciklusa, ${num(totalHours, 1)} h ` +
          `(${day(firstDay)} → ${day(lastDay)})`,
      );
    }

    // --- izvor 2: kontinuirana serija -----------------------------------
    const obs = await soft(
      'ThermostatObservation po danu',
      `SELECT date_trunc('day', "at")::date AS d,
              count(*) AS samples,
              count(CASE WHEN "at"::time >= '22:00' OR "at"::time < '06:00' THEN 1 END) AS night_samples
         FROM "ThermostatObservation"
         GROUP BY 1 ORDER BY 1`,
    );
    if (obs) {
      const days = obs.length;
      const usable = obs.filter((row) => Number(row.samples) >= 2).length;
      const nights = obs.filter((row) => Number(row.night_samples) > 0).length;
      out('## Izvor: mjerenja (`ThermostatObservation`)');
      out();
      out(
        `- dana sa uzorcima: **${days}**, od toga sa ≥ 2 uzorka: **${usable}**, ` +
          `sa noćnim uzorkom: **${nights}**`,
      );
      out(
        '- iz ovoga se mogu rekonstruisati: `nightUndershootC`, `nightMinOutdoorMeasuredC`, ' +
          '`nightFlowC`, `hysteresisK` (≥ 2 prelaza u danu) i `heatRateCPerHour` (≥ 2 uzorka u ciklusu)',
      );
      out(
        `- ⚠️ sve ostalo ostaje \`null\`: serija je nastala ${day(obs[0]?.d)} i nema je za ranije dane`,
      );
      out();
      notice(`mjerenja: ${days} dana sa uzorcima, ${usable} sa ≥ 2 uzorka, ${nights} sa noćnim`);
    }

    // --- izvor 3: stare preporuke ---------------------------------------
    const recs = await soft(
      'Recommendation po danu',
      `SELECT date_trunc('day', "date")::date AS d,
              count(*) AS rows,
              count("breakdown") AS with_breakdown
         FROM "Recommendation"
         GROUP BY 1 ORDER BY 1`,
    );
    if (recs) {
      const days = recs.length;
      const withBreakdown = recs.filter((row) => Number(row.with_breakdown) > 0).length;
      out('## Izvor: stare preporuke (`Recommendation`)');
      out();
      out(
        `- dana sa preporukom: **${days}** (${day(recs[0]?.d)} → ${day(recs[recs.length - 1]?.d)}), ` +
          `sa \`breakdown\` poljem: ${withBreakdown}`,
      );
      out(
        '- iz ovoga se može preuzeti `proposedFlowTemp` i `seasonMode` za te dane — to je ' +
          '**ono što je korisnik tada stvarno dobio**, pa nije rekonstrukcija nego zapis',
      );
      out();
      notice(`stare preporuke: ${days} dana`);
    }

    // --- izvor 4: plin ---------------------------------------------------
    const gasSpacing = await soft(
      'razmak očitanja plina',
      `WITH g AS (
         SELECT "readingDate",
                "readingDate" - lag("readingDate") OVER (ORDER BY "readingDate") AS gap
           FROM "GasReading"
       )
       SELECT count(*) AS readings,
              count(gap) AS gaps,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM gap) / 86400.0) AS median_days,
              min(EXTRACT(EPOCH FROM gap) / 86400.0) AS min_days,
              max(EXTRACT(EPOCH FROM gap) / 86400.0) AS max_days
         FROM g`,
    );
    if (gasSpacing && gasSpacing[0]) {
      const row = gasSpacing[0];
      out('## Izvor: plin (`GasReading`)');
      out();
      out(
        `- ${row.readings} očitanja, ${row.gaps} razmaka; medijana **${num(row.median_days, 1)} dana** ` +
          `(min ${num(row.min_days, 1)}, max ${num(row.max_days, 1)})`,
      );
      out(
        '- ⚠️ dnevni `gasM3` iz mjesečnih očitanja je **raspoređivanje**, ne mjerenje. ' +
          'Ako se backfill uradi, mora nositi oznaku izvora — inače izgleda kao dnevno očitanje',
      );
      out();
      notice(`plin: ${row.readings} očitanja, medijana razmaka ${num(row.median_days, 1)} dana`);
    }

    // --- shema: da li su migracije stvarno primijenjene ------------------
    /*
     * Provjera koja ne mjeri podatke nego **šemu**: kolone koje kod čita a koje
     * možda ne postoje u produkciji. `SELECT` nepostojeće kolone ruši endpoint u
     * radu, a migracija koja nije primijenjena se ne vidi iz brojeva redova.
     */
    const expectedColumns = [
      ['HomeProfile', 'boilerOutputKw'],
      ['HomeProfile', 'boilerCatalogId'],
      ['HomeProfile', 'maxHeatingFlowC'],
      ['DailyRecord', 'modelVersion'],
      ['DailyRecord', 'outcomeVersion'],
      ['DailyRecord', 'origin'],
    ];
    const schemaCheck = await soft(
      'kolone iz novijih migracija',
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND (table_name, column_name) IN (${expectedColumns
            .map(([t, c]) => `('${t}', '${c}')`)
            .join(', ')})
        ORDER BY table_name, column_name`,
    );
    if (schemaCheck) {
      const present = new Set(
        schemaCheck.map((row) => `${row.table_name}.${row.column_name}`),
      );
      const missing = expectedColumns
        .map(([t, c]) => `${t}.${c}`)
        .filter((key) => !present.has(key));
      out('## Šema: kolone koje kod čita');
      out();
      out(
        missing.length === 0
          ? `- sve provjerene kolone postoje (${expectedColumns.length}/${expectedColumns.length})`
          : `- ⛔ **nedostaju**: ${missing.join(', ')} — migracija nije primijenjena, a kod je čita`,
      );
      out();
      notice(
        missing.length === 0
          ? `šema: ${expectedColumns.length}/${expectedColumns.length} kolona postoji`
          : `šema: NEDOSTAJE ${missing.join(', ')}`,
      );
    }

    // --- izvor 5: vrijeme ------------------------------------------------
    const weather = await soft(
      'WeatherCache',
      `SELECT count(*) AS rows, count(DISTINCT city) AS cities,
              min("fetchedAt") AS first_at, max("fetchedAt") AS last_at
         FROM "WeatherCache"`,
    );
    const weatherV2 = await soft(
      'WeatherV2Cache',
      `SELECT count(*) AS rows, min("fetchedAt") AS first_at, max("fetchedAt") AS last_at
         FROM "WeatherV2Cache"`,
    );
    out('## Izvor: vrijeme (`WeatherCache`, `WeatherV2Cache`)');
    out();
    if (weather && weather[0]) {
      out(
        `- \`WeatherCache\`: ${weather[0].rows} redova, ${weather[0].cities} gradova, ` +
          `${day(weather[0].first_at)} → ${day(weather[0].last_at)}`,
      );
    }
    if (weatherV2 && weatherV2[0]) {
      out(
        `- \`WeatherV2Cache\`: ${weatherV2[0].rows} redova, ` +
          `${day(weatherV2[0].first_at)} → ${day(weatherV2[0].last_at)}`,
      );
    }
    out(
      '- ⚠️ oba keša čuvaju **ono što je zadnje dohvaćeno**, ne historiju po danu. ' +
        '`nightMinC` / `dayMeanC` / `dayMaxC` za prošle dane se iz njih ne mogu izvesti ' +
        'osim za dane kad je keš stvarno bio dohvaćen',
    );
    out();

    // --- izvor 6: historija kotla ---------------------------------------
    const boiler = await soft(
      'BoilerHistory po danu',
      `SELECT date_trunc('day', "createdAt")::date AS d, count(*) AS rows
         FROM "BoilerHistory" GROUP BY 1 ORDER BY 1`,
    );
    if (boiler) {
      out('## Izvor: historija kotla (`BoilerHistory`)');
      out();
      out(
        `- dana sa zapisom: **${boiler.length}** ` +
          `(${day(boiler[0]?.d)} → ${day(boiler[boiler.length - 1]?.d)})`,
      );
      out(
        '- iz ovoga se može uzeti **stvarna** polazna koja je bila na kotlu (`actualFlowTemp`) ' +
          'i vanjska temperatura — to je `flowSetC`, ne `proposedFlowTemp`',
      );
      out();
      notice(`BoilerHistory: ${boiler.length} dana`);
    }

    out('---');
    out();
    out(
      '**Šta se ne može rekonstruisati ni iz čega:** `shadow*` kolone (odluka koja tada ' +
        'nije donesena — upisati je sada značilo bi tvrditi da je donesena), `params` ' +
        '(ulazi proračuna tada nijesu zapisani), `heatRateCPerHour` / `hysteresisK` za dane ' +
        'bez serije, i `outcomeAt` kao vrijeme mjerenja.',
    );
  } finally {
    await client.end();
  }

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    require('node:fs').appendFileSync(summary, lines.join('\n') + '\n');
  }
}

main().catch((error) => {
  console.error('Provjera pokrivenosti nije prošla:', error.message);
  process.exit(1);
});
