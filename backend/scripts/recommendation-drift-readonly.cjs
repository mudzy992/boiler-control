#!/usr/bin/env node
/**
 * F4.6 — DA LI SE PREPORUKA ZA KLIJENTE RAZILAZI S PREDLOGOM (read-only)
 *
 * Tvrdnja koja se mjeri: **`Recommendation.recommendedFlowTemp` (broj koji
 * klijenti čitaju) i `DailyRecord.proposedFlowTemp` (jutarnji predlog) nijesu
 * isti broj.**
 *
 * Dva pisca postoje i to je uzrok:
 * - `DailyRecordWriter` upisuje jutarnji predlog u oba mjesta, u istoj
 *   transakciji (`daily-record.writer.ts:654`);
 * - `HeatingRecommendationService` **prepisuje** `Recommendation` krivinom na
 *   svakom događaju grijanja (`heating.recommendation.service.ts:224/235`).
 *
 * Dakle klijent vidi posljednji pisac, a to je kriva — i to je razlika koju
 * F4.6 treba da ukloni. Prije izmjene mora se znati kolika je, inače se
 * proizvodni kod mijenja na osnovu mišljenja.
 *
 * **Grupa je `(userId, datum)`**, isti dan iz oba izvora. Poredi se samo dan
 * koji ima **oba** reda: bez jutarnjeg predloga nema s čim porediti, a to nije
 * nalaz nego nedostatak podatka.
 *
 * **Šta se mjeri:**
 * 1. **koliko dana ima oba reda** — pokrivenost; bez toga nema zaključka.
 * 2. **razlika u broju** (`recommendation − predlog`) — koliko se razišlo.
 * 3. **koliko dana prelazi 0,5 K** — prag na kojem korisnik vidi razliku.
 *
 * **Šta se NE tvrdi.** Ne mjeri se **koji** je pisac bio posljednji (to traži
 * historiju upisa, koje nema) i ne tvrdi se da je razlika greška: kriva može
 * biti bolja od jutarnjeg predloga. Mjeri se da **dva pisca daju dva broja**.
 *
 * Skripta je **samo čitanje**: `DATABASE_URL_READONLY`, `SET TRANSACTION READ
 * ONLY`, samo `SELECT`.
 *
 * Upotreba:
 *   DATABASE_URL_READONLY=... node scripts/recommendation-drift-readonly.cjs
 *   ... --days=60
 *   ... --since=YYYY-MM-DD    (za ponovno mjerenje poslije F4.6)
 *   ... --json
 *   ... --self-test
 */
'use strict';

const { Client } = require('pg');

/** Prag iznad kojeg se razlika vidi na displeju kotla (prikaz na 0,5 °C). */
const VISIBLE_C = 0.5;

if (process.argv.includes('--help')) {
  console.log(`Upotreba: DATABASE_URL_READONLY=... node scripts/recommendation-drift-readonly.cjs [opcije]

  --days=N         koliko dana unazad (zadano 60)
  --since=YYYY-MM-DD
                   mjeri samo od tog datuma (mjerenje poslije F4.6)
  --json           mašinski čitljiv izlaz
  --self-test      provjeri klasifikaciju na sintetici, bez baze
  --help           ova poruka

Mjeri razliku izmedju Recommendation.recommendedFlowTemp (broj koji klijenti
citaju) i DailyRecord.proposedFlowTemp (jutarnji predlog). Samo SELECT.`);
  process.exit(0);
}

function argValue(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const value = Number(hit.slice(name.length + 3));
  return Number.isFinite(value) ? value : fallback;
}

function sinceDate() {
  const hit = process.argv.find((a) => a.startsWith('--since='));
  if (!hit) return null;
  const raw = hit.slice('--since='.length).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    console.error(`--since mora biti YYYY-MM-DD, dobio sam "${raw}".`);
    process.exit(2);
  }
  return raw;
}

/**
 * Klasifikacija dana po razlici.
 *
 * `SAME` je jedina dobra vrijednost: dva pisca dala su isti broj. `ROUNDING` je
 * razlika unutar prikaza kotla. `VISIBLE` je razlika koju korisnik vidi.
 */
function classify(diffC) {
  if (diffC === null || diffC === undefined) return 'MISSING';
  const abs = Math.abs(diffC);
  if (abs === 0) return 'SAME';
  if (abs < VISIBLE_C) return 'ROUNDING';
  return 'VISIBLE';
}

function summarize(rows) {
  const days = rows.length;
  const buckets = { SAME: 0, ROUNDING: 0, VISIBLE: 0, MISSING: 0 };
  for (const row of rows) buckets[classify(row.diffC)]++;

  const diffs = rows
    .filter((r) => classify(r.diffC) !== 'MISSING')
    .map((r) => Math.abs(r.diffC));

  return {
    days,
    differing: buckets.ROUNDING + buckets.VISIBLE,
    ratio: days === 0 ? null : (buckets.ROUNDING + buckets.VISIBLE) / days,
    buckets,
    maxAbsC: diffs.length ? Math.max(...diffs) : null,
    meanAbsC: diffs.length
      ? diffs.reduce((a, b) => a + b, 0) / diffs.length
      : null,
  };
}

/**
 * Presuda. Prazan izlaz **imenuje uzrok brojem**, jer „nema se šta mjeriti" ne
 * razlikuje „nema preporuka" od „preporuke postoje, ali nijedan dan nema oba
 * reda" — a to su različiti problemi.
 */
function verdict(summary) {
  if (summary.days === 0) {
    return {
      verdict: 'NO_DAYS',
      reason:
        'nijedan dan nema i Recommendation i DailyRecord.proposedFlowTemp za isti dan',
    };
  }
  if (summary.buckets.MISSING === summary.days) {
    return {
      verdict: 'NO_COMPARABLE',
      reason: `${summary.days} dana, ali nijedan nema oba broja`,
    };
  }
  if (summary.differing === 0) {
    return {
      verdict: 'SAME_NUMBER',
      reason:
        `${summary.days} dana, oba pisca daju isti broj — F4.6 nema šta ` +
        `popraviti na ovom uzorku`,
    };
  }
  if (summary.buckets.VISIBLE === 0) {
    return {
      verdict: 'DIFF_INVISIBLE',
      reason:
        `${summary.differing}/${summary.days} dana se razlikuje, ali max ` +
        `${summary.maxAbsC.toFixed(2)} K < ${VISIBLE_C} K`,
    };
  }
  return {
    verdict: 'DIFF_VISIBLE',
    reason:
      `${summary.buckets.VISIBLE}/${summary.days} dana se razlikuje više od ` +
      `${VISIBLE_C} K (max ${summary.maxAbsC.toFixed(2)} K) — klijent vidi ` +
      `broj koji nije predlog`,
  };
}

async function runSelfTest() {
  const cases = [
    { name: 'prazno', rows: [], expect: 'NO_DAYS' },
    {
      name: 'nijedan uporediv',
      rows: [{ localDate: '2026-01-01', diffC: null }],
      expect: 'NO_COMPARABLE',
    },
    {
      name: 'isti broj',
      rows: [
        { localDate: '2026-01-01', diffC: 0 },
        { localDate: '2026-01-02', diffC: 0 },
      ],
      expect: 'SAME_NUMBER',
    },
    {
      name: 'samo zaokruzivanje',
      rows: [
        { localDate: '2026-01-01', diffC: 0.2 },
        { localDate: '2026-01-02', diffC: 0 },
      ],
      expect: 'DIFF_INVISIBLE',
    },
    {
      name: 'vidljiva razlika',
      rows: [
        { localDate: '2026-01-01', diffC: -3.4 },
        { localDate: '2026-01-02', diffC: 0 },
      ],
      expect: 'DIFF_VISIBLE',
    },
    {
      name: 'granica tacno na pragu',
      rows: [{ localDate: '2026-01-01', diffC: 0.5 }],
      expect: 'DIFF_VISIBLE',
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
    [0, 'SAME'],
    [0.499, 'ROUNDING'],
    [0.5, 'VISIBLE'],
    [-0.5, 'VISIBLE'],
    [null, 'MISSING'],
  ];
  for (const [value, expect] of boundary) {
    const got = classify(value);
    const ok = got === expect;
    if (!ok) failed++;
    console.log(
      `${ok ? 'OK  ' : 'FAIL'} classify(${value}) = ${got} (ocekivano ${expect})`,
    );
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

  const since = sinceDate();

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
     * Spaja se po `(userId, dan)`.
     *
     * `Recommendation.date` je timestamp (`@default(now())`), a `DailyRecord`
     * ima `localDate` kao string `YYYY-MM-DD`. Zato se datum iz `Recommendation`
     * reže na dan — poređenje timestamp-a sa stringom na dan bi inače
     * propustilo sve redove.
     *
     * Ako za isti dan ima više `Recommendation` redova (stariji upisi), uzima
     * se **posljednji** (`ORDER BY date DESC` u podupitu): to je broj koji je
     * klijent vidio na kraju dana, a to je ono što se poredi.
     */
    const { rows } = await client.query(
      `SELECT
         r."userId" AS "userId",
         r."day" AS "localDate",
         r."flow" AS "recommendationFlowC",
         d."proposedFlowTemp" AS "proposedFlowC",
         (r."flow" - d."proposedFlowTemp")::float8 AS "diffC"
       FROM (
         SELECT DISTINCT ON (x."userId", x."day")
           x."userId",
           x."day",
           x."flow"
         FROM (
           SELECT
             rc."userId",
             to_char(rc."date", 'YYYY-MM-DD') AS "day",
             rc."recommendedFlowTemp"::float8 AS "flow"
           FROM "Recommendation" rc
           WHERE rc."date" >= CURRENT_DATE - ($1::int || ' days')::interval
             AND ($2::date IS NULL OR rc."date" >= $2::date)
             AND rc."recommendedFlowTemp" IS NOT NULL
         ) x
         ORDER BY x."userId", x."day", x."flow" DESC
       ) r
       JOIN "DailyRecord" d
         ON d."userId" = r."userId"
        AND d."localDate" = r."day"
       WHERE d."proposedFlowTemp" IS NOT NULL
       ORDER BY r."day" DESC, r."userId"`,
      [days, since],
    );

    await client.query('COMMIT');

    const summary = summarize(rows);
    const decision = verdict(summary);

    if (process.argv.includes('--json')) {
      console.log(JSON.stringify({ summary, ...decision, rows: rows.length }, null, 2));
    } else {
      console.log('F4.6 — razlika izmedju preporuke (klijenti) i predloga');
      console.log(
        `  prozor:                  ${days} dana` + (since ? ` (od ${since})` : ''),
      );
      console.log(`  uporedivih dana:         ${summary.days}`);
      console.log(`  razlikuje se:            ${summary.differing}`);
      if (summary.ratio !== null) {
        console.log(`  udio:                    ${(summary.ratio * 100).toFixed(1)} %`);
      }
      console.log(
        `  isto / zaokruzeno / vidljivo: ${summary.buckets.SAME} / ` +
          `${summary.buckets.ROUNDING} / ${summary.buckets.VISIBLE}`,
      );
      if (summary.maxAbsC !== null) {
        console.log(
          `  |razlika| max/prosjek:   ${summary.maxAbsC.toFixed(2)} K / ` +
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
