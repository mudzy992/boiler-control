#!/usr/bin/env node
/**
 * F3.4 — GREŠKA PROGNOZE NOĆI (read-only)
 *
 * Tvrdnja koja se mjeri: **`dF/dO = s ≈ 1`, pa 1 K greške u noći znači 1 K
 * greške u polaznoj.** To je razlog zašto se prognoza uopšte provjerava prije
 * nego se povjeri formuli: `nightMinC` nije mjerenje nego predviđanje, a ulazi
 * direktno u `O_ref` (70 % težine).
 *
 * Mjeri se razlika `nightMinC − nightMinOutdoorMeasuredC` po danu:
 *
 *   > 0  prognoza je bila **hladnija** od stvarnosti ⇒ polazna je bila viša
 *        nego što je trebalo (trošenje gasa, ne hladna kuća)
 *   < 0  prognoza je bila **toplija** ⇒ polazna je bila niža (hladna kuća)
 *
 * Znak je bitniji od iznosa: sistematska greška u jednom smjeru se može
 * kompenzovati, slučajna ne može i mora se apsorbovati u `s`.
 *
 * **Zašto histogram, a ne prosjek.** Prosjek dvije greške od +3 K i −3 K je 0 —
 * a to nije „prognoza je dobra", nego „prognoza promašuje u oba smjera". Zato
 * se uz prosjek ispisuje medijana, 90. percentil apsolutne greške i udio dana
 * sa promašajem većim od 2 K (isti prag kao `NIGHT_COMPARABLE_TOLERANCE_K`: iznad
 * njega noć više nije poredljiva i dokaz ne važi).
 *
 * **Šta se NE tvrdi.** Ovo mjeri grešku **prognoze**, ne modela. Model može biti
 * tačan i uz stalnu grešku prognoze; ono što se ovdje dobija je koliko `s` mora
 * da nosi. Ako je greška velika, `slopeCi` je širi i F3.1 pokrivenost pada —
 * dva mjerenja se moraju čitati zajedno.
 *
 * Skripta je **samo čitanje**: `DATABASE_URL_READONLY`, `SET TRANSACTION READ
 * ONLY` unutar transakcije, samo `SELECT`.
 *
 * Upotreba:
 *   DATABASE_URL_READONLY=... node scripts/forecast-error-readonly.cjs
 *   ... --min-days=5 --json
 *   ... --self-test        (bez baze; provjeri statistiku na sintetici)
 */
'use strict';

const { Client } = require('pg');

if (process.argv.includes('--help')) {
  console.log(`Upotreba: DATABASE_URL_READONLY=... node scripts/forecast-error-readonly.cjs [opcije]

  --min-days=<n>   minimalan broj dana za izvještaj (default 5)
  --json           mašinski čitljiv izlaz
  --self-test      provjeri statistiku na sintetičkom nizu, bez baze
  --help           ova poruka

Mjeri nightMinC - nightMinOutdoorMeasuredC po danu. Samo SELECT.`);
  process.exit(0);
}

const selfTest = process.argv.includes('--self-test');
const asJson = process.argv.includes('--json');
const minDaysArg = process.argv.find((a) => a.startsWith('--min-days='));
const MIN_DAYS = minDaysArg ? Number(minDaysArg.split('=')[1]) : 5;

const url = process.env.DATABASE_URL_READONLY;
if (!url && !selfTest) {
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
const num = (value, digits = 1) =>
  value == null || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(digits);

/* --- statistika ----------------------------------------------------------- */

/**
 * Prag iznad kojeg noć nije poredljiva — isti broj kao
 * `NIGHT_COMPARABLE_TOLERANCE_K` u `DailyRecord/flow-bounds.ts`. Ovdje je
 * ponovljen namjerno: skripta ne uvozi `flow-bounds.ts` jer mjeri **prognozu**,
 * a ne granicu, i ne treba joj cijeli modul sa Prisma tipovima.
 */
const COMPARABLE_TOLERANCE_K = 2;
/** Histogram se dijeli na kante od 1 K; dovoljno za oblik, ne za lažnu preciznost. */
const BUCKET_K = 1;

const round = (value, digits = 2) =>
  value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Linearna interpolacija percentila (ista definicija kao `numpy.percentile`). */
function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

/**
 * Analiza jednog niza grešaka.
 *
 * `errors` su `nightMinC − measured`, dakle **pozitivno = prognoza hladnija**.
 * Vraća i `bias` (prosjek) i `medianBias`: kad se razlikuju, niz ima repove i
 * prosjek sam nije dovoljan da se opiše.
 */
function analyseErrors(errors) {
  const n = errors.length;
  if (n === 0) {
    return { days: 0, status: 'NO_DATA' };
  }
  const abs = errors.map((e) => Math.abs(e));
  const mean = errors.reduce((a, b) => a + b, 0) / n;

  // Histogram po kantama od 1 K, sa imenovanim centrom kante.
  const buckets = new Map();
  for (const e of errors) {
    const bucket = Math.floor(e / BUCKET_K) * BUCKET_K;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  const histogram = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([from, count]) => ({
      fromC: from,
      toC: from + BUCKET_K,
      label: `${from >= 0 ? '+' : ''}${from} … ${from + BUCKET_K >= 0 ? '+' : ''}${from + BUCKET_K} K`,
      count,
      sharePct: round((100 * count) / n, 1),
    }));

  return {
    days: n,
    status: n >= MIN_DAYS ? 'OK' : 'NOT_ENOUGH_DAYS',
    // Prosjek nosi znak sistematske greške; medijana kaže da li je tipičan dan
    // promašen. Oba su potrebna: prosjek 0 uz medijanu 1,5 K znači da pola
    // dana ide u jednu a pola u drugu stranu.
    bias: round(mean, 2),
    medianBias: round(median(errors), 2),
    meanAbsError: round(abs.reduce((a, b) => a + b, 0) / n, 2),
    p90AbsError: round(percentile(abs, 90), 2),
    maxAbsError: round(Math.max(...abs), 2),
    /** Udio dana kad prognoza promašuje više od poredljivog praga. */
    shareBeyondTolerancePct: round(
      (100 * abs.filter((a) => a > COMPARABLE_TOLERANCE_K).length) / n,
      1,
    ),
    /** Znak sistematske greške: `COLDER` = prognoza hladnija (viša polazna). */
    direction:
      Math.abs(mean) < 0.2 ? 'NEUTRAL' : mean > 0 ? 'COLDER' : 'WARMER',
    histogram,
    /**
     * 1 K greške u noći ⇒ koliko K u polaznoj. Nije 1 po definiciji: množi se
     * težinom noći u referenci (`DAY_REFERENCE_WEIGHT`) i nagibom `s`, pa se
     * ovo polje popunjava pozivalac kad ima model. Ovdje ostaje `null` da se ne
     * izmisli broj — v. `--s=` opciju u izlazu iznad.
     */
    flowErrorPerKelvin: null,
  };
}

/* --- sintetika za samotest ------------------------------------------------ */

function runSelfTest() {
  const problems = [];

  // 1) Nula greške: bias 0, nema dana iznad praga.
  const flat = analyseErrors([0, 0, 0, 0, 0]);
  if (flat.bias !== 0) problems.push(`nulti niz daje bias ${flat.bias}, očekivano 0`);
  if (flat.shareBeyondTolerancePct !== 0) {
    problems.push(`nulti niz ima ${flat.shareBeyondTolerancePct} % iznad praga`);
  }

  // 2) Sistematska greška: prognoza uvijek 1,5 K hladnija ⇒ bias +1,5, smjer COLDER.
  const biased = analyseErrors([1.5, 1.5, 1.5, 1.5, 1.5]);
  if (biased.bias !== 1.5) problems.push(`sistematska greška daje bias ${biased.bias}`);
  if (biased.direction !== 'COLDER') {
    problems.push(`sistematska greška daje smjer ${biased.direction}`);
  }

  // 3) Repovi: +3 i −3 se poništavaju u prosjeku, ali NE u medijani apsolutne.
  //    Ovo je razlog postojanja percentila; ako prosjek postane jedina mjera,
  //    ovaj test pada.
  const tails = analyseErrors([3, -3, 3, -3, 0]);
  if (tails.bias !== 0) problems.push(`repovi daju bias ${tails.bias}, očekivano 0`);
  if (!(tails.p90AbsError >= 3)) {
    problems.push(`repovi daju p90 ${tails.p90AbsError}, očekivano ≥ 3`);
  }
  if (!(tails.shareBeyondTolerancePct > 0)) {
    problems.push('repovi nisu prepoznati kao promašaj iznad praga');
  }

  // 4) Percentil: za 1..10, p90 mora biti 9,1 (linearna interpolacija), a ne 10.
  const seq = percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90);
  if (Math.abs(seq - 9.1) > 1e-9) problems.push(`percentil 90 je ${seq}, očekivano 9.1`);

  // 5) Ispod praga dana: status mora reći šta je, ne pasti.
  const few = analyseErrors([0.5]);
  if (few.status !== 'NOT_ENOUGH_DAYS') problems.push(`1 dan daje status ${few.status}`);

  if (problems.length) {
    console.error('Samotest NIJE prošao:');
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log(
    `Samotest prošao: bias ${biased.bias} K smjer ${biased.direction}, ` +
      `p90 aps. ${tails.p90AbsError} K, prag ${COMPARABLE_TOLERANCE_K} K, MIN_DAYS ${MIN_DAYS}.`,
  );
  process.exit(0);
}

if (selfTest) runSelfTest();

/* --- baza ----------------------------------------------------------------- */

/**
 * Jedan dan = jedna prognoza i jedno mjerenje.
 *
 * Oba polja postoje od F1; `nightMinC` je prognoza koja je bila osnov predloga,
 * `nightMinOutdoorMeasuredC` je najhladniji izmjereni sat te noći. Dan sa samo
 * jednim od njih **ne ulazi** — razlika se ne izmišlja.
 */
const ERROR_SQL = `
  SELECT r."homeProfileId",
         r."localDate",
         r."nightMinC"                  AS "forecastC",
         r."nightMinOutdoorMeasuredC"   AS "measuredC",
         (r."nightMinC" - r."nightMinOutdoorMeasuredC")::float8 AS "errorC"
    FROM "DailyRecord" r
   WHERE r."nightMinC" IS NOT NULL
     AND r."nightMinOutdoorMeasuredC" IS NOT NULL
   ORDER BY r."homeProfileId", r."localDate"
`;

/**
 * Rezerva: izmjereni noćni minimum iz **satnih uzoraka**, kad kolona
 * `nightMinOutdoorMeasuredC` nije popunjena.
 *
 * Zašto ovo postoji: kolonu piše samo `DailyOutcomeService` (jednom dnevno), a
 * `backfill-reconstruction.ts` je izričito ne piše — pa 301 od 305 dana u
 * produkciji nema tu vrijednost, iako **uzorci za nju postoje**. Bez rezerve bi
 * F3.4 čekao mjesec dana da backfillovani dani dobiju obračun, iako se greška
 * prognoze može izmjeriti odmah.
 *
 * Isti prozor kao `day-outcome.ts` (`NIGHT_START_LOCAL_HOUR` 22 →
 * `NIGHT_END_LOCAL_HOUR` 6) i **ista zona** kao ostatak repo-a. Granica je
 * namjerno ista: ako se prozor raziđe, mjeri se druga noć, a razlika izgleda
 * kao greška prognoze.
 *
 * Kolona ostaje prvi izvor. Rezerva se koristi samo za dane gdje je `null`, i
 * to se u izlazu imenuje (`source`), da se dva broja ne pomiješaju tiho.
 */
const FALLBACK_NIGHT_SQL = `
  WITH night AS (
    SELECT r."homeProfileId",
           r."localDate",
           min(o."outdoorTempC")::float8 AS "measuredC",
           count(o."outdoorTempC")::int AS "samples"
      FROM "DailyRecord" r
      JOIN "ThermostatObservation" o
        ON o."homeProfileId" = r."homeProfileId"
       AND (
         -- Noć pripada danu u koji se uliva: 22:00 prethodnog dana → 06:00 ovog.
         (o."at" AT TIME ZONE 'Europe/Sarajevo') >=
           ((r."localDate"::timestamp - interval '2 hours') AT TIME ZONE 'Europe/Sarajevo')
         AND (o."at" AT TIME ZONE 'Europe/Sarajevo') <
           ((r."localDate"::timestamp + interval '6 hours') AT TIME ZONE 'Europe/Sarajevo')
       )
     WHERE r."nightMinC" IS NOT NULL
       AND r."nightMinOutdoorMeasuredC" IS NULL
       AND o."outdoorTempC" IS NOT NULL
     GROUP BY 1, 2
  )
  SELECT "homeProfileId", "localDate", "measuredC", "samples"
    FROM night
   WHERE "samples" >= 8
   ORDER BY 1, 2
`;

async function main() {
  const client = new Client({ connectionString: url, ssl: false });
  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query('SET TRANSACTION READ ONLY');

    const { rows: fromColumn } = await client.query(ERROR_SQL);
    const { rows: fromSamples } = await client.query(FALLBACK_NIGHT_SQL);

    // Kolona je prvi izvor; rezerva popunjava samo dane gdje je `null`.
    const rows = [
      ...fromColumn.map((row) => ({ ...row, source: 'COLUMN' })),
      ...fromSamples
        .filter(
          (row) =>
            !fromColumn.some(
              (c) =>
                c.homeProfileId === row.homeProfileId &&
                c.localDate === row.localDate,
            ),
        )
        .map((row) => ({
          homeProfileId: row.homeProfileId,
          localDate: row.localDate,
          forecastC: null,
          measuredC: row.measuredC,
          errorC: null,
          source: 'NIGHT_SAMPLES',
        })),
    ];

    // Rezervi treba i prognoza iz istog reda; dohvata se jednim upitom, da se
    // ne spoji pogrešan dan sa pogrešnom noći.
    if (rows.some((row) => row.source === 'NIGHT_SAMPLES')) {
      const { rows: forecasts } = await client.query(
        `SELECT "homeProfileId", "localDate", "nightMinC"::float8 AS "forecastC"
           FROM "DailyRecord"
          WHERE "nightMinC" IS NOT NULL`,
      );
      const byKey = new Map(
        forecasts.map((f) => [`${f.homeProfileId}|${f.localDate}`, f.forecastC]),
      );
      for (const row of rows) {
        if (row.source === 'NIGHT_SAMPLES') {
          row.forecastC = byKey.get(`${row.homeProfileId}|${row.localDate}`) ?? null;
          row.errorC =
            row.forecastC == null || row.measuredC == null
              ? null
              : row.forecastC - row.measuredC;
        }
      }
    }

    const usable = rows.filter((row) => row.errorC != null);
    const byHome = new Map();
    for (const row of usable) {
      const list = byHome.get(row.homeProfileId) ?? [];
      list.push(row);
      byHome.set(row.homeProfileId, list);
    }

    const homes = [...byHome.entries()].map(([homeProfileId, list]) => {
      const analysis = analyseErrors(list.map((r) => r.errorC));
      return {
        homeProfileId,
        ...analysis,
        // Zadnjih pet dana se ispisuje imenom: prosjek skriva da je posljednji
        // dan bio najgori, a to je jedino što se može odmah popraviti.
        // Izvor se nosi dalje: bez toga se broj iz kolone i broj iz uzoraka
        // sabiraju kao da su ista stvar.
        sources: {
          COLUMN: list.filter((r) => r.source === 'COLUMN').length,
          NIGHT_SAMPLES: list.filter((r) => r.source === 'NIGHT_SAMPLES').length,
        },
        recent: list.slice(-5).map((r) => ({
          localDate: r.localDate,
          source: r.source,
          forecastC: round(r.forecastC, 1),
          measuredC: round(r.measuredC, 1),
          errorC: round(r.errorC, 2),
        })),
        worst: [...list]
          .sort((a, b) => Math.abs(b.errorC) - Math.abs(a.errorC))
          .slice(0, 3)
          .map((r) => ({
            localDate: r.localDate,
            errorC: round(r.errorC, 2),
            forecastC: round(r.forecastC, 1),
            measuredC: round(r.measuredC, 1),
          })),
      };
    });

    await client.query('COMMIT');

    if (asJson) {
      console.log(
        JSON.stringify(
          {
            minDays: MIN_DAYS,
            toleranceK: COMPARABLE_TOLERANCE_K,
            homes,
          },
          null,
          2,
        ),
      );
      return;
    }

    out('# F3.4 — greška prognoze noći (`nightMinC` vs. izmjereno)');
    out();
    out(
      'Razlika je `prognoza − izmjereno`: **pozitivno** znači da je prognoza bila ' +
        'hladnija (polazna viša nego što treba), **negativno** da je bila toplija ' +
        '(hladna kuća).',
    );
    out();

    if (homes.length === 0) {
      out('**Nema nijednog dana sa oba polja** (`nightMinC` i `nightMinOutdoorMeasuredC`).');
      out();
      out(
        'To nije kvar skripte. `nightMinOutdoorMeasuredC` piše `DailyOutcomeService` ' +
          'poslije prvog obračuna dana; dok ga nema, greška prognoze nema osnova.',
      );
      notice('F3.4: nema dana sa prognozom i mjerenjem — nema se šta mjeriti');
      return;
    }

    for (const home of homes) {
      out(`## Dom ${home.homeProfileId}`);
      out();
      if (home.days === 0) {
        out('Nema dana.');
        out();
        continue;
      }
      out(
        `Dana: **${home.days}** · status **${home.status}**` +
          (home.status === 'NOT_ENOUGH_DAYS' ? ` (prag ${MIN_DAYS})` : ''),
      );
      out();
      out(
        `- bias (prosjek): **${num(home.bias, 2)} K** · medijana: **${num(home.medianBias, 2)} K** · smjer **${home.direction}**`,
      );
      out(
        `- greška (apsolutna): prosjek **${num(home.meanAbsError, 2)} K**, ` +
          `p90 **${num(home.p90AbsError, 2)} K**, najveća **${num(home.maxAbsError, 2)} K**`,
      );
      out(
        `- iznad poredljivog praga (${COMPARABLE_TOLERANCE_K} K): **${num(home.shareBeyondTolerancePct, 1)} %** dana`,
      );
      out();
      out(
        `Izvori mjerenja: **${home.sources.COLUMN}** iz obračuna dana ` +
          `(\`nightMinOutdoorMeasuredC\`), **${home.sources.NIGHT_SAMPLES}** iz satnih uzoraka ` +
          '(22–06, ≥ 8 uzoraka).',
      );
      out();
      out('| kanta | dana | udio |');
      out('|---|---|---|');
      for (const bucket of home.histogram) {
        out(`| ${bucket.label} | ${bucket.count} | ${bucket.sharePct} % |`);
      }
      out();
      if (home.recent.length) {
        out('Zadnjih dana:');
        out();
        out('| dan | prognoza | izmjereno | razlika | izvor |');
        out('|---|---|---|---|---|');
        for (const row of home.recent) {
          out(
            `| ${row.localDate} | ${num(row.forecastC, 1)} °C | ${num(row.measuredC, 1)} °C | ` +
              `${num(row.errorC, 2)} K | ${row.source === 'COLUMN' ? 'obračun' : 'satni uzorci'} |`,
          );
        }
        out();
      }
      if (home.worst.length) {
        out(
          `Najveće greške: ${home.worst
            .map((w) => `${w.localDate} (${num(w.errorC, 1)} K)`)
            .join(', ')}`,
        );
        out();
      }
    }

    // --- sažetak u jednoj liniji (za CI anotaciju) -------------------------
    const withDays = homes.filter((h) => h.days > 0);
    const totalDays = withDays.reduce((acc, h) => acc + h.days, 0);
    const weightedBias =
      totalDays === 0
        ? null
        : withDays.reduce((acc, h) => acc + h.bias * h.days, 0) / totalDays;
    const worstP90 = withDays.length ? Math.max(...withDays.map((h) => h.p90AbsError ?? 0)) : null;

    out('## Sažetak');
    out();
    out(
      `F3.4: ${totalDays} dana, bias ${num(weightedBias, 2)} K, ` +
        `p90 aps. greške ${num(worstP90, 2)} K, ` +
        `${withDays.filter((h) => h.status === 'NOT_ENOUGH_DAYS').length} dom(ova) sa < ${MIN_DAYS} dana`,
    );
    notice(
      `F3.4: ${totalDays} dana, bias ${num(weightedBias, 2)} K, ` +
        `p90 ${num(worstP90, 2)} K, prag ${COMPARABLE_TOLERANCE_K} K`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`F3.4 skripta je pala: ${error.message}`);
  process.exit(1);
});
