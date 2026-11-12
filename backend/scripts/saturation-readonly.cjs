#!/usr/bin/env node
/**
 * F3.5 — SATURACIJA POLAZNE (read-only)
 *
 * Tvrdnja koja se mjeri: **koliko dana polazna radi na gornjoj granici.** To je
 * jedini pokazatelj da kuća traži više nego što sistem daje — a takva kuća se
 * ne popravlja formulom, nego izolacijom ili većim radijatorima. Formula koja
 * „ne uspijeva" na takvoj kući nije pogrešna; nema šta da predloži.
 *
 * **Dvije različite stvari se mjere odvojeno**, i to je cijela poenta skripte:
 *
 * 1. **predlog na granici** — `proposedFlowTemp ≥ maxHeatingFlowC − 0,1`.
 *    Formulа je tražila maksimum. To može biti i ispravno i pogrešno.
 * 2. **kotao stvarno na granici** — `flowSetC` (izmjereno, `ThermostatObservation`)
 *    na granici. Ovo je dokaz da sistem **radi** na maksimumu.
 *
 * Ako je samo (1), formula je previsoko računala. Ako je samo (2), predlog nije
 * bio dovoljan i kuća je hladna uprkos maksimumu. Ako su oba, kuća je stvarno
 * na granici kapaciteta.
 *
 * Treća mjera je najvažnija za odluku: **koliko je od tih dana bilo hladno.**
 * Dan na granici sa sobom na 21,0 °C nije problem. Dan na granici sa sobom na
 * 18,5 °C je nalaz — i tada nijedna promjena formule ne pomaže.
 *
 * **Šta se NE tvrdi.** Ne mjeri se potrošnja gasa pri satu na granici (nema
 * mjerača po satu) i ne tvrdi se da je granica optimalna. Mjeri se samo koliko
 * često se do nje dolazi i da li je tada bilo hladno.
 *
 * Skripta je **samo čitanje**: `DATABASE_URL_READONLY`, `SET TRANSACTION READ
 * ONLY` unutra transakcije, samo `SELECT`.
 *
 * Upotreba:
 *   DATABASE_URL_READONLY=... node scripts/saturation-readonly.cjs
 *   ... --json
 *   ... --self-test      (bez baze; provjeri klasifikaciju na sintetici)
 */
'use strict';

const { Client } = require('pg');

if (process.argv.includes('--help')) {
  console.log(`Upotreba: DATABASE_URL_READONLY=... node scripts/saturation-readonly.cjs [opcije]

  --json           mašinski čitljiv izlaz
  --self-test      provjeri klasifikaciju na sintetičkim danima, bez baze
  --help           ova poruka

Mjeri koliko dana predlog i kotao rade na gornjoj granici i koliko je tada bilo
hladno. Samo SELECT.`);
  process.exit(0);
}

const selfTest = process.argv.includes('--self-test');
const asJson = process.argv.includes('--json');

const url = process.env.DATABASE_URL_READONLY;
if (!url && !selfTest) {
  console.error('DATABASE_URL_READONLY nije postavljen.');
  process.exit(2);
}

const out = (line = '') => console.log(line);
const notice = (message) => {
  const flat = String(message).replace(/[\r\n]+/g, ' ').replace(/%/g, '%25');
  console.log(`::notice::${flat}`);
};
const num = (value, digits = 1) =>
  value == null || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(digits);
const round = (value, digits = 2) =>
  value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));

/** Isti prag kao `BOILER_FLOW_MAX_C`; ovdje samo kao fallback kad dom nema svoj. */
const SYSTEM_MAX_FLOW_C = 55;
/** Tolerancija „na granici": polazna je zaokružena na 0,1 K. */
const AT_LIMIT_TOLERANCE_K = 0.1;
/**
 * Manjak sobe iznad kojeg dan na granici **jeste** nalaz. Isti prag kao
 * `UNDERSHOOT_TOLERANCE_K` (`flow-constants.ts`): manje od toga je mjerni šum,
 * ne hladna kuća.
 */
const COLD_UNDERSHOOT_K = 1.0;

/**
 * Klasifikacija jednog dana. Vraća `null` kad dan nema podatke za odluku —
 * bolje izostaviti dan nego ga svrstati po pretpostavci.
 */
function classifyDay(row) {
  const limit = row.limitC ?? SYSTEM_MAX_FLOW_C;
  const proposed = row.proposedFlowTemp;
  const atLimit =
    proposed != null && proposed >= limit - AT_LIMIT_TOLERANCE_K ? true : false;
  // Izmjereno grijanje na granici: samo dani kad je kotao stvarno grijao.
  const observedAtLimit =
    row.maxFlowSetC != null && row.maxFlowSetC >= limit - AT_LIMIT_TOLERANCE_K;

  // Manjak sobe: najniža sobna tog dana prema cilju. `null` = nema mjerenja.
  const undershoot =
    row.minRoomC != null && row.targetC != null ? row.targetC - row.minRoomC : null;
  const cold = undershoot != null && undershoot > COLD_UNDERSHOOT_K;

  return {
    atLimit,
    observedAtLimit,
    undershoot,
    cold,
    /**
     * Presuda za taj dan. Imena su namjerno različita jer traže različitu
     * akciju: `CAPACITY` ne popravlja formula, `OVERPROPOSED` može.
     */
    verdict: atLimit
      ? cold
        ? 'CAPACITY'
        : 'AT_LIMIT_WARM'
      : observedAtLimit && cold
        ? 'OBSERVED_ONLY'
        : observedAtLimit
          ? 'OBSERVED_ONLY_WARM'
          : cold
            ? 'COLD_NOT_AT_LIMIT'
            : 'NORMAL',
  };
}

function summarise(rows) {
  const days = rows.map((row) => ({ ...row, ...classifyDay(row) }));
  const total = days.length;
  const atLimit = days.filter((d) => d.atLimit).length;
  const observed = days.filter((d) => d.observedAtLimit).length;
  const capacity = days.filter((d) => d.verdict === 'CAPACITY').length;
  const overproposed = days.filter((d) => d.verdict === 'AT_LIMIT_WARM').length;

  return {
    days: total,
    atLimitDays: atLimit,
    atLimitSharePct: total ? round((100 * atLimit) / total, 1) : null,
    observedAtLimitDays: observed,
    observedAtLimitSharePct: total ? round((100 * observed) / total, 1) : null,
    capacityDays: capacity,
    atLimitWarmDays: overproposed,
    coldNotAtLimitDays: days.filter((d) => d.verdict === 'COLD_NOT_AT_LIMIT').length,
    normalDays: days.filter((d) => d.verdict === 'NORMAL').length,
    /**
     * Presuda cijelog doma — jedan broj koji se može nositi u sažetku.
     * Redoslijed je namjeran: `CAPACITY` nadjačava sve (kuća je hladna UZ
     * maksimum), pa `OVERPROPOSED` (formula traži previše), pa ostalo.
     */
    verdict:
      total === 0
        ? 'NO_DATA'
        : capacity > 0
          ? 'CAPACITY'
          : observed > 0 && overproposed === 0
            ? 'SATURATED_OBSERVED'
            : atLimit > 0
              ? 'AT_LIMIT_SOMETIMES'
              : 'NOT_SATURATED',
  };
}

/* --- samotest ------------------------------------------------------------- */

function runSelfTest() {
  const problems = [];
  const check = (label, row, expected) => {
    const got = classifyDay(row).verdict;
    if (got !== expected) problems.push(`${label}: ${got}, očekivano ${expected}`);
  };

  // Dan na granici i hladno ⇒ kapacitet. Formula tu nije kriva.
  check(
    'granica + podbačaj',
    { limitC: 55, proposedFlowTemp: 55, minRoomC: 18.5, targetC: 21 },
    'CAPACITY',
  );
  // Dan na granici, ali toplo ⇒ formula je tražila previše.
  check(
    'granica + toplo',
    { limitC: 55, proposedFlowTemp: 54.95, minRoomC: 20.8, targetC: 21 },
    'AT_LIMIT_WARM',
  );
  // Kotao je bio na granici a predlog nije ⇒ predlog nije bio dovoljan.
  check(
    'samo izmjereno na granici',
    { limitC: 55, proposedFlowTemp: 48, maxFlowSetC: 55, minRoomC: 19.5, targetC: 21 },
    'OBSERVED_ONLY',
  );
  // Hladno bez granice ⇒ problem nije kapacitet nego kontrola.
  check(
    'hladno, daleko od granice',
    { limitC: 55, proposedFlowTemp: 44, minRoomC: 19, targetC: 21 },
    'COLD_NOT_AT_LIMIT',
  );
  // Dom sa nižim maksimumom: granica je doma, ne 55.
  check(
    'granica doma 50',
    { limitC: 50, proposedFlowTemp: 50, minRoomC: 18.9, targetC: 21 },
    'CAPACITY',
  );
  // Podbačaj manji od praga je šum, ne hladnoća.
  check(
    'podbačaj u granicama šuma',
    { limitC: 55, proposedFlowTemp: 55, minRoomC: 20.5, targetC: 21 },
    'AT_LIMIT_WARM',
  );
  // Bez mjerenja sobe presuda ne smije biti `CAPACITY` (nema dokaza da je hladno).
  check(
    'bez mjerenja sobe',
    { limitC: 55, proposedFlowTemp: 55, minRoomC: null, targetC: 21 },
    'AT_LIMIT_WARM',
  );

  // Sažetak: kapacitet nadjačava sve ostalo.
  const summary = summarise([
    { limitC: 55, proposedFlowTemp: 55, minRoomC: 18.4, targetC: 21 },
    { limitC: 55, proposedFlowTemp: 55, minRoomC: 20.9, targetC: 21 },
    { limitC: 55, proposedFlowTemp: 44, minRoomC: 20.9, targetC: 21 },
  ]);
  if (summary.verdict !== 'CAPACITY') {
    problems.push(`sažetak daje ${summary.verdict}, očekivano CAPACITY`);
  }
  if (summary.atLimitSharePct !== 66.7) {
    problems.push(`udio na granici ${summary.atLimitSharePct}, očekivano 66.7`);
  }

  const empty = summarise([]);
  if (empty.verdict !== 'NO_DATA') problems.push(`prazan skup daje ${empty.verdict}`);

  if (problems.length) {
    console.error('Samotest NIJE prošao:');
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log(
    `Samotest prošao: klasifikacija 7 slučajeva, granica ${SYSTEM_MAX_FLOW_C} °C, ` +
      `tolerancija ${AT_LIMIT_TOLERANCE_K} K, hladno > ${COLD_UNDERSHOOT_K} K.`,
  );
  process.exit(0);
}

if (selfTest) runSelfTest();

/* --- baza ----------------------------------------------------------------- */

/**
 * Jedan red = jedan dan jednog doma, sa svime što klasifikacija traži.
 *
 * Granica je po **domu** (`maxHeatingFlowC`), ne globalna: dom sa podnim
 * grijanjem ima nižu granicu i „na granici" tamo znači nešto drugo. Fallback je
 * granica kotla, ista kao u proizvodu.
 *
 * `minRoomC` i `maxFlowSetC` dolaze iz `ThermostatObservation` jer `DailyRecord`
 * ne pamti najnižu sobu ni najvišu izmjerenu polaznu — a bez njih se dan na
 * granici ne može razlikovati od hladnog dana.
 */
const SATURATION_SQL = `
  SELECT r."homeProfileId",
         r."localDate",
         r."proposedFlowTemp",
         r."maxFlowC"                                    AS "limitC",
         (r."targetMorningTemp")                         AS "targetC",
         o."minRoomC",
         o."maxFlowSetC"
    FROM (
      SELECT r."homeProfileId",
             r."localDate",
             r."proposedFlowTemp",
             -- Granica koju je sistem te noći mogao: dom ili kotao.
             LEAST(55, COALESCE(h."maxHeatingFlowC", 55))::float8 AS "maxFlowC",
             COALESCE(h."targetMorningTemp", h."targetDayTemp") ::float8 AS "targetMorningTemp"
        FROM "DailyRecord" r
        LEFT JOIN "HomeProfile" h ON h.id = r."homeProfileId"
       WHERE r."proposedFlowTemp" IS NOT NULL
    ) r
    LEFT JOIN LATERAL (
      SELECT min(o."roomTempC")::float8    AS "minRoomC",
             max(o."flowSetC")::float8     AS "maxFlowSetC"
        FROM "ThermostatObservation" o
       WHERE o."homeProfileId" = r."homeProfileId"
         AND to_char(o."at" AT TIME ZONE 'Europe/Sarajevo', 'YYYY-MM-DD') = r."localDate"
         AND o."isHeating"
    ) o ON true
   ORDER BY r."homeProfileId", r."localDate"
`;

async function main() {
  const client = new Client({ connectionString: url, ssl: false });
  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query('SET TRANSACTION READ ONLY');

    const { rows } = await client.query(SATURATION_SQL);

    const byHome = new Map();
    for (const row of rows) {
      const list = byHome.get(row.homeProfileId) ?? [];
      list.push(row);
      byHome.set(row.homeProfileId, list);
    }

    const homes = [...byHome.entries()].map(([homeProfileId, list]) => ({
      homeProfileId,
      ...summarise(list),
      recent: list.slice(-5).map((row) => {
        const day = classifyDay(row);
        return {
          localDate: row.localDate,
          proposedC: round(row.proposedFlowTemp, 1),
          limitC: round(row.limitC ?? SYSTEM_MAX_FLOW_C, 1),
          minRoomC: round(row.minRoomC, 1),
          atLimit: day.atLimit,
          undershoot: round(day.undershoot, 2),
          verdict: day.verdict,
        };
      }),
    }));

    await client.query('COMMIT');

    if (asJson) {
      console.log(JSON.stringify({ systemMaxFlowC: SYSTEM_MAX_FLOW_C, homes }, null, 2));
      return;
    }

    out('# F3.5 — saturacija polazne (koliko dana radi na gornjoj granici)');
    out();
    out(
      'Dvije stvari se mjere odvojeno: **predlog na granici** (formula traži ' +
        'maksimum) i **kotao na granici** (izmjereno). Presuda ovisi o tome je li ' +
        `tada bilo hladno (manjak > ${COLD_UNDERSHOOT_K} K).`,
    );
    out();

    if (homes.length === 0) {
      out('**Nema nijednog dana sa predlogom** (`proposedFlowTemp`).');
      notice('F3.5: nema dana sa predlogom — nema se šta mjeriti');
      return;
    }

    for (const home of homes) {
      out(`## Dom ${home.homeProfileId}`);
      out();
      out(`**Presuda: ${home.verdict}** · dana ${home.days}`);
      out();
      out(
        `- predlog na granici: **${home.atLimitDays}** dana (**${num(home.atLimitSharePct, 1)} %**)`,
      );
      out(
        `- kotao izmjereno na granici: **${home.observedAtLimitDays}** dana (**${num(home.observedAtLimitSharePct, 1)} %**)`,
      );
      out(
        `- na granici i hladno (**CAPACITY**): **${home.capacityDays}** · ` +
          `na granici a toplo: **${home.atLimitWarmDays}** · ` +
          `hladno bez granice: **${home.coldNotAtLimitDays}** · normalno: **${home.normalDays}**`,
      );
      out();
      if (home.recent.length) {
        out('| dan | predlog | granica | najniža soba | na granici | manjak | presuda |');
        out('|---|---|---|---|---|---|---|');
        for (const row of home.recent) {
          out(
            `| ${row.localDate} | ${num(row.proposedC, 1)} °C | ${num(row.limitC, 1)} °C | ` +
              `${num(row.minRoomC, 1)} °C | ${row.atLimit ? 'da' : 'ne'} | ` +
              `${row.undershoot == null ? '—' : `${num(row.undershoot, 2)} K`} | ${row.verdict} |`,
          );
        }
        out();
      }
    }

    const totalDays = homes.reduce((acc, h) => acc + h.days, 0);
    const totalAtLimit = homes.reduce((acc, h) => acc + h.atLimitDays, 0);
    const totalCapacity = homes.reduce((acc, h) => acc + h.capacityDays, 0);
    const capacityHomes = homes.filter((h) => h.verdict === 'CAPACITY').length;

    out('## Sažetak');
    out();
    out(
      `F3.5: ${totalDays} dana, ${totalAtLimit} na granici ` +
        `(${num(totalDays ? (100 * totalAtLimit) / totalDays : null, 1)} %), ` +
        `${totalCapacity} na granici i hladno, ${capacityHomes}/${homes.length} dom(ova) u CAPACITY`,
    );
    notice(
      `F3.5: ${totalDays} dana, ${totalAtLimit} na granici, ` +
        `${totalCapacity} CAPACITY, ${capacityHomes}/${homes.length} domova`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`F3.5 skripta je pala: ${error.message}`);
  process.exit(1);
});
