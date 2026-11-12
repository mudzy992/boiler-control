#!/usr/bin/env node
/**
 * F3.1 — POKRIVENOST INTERVALA POUZDANOSTI (read-only)
 *
 * Tvrdnja koja se mjeri: **ako model kaže 95 %, stvarno treba da bude 95 %.**
 * To je jedina tvrdnja koja se može provjeriti **bez puštanja modela u
 * produkciju** — dovoljno je da se, za svaki dan koji je ušao u fit, vidi da li
 * izmjereni `y` pada unutar intervala koji je model tada davao.
 *
 * Zašto je to važno prije F2/F4: `s` u ravnotežnoj polaznoj dolazi iz
 * `slopeCiHigh` prvih 20 dana. Ako interval nije kalibrisan, ta „konzervativna"
 * granica nije konzervativna — može biti preniska (hladna kuća) ili previsoka
 * (trošenje gasa uzalud). Bez ovog broja puštanje modela je zamjena jedne
 * neprovjerene vrijednosti drugom.
 *
 * **Šta se NE tvrdi.** Ovo je pokrivenost na **istim danima na kojima je model
 * fitovan** (in-sample). Takva pokrivenost je po pravilu previsoka — model je
 * prilagođen tim danima. Zato se mjeri i **leave-one-out** pokrivenost: model se
 * ponovo fituje bez tog dana i pita da li je taj dan unutar intervala. LOO je
 * pošten jer dan nije vidio fit. Oba broja se ispisuju zajedno; samo prvi bi bio
 * samozavaravanje.
 *
 * Metoda: `fitDailyBalance` iz `HomeModel/daily-balance.ts` (isti modul koji
 * piše `HomeModel`), sa istim pragovima (`MIN_DAYS_FOR_FIT`, `BOOTSTRAP_RESAMPLES`).
 * Nema kopije formule i nema izmišljenih dana.
 *
 * Skripta je **samo čitanje**: `DATABASE_URL_READONLY`, `SET TRANSACTION READ
 * ONLY` unutar transakcije, samo `SELECT`.
 *
 * Upotreba:
 *   DATABASE_URL_READONLY=... node scripts/ci-coverage-readonly.cjs
 *   ... --min-days=8 --json
 *   ... --self-test        (bez baze; provjeri da modul radi)
 */
'use strict';

const { Client } = require('pg');
const path = require('node:path');

if (process.argv.includes('--help')) {
  console.log(`Upotreba: DATABASE_URL_READONLY=... node scripts/ci-coverage-readonly.cjs [opcije]

  --min-days=<n>   minimalan broj dana za fit (default: MIN_DAYS_FOR_FIT iz modula)
  --json           mašinski čitljiv izlaz
  --self-test      provjeri učitavanje modula i fit, bez baze
  --help           ova poruka

Mjeri da li izmjereni dani padaju unutar intervala koji model daje — in-sample
i leave-one-out. Samo SELECT.`);
  process.exit(0);
}

const selfTest = process.argv.includes('--self-test');
const asJson = process.argv.includes('--json');
const minDaysArg = process.argv.find((a) => a.startsWith('--min-days='));

const url = process.env.DATABASE_URL_READONLY;
if (!url && !selfTest) {
  console.error('DATABASE_URL_READONLY nije postavljen.');
  process.exit(2);
}

/*
 * `TS_NODE_PROJECT` je obavezan iz istog razloga kao u `shadow-report-readonly`:
 * bez njega ts-node iz korijena repoa nađe `mobile/tsconfig.json` i padne na
 * `expo/tsconfig.base`.
 */
const root = path.resolve(__dirname, '../..');
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');
require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));

const balance = require(
  path.join(root, 'backend/src/modules/HomeModel/daily-balance.ts'),
);
const { fitDailyBalance, buildDayRow, MIN_DAYS_FOR_FIT } = balance;

const MIN_DAYS = minDaysArg ? Number(minDaysArg.split('=')[1]) : MIN_DAYS_FOR_FIT;

const lines = [];
const out = (line = '') => {
  lines.push(line);
  console.log(line);
};
const notice = (message) => {
  const flat = String(message).replace(/[\r\n]+/g, ' ').replace(/%/g, '%25');
  console.log(`::notice::${flat}`);
};
/**
 * Značenje razloga odbijanja, sa pragom iz modula. Bez ovoga „4 dana odbijena"
 * izgleda kao kvar, a u stvari je najčešće `INCOMPLETE`: uzorak na 1 min daje
 * 288 tačaka dnevno, a fit traži 80 % pokrivenosti — dakle 231 uzorak. Dom koji
 * je izašao iz sezone ili je bio bez struje pola dana ne može da prođe, i to je
 * ispravno. Razlika je važna jer određuje šta se popravlja: podatke ili model.
 */
const REJECTION_MEANING = {
  INCOMPLETE: `uzoraka < 80 % od 288 (dnevni niz ne pokriva dan)`,
  NO_OUTDOOR: 'nijedan uzorak nema vanjsku temperaturu',
  NO_HEATING: 'nijedan uzorak nije pod grijanjem (sezona ili režim)',
  FLOW_MISSING: 'polazna nedostaje na > 10 % uzoraka grijanja',
  NO_TARGET: 'nema ciljne sobne temperature tog dana',
  DUTY: 'udio grijanja van 5–98 % (dan nije ni grijao ni bio isključen)',
  WEAK_SIGNAL: 'razlika soba−vani < 5 K (nema signala za nagib)',
  NOT_IN_BALANCE: 'soba > 2 K od cilja (dan nije u ravnoteži, fit ga ne želi)',
};

const pct = (part, whole) =>
  whole === 0 ? '—' : `${((part / whole) * 100).toFixed(1)} %`;

/**
 * Skupovi agregata koji ulaze u fit. Jedan dom = jedan model (`21` §7), pa se
 * domovi ne miješaju: interval važi za kuću, ne za populaciju.
 *
 * Agregat je napravljen tako da odgovara `HomeModelService.dayAggregates`:
 * grupa po kući i lokalnom danu, isti brojači i iste sume. Lokalni dan se
 * dobija iz `at` u zoni kuće (`Europe/Sarajevo`); kolona je `at`, tabela je
 * `ThermostatObservation` — prva verzija ovog upita je koristila `Observation`
 * i `timestamp`, što ne postoji.
 *
 * **Ograničenje koje se ne prećutkuje:** zona je ovdje fiksna na
 * `Europe/Sarajevo`, a proizvod je čita iz `HomeProfile.weatherTimezone` sa
 * fallbackom na `User.timezone`. Ako dom ima drugu zonu, granica dana se
 * pomjera i brojevi se ne poklapaju u potpunosti. Uz jedan dom u produkciji
 * (v. baseline) to je tačno; sa više domova treba proslijediti zonu po domu.
 */
const AGGREGATE_SQL = `
  SELECT o."homeProfileId",
         to_char(o."at" AT TIME ZONE 'Europe/Sarajevo', 'YYYY-MM-DD') AS "localDate",
         count(*)::int                                        AS samples,
         count(*) FILTER (WHERE o."isHeating")::int            AS "heatingSamples",
         count(*) FILTER (
           WHERE o."isHeating" AND o."flowSetC" IS NOT NULL
         )::int                                               AS "heatingPairs",
         coalesce(sum(o."flowSetC" - o."roomTempC") FILTER (
           WHERE o."isHeating" AND o."flowSetC" IS NOT NULL
         ), 0)::float8                                        AS "flowMinusRoomSum",
         coalesce(sum(o."roomTempC"), 0)::float8              AS "roomSum",
         coalesce(sum(o."outdoorTempC") FILTER (
           WHERE o."outdoorTempC" IS NOT NULL
         ), 0)::float8                                        AS "outdoorSum",
         count(o."outdoorTempC")::int                         AS "outdoorSamples"
    FROM "ThermostatObservation" o
   GROUP BY 1, 2
   ORDER BY 1, 2
`;

/** Jedan dan kao red fita; `null` kad ga `buildDayRow` odbije (sa razlogom). */
function toRow(aggregate) {
  const result = buildDayRow({
    localDate: aggregate.localDate,
    samples: aggregate.samples,
    heatingSamples: aggregate.heatingSamples,
    heatingPairs: aggregate.heatingPairs,
    flowMinusRoomSum: aggregate.flowMinusRoomSum,
    roomSum: aggregate.roomSum,
    outdoorSum: aggregate.outdoorSum,
    outdoorSamples: aggregate.outdoorSamples,
    targetRoomC: null,
  });
  return result;
}

/** Je li `y` unutar `[ciLow, ciHigh]` iz fita. */
function inside(y, fit) {
  return y >= fit.ciLow - 1e-9 && y <= fit.ciHigh + 1e-9;
}

/**
 * Leave-one-out: fit bez jednog dana, pa provjera tog dana.
 *
 * Namjerno se ne koristi nikakva aproksimacija (npr. uticajna tačka): skup je
 * mali (osam do trideset dana), pa je ponovni fit za svaki dan jeftin i tačan.
 */
function leaveOneOut(rows, options) {
  const results = [];
  for (let i = 0; i < rows.length; i += 1) {
    const without = rows.filter((_, index) => index !== i);
    const fit = fitDailyBalance(without, options);
    if (fit.status !== 'ok') {
      results.push({ localDate: rows[i].localDate, skipped: fit.reason ?? fit.status });
      continue;
    }
    results.push({
      localDate: rows[i].localDate,
      y: rows[i].y,
      ciLow: fit.ciLow,
      ciHigh: fit.ciHigh,
      covered: inside(rows[i].y, fit),
    });
  }
  return results;
}

function analyseHome(homeProfileId, aggregates, options) {
  const accepted = [];
  const rejected = [];
  for (const aggregate of aggregates) {
    const result = toRow(aggregate);
    if (result.ok) accepted.push(result.row);
    else rejected.push({ localDate: result.localDate, reason: result.reason });
  }

  if (accepted.length < MIN_DAYS) {
    return {
      homeProfileId,
      days: accepted.length,
      rejected,
      verdict: 'NOT_ENOUGH_DAYS',
      note: `prihvaćeno ${accepted.length}, potrebno ${MIN_DAYS}`,
    };
  }

  const fit = fitDailyBalance(accepted, options);
  if (fit.status !== 'ok') {
    return {
      homeProfileId,
      days: accepted.length,
      rejected,
      verdict: 'FIT_FAILED',
      note: fit.reason ?? fit.status,
    };
  }

  const inSample = accepted.filter((row) => inside(row.y, fit)).length;
  const loo = leaveOneOut(accepted, options);
  const looEvaluated = loo.filter((entry) => !entry.skipped);
  const looCovered = looEvaluated.filter((entry) => entry.covered).length;

  /*
   * Očekivana pokrivenost za 95 % interval je 95 %. Tolerancija od 10
   * procentnih poena je široka namjerno: sa 10–30 dana binomialni šum je
   * velik, pa bi stroža granica proizvodila lažne uzbune. Ono što se ovdje
   * traži nije precizan broj nego to da interval nije **sistematski** pogrešan.
   */
  const expected = 95;
  const tolerancePct = 10;
  const looSharePct =
    looEvaluated.length === 0 ? null : (looCovered / looEvaluated.length) * 100;
  let verdict = 'OK';
  if (looSharePct == null) verdict = 'NOT_ENOUGH_DAYS';
  else if (Math.abs(looSharePct - expected) > tolerancePct) verdict = 'MISCALIBRATED';

  return {
    homeProfileId,
    days: accepted.length,
    rejected,
    slope: fit.slope,
    ciLow: fit.ciLow,
    ciHigh: fit.ciHigh,
    internalGainC: fit.internalGainC,
    residualStd: fit.residualStd,
    inSample: { covered: inSample, total: accepted.length },
    loo: {
      covered: looCovered,
      total: looEvaluated.length,
      skipped: loo.filter((entry) => entry.skipped),
      sharePct: looSharePct == null ? null : Math.round(looSharePct * 10) / 10,
    },
    expectedPct: expected,
    tolerancePct,
    verdict,
  };
}

function runSelfTest() {
  const problems = [];
  for (const [name, value] of Object.entries({
    fitDailyBalance,
    buildDayRow,
    MIN_DAYS_FOR_FIT,
  })) {
    if (value == null) problems.push(`${name} nije izvezen iz daily-balance`);
  }
  if (typeof MIN_DAYS_FOR_FIT === 'number' && MIN_DAYS_FOR_FIT < 2) {
    problems.push(`MIN_DAYS_FOR_FIT je ${MIN_DAYS_FOR_FIT}, očekivano ≥ 2`);
  }
  // Sintetički skup: linearna relacija sa šumom. Fit mora uspjeti i interval
  // mora biti konačan, inače pokrivenost nema smisla računati.
  const rows = [];
  for (let i = 0; i < 20; i += 1) {
    const x = 0.5 + (i % 7) * 0.15;
    rows.push({
      localDate: `2026-01-${String(i + 1).padStart(2, '0')}`,
      x,
      y: 1.0 * x + 0.2 + ((i % 5) - 2) * 0.01,
      duty: 0.6,
      roomMeanC: 21,
      outdoorMeanC: 4,
    });
  }
  const fit = fitDailyBalance(rows, { bootstrapResamples: 50, seed: 7 });
  if (fit.status !== 'ok') problems.push(`fit na sintetici nije uspio: ${fit.status}`);
  else if (!(fit.ciLow < fit.ciHigh)) problems.push('interval nije uređen');
  else if (Math.abs(fit.slope - 1.0) > 0.15) {
    problems.push(`nagib ${fit.slope} odstupа od 1,0 više od 0,15`);
  }

  if (problems.length) {
    console.error('Samotest NIJE prošao:');
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log(
    `Samotest prošao: fit na sintetici daje s=${fit.slope.toFixed(3)} ` +
      `[${fit.ciLow.toFixed(3)}, ${fit.ciHigh.toFixed(3)}], MIN_DAYS=${MIN_DAYS_FOR_FIT}.`,
  );
  process.exit(0);
}

async function main() {
  const client = new Client({ connectionString: url });
  await client.connect();

  let homes = [];
  let modelInfo = null;

  try {
    await client.query('BEGIN');
    await client.query('SET TRANSACTION READ ONLY');

    const { rows: aggregates } = await client.query(AGGREGATE_SQL);

    const byHome = new Map();
    for (const aggregate of aggregates) {
      const list = byHome.get(aggregate.homeProfileId) ?? [];
      list.push(aggregate);
      byHome.set(aggregate.homeProfileId, list);
    }

    for (const [homeProfileId, list] of byHome) {
      homes.push(analyseHome(homeProfileId, list, {}));
    }

    const { rows: models } = await client.query(
      `SELECT "homeProfileId", "slopeS", "slopeCiLow", "slopeCiHigh",
              "internalGainC", "days", "daysEvaluated", "residualStd", "state",
              "modelVersion"
         FROM "HomeModel"`,
    );
    modelInfo = models;

    await client.query('ROLLBACK');
  } finally {
    await client.end();
  }

  if (asJson) {
    console.log(
      JSON.stringify({ minDays: MIN_DAYS, homes, models: modelInfo }, null, 2),
    );
    return;
  }

  out('## F3.1 — pokrivenost intervala pouzdanosti (95 %)');
  out();
  out(
    'Mjeri se na **stvarnim danima**. In-sample pokrivenost je po pravilu ' +
      'previsoka (model je fitovan na tim danima), pa je mjerodavan ' +
      '**leave-one-out** broj: model se ponovo fituje bez dana i pita da li taj ' +
      'dan pada unutar intervala.',
  );
  out();

  if (homes.length === 0) {
    out('**Nema dana sa uzorcima** — nema se šta mjeriti.');
    notice('F3.1: nema dana sa uzorcima');
  }

  for (const home of homes) {
    out(`### Dom ${home.homeProfileId}`);
    out();
    out(`| mjera | vrijednost |`);
    out('|---|---|');
    out(`| prihvaćeno dana za fit | ${home.days} (potrebno ≥ ${MIN_DAYS}) |`);
    out(`| odbijeno dana | ${home.rejected.length} |`);
    if (home.verdict === 'NOT_ENOUGH_DAYS' || home.verdict === 'FIT_FAILED') {
      out(`| presuda | **${home.verdict}** — ${home.note} |`);
      out();
      if (home.rejected.length) {
        const reasons = new Map();
        for (const entry of home.rejected) {
          const list = reasons.get(entry.reason) ?? [];
          list.push(entry.localDate);
          reasons.set(entry.reason, list);
        }
        out('| razlog | dana | dani | zašto (prag iz `daily-balance`) |');
        out('|---|---|---|---|');
        for (const [reason, days] of reasons) {
          out(
            `| \`${reason}\` | ${days.length} | ${days.join(', ')} | ${REJECTION_MEANING[reason] ?? '—'} |`,
          );
        }
        out();
      }
      notice(
        `F3.1 dom ${home.homeProfileId}: ${home.verdict} (${home.days}/${MIN_DAYS} dana, ` +
          `odbijeno ${home.rejected.length})`,
      );
      continue;
    }

    out(`| nagib `+'`s`'+` | ${home.slope.toFixed(4)} |`);
    out(`| interval `+'`s`'+` | [${home.ciLow.toFixed(4)}, ${home.ciHigh.toFixed(4)}] |`);
    out(`| `+'`c`'+` (interni dobici) | ${home.internalGainC.toFixed(3)} |`);
    out(`| rezidual `+'`σ`'+` | ${home.residualStd == null ? '—' : home.residualStd.toFixed(3)} |`);
    out(`| in-sample pokrivenost | ${pct(home.inSample.covered, home.inSample.total)} (${home.inSample.covered}/${home.inSample.total}) |`);
    out(
      `| **leave-one-out pokrivenost** | ${home.loo.sharePct == null ? '—' : `${home.loo.sharePct} %`} ` +
        `(${home.loo.covered}/${home.loo.total}) |`,
    );
    if (home.loo.skipped.length) {
      out(`| LOO preskočeno | ${home.loo.skipped.length} (fit bez dana nije uspio) |`);
    }
    out(`| očekivano | ${home.expectedPct} % (± ${home.tolerancePct} pp) |`);
    out(`| presuda | **${home.verdict}** |`);
    out();
    notice(
      `F3.1 dom ${home.homeProfileId}: ${home.verdict}, LOO ${home.loo.sharePct ?? '—'} % ` +
        `(${home.loo.covered}/${home.loo.total}), in-sample ${pct(home.inSample.covered, home.inSample.total)}, ` +
        `s=${home.slope.toFixed(4)} [${home.ciLow.toFixed(4)}, ${home.ciHigh.toFixed(4)}]`,
    );
  }

  if (modelInfo && modelInfo.length) {
    out('### Šta je zapisano u `HomeModel`');
    out();
    out('| dom | s | CI | c | dana | stanje | verzija |');
    out('|---|---|---|---|---|---|---|');
    for (const model of modelInfo) {
      const f = (value, digits) =>
        value == null ? '—' : Number(value).toFixed(digits);
      out(
        `| ${model.homeProfileId} | ${f(model.slopeS, 4)} | ` +
          `[${f(model.slopeCiLow, 4)}, ${f(model.slopeCiHigh, 4)}] | ` +
          `${f(model.internalGainC, 3)} | ${model.days}/${model.daysEvaluated} | ` +
          `${model.state} | \`${model.modelVersion}\` |`,
      );
    }
    out();
  }

  out(
    '> Ograničenje: pokrivenost se mjeri na danima koji su prošli iste filtere kao ' +
      'fit (`buildDayRow`). Dani koje fit odbije ne ulaze ni u broj, pa pokrivenost ' +
      'opisuje model na podacima koje model i prihvata — ne na cijeloj zimi.',
  );

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    require('node:fs').appendFileSync(summary, lines.join('\n') + '\n');
  }
}

if (selfTest) runSelfTest();

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
