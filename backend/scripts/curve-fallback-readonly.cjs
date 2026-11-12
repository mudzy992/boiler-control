#!/usr/bin/env node
/**
 * F4.7 korak 1 — KOLIKO BI OSTALO BEZ BROJA BEZ MOTORA (read-only)
 *
 * **Zašto ovo mjerenje mora ići prije brisanja.** F4.7 traži da `Heating/engine`
 * nestane. Ali motor u `boiler.service` nije samo „računa broj": on je **jedini
 * izvor** kad `DailyRecord` za danas ne postoji ili nema predlog, i on daje
 * `curveFlowTemp` za drift na dashboardu. Ako se motor ukloni prije nego se zna
 * koliko puta je to stvarno bio slučaj, polazna tiho pada na `null` — a `null`
 * na kotlu nije „nema podatka", nego greška.
 *
 * Mjeri se: **po kući-danu**, postoji li zapis i ima li predlog.
 *
 *   WITH_MORNING     `DailyRecord.proposedFlowTemp` nije `null` -> motor nije
 *                    potreban za izbor broja (samo za drift)
 *   RECORD_NO_FLOW   zapis postoji, predlog je `null` -> motor je bio fallback
 *   NO_RECORD        zapisa za taj dan nema -> motor je bio fallback
 *
 * **Šta se NE tvrdi.** Ne mjeri se broj HTTP poziva na `/boiler/sync` — zapis ne
 * nosi tu informaciju. Kuća-dan je **gornja granica**: ako svaki poziv padne u
 * fallback, to je najviše toliko, a može biti manje. Presuda to kaže izričito,
 * jer bi „12 dana" lako pročitano kao „12 poziva".
 *
 * Skripta je **samo čitanje**: `SET TRANSACTION READ ONLY`, samo `SELECT`.
 *
 * Upotreba:
 *   DATABASE_URL_READONLY=... node scripts/curve-fallback-readonly.cjs
 *   ... --days=60  ... --json  ... --self-test
 */
'use strict';

const { Client } = require('pg');

if (process.argv.includes('--help')) {
  console.log(`Upotreba: DATABASE_URL_READONLY=... node scripts/curve-fallback-readonly.cjs [opcije]

  --days=N         koliko dana unazad (zadano 60)
  --json           mašinski čitljiv izlaz
  --self-test      provjeri klasifikaciju na sintetici, bez baze
  --help           ova poruka

Mjeri koliko kuca-dana nema zapisani predlog (dakle: motor je bio fallback).
Samo SELECT.`);
  process.exit(0);
}

function argValue(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const value = Number(hit.slice(name.length + 3));
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Klasifikacija jednog kuća-dana.
 *
 * `hasRecord` je odvojen od `proposedFlowTemp` namjerno: „zapis postoji ali
 * predlog je prazan" i „zapisa nema" imaju **različit uzrok** (prvi: model nije
 * dao broj; drugi: writer nije radio), a za F4.7 imaju istu posljedicu.
 */
function classify(hasRecord, proposedFlowTemp) {
  if (!hasRecord) return 'NO_RECORD';
  if (proposedFlowTemp === null || proposedFlowTemp === undefined) return 'RECORD_NO_FLOW';
  if (!Number.isFinite(proposedFlowTemp) || proposedFlowTemp <= 0) return 'RECORD_NO_FLOW';
  return 'WITH_MORNING';
}

function summarize(rows) {
  const buckets = {
    WITH_MORNING: 0,
    RECORD_NO_FLOW: 0,
    NO_RECORD: 0,
  };
  for (const row of rows) buckets[classify(row.hasRecord, row.proposedFlowTemp)]++;

  const total = rows.length;
  const fallback = buckets.RECORD_NO_FLOW + buckets.NO_RECORD;

  return {
    houseDays: total,
    withMorning: buckets.WITH_MORNING,
    recordNoFlow: buckets.RECORD_NO_FLOW,
    noRecord: buckets.NO_RECORD,
    fallback,
    fallbackRatio: total === 0 ? null : fallback / total,
    homes: new Set(rows.map((r) => r.homeProfileId)).size,
    days: new Set(rows.map((r) => r.localDate)).size,
    /*
     * GDJE su dani bez zapisa? Razlika odlucuje o F4.7:
     *  - svi PRIJE prvog zapisa  -> motor je bio fallback samo za dane kad
     *    zapisa jos nije bilo (pocetak rada). Uklanjanje motora tada ne ostavlja
     *    AKTIVNU kucu bez broja; ti dani su vec prosli.
     *  - ima ih POSLIJE prvog zapisa -> ziva zavisnost; motor i dalje nosi
     *    polaznu, i brisanje bi je oborilo.
     */
    firstRecordDate: rows
      .filter((r) => r.hasRecord)
      .map((r) => r.localDate)
      .sort()[0] ?? null,
    noRecordDates: rows
      .filter((r) => classify(r.hasRecord, r.proposedFlowTemp) === 'NO_RECORD')
      .map((r) => r.localDate),
  };
}

/** Jesu li svi dani bez zapisa prije prvog zapisanog dana? */
function noRecordAllHistorical(summary) {
  if (summary.noRecordDates.length === 0) return null;
  if (summary.firstRecordDate === null) return false;
  return summary.noRecordDates.every((d) => d < summary.firstRecordDate);
}

function verdict(summary) {
  if (summary.houseDays === 0) {
    return { verdict: 'NO_HOUSE_DAYS', reason: 'nijedan kuća-dan u prozoru' };
  }
  if (summary.fallback === 0) {
    return {
      verdict: 'CURVE_NOT_NEEDED',
      reason:
        `${summary.houseDays} kuća-dana, svaki ima predlog — motor nije bio ` +
        `fallback ni jednom; brisanje ne bi ostavilo nikoga bez broja`,
    };
  }
  const historical = noRecordAllHistorical(summary);
  if (historical === true) {
    return {
      verdict: 'CURVE_ONLY_BEFORE_RECORDS',
      reason:
        `${summary.fallback}/${summary.houseDays} kuća-dana bez predloga, i SVI su prije ` +
        `prvog zapisanog dana (${summary.firstRecordDate}). Motor je bio fallback samo ` +
        `za dane kad zapisa još nije bilo — brisanje ne ostavlja aktivnu kuću bez broja`,
    };
  }
  return {
    verdict: 'CURVE_IS_LIVE_FALLBACK',
    reason:
      `${summary.fallback}/${summary.houseDays} kuća-dana (${(summary.fallbackRatio * 100).toFixed(1)} %) ` +
      `nema predlog, a ima ih i POSLIJE prvog zapisa (${summary.firstRecordDate}) — ` +
      `motor i dalje nosi polaznu. To je GORNJA GRANICA broja poziva, ne broj poziva`,
  };
}

async function runSelfTest() {
  let failed = 0;

  const checks = [
    { hasRecord: true, flow: 47.2, expect: 'WITH_MORNING' },
    { hasRecord: true, flow: null, expect: 'RECORD_NO_FLOW' },
    { hasRecord: true, flow: 0, expect: 'RECORD_NO_FLOW' },
    { hasRecord: true, flow: -1, expect: 'RECORD_NO_FLOW' },
    { hasRecord: true, flow: NaN, expect: 'RECORD_NO_FLOW' },
    { hasRecord: false, flow: null, expect: 'NO_RECORD' },
    // Nema zapisa ali broj postoji -> nemoguce; ipak mora pasti na NO_RECORD,
    // jer `hasRecord` je taj koji odlucuje, ne broj.
    { hasRecord: false, flow: 47.2, expect: 'NO_RECORD' },
  ];
  for (const c of checks) {
    const got = classify(c.hasRecord, c.flow);
    const ok = got === c.expect;
    if (!ok) failed++;
    console.log(
      `${ok ? 'OK  ' : 'FAIL'} classify(hasRecord=${c.hasRecord}, flow=${c.flow}) = ${got} (ocekivano ${c.expect})`,
    );
  }

  const cases = [
    {
      name: 'prazno',
      rows: [],
      expect: 'NO_HOUSE_DAYS',
    },
    {
      name: 'motor nije potreban',
      rows: [
        { hasRecord: true, proposedFlowTemp: 47, homeProfileId: 1, localDate: '2026-11-01' },
        { hasRecord: true, proposedFlowTemp: 48, homeProfileId: 1, localDate: '2026-11-02' },
      ],
      expect: 'CURVE_NOT_NEEDED',
    },
    {
      name: 'motor je fallback',
      rows: [
        { hasRecord: true, proposedFlowTemp: 47, homeProfileId: 1, localDate: '2026-11-01' },
        { hasRecord: true, proposedFlowTemp: null, homeProfileId: 1, localDate: '2026-11-02' },
      ],
      expect: 'CURVE_IS_LIVE_FALLBACK',
    },
    {
      name: 'nema zapisa uopste',
      rows: [{ hasRecord: false, proposedFlowTemp: null, homeProfileId: 1, localDate: '2026-11-03' }],
      expect: 'CURVE_IS_LIVE_FALLBACK',
    },
    {
      /*
       * Kljucni slucaj za F4.7: dani bez zapisa su svi PRIJE prvog zapisa.
       * Tada motor nije ziva zavisnost nego fallback za pocetak rada — i
       * presuda to mora reci drugacije, inace mjerenje zaustavlja brisanje
       * bez razloga.
       */
      name: 'bez zapisa samo prije prvog zapisa',
      rows: [
        { hasRecord: false, proposedFlowTemp: null, homeProfileId: 1, localDate: '2026-10-01' },
        { hasRecord: false, proposedFlowTemp: null, homeProfileId: 1, localDate: '2026-10-02' },
        { hasRecord: true, proposedFlowTemp: 47, homeProfileId: 1, localDate: '2026-10-03' },
      ],
      expect: 'CURVE_ONLY_BEFORE_RECORDS',
    },
    {
      // A jedan dan bez zapisa POSLIJE prvog zapisa vraca nalaz u zivu zavisnost.
      name: 'praznina poslije prvog zapisa',
      rows: [
        { hasRecord: true, proposedFlowTemp: 47, homeProfileId: 1, localDate: '2026-10-01' },
        { hasRecord: false, proposedFlowTemp: null, homeProfileId: 1, localDate: '2026-10-02' },
        { hasRecord: true, proposedFlowTemp: 47, homeProfileId: 1, localDate: '2026-10-03' },
      ],
      expect: 'CURVE_IS_LIVE_FALLBACK',
    },
  ];
  for (const c of cases) {
    const got = verdict(summarize(c.rows));
    const ok = got.verdict === c.expect;
    if (!ok) failed++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${c.name}: ${got.verdict} (ocekivano ${c.expect})`);
  }

  // Udio i brojanje: 1 od 4 mora biti 0.25, a ne 0.5 ili 0.
  const ratioCase = summarize([
    { hasRecord: true, proposedFlowTemp: 47, homeProfileId: 1, localDate: '2026-11-01' },
    { hasRecord: true, proposedFlowTemp: 47, homeProfileId: 1, localDate: '2026-11-02' },
    { hasRecord: true, proposedFlowTemp: 47, homeProfileId: 1, localDate: '2026-11-03' },
    { hasRecord: true, proposedFlowTemp: null, homeProfileId: 1, localDate: '2026-11-04' },
  ]);
  const ratioOk = Math.abs(ratioCase.fallbackRatio - 0.25) < 1e-9;
  if (!ratioOk) failed++;
  console.log(
    `${ratioOk ? 'OK  ' : 'FAIL'} fallbackRatio = ${ratioCase.fallbackRatio} (ocekivano 0.25)`,
  );

  // Dva kljucna razlicita uzroka moraju ostati razdvojena u izlazu.
  const splitCase = summarize([
    { hasRecord: true, proposedFlowTemp: null, homeProfileId: 1, localDate: '2026-11-01' },
    { hasRecord: false, proposedFlowTemp: null, homeProfileId: 1, localDate: '2026-11-02' },
  ]);
  const splitOk = splitCase.recordNoFlow === 1 && splitCase.noRecord === 1;
  if (!splitOk) failed++;
  console.log(
    `${splitOk ? 'OK  ' : 'FAIL'} uzroci razdvojeni: recordNoFlow=${splitCase.recordNoFlow}, noRecord=${splitCase.noRecord}`,
  );

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

    /*
     * Baza kuća-dana je **unija** dvije strane: dani iz zapisa i dani u kojima
     * je kuća postojala bez zapisa. Bez druge strane `NO_RECORD` se nikad ne
     * pojavi (upit po `DailyRecord` ne može naći red koga nema), pa bi nalaz
     * uvijek bio „motor nije potreban" — tiha greška u korist brisanja.
     *
     * Spaja se po **`userId`**, ne po `homeProfileId`: v. dijagnostiku niže.
     */
    const { rows } = await client.query(
      `WITH days AS (
         /*
          * ::text MORA biti unutar to_char, ne na kraju poziva.
          *
          * Prvi pokusaj je bio generate_series(date, date, interval)::text.
          * Postgres tada bira **timestamp** overload (jer je korak interval),
          * pa ::text daje 2026-10-09 00:00:00+00 — a DailyRecord.localDate
          * je YYYY-MM-DD. Join po tekstu zato promasi SVE redove, i svaki
          * kuca-dan izgleda kao NO_RECORD. Dijagnostika je to razotkrila:
          * 56 redova u prozoru, 56 spojenih po userId, a grid nalazi 0.
          */
         SELECT to_char(
           generate_series(
             (CURRENT_DATE - ($1::int || ' days')::interval)::date,
             CURRENT_DATE,
             '1 day'
           ),
           'YYYY-MM-DD'
         ) AS "localDate"
       ),
       homes AS (
         SELECT id AS "homeProfileId", "userId", "createdAt"::date::text AS "createdOn"
         FROM "HomeProfile"
       ),
       grid AS (
         SELECT h."homeProfileId", h."userId", d."localDate"
         FROM homes h
         CROSS JOIN days d
         WHERE d."localDate" >= h."createdOn"
       )
       SELECT
         g."homeProfileId",
         g."localDate",
         (r.id IS NOT NULL) AS "hasRecord",
         r."proposedFlowTemp"::float8 AS "proposedFlowTemp"
       FROM grid g
       LEFT JOIN "DailyRecord" r
         ON r."userId" = g."userId"
        AND r."localDate" = g."localDate"
       ORDER BY g."localDate", g."homeProfileId"`,
      [days],
    );

    /*
     * Dijagnostika koja je morala postojati prije povjerenja u nalaz.
     *
     * Prvi run je dao `61/61 kuća-dana bez zapisa` — nemoguće, jer je
     * `recommendation-drift` na istom prozoru čitao 54 dana iz `DailyRecord`.
     * Uzrok je veza: spajanje po `homeProfileId` promaši redove čiji profil
     * više ne postoji ili je zamijenjen. Zato se spaja po `userId` — isto kao
     * `recommendation-drift`, `daily-flow-oscillation` i ostale skripte.
     *
     * Ovaj upit mjeri je li to bio uzrok, umjesto da se pretpostavi.
     */
    const diag = await client.query(
      `SELECT
         (SELECT count(*)::int FROM "DailyRecord") AS "dailyRecordRows",
         (SELECT count(DISTINCT "homeProfileId")::int FROM "DailyRecord") AS "dailyRecordHomes",
         (SELECT count(*)::int FROM "HomeProfile") AS "homeProfiles",
         (SELECT count(*)::int
            FROM "DailyRecord" r
            LEFT JOIN "HomeProfile" h ON h.id = r."homeProfileId"
           WHERE h.id IS NULL) AS "orphanRows",
         (SELECT count(DISTINCT "userId")::int FROM "DailyRecord") AS "dailyRecordUsers",
         (SELECT count(DISTINCT "userId")::int FROM "HomeProfile") AS "homeProfileUsers",
         (SELECT count(*)::int FROM "DailyRecord"
           WHERE "localDate" >= to_char(CURRENT_DATE - ($1::int || ' days')::interval, 'YYYY-MM-DD')) AS "windowRecords",
         (SELECT count(*)::int FROM "DailyRecord" r
            JOIN "HomeProfile" h ON h."userId" = r."userId"
           WHERE r."localDate" >= to_char(CURRENT_DATE - ($1::int || ' days')::interval, 'YYYY-MM-DD')) AS "matchedByUser",
         (SELECT count(*)::int FROM "DailyRecord" r
            JOIN "HomeProfile" h ON h.id = r."homeProfileId"
           WHERE r."localDate" >= to_char(CURRENT_DATE - ($1::int || ' days')::interval, 'YYYY-MM-DD')) AS "matchedByHome"`,
      [days],
    );

    await client.query('COMMIT');

    const normalized = rows.map((row) => ({
      homeProfileId: row.homeProfileId,
      localDate: row.localDate,
      hasRecord: row.hasRecord === true,
      proposedFlowTemp: row.proposedFlowTemp,
    }));

    const summary = summarize(normalized);
    const decision = verdict(summary);
    const link = diag.rows[0];

    if (process.argv.includes('--json')) {
      console.log(JSON.stringify({ summary, link: diag.rows[0], ...decision }, null, 2));
    } else {
      console.log('F4.7 korak 1 — koliko bi ostalo bez broja bez motora');
      console.log(`  prozor:                  ${days} dana`);
      console.log(`  kuća-dana:               ${summary.houseDays} (${summary.homes} kuća, ${summary.days} dana)`);
      console.log(`  sa jutarnjim predlogom:  ${summary.withMorning}`);
      console.log(`  zapis bez predloga:      ${summary.recordNoFlow}`);
      console.log(`  bez zapisa:              ${summary.noRecord}`);
      console.log(`  motor kao fallback:      ${summary.fallback}`);
      if (summary.fallbackRatio !== null) {
        console.log(`  udio:                    ${(summary.fallbackRatio * 100).toFixed(1)} %`);
      }
      console.log(
        `\n  veza: DailyRecord redova ${link.dailyRecordRows}, kuća u njima ` +
          `${link.dailyRecordHomes}, HomeProfile redova ${link.homeProfiles}, ` +
          `redova bez profila ${link.orphanRows}; ` +
          `userId u zapisima ${link.dailyRecordUsers}, u profilima ${link.homeProfileUsers}; ` +
          `u prozoru redova ${link.windowRecords}, spojeno po userId ${link.matchedByUser}, ` +
          `po homeProfileId ${link.matchedByHome}`,
      );
      if (summary.noRecordDates.length) {
        console.log(`  dani bez zapisa:         ${summary.noRecordDates.join(', ')}`);
      }
      if (summary.firstRecordDate) {
        console.log(`  prvi zapisani dan:       ${summary.firstRecordDate}`);
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
