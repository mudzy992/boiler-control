#!/usr/bin/env node
/**
 * F4.5 — DA LI SE BROJ MIJENJA USRED DANA (read-only)
 *
 * Tvrdnja koja se mjeri: **koliko puta se polazna koju korisnik vidi promijeni
 * za isti dan.** Plan (F4.5) tvrdi da `/boiler/sync` i `ThermostatPoll` ne
 * smiju zvati krivu usred dana i da umjesto toga treba vraćati zapisani
 * `DailyRecord.proposedFlowTemp`. Prije nego se to dirne, mora se znati koliko
 * problema zaista postoji — inače se mijenja proizvodni kod na osnovu mišljenja.
 *
 * **Zašto `params.formulaDriftC` a ne poređenje dvaju poziva.** Skripta ne
 * računa formulu (to bi značilo da mjeri svoju kopiju, a ne proizvodni kod).
 * Čita broj koji je dashboard **već izračunao i prikazao**: `formulaDriftC` je
 * razlika između jutarnjeg predloga i onoga što formula daje sada. Ako je to
 * polje nula na svakom danu, kriva i jutarnji predlog se ne razilaze — i tada
 * F4.5 ne mijenja ništa što korisnik vidi.
 *
 * **Šta se mjeri, tri odvojene stvari:**
 *
 * 1. **koliko dana ima zapisan drift** — pokrivenost mjerenja. Ako je nula,
 *    nema se šta zaključiti i to se imenuje brojem, ne riječima.
 * 2. **|drift| po danu** — koliko se broj razlikuje. 0,05 K je zaokruživanje;
 *    4 K je drugi broj na ekranu.
 * 3. **koliko dana prelazi prag 0,5 K** — tek iznad toga korisnik vidi razliku
 *    na displeju kotla (prikaz je na 0,5 °C).
 *
 * **Šta se NE tvrdi.** Ne mjeri se koliko je od tih promjena bilo *opravdano*
 * (manjak izmjeren usred dana) — `params.formulaDriftC` ne nosi razlog. Skripta
 * mjeri veličinu problema, ne njegov uzrok; uzrok traži `shadow-report`.
 *
 * Skripta je **samo čitanje**: `DATABASE_URL_READONLY`, `SET TRANSACTION READ
 * ONLY` unutra transakcije, samo `SELECT`.
 *
 * Upotreba:
 *   DATABASE_URL_READONLY=... node scripts/formula-drift-readonly.cjs
 *   ... --json
 *   ... --days=60
 *   ... --self-test      (bez baze; provjeri klasifikaciju na sintetici)
 */
'use strict';

const { Client } = require('pg');

/** Prag iznad kojeg se razlika vidi na displeju kotla (prikaz na 0,5 °C). */
const VISIBLE_C = 0.5;

if (process.argv.includes('--help')) {
  console.log(`Upotreba: DATABASE_URL_READONLY=... node scripts/formula-drift-readonly.cjs [opcije]

  --days=N         koliko dana unazad (zadano 60)
  --json           mašinski čitljiv izlaz
  --self-test      provjeri klasifikaciju na sintetičkim danima, bez baze
  --help           ova poruka

Mjeri koliko se polazna koju korisnik vidi razilazi od jutarnjeg predloga
(params.formulaDriftC). Samo SELECT.`);
  process.exit(0);
}

function argValue(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const value = Number(hit.slice(name.length + 3));
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Klasifikacija dana po veličini drifta.
 *
 * Granice su namjerne: `NONE` je tačno nula (nema razlike), `ROUNDING` je
 * unutar prikaza kotla, `VISIBLE` je razlika koju korisnik može vidjeti.
 * „Blizu nule" nije kategorija — ili se poklapa ili ne.
 */
function classify(drift) {
  if (drift === null || drift === undefined) return 'MISSING';
  const abs = Math.abs(drift);
  if (abs === 0) return 'NONE';
  if (abs < VISIBLE_C) return 'ROUNDING';
  return 'VISIBLE';
}

/**
 * Sažetak nad nizom `{ localDate, driftC }`.
 *
 * Vraća i **pokrivenost** (`withDrift / total`), jer prosjek nad 3 dana od 300
 * nije nalaz nego slučajnost — a bez tog broja izlaz bi izgledao kao nalaz.
 */
function summarize(rows) {
  const total = rows.length;
  const withDrift = rows.filter((r) => classify(r.driftC) !== 'MISSING');
  const buckets = { NONE: 0, ROUNDING: 0, VISIBLE: 0 };
  for (const row of withDrift) buckets[classify(row.driftC)]++;

  const absValues = withDrift.map((r) => Math.abs(r.driftC));
  const maxAbs = absValues.length ? Math.max(...absValues) : null;
  const meanAbs = absValues.length
    ? absValues.reduce((a, b) => a + b, 0) / absValues.length
    : null;

  return {
    days: total,
    withDrift: withDrift.length,
    coverage: total === 0 ? null : withDrift.length / total,
    buckets,
    maxAbsC: maxAbs,
    meanAbsC: meanAbs,
  };
}

/**
 * Presuda. Namjerno **imenuje uzrok brojem kad nema podataka**, jer prazan
 * izlaz koji kaže „nema se šta mjeriti" ne razlikuje „nitko nije imao
 * preporuku" od „kolona se ne piše".
 */
function verdict(summary) {
  if (summary.days === 0) {
    return {
      verdict: 'NO_DAYS',
      reason: 'nijedan dan u prozoru nema DailyRecord',
    };
  }
  if (summary.withDrift === 0) {
    return {
      verdict: 'NO_DRIFT_RECORDED',
      reason:
        `${summary.days} dana, 0 sa params.formulaDriftC — ` +
        `kolona se ne piše, pa se drift ne može izmjeriti`,
    };
  }
  if (summary.buckets.VISIBLE === 0) {
    return {
      verdict: 'DRIFT_INVISIBLE',
      reason:
        `${summary.withDrift}/${summary.days} dana ima drift, ali max ` +
        `${summary.maxAbsC.toFixed(2)} K < ${VISIBLE_C} K — korisnik ne vidi razliku`,
    };
  }
  return {
    verdict: 'DRIFT_VISIBLE',
    reason:
      `${summary.buckets.VISIBLE}/${summary.withDrift} dana sa driftom prelazi ` +
      `${VISIBLE_C} K (max ${summary.maxAbsC.toFixed(2)} K) — F4.5 mijenja ono ` +
      `što korisnik vidi`,
  };
}

async function runSelfTest() {
  // Sintetika pokriva svaki ishod presude; bez ovoga bi skripta mogla biti
  // „zelena" samo zato što nikad nije vidjela nijedan slučaj.
  const cases = [
    { name: 'prazno', rows: [], expect: 'NO_DAYS' },
    {
      name: 'nema kolone',
      rows: [
        { localDate: '2026-01-01', driftC: null },
        { localDate: '2026-01-02', driftC: null },
      ],
      expect: 'NO_DRIFT_RECORDED',
    },
    {
      name: 'samo zaokruživanje',
      rows: [
        { localDate: '2026-01-01', driftC: 0.1 },
        { localDate: '2026-01-02', driftC: -0.2 },
      ],
      expect: 'DRIFT_INVISIBLE',
    },
    {
      name: 'vidljiv drift',
      rows: [
        { localDate: '2026-01-01', driftC: 3.5 },
        { localDate: '2026-01-02', driftC: 0.1 },
      ],
      expect: 'DRIFT_VISIBLE',
    },
    {
      name: 'tacno nula i vidljiv',
      rows: [
        { localDate: '2026-01-01', driftC: 0 },
        { localDate: '2026-01-02', driftC: -0.7 },
      ],
      expect: 'DRIFT_VISIBLE',
    },
  ];

  let failed = 0;
  for (const c of cases) {
    const got = verdict(summarize(c.rows));
    const ok = got.verdict === c.expect;
    if (!ok) failed++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${c.name}: ${got.verdict} (ocekivano ${c.expect})`);
  }

  // Klasifikacija pojedinacnih dana — granica mora biti tacno na pragu.
  const boundary = [
    [null, 'MISSING'],
    [0, 'NONE'],
    [0.499, 'ROUNDING'],
    [0.5, 'VISIBLE'],
    [-0.5, 'VISIBLE'],
    [4, 'VISIBLE'],
  ];
  for (const [value, expect] of boundary) {
    const got = classify(value);
    const ok = got === expect;
    if (!ok) failed++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} classify(${value}) = ${got} (ocekivano ${expect})`);
  }

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
    console.error(
      'Nema DATABASE_URL_READONLY. Skripta samo cita; postavi read-only URL.',
    );
    process.exit(2);
  }

  const days = argValue('days', 60);
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query('SET TRANSACTION READ ONLY');
    await client.query('BEGIN');

    /*
     * `params` je JSON i moze biti NULL na starim redovima — zato se drift
     * vadi iz JSON-a u SQL-u, a ne u JS-u: tako se `null` i "nema kljuca"
     * razlikuju od `0` vec na izvoru (`->>` vraca NULL za oba).
     *
     * `days` ide kao parametar, ne kao interpolacija — iako je broj, navika
     * se ne mijenja po tipu argumenta.
     */
    const { rows } = await client.query(
      `SELECT
         d."localDate" AS "localDate",
         CASE
           WHEN d.params IS NULL THEN NULL
           WHEN d.params->>'formulaDriftC' IS NULL THEN NULL
           ELSE (d.params->>'formulaDriftC')::float8
         END AS "driftC"
       FROM "DailyRecord" d
       WHERE d."localDate" >= to_char(CURRENT_DATE - ($1::int || ' days')::interval, 'YYYY-MM-DD')
       ORDER BY d."localDate"`,
      [days],
    );

    await client.query('COMMIT');

    const summary = summarize(rows);
    const decision = verdict(summary);

    if (process.argv.includes('--json')) {
      console.log(JSON.stringify({ summary, ...decision, rows: rows.length }, null, 2));
    } else {
      console.log('F4.5 — drift polazne koju korisnik vidi');
      console.log(`  prozor:            ${days} dana`);
      console.log(`  dana sa zapisom:   ${summary.days}`);
      console.log(`  sa driftom:        ${summary.withDrift}`);
      if (summary.coverage !== null) {
        console.log(`  pokrivenost:       ${(summary.coverage * 100).toFixed(1)} %`);
      }
      console.log(
        `  nula / zaokruzeno / vidljivo: ${summary.buckets.NONE} / ` +
          `${summary.buckets.ROUNDING} / ${summary.buckets.VISIBLE}`,
      );
      if (summary.maxAbsC !== null) {
        console.log(
          `  |drift| max/prosjek:  ${summary.maxAbsC.toFixed(2)} K / ` +
            `${summary.meanAbsC.toFixed(2)} K`,
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
