#!/usr/bin/env node
/**
 * F4.8 — KOLIKO PREDLOGA JE BILO ISPOD STARE GRANICE UNOSA (read-only)
 *
 * Tvrdnja koja se mjeri: **koliko puta je predlog bio niži od 46 °C**, tj.
 * ispod donje granice koju je korisnik smio upisati do F4.8.
 *
 * Zašto je to problem: granica unosa je bila granica **krive**
 * (`SYSTEM_MIN_FLOW_C = 46`), a model daje niže — za tipičnu kuću (s = 0,9,
 * c = 1 K, cilj 22 °C) ravnotežna polazna je 34,7 pri noći na +5 °C. Ako je
 * predlog ispod granice, korisnik vidi broj koji **ne može prihvatiti** — a to
 * je ista greška kao „zadano 48 vs. predlog 47,7" iz `F13`, samo dublje.
 *
 * Mjeri se na **zapisanim predlozima**, ne na modelu: model se ne može pustiti
 * unazad kroz historiju bez ponovnog računanja, a predlozi su dokaz onoga što
 * je korisnik zaista vidio.
 *
 * **Šta se NE tvrdi.** Ne tvrdi se da bi svaki predlog ispod 46 bio ispravan —
 * neki su bili pogrešni iz drugih razloga. Mjeri se **koliko ih je bilo**, jer
 * to je veličina problema koji F4.8 rješava.
 *
 * Skripta je **samo čitanje**: `DATABASE_URL_READONLY`, `SET TRANSACTION READ
 * ONLY`, samo `SELECT`.
 *
 * Upotreba:
 *   DATABASE_URL_READONLY=... node scripts/flow-floor-gap-readonly.cjs
 *   ... --days=60  ... --json  ... --self-test
 */
'use strict';

const { Client } = require('pg');

/** Donja granica unosa do F4.8 (granica krive, `SYSTEM_MIN_FLOW_C`). */
const OLD_FLOOR_C = 46;

if (process.argv.includes('--help')) {
  console.log(`Upotreba: DATABASE_URL_READONLY=... node scripts/flow-floor-gap-readonly.cjs [opcije]

  --days=N         koliko dana unazad (zadano 60)
  --json           mašinski čitljiv izlaz
  --self-test      provjeri klasifikaciju na sintetici, bez baze
  --help           ova poruka

Mjeri koliko je zapisanih predloga bilo ispod donje granice unosa (46 °C).
Samo SELECT.`);
  process.exit(0);
}

function argValue(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const value = Number(hit.slice(name.length + 3));
  return Number.isFinite(value) ? value : fallback;
}

/** Klasifikacija po tome je li predlog ispod stare granice. */
function classify(flowC) {
  if (flowC === null || flowC === undefined) return 'MISSING';
  if (flowC < OLD_FLOOR_C) return 'BELOW_OLD_FLOOR';
  return 'AT_OR_ABOVE';
}

function summarize(rows) {
  const total = rows.length;
  const buckets = { BELOW_OLD_FLOOR: 0, AT_OR_ABOVE: 0, MISSING: 0 };
  for (const row of rows) buckets[classify(row.flowC)]++;

  const valid = total - buckets.MISSING;
  const below = rows
    .filter((r) => classify(r.flowC) === 'BELOW_OLD_FLOOR')
    .map((r) => r.flowC);

  return {
    days: total,
    valid,
    belowOldFloor: buckets.BELOW_OLD_FLOOR,
    ratio: valid === 0 ? null : buckets.BELOW_OLD_FLOOR / valid,
    minC: below.length ? Math.min(...below) : null,
    maxBelowC: below.length ? Math.max(...below) : null,
    /** Koliko je najniži predlog ispod stare granice. */
    maxGapK: below.length ? OLD_FLOOR_C - Math.min(...below) : null,
  };
}

/**
 * Presuda. Prazan izlaz **imenuje uzrok brojem**: „nema predloga" i „svi
 * predlozi su iznad granice" su različiti nalazi.
 */
function verdict(summary) {
  if (summary.days === 0) {
    return { verdict: 'NO_DAYS', reason: 'nijedan DailyRecord.proposedFlowTemp u prozoru' };
  }
  if (summary.valid === 0) {
    return { verdict: 'NO_PROPOSALS', reason: `${summary.days} dana, nijedan sa predlogom` };
  }
  if (summary.belowOldFloor === 0) {
    return {
      verdict: 'NONE_BELOW',
      reason:
        `${summary.valid} predloga, nijedan ispod ${OLD_FLOOR_C} °C — ` +
        `F4.8 nema šta popraviti na ovom uzorku`,
    };
  }
  return {
    verdict: 'BELOW_FLOOR_EXISTS',
    reason:
      `${summary.belowOldFloor}/${summary.valid} predloga je ispod ${OLD_FLOOR_C} °C ` +
      `(najniži ${summary.minC.toFixed(1)} °C, do ${summary.maxGapK.toFixed(1)} K ispod ` +
      `granice) — korisnik nije mogao prihvatiti vlastiti predlog`,
  };
}

async function runSelfTest() {
  const cases = [
    { name: 'prazno', rows: [], expect: 'NO_DAYS' },
    { name: 'nema predloga', rows: [{ flowC: null }], expect: 'NO_PROPOSALS' },
    {
      name: 'svi iznad',
      rows: [{ flowC: 50 }, { flowC: 46 }],
      expect: 'NONE_BELOW',
    },
    {
      name: 'ima ispod',
      rows: [{ flowC: 34.7 }, { flowC: 50 }],
      expect: 'BELOW_FLOOR_EXISTS',
    },
    {
      name: 'granica tacno 46 nije ispod',
      rows: [{ flowC: 46 }],
      expect: 'NONE_BELOW',
    },
  ];

  let failed = 0;
  for (const c of cases) {
    const got = verdict(summarize(c.rows));
    const ok = got.verdict === c.expect;
    if (!ok) failed++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${c.name}: ${got.verdict} (ocekivano ${c.expect})`);
  }

  const boundary = [
    [46, 'AT_OR_ABOVE'],
    [45.9, 'BELOW_OLD_FLOOR'],
    [34.7, 'BELOW_OLD_FLOOR'],
    [null, 'MISSING'],
  ];
  for (const [value, expect] of boundary) {
    const got = classify(value);
    const ok = got === expect;
    if (!ok) failed++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} classify(${value}) = ${got} (ocekivano ${expect})`);
  }

  // `maxGapK` mora biti razlika do NAJNIŽEG, ne do prosjeka.
  const s = summarize([{ flowC: 34.7 }, { flowC: 44 }]);
  const gapOk = Math.abs(s.maxGapK - (46 - 34.7)) < 1e-9;
  if (!gapOk) failed++;
  console.log(`${gapOk ? 'OK  ' : 'FAIL'} maxGapK = ${s.maxGapK} (ocekivano ${(46 - 34.7).toFixed(1)})`);

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
    console.error('Nema DATABASE_URL_READONLY. Skripta samo cita; postavi read-only URL.');
    process.exit(2);
  }

  const days = argValue('days', 60);
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query('SET TRANSACTION READ ONLY');
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT d."proposedFlowTemp"::float8 AS "flowC"
       FROM "DailyRecord" d
       WHERE d."localDate" >= to_char(CURRENT_DATE - ($1::int || ' days')::interval, 'YYYY-MM-DD')
         AND d."proposedFlowTemp" IS NOT NULL
       ORDER BY d."localDate"`,
      [days],
    );

    await client.query('COMMIT');

    const summary = summarize(rows);
    const decision = verdict(summary);

    if (process.argv.includes('--json')) {
      console.log(JSON.stringify({ summary, ...decision }, null, 2));
    } else {
      console.log('F4.8 — predlozi ispod stare granice unosa');
      console.log(`  prozor:                 ${days} dana`);
      console.log(`  predloga:               ${summary.valid}`);
      console.log(`  ispod ${OLD_FLOOR_C} °C:            ${summary.belowOldFloor}`);
      if (summary.ratio !== null) {
        console.log(`  udio:                   ${(summary.ratio * 100).toFixed(1)} %`);
      }
      if (summary.minC !== null) {
        console.log(
          `  najnizi / max razlika:  ${summary.minC.toFixed(1)} °C / ` +
            `${summary.maxGapK.toFixed(1)} K ispod granice`,
        );
      }
      console.log(`\n  ${decision.verdict}: ${decision.reason}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
