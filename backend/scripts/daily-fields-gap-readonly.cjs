#!/usr/bin/env node
/**
 * Zašto `gasM3` i `degreeDays` fale po danima? (read-only)
 *
 * **Pitanje koje mjeri.** U tabeli `/api/daily-records` vidi se oštra granica:
 * dani do 08.11. imaju plin i/ili stepen-dan, a od 09.11. nemaju — iako imaju
 * cikluse i `Izmjereno`. Pitanje nije „prikazuje li UI tačno" (prikazuje ono
 * što je u bazi), nego **zašto je u bazi `NULL`**.
 *
 * **Dvije hipoteze koje se moraju razdvojiti brojem, ne mišljenjem:**
 *
 *   H1 — podatka nema: za taj dan uopšte nema `GasReading` / `BoilerHistory`
 *        redova (ili ih je manje od praga). Tada je `NULL` **tačan** i problem
 *        je u izvoru, ne u kodu.
 *
 *   H2 — podatak postoji a polje je prazno: redovi postoje, a `DailyRecord`
 *        i dalje ima `NULL`. Tada je uzrok **pisac**, jer live put
 *        (`daily-record.writer.ts`) ta dva polja ne upisuje uopšte, a backfill
 *        preskače dan koji već postoji (`backfill-daily-records.ts:269`).
 *
 * **Zašto H2 uopšte može biti istina.** `gasM3` i `degreeDays` piše isključivo
 * `scripts/backfill-daily-records.ts` (dokazano `grep`-om po `src/`). Dani
 * nastali live writerom zato ostaju bez njih **zauvijek** — nema nijednog
 * `dailyRecord.update` koji bi ih dopunio.
 *
 * **Pragovi, imenovani:**
 *   - `MIN_OUTDOOR_SAMPLES_PER_DAY = 8` — koliko `BoilerHistory.externalTemp`
 *     očitanja treba za stepen-dan (`backfill-reconstruction.ts:37`).
 *   - `DEGREE_DAY_BASE_C = 15` — bazna temperatura stepen-dana.
 *
 * Skripta je **samo čitanje**: `SET TRANSACTION READ ONLY`, samo `SELECT`.
 *
 * Upotreba:
 *   DATABASE_URL_READONLY=... node scripts/daily-fields-gap-readonly.cjs
 *   ... --days=20  ... --json  ... --self-test
 */
'use strict';

const { Client } = require('pg');

/** Prag iz `backfill-reconstruction.ts:37` — ne prepisuje se ovdje. */
const MIN_OUTDOOR_SAMPLES_PER_DAY = 8;
/** Bazna temperatura iz `backfill-reconstruction.ts:34`. */
const DEGREE_DAY_BASE_C = 15;

if (process.argv.includes('--help')) {
  console.log(`Upotreba: DATABASE_URL_READONLY=... node scripts/daily-fields-gap-readonly.cjs [opcije]

  --days=N         koliko dana unazad (zadano 20)
  --json           mašinski čitljiv izlaz
  --self-test      provjeri presudu na sintetici, bez baze
  --help           ova poruka

Za svaki dan poredi DailyRecord.gasM3/degreeDays sa IZVOROM (GasReading,
BoilerHistory.externalTemp). Samo SELECT.`);
  process.exit(0);
}

function argValue(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const value = Number(hit.slice(name.length + 3));
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Presuda za jedno polje jednog dana.
 *
 * Redoslijed je bitan: prvo se gleda **ima li izvora uopšte**, pa tek onda
 * ima li vrijednosti u `DailyRecord`. Obrnut redoslijed bi svaki dan bez
 * izvora proglasio greškom pisca.
 */
function judgeField({ stored, sourceReadings, minReadings }) {
  if (sourceReadings === 0) {
    return 'NEMA_IZVORA';
  }
  if (sourceReadings < minReadings) {
    return 'IZVOR_ISPOD_PRAGA';
  }
  if (stored === true) {
    return 'POPUNJENO';
  }
  return 'IZVOR_POSTOJI_POLJE_PRAZNO';
}

/**
 * Presuda za dan kao cjelinu.
 *
 * Cilj je jedna riječ koja kaže **gdje** se gubi, a ne koliko polja fali.
 */
function judgeDay({ hasRecord, gas, degree }) {
  if (!hasRecord) return 'NEMA_REDA';
  const verdicts = [gas, degree];
  if (verdicts.includes('IZVOR_POSTOJI_POLJE_PRAZNO')) return 'PISAC';
  if (verdicts.every((v) => v === 'POPUNJENO')) return 'POTPUN';
  if (verdicts.every((v) => v === 'NEMA_IZVORA' || v === 'IZVOR_ISPOD_PRAGA')) {
    return 'NEMA_IZVORA';
  }
  return 'MIJESANO';
}

/**
 * Sažetak preko dana. Namjerno **ne** sabira „koliko polja fali", jer to
 * miješa dva uzroka i daje broj koji se ne može popraviti ni jednom izmjenom.
 */
function summarize(days) {
  const counts = {};
  for (const day of days) {
    counts[day.verdict] = (counts[day.verdict] ?? 0) + 1;
  }
  let verdict;
  if (days.length === 0) verdict = 'NEMA_DANA';
  else if (counts.PISAC > 0) verdict = 'PISAC_JE_UZROK';
  else if (counts.NEMA_IZVORA > 0 || counts.MIJESANO > 0) verdict = 'IZVOR_JE_UZROK';
  else verdict = 'SVE_POTPUNO';
  return { verdict, counts, days: days.length };
}

async function runSelfTest() {
  let failed = 0;
  const ok = (cond, label) => {
    if (!cond) failed++;
    console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}`);
  };

  // Polje: redoslijed provjera je ono što se testira.
  ok(
    judgeField({ stored: false, sourceReadings: 0, minReadings: 8 }) === 'NEMA_IZVORA',
    'nula očitanja -> NEMA_IZVORA (ne PISAC)',
  );
  ok(
    judgeField({ stored: false, sourceReadings: 7, minReadings: 8 }) ===
      'IZVOR_ISPOD_PRAGA',
    '7 od 8 -> IZVOR_ISPOD_PRAGA',
  );
  ok(
    judgeField({ stored: false, sourceReadings: 8, minReadings: 8 }) ===
      'IZVOR_POSTOJI_POLJE_PRAZNO',
    '8 od 8 a prazno -> PISAC',
  );
  ok(
    judgeField({ stored: true, sourceReadings: 8, minReadings: 8 }) === 'POPUNJENO',
    '8 od 8 i popunjeno -> POPUNJENO',
  );
  // Plin: jedan red je dovoljan (prag 1), pa razlika mora postojati.
  ok(
    judgeField({ stored: false, sourceReadings: 1, minReadings: 1 }) ===
      'IZVOR_POSTOJI_POLJE_PRAZNO',
    'plin: 1 očitanje a prazno -> PISAC',
  );

  // Dan i sažetak.
  ok(
    judgeDay({ hasRecord: true, gas: 'POPUNJENO', degree: 'POPUNJENO' }) === 'POTPUN',
    'oba popunjena -> POTPUN',
  );
  ok(
    judgeDay({ hasRecord: true, gas: 'NEMA_IZVORA', degree: 'NEMA_IZVORA' }) ===
      'NEMA_IZVORA',
    'oba bez izvora -> NEMA_IZVORA',
  );
  ok(
    judgeDay({
      hasRecord: true,
      gas: 'IZVOR_POSTOJI_POLJE_PRAZNO',
      degree: 'NEMA_IZVORA',
    }) === 'PISAC',
    'jedno polje ima izvor a prazno -> PISAC (pisac ima prioritet)',
  );
  ok(
    judgeDay({ hasRecord: false, gas: 'NEMA_IZVORA', degree: 'NEMA_IZVORA' }) ===
      'NEMA_REDA',
    'nema reda u DailyRecord -> NEMA_REDA',
  );

  const s1 = summarize([
    { verdict: 'POTPUN' },
    { verdict: 'NEMA_IZVORA' },
  ]);
  ok(s1.verdict === 'IZVOR_JE_UZROK', 'mješano bez pisca -> IZVOR_JE_UZROK');
  const s2 = summarize([{ verdict: 'PISAC' }, { verdict: 'NEMA_IZVORA' }]);
  ok(s2.verdict === 'PISAC_JE_UZROK', 'pisc + izvor -> PISAC_JE_UZROK (pisac prioritet)');
  ok(summarize([]).verdict === 'NEMA_DANA', 'prazno -> NEMA_DANA');
  ok(
    summarize([{ verdict: 'POTPUN' }]).verdict === 'SVE_POTPUNO',
    'svi potpuni -> SVE_POTPUNO',
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
    console.error('DATABASE_URL_READONLY nije postavljen — mjerenje nije pokrenuto.');
    process.exit(1);
  }

  const days = argValue('days', 20);
  const asJson = process.argv.includes('--json');
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query('SET TRANSACTION READ ONLY');
    await client.query('BEGIN');

    /*
     * Jedan upit po izvoru, spojen po LOKALNOM datumu.
     *
     * `AT TIME ZONE 'Europe/Sarajevo'` mora biti i na `createdAt` i na
     * `readingDate`: bez toga se dan u `BoilerHistory` računa u UTC, a
     * `DailyRecord.localDate` je lokalni — pa bi se poređenje pomjerilo za
     * jedan dan i svaki nalaz bi bio pogrešan na granici dana.
     */
    const { rows } = await client.query(
      `WITH d AS (
         SELECT "homeProfileId", "localDate", "gasM3", "degreeDays", "cycles",
                "nightMinOutdoorMeasuredC"
         FROM "DailyRecord"
         WHERE "localDate" >= to_char(CURRENT_DATE - ($1::int || ' days')::interval, 'YYYY-MM-DD')
       ),
       b AS (
         SELECT "userId",
                to_char("createdAt" AT TIME ZONE 'Europe/Sarajevo', 'YYYY-MM-DD') AS "localDate",
                count(*) FILTER (WHERE "externalTemp" IS NOT NULL)::int AS "outdoorReadings",
                avg("externalTemp") AS "meanOutdoorC"
         FROM "BoilerHistory"
         WHERE "createdAt" >= now() - ($1::int || ' days')::interval
         GROUP BY 1, 2
       ),
       g AS (
         SELECT "userId",
                to_char("readingDate" AT TIME ZONE 'Europe/Sarajevo', 'YYYY-MM-DD') AS "localDate",
                count(*)::int AS "gasReadings",
                count(*) FILTER (WHERE "consumption" IS NOT NULL)::int AS "gasWithValue"
         FROM "GasReading"
         WHERE "readingDate" >= now() - ($1::int || ' days')::interval
         GROUP BY 1, 2
       )
       SELECT d."homeProfileId", d."localDate", d."gasM3", d."degreeDays",
              d."cycles", d."nightMinOutdoorMeasuredC",
              COALESCE(b."outdoorReadings", 0) AS "outdoorReadings",
              b."meanOutdoorC",
              COALESCE(g."gasReadings", 0) AS "gasReadings",
              COALESCE(g."gasWithValue", 0) AS "gasWithValue"
       FROM d
       LEFT JOIN "HomeProfile" hp ON hp.id = d."homeProfileId"
       LEFT JOIN b ON b."userId" = hp."userId" AND b."localDate" = d."localDate"
       LEFT JOIN g ON g."userId" = hp."userId" AND g."localDate" = d."localDate"
       ORDER BY d."localDate" DESC, d."homeProfileId"`,
      [days],
    );

    const measured = rows.map((row) => {
      const gas = judgeField({
        stored: row.gasM3 !== null,
        sourceReadings: row.gasWithValue,
        minReadings: 1,
      });
      const degree = judgeField({
        stored: row.degreeDays !== null,
        sourceReadings: row.outdoorReadings,
        minReadings: MIN_OUTDOOR_SAMPLES_PER_DAY,
      });
      return {
        localDate: String(row.localDate),
        homeProfileId: row.homeProfileId,
        gasM3: row.gasM3,
        degreeDays: row.degreeDays,
        cycles: row.cycles,
        nightOutdoor: row.nightMinOutdoorMeasuredC,
        outdoorReadings: row.outdoorReadings,
        meanOutdoorC:
          row.meanOutdoorC === null ? null : Number(row.meanOutdoorC),
        gasReadings: row.gasReadings,
        gasWithValue: row.gasWithValue,
        gas,
        degree,
        verdict: judgeDay({ hasRecord: true, gas, degree }),
      };
    });

    const summary = summarize(measured);

    if (asJson) {
      console.log(JSON.stringify({ windowDays: days, summary, rows: measured }, null, 2));
      return;
    }

    console.log(`\n## dnevna polja: plin i stepen-dan (zadnjih ${days} dana)`);
    console.log(
      `  prag za stepen-dan: ${MIN_OUTDOOR_SAMPLES_PER_DAY} ocitanja externalTemp ` +
        `(baza ${DEGREE_DAY_BASE_C} °C); prag za plin: 1 ocitanje sa consumption`,
    );
    console.log('');
    console.log(
      '  datum       dom  plin        stepen-dan   ext.oč.  gas.oč.  presuda',
    );
    for (const row of measured) {
      const gas = row.gasM3 === null ? '—' : row.gasM3.toFixed(2);
      const dd = row.degreeDays === null ? '—' : row.degreeDays.toFixed(2);
      console.log(
        `  ${row.localDate}  ${String(row.homeProfileId).padStart(3)}  ` +
          `${gas.padEnd(10)}  ${dd.padEnd(11)}  ` +
          `${String(row.outdoorReadings).padStart(6)}  ` +
          `${String(row.gasWithValue).padStart(7)}  ` +
          `${row.verdict}${row.verdict === 'MIJESANO' || row.verdict === 'PISAC' ? ` (plin:${row.gas}, stepen:${row.degree})` : ''}`,
      );
    }

    console.log(`\n  ${summary.verdict}: ${summary.days} dana u prozoru`);
    const parts = Object.entries(summary.counts).map(([k, v]) => `${k} ${v}`);
    console.log(`    presude: ${parts.join(', ') || '—'}`);

    const pisac = measured.filter((r) => r.verdict === 'PISAC');
    if (pisac.length > 0) {
      console.log(
        `\n  PISAC: ${pisac.length} dana ima IZVOR a polje je prazno — ` +
          `live writer ne upisuje ta polja:`,
      );
      for (const r of pisac) {
        console.log(
          `    ${r.localDate}: plin ${r.gas} (${r.gasWithValue} ocitanja), ` +
            `stepen-dan ${r.degree} (${r.outdoorReadings} ext. ocitanja)`,
        );
      }
    }

    const bezIzvora = measured.filter((r) => r.verdict === 'NEMA_IZVORA');
    if (bezIzvora.length > 0) {
      console.log(
        `\n  NEMA IZVORA: ${bezIzvora.length} dana — polje je tacno NULL:`,
      );
      for (const r of bezIzvora) {
        console.log(
          `    ${r.localDate}: ext. ocitanja ${r.outdoorReadings}, ` +
            `gas ocitanja ${r.gasReadings}`,
        );
      }
    }

    console.log(
      `\n  SAZETAK: ${summary.verdict} — ${summary.days} dana, ` +
        `PISAC ${summary.counts.PISAC ?? 0}, NEMA_IZVORA ${summary.counts.NEMA_IZVORA ?? 0}, ` +
        `POTPUN ${summary.counts.POTPUN ?? 0}`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
