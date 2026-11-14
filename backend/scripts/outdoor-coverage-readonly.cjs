#!/usr/bin/env node
/**
 * Koliko dana model kuće gubi zbog praznog `outdoorTempC`? (read-only)
 *
 * **Zašto ovo mjerenje ide prije koda.** Predloženo je pozadinsko
 * osvježavanje keša. Prije nego se doda mrežni poziv u raspored, mora se
 * znati **koliko je toga već izgubljeno**, brojem. Bez toga je popravka
 * objašnjena argumentom („keš nema podataka, dakle…"), a ne dokazom — a
 * upravo je to način na koji su nastala tri pogrešna nalaza u `§10.29`/`§10.30`.
 *
 * **Lanac koji se mjeri** (dokazan čitanjem koda):
 *
 *   ThermostatObservation.outdoorTempC      <- polling čita KEŠ
 *   DailyRecord.nightMinOutdoorMeasuredC    <- day-outcome za završene dane
 *   HomeModel.slopeS / internalGainC        <- daily-balance, odbija NO_OUTDOOR
 *   equilibrium-flow F_eq                   <- slopeS je ulaz
 *   predlog polazne
 *
 * **Šta se NE tvrdi.** Ne mjeri se „koliko bi predloga bilo bolje" — to bi
 * zahtijevalo ponovno računanje modela na drugim podacima. Mjeri se **koliko
 * je dana odbijeno** i **koliko uzoraka nema `outdoorTempC`**, jer je to
 * veličina problema koji popravka rješava.
 *
 * Skripta je **samo čitanje**: `SET TRANSACTION READ ONLY`, samo `SELECT`.
 *
 * Upotreba:
 *   DATABASE_URL_READONLY=... node scripts/outdoor-coverage-readonly.cjs
 *   ... --days=30  ... --json  ... --self-test
 */
'use strict';

const { Client } = require('pg');

if (process.argv.includes('--help')) {
  console.log(`Upotreba: DATABASE_URL_READONLY=... node scripts/outdoor-coverage-readonly.cjs [opcije]

  --days=N         koliko dana unazad (zadano 30)
  --json           mašinski čitljiv izlaz
  --self-test      provjeri klasifikaciju na sintetici, bez baze
  --help           ova poruka

Mjeri koliko dana model kuce gubi zbog praznog outdoorTempC. Samo SELECT.`);
  process.exit(0);
}

function argValue(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const value = Number(hit.slice(name.length + 3));
  return Number.isFinite(value) ? value : fallback;
}

/** Prag iznad kojeg se gubitak dana smatra značajnim. */
const MEANINGFUL_DAYS = 3;

/**
 * Presuda nad pokrivenošću uzoraka.
 *
 * Odnos je bitan, ne pojedinačan broj: ako uzoraka **uopšte** nema, pokrivenost
 * od 0 % nije nalaz o kešu nego o tome da se niz ne piše. Zato se prvo
 * provjerava ima li uzoraka, pa onda koliko ih ima outdoor.
 */
function classifySamples(samples, withOutdoor) {
  if (samples === 0) return 'NO_SAMPLES';
  if (withOutdoor === 0) return 'NO_OUTDOOR_AT_ALL';
  const ratio = withOutdoor / samples;
  if (ratio < 0.5) return 'SPARSE_OUTDOOR';
  return 'OUTDOOR_COVERED';
}

function verdict(summary) {
  if (summary.samples === 0) {
    return {
      verdict: 'NEMA_UZORAKA',
      reason: 'nijedan ThermostatObservation u prozoru — niz se ne piše',
    };
  }
  if (summary.withOutdoor === 0) {
    return {
      verdict: 'KES_NIKAD_NIJE_SVJEZ',
      reason:
        `${summary.samples} uzoraka, nijedan sa outdoorTempC — keš nije bio ` +
        `svjež nijednom u prozoru; popravka nema šta izmjeriti jer podatka nema`,
    };
  }
  if (summary.rejectedNoOutdoor >= MEANINGFUL_DAYS) {
    return {
      verdict: 'GUBITAK_JE_ZNACAJAN',
      reason:
        `${summary.rejectedNoOutdoor}/${summary.rejectedTotal} odbijenih dana je ` +
        `zbog NO_OUTDOOR (${summary.coveragePercent} % uzoraka ima outdoorTempC) — ` +
        `popravka ima mjerljiv razlog`,
    };
  }
  if (summary.rejectedNoOutdoor > 0) {
    return {
      verdict: 'GUBITAK_JE_MALI',
      reason:
        `${summary.rejectedNoOutdoor} odbijenih dana zbog NO_OUTDOOR (prag ` +
        `${MEANINGFUL_DAYS}) — popravka se odgađa, ali gubitak postoji`,
    };
  }
  return {
    verdict: 'NEMA_GUBITKA',
    reason:
      `${summary.samples} uzoraka, ${summary.coveragePercent} % ima outdoorTempC; ` +
      `0 odbijenih dana zbog NO_OUTDOOR — popravka nije potrebna`,
  };
}

async function runSelfTest() {
  let failed = 0;
  const ok = (cond, label) => {
    if (!cond) failed++;
    console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}`);
  };

  ok(classifySamples(0, 0) === 'NO_SAMPLES', 'nema uzoraka -> NO_SAMPLES');
  ok(classifySamples(100, 0) === 'NO_OUTDOOR_AT_ALL', 'uzorci bez outdoor -> NO_OUTDOOR_AT_ALL');
  ok(classifySamples(100, 10) === 'SPARSE_OUTDOOR', '10 % pokriveno -> SPARSE_OUTDOOR');
  ok(classifySamples(100, 80) === 'OUTDOOR_COVERED', '80 % pokriveno -> OUTDOOR_COVERED');

  const cases = [
    {
      name: 'nema uzoraka',
      s: { samples: 0, withOutdoor: 0, rejectedNoOutdoor: 0, rejectedTotal: 0, coveragePercent: 0 },
      expect: 'NEMA_UZORAKA',
    },
    {
      // Stvarno stanje 14.11.: 1463 uzorka, 1 sat sa outdoor.
      name: 'kes nikad svjez',
      s: { samples: 1463, withOutdoor: 0, rejectedNoOutdoor: 3, rejectedTotal: 6, coveragePercent: 0 },
      expect: 'KES_NIKAD_NIJE_SVJEZ',
    },
    {
      name: 'gubitak znacajan',
      s: { samples: 1000, withOutdoor: 700, rejectedNoOutdoor: 4, rejectedTotal: 6, coveragePercent: 70 },
      expect: 'GUBITAK_JE_ZNACAJAN',
    },
    {
      name: 'gubitak mali',
      s: { samples: 1000, withOutdoor: 900, rejectedNoOutdoor: 1, rejectedTotal: 8, coveragePercent: 90 },
      expect: 'GUBITAK_JE_MALI',
    },
    {
      name: 'nema gubitka',
      s: { samples: 1000, withOutdoor: 990, rejectedNoOutdoor: 0, rejectedTotal: 8, coveragePercent: 99 },
      expect: 'NEMA_GUBITKA',
    },
  ];
  for (const c of cases) {
    const got = verdict(c.s);
    const good = got.verdict === c.expect;
    if (!good) failed++;
    console.log(`${good ? 'OK  ' : 'FAIL'} ${c.name}: ${got.verdict} (ocekivano ${c.expect})`);
  }

  // Presuda mora gledati ODNOS, ne apsolutni broj uzoraka: 10 000 uzoraka
  // bez outdoor nije "bolje" od 100 sa outdoor.
  const big = verdict({ samples: 10000, withOutdoor: 0, rejectedNoOutdoor: 3, rejectedTotal: 6, coveragePercent: 0 });
  ok(big.verdict === 'KES_NIKAD_NIJE_SVJEZ', 'mnogo uzoraka bez outdoor nije poboljsanje');

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

  const days = argValue('days', 30);
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query('SET TRANSACTION READ ONLY');
    await client.query('BEGIN');

    const { rows: sampleRows } = await client.query(
      `SELECT
         count(*)::int AS "samples",
         count(*) FILTER (WHERE "outdoorTempC" IS NOT NULL)::int AS "withOutdoor"
       FROM "ThermostatObservation"
       WHERE "at" >= now() - ($1::int || ' days')::interval`,
      [days],
    );

    /*
     * `skipReason` je razlog zašto predlog NIJE nastao. `NO_OUTDOOR` je
     * doslovno ime razloga iz `daily-balance.ts:133`, pa se broji po njemu —
     * a ne po pretpostavci šta bi razlog mogao biti.
     */
    const { rows: skipRows } = await client.query(
      `SELECT
         coalesce("skipReason", '(bez razloga)') AS "reason",
         count(*)::int AS "days"
       FROM "DailyRecord"
       WHERE "localDate" >= to_char(CURRENT_DATE - ($1::int || ' days')::interval, 'YYYY-MM-DD')
         AND "proposedFlowTemp" IS NULL
       GROUP BY 1
       ORDER BY 2 DESC`,
      [days],
    );

    const { rows: modelRows } = await client.query(
      `SELECT
         count(*)::int AS "models",
         count(*) FILTER (WHERE "slopeS" IS NULL)::int AS "withoutSlope",
         count(*) FILTER (WHERE "days" = 0)::int AS "noDays",
         coalesce(sum("days"), 0)::int AS "modelDays"
       FROM "HomeModel"`,
    );

    await client.query('COMMIT');

    const samples = sampleRows[0]?.samples ?? 0;
    const withOutdoor = sampleRows[0]?.withOutdoor ?? 0;
    const rejectedTotal = skipRows.reduce((sum, r) => sum + r.days, 0);
    const rejectedNoOutdoor =
      skipRows.find((r) => r.reason === 'NO_OUTDOOR')?.days ?? 0;

    const summary = {
      samples,
      withOutdoor,
      coveragePercent: samples === 0 ? 0 : Math.round((withOutdoor / samples) * 1000) / 10,
      rejectedTotal,
      rejectedNoOutdoor,
      skipReasons: skipRows,
      models: modelRows[0]?.models ?? 0,
      modelsWithoutSlope: modelRows[0]?.withoutSlope ?? 0,
      modelsNoDays: modelRows[0]?.noDays ?? 0,
      modelDays: modelRows[0]?.modelDays ?? 0,
      sampleClass: classifySamples(samples, withOutdoor),
    };
    const decision = verdict(summary);

    if (process.argv.includes('--json')) {
      console.log(JSON.stringify({ summary, ...decision }, null, 2));
      return;
    }

    console.log(
      `  SAZETAK: ${decision.verdict} — outdoorTempC ${summary.coveragePercent} %, ` +
        `NO_OUTDOOR ${summary.rejectedNoOutdoor} dana`,
    );
    console.log('Pokrivenost outdoorTempC i gubitak dana modela');
    console.log(`  prozor:                       ${days} dana`);
    console.log(`  uzoraka:                      ${summary.samples}`);
    console.log(
      `  sa outdoorTempC:              ${summary.withOutdoor} (${summary.coveragePercent} %)`,
    );
    console.log(`  klasa:                        ${summary.sampleClass}`);
    console.log(`  odbijenih dana (ukupno):      ${summary.rejectedTotal}`);
    for (const r of summary.skipReasons) {
      console.log(`    ${r.reason}: ${r.days}`);
    }
    console.log(
      `  HomeModel:                    ${summary.models} redova, ` +
        `bez slopeS ${summary.modelsWithoutSlope}, bez dana ${summary.modelsNoDays}, ` +
        `dana ukupno ${summary.modelDays}`,
    );
    console.log(`\n  ${decision.verdict}: ${decision.reason}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
