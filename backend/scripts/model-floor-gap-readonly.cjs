#!/usr/bin/env node
/**
 * F4.8 — ŠTA BI MODEL TRAŽIO NA ZAPISANIM ULAZIMA (read-only)
 *
 * **Zašto ova skripta postoji, a prva nije bila dovoljna.** Prvo mjerenje
 * (`flow-floor-gap-readonly.cjs`, run `43285799640`) dalo je
 * `NONE_BELOW_BY_CLAMP: 56 predloga, nijedan ispod 46 °C`. To **nije nalaz**,
 * nego posljedica: do F4.8 su predloge dale kriva i kontroler, a oba su
 * klampovana na 46 (`SYSTEM_MIN_FLOW_C`). Izmjereno na motoru: noć +15 °C daje
 * tačno 46,0 — kriva **ne može** dati ispod 46 ni teoretski. Brojanje
 * zatečenih predloga zato mjeri klamp, ne problem.
 *
 * Ova skripta mjeri pravu stvar: **koliko bi predloga bilo ispod 46 °C kad bi
 * ih dao model**, na **istim ulazima** koje zapis nosi.
 *
 * **Zašto preračun a ne poziv modela na živim podacima.** Zapis (`params`) nosi
 * tačno ulaze koji su tada korišteni: `input.forecast.nightMinC`, `dayMaxC` i
 * snimak `breakdown`-a. Preračun na tim ulazima daje broj koji bi model dao za
 * taj dan — bez ponovnog čitanja prognoze, koja se od tada promijenila.
 *
 * **Šta se NE tvrdi.** Preračun **ne uključuje** model kuće (`slopeS`,
 * `internalGainC`) — ti podaci u `params` nijesu snimljeni. Zato se koristi
 * **referentni nagib** (vrijednost iz mjerenja u planu, s = 0,9, c = 1 K) i to
 * se **imenuje u izlazu**, a ne prećutkuje. Rezultat je stoga **donja granica
 * reda veličine**, ne tačan broj po danu: sa stvarnim nagibom po kući broj se
 * mijenja, ali ne mijenja se zaključak da model traži niže od 46.
 *
 * Skripta je **samo čitanje**: `DATABASE_URL_READONLY`, `SET TRANSACTION READ
 * ONLY`, samo `SELECT`.
 *
 * Upotreba:
 *   DATABASE_URL_READONLY=... node scripts/model-floor-gap-readonly.cjs
 *   ... --days=60  ... --json  ... --self-test
 */
'use strict';

const { Client } = require('pg');

/** Donja granica unosa do F4.8 (granica krive). */
const OLD_FLOOR_C = 46;
/** Apsolutni pod (`ABSOLUTE_MIN_FLOW_C`) — granica poslije F4.8. */
const NEW_FLOOR_C = 30;

/** Referentni nagib iz mjerenja u planu (§10.27). */
const REF_SLOPE = 0.9;
const REF_INTERNAL_GAIN_C = 1;
const REF_TARGET_C = 22;

if (process.argv.includes('--help')) {
  console.log(`Upotreba: DATABASE_URL_READONLY=... node scripts/model-floor-gap-readonly.cjs [opcije]

  --days=N         koliko dana unazad (zadano 60)
  --json           mašinski čitljiv izlaz
  --self-test      provjeri izračun na sintetici, bez baze
  --help           ova poruka

Preracuna F_eq (ravnoteznu polaznu) na zapisanim ulazima i mjeri koliko bi
predloga bilo ispod stare granice unosa (46 °C). Samo SELECT.`);
  process.exit(0);
}

function argValue(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const value = Number(hit.slice(name.length + 3));
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Ravnotežna polazna (`F2`), ista jednačina kao `equilibrium-flow.ts`:
 *
 *   O_ref = 0,7·nightMinC + 0,3·dayMaxC   (kad ima oba)
 *   F_eq  = T_cilj + s·(T_cilj − O_ref) − c
 *
 * `u_day` se **ne** oduzima: isključen je odlukom vlasnika 2026-11-12
 * (`DAY_GAIN_IN_PROPOSAL = false`), pa bi ga ovdje dodavati značilo mjeriti
 * izraz koji ne postoji u proizvodnji.
 *
 * `dayMaxC` može biti `null` (stariji zapisi bez satne prognoze) — tada je
 * referenca samo noć, i to se označava kroz `refSource`.
 */
function equilibriumFlow(input) {
  const { nightMinC, dayMaxC, slopeS, internalGainC, targetRoomC } = input;
  if (nightMinC === null || nightMinC === undefined) return { flowC: null, refSource: 'NO_NIGHT' };

  const hasDay = typeof dayMaxC === 'number' && Number.isFinite(dayMaxC);
  const outdoorRefC = hasDay ? 0.7 * nightMinC + 0.3 * dayMaxC : nightMinC;

  const flowC =
    targetRoomC + slopeS * (targetRoomC - outdoorRefC) - internalGainC;

  return {
    flowC,
    outdoorRefC,
    refSource: hasDay ? 'NIGHT_DAY_BLEND' : 'NIGHT',
  };
}

function classify(flowC) {
  if (flowC === null || flowC === undefined) return 'MISSING';
  if (flowC < NEW_FLOOR_C) return 'BELOW_SYSTEM_FLOOR';
  if (flowC < OLD_FLOOR_C) return 'BETWEEN_FLOORS';
  return 'AT_OR_ABOVE_OLD';
}

function summarize(rows) {
  const total = rows.length;
  const buckets = {
    BELOW_SYSTEM_FLOOR: 0,
    BETWEEN_FLOORS: 0,
    AT_OR_ABOVE_OLD: 0,
    MISSING: 0,
  };
  for (const row of rows) buckets[classify(row.flowC)]++;

  const valid = total - buckets.MISSING;
  /*
   * „Ispod stare granice" je SVE ispod 46 — i ono što pada u novi dozvoljeni
   * pojas (30–46) i ono ispod fizičkog poda. Prva verzija je brojala samo
   * `BELOW_SYSTEM_FLOOR` i self-test je to uhvatio: `classify(30)` je
   * `BETWEEN_FLOORS`, pa bi 34,7 — ključni slučaj F4.8 — bilo **neizbrojano**.
   */
  const below = rows
    .filter((r) => {
      const c = classify(r.flowC);
      return c === 'BELOW_SYSTEM_FLOOR' || c === 'BETWEEN_FLOORS';
    })
    .map((r) => r.flowC);

  const allFlows = rows
    .filter((r) => classify(r.flowC) !== 'MISSING')
    .map((r) => r.flowC);

  return {
    days: total,
    valid,
    /** Koliko bi ih bilo ispod stare granice (46) — dakle blokirano. */
    belowOldFloor: buckets.BELOW_SYSTEM_FLOOR + buckets.BETWEEN_FLOORS,
    // Ista greska kao `belowOldFloor` u prvoj verziji: udio mora biti udio
    // SVEga ispod stare granice, a ne samo onoga ispod fizickog poda.
    ratio:
      valid === 0
        ? null
        : (buckets.BELOW_SYSTEM_FLOOR + buckets.BETWEEN_FLOORS) / valid,
    minC: allFlows.length ? Math.min(...allFlows) : null,
    maxC: allFlows.length ? Math.max(...allFlows) : null,
    /** Najveća razlika između stare granice i modelovog zahtjeva. */
    maxGapK: below.length ? OLD_FLOOR_C - Math.min(...below) : null,
    /** Koliko bi ih palo ispod fizičkog poda poslije F4.8 (treba biti 0). */
    belowSystemFloor: buckets.BELOW_SYSTEM_FLOOR,
  };
}

function verdict(summary) {
  if (summary.days === 0) {
    return { verdict: 'NO_DAYS', reason: 'nijedan DailyRecord sa zapisanom noći u prozoru' };
  }
  if (summary.valid === 0) {
    return {
      verdict: 'NO_USABLE_INPUTS',
      reason:
        `${summary.days} dana, ali nijedan nema \`params.input.forecast.nightMinC\` — ` +
        `bez noći se F_eq ne može preračunati`,
    };
  }
  if (summary.belowOldFloor === 0) {
    return {
      verdict: 'MODEL_ABOVE_OLD_FLOOR',
      reason:
        `${summary.valid} dana, model bi tražio ≥ ${OLD_FLOOR_C} °C na svakom — ` +
        `F4.8 nema šta popraviti na ovim ulazima`,
    };
  }
  return {
    verdict: 'MODEL_BELOW_OLD_FLOOR',
    reason:
      `${summary.belowOldFloor}/${summary.valid} dana bi model tražio ispod ` +
      `${OLD_FLOOR_C} °C (raspon ${summary.minC.toFixed(1)}–${summary.maxC.toFixed(1)}, ` +
      `do ${summary.maxGapK.toFixed(1)} K ispod) — unos zaključan na ` +
      `${OLD_FLOOR_C} bi odbio vlastiti predlog`,
  };
}

async function runSelfTest() {
  let failed = 0;

  // Jednačina: rucno provjereni brojevi iz plana §10.27.
  const checks = [
    { night: 5, day: 11, expect: 34.7 },
    { night: 0, day: 6, expect: 39.2 },
    { night: -5, day: 1, expect: 43.7 },
    { night: -10, day: -4, expect: 48.2 },
  ];
  for (const c of checks) {
    const got = equilibriumFlow({
      nightMinC: c.night,
      dayMaxC: c.day,
      slopeS: REF_SLOPE,
      internalGainC: REF_INTERNAL_GAIN_C,
      targetRoomC: REF_TARGET_C,
    });
    const ok = Math.abs(got.flowC - c.expect) < 0.05;
    if (!ok) failed++;
    console.log(
      `${ok ? 'OK  ' : 'FAIL'} F_eq(noc ${c.night}, dan ${c.day}) = ${got.flowC.toFixed(1)} (ocekivano ${c.expect})`,
    );
  }

  // Bez dana -> referenca je samo noc; rezultat mora biti NIZI (hladnija ref).
  const noDay = equilibriumFlow({
    nightMinC: 5,
    dayMaxC: null,
    slopeS: REF_SLOPE,
    internalGainC: REF_INTERNAL_GAIN_C,
    targetRoomC: REF_TARGET_C,
  });
  const noDayOk = noDay.refSource === 'NIGHT' && noDay.flowC > 34.7;
  if (!noDayOk) failed++;
  console.log(
    `${noDayOk ? 'OK  ' : 'FAIL'} bez dana: ref=${noDay.refSource}, F_eq=${noDay.flowC?.toFixed(1)} (visi od 34,7 jer je ref toplija)`,
  );

  // Nema noci -> nema broja, ne izmislja se.
  const noNight = equilibriumFlow({
    nightMinC: null,
    dayMaxC: 5,
    slopeS: REF_SLOPE,
    internalGainC: REF_INTERNAL_GAIN_C,
    targetRoomC: REF_TARGET_C,
  });
  const noNightOk = noNight.flowC === null;
  if (!noNightOk) failed++;
  console.log(`${noNightOk ? 'OK  ' : 'FAIL'} bez noci: flowC=null (ne izmislja se)`);

  const cases = [
    { name: 'prazno', rows: [], expect: 'NO_DAYS' },
    { name: 'bez ulaza', rows: [{ flowC: null }], expect: 'NO_USABLE_INPUTS' },
    {
      name: 'model iznad granice',
      rows: [{ flowC: 50 }, { flowC: 46 }],
      expect: 'MODEL_ABOVE_OLD_FLOOR',
    },
    {
      name: 'model ispod granice',
      rows: [{ flowC: 34.7 }, { flowC: 50 }],
      expect: 'MODEL_BELOW_OLD_FLOOR',
    },
  ];
  for (const c of cases) {
    const got = verdict(summarize(c.rows));
    const ok = got.verdict === c.expect;
    if (!ok) failed++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${c.name}: ${got.verdict} (ocekivano ${c.expect})`);
  }

  const boundary = [
    [30, 'BETWEEN_FLOORS'],
    [29.9, 'BELOW_SYSTEM_FLOOR'],
    [45.9, 'BETWEEN_FLOORS'],
    [46, 'AT_OR_ABOVE_OLD'],
    [null, 'MISSING'],
  ];
  for (const [value, expect] of boundary) {
    const got = classify(value);
    const ok = got === expect;
    if (!ok) failed++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} classify(${value}) = ${got} (ocekivano ${expect})`);
  }

  // Udio mora brojati i pojas 30-46, ne samo ispod 30.
  const ratioCase = summarize([{ flowC: 34.7 }, { flowC: 50 }]);
  const ratioOk = Math.abs(ratioCase.ratio - 0.5) < 1e-9;
  if (!ratioOk) failed++;
  console.log(
    `${ratioOk ? 'OK  ' : 'FAIL'} udio ispod 46 = ${ratioCase.ratio} (ocekivano 0.5)`,
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
     * Ulazi se čitaju iz `params.input.forecast` — ono što je **stvarno**
     * korišteno tog dana, ne današnja prognoza.
     *
     * `->>` vraća `NULL` i za „nema ključa" i za JSON `null`; to je ovdje
     * ispravno: oba znače „nema noćne prognoze".
     */
    /*
   * Pokrivenost uzorka se mjeri odvojeno od nalaza. Mjereno run `43287531318`:
   * 1 dan od 56 ima `params.input.forecast.nightMinC`. Ako se to prećuti,
   * `1/1` izgleda kao da je mjerenje obuhvatilo 60 dana — a nije.
   */
  const { rows } = await client.query(
      `SELECT
         d."localDate" AS "localDate",
         (d.params->'input'->'forecast'->>'nightMinC')::float8 AS "nightMinC",
         (d.params->'input'->'forecast'->>'dayMaxC')::float8 AS "dayMaxC",
         d."proposedFlowTemp"::float8 AS "proposedFlowC"
       FROM "DailyRecord" d
       WHERE d."localDate" >= to_char(CURRENT_DATE - ($1::int || ' days')::interval, 'YYYY-MM-DD')
       ORDER BY d."localDate"`,
      [days],
    );

    await client.query('COMMIT');

    const computed = rows.map((row) => {
      const eq = equilibriumFlow({
        nightMinC: row.nightMinC,
        dayMaxC: row.dayMaxC,
        slopeS: REF_SLOPE,
        internalGainC: REF_INTERNAL_GAIN_C,
        targetRoomC: REF_TARGET_C,
      });
      return { ...row, flowC: eq.flowC, refSource: eq.refSource };
    });

    const summary = summarize(computed);
    const decision = verdict(summary);

    /*
     * Upozorenje o pokrivenosti: nalaz vrijedi za dane sa ulazima, ne za
     * prozor. `MODEL_BELOW_OLD_FLOOR` na 1 od 56 dana je **smjer**, ne udio —
     * i izlaz to mora reći, inače se čita kao da je 100 % prozora.
     */
    const coverage = {
      withInputs: summary.valid,
      days: summary.days,
      ratio: summary.days === 0 ? null : summary.valid / summary.days,
      thin: summary.valid > 0 && summary.valid / Math.max(summary.days, 1) < 0.5,
    };

    if (process.argv.includes('--json')) {
      console.log(
        JSON.stringify(
          {
            summary,
            coverage,
            ...decision,
            reference: { slopeS: REF_SLOPE, internalGainC: REF_INTERNAL_GAIN_C, targetC: REF_TARGET_C },
            rows: computed.length,
          },
          null,
          2,
        ),
      );
    } else {
      console.log('F4.8 — sta bi model trazio na zapisanim ulazima');
      console.log(`  prozor:                  ${days} dana`);
      console.log(`  dana sa ulazima:         ${summary.valid} / ${summary.days}`);
      console.log(
        `  referenca:               s=${REF_SLOPE}, c=${REF_INTERNAL_GAIN_C} K, cilj ${REF_TARGET_C} °C ` +
          `(model kuce nije u params)`,
      );
      if (summary.minC !== null) {
        console.log(
          `  F_eq raspon:             ${summary.minC.toFixed(1)}–${summary.maxC.toFixed(1)} °C`,
        );
      }
      console.log(`  ispod ${OLD_FLOOR_C} °C:             ${summary.belowOldFloor}`);
      if (summary.ratio !== null) {
        console.log(`  udio:                    ${(summary.ratio * 100).toFixed(1)} %`);
      }
      if (summary.maxGapK !== null) {
        console.log(`  max razlika:             ${summary.maxGapK.toFixed(1)} K ispod granice`);
      }
      console.log(`  ispod ${NEW_FLOOR_C} °C (novi pod):  ${summary.belowSystemFloor}`);
      if (coverage.ratio !== null) {
        console.log(
          `  pokrivenost uzorka:      ${coverage.withInputs}/${coverage.days} ` +
            `(${(coverage.ratio * 100).toFixed(1)} % ima zapisanu nocnu prognozu)`,
        );
      }
      console.log(`\n  ${decision.verdict}: ${decision.reason}`);
      if (coverage.thin) {
        console.log(
          `\n  PAZNJA: nalaz vrijedi za ${coverage.withInputs} dan(a), ne za cijeli ` +
            `prozor od ${coverage.days}. To je SMJER, ne udio.`,
        );
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
