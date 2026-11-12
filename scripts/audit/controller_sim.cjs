#!/usr/bin/env node
/*
 * CONTROLLER CLOSED-LOOP SIMULATION (17 §11, gate for §13 step 6)
 *
 * Runs 60 simulated days through the REAL modules:
 *
 *   samples → buildDayRow + fitDailyBalance   (HomeModel/daily-balance.ts)
 *           → computeDayOutcome                (DailyRecord/day-outcome.ts)
 *           → nightFloorFrom                   (DailyRecord/flow-bounds.ts)
 *           → decideProposal                   (DailyRecord/proposal-controller.ts)
 *
 * The physics is a single-capacity house (same as learning_sim.cjs) with a
 * 0,5 °C sensor quantisation, a 1-minute poll and a 60 s actuation lag. No
 * boiler minimum modulation, no sun, no DHW, no window opening — that limit is
 * printed with the result, not hidden.
 *
 * Usage: node scripts/audit/controller_sim.cjs [--days=60] [--trace] [--json]
 * Bez mreže, baze i tajni. Rezultat važi za model, ne za instalaciju.
 */
'use strict';

const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert');

if (process.argv.includes('--help')) {
  console.log(`Upotreba: node scripts/audit/controller_sim.cjs [opcije]

  --days=<n>     broj simuliranih dana (default 60)
  --trace        ispiši tok po danu
  --json         mašinski čitljiv izlaz
  --help         ova poruka

Zatvorena petlja kroz stvarne module: fit nagiba, ishod dana, noćni minimum i
odluka kontrolera. Mjeri da li kontroler nađe nižu polaznu bez gubitka komfora.
Bez mreže, baze i izmjene aplikacijskog koda.`);
  process.exit(0);
}

const asJson = process.argv.includes('--json');

/*
 * F3.8 (osjetljivost): `decideProposal` čita `STEP_UP_K`, `STEP_DOWN_K` i
 * `DWELL_DAYS` iz svog modula pri **svakom** pozivu. Zato se vrijednost za
 * jedan prolaz može promijeniti upisom u `exports` tog modula — bez kopije
 * kontrolera i bez izmjene aplikacijskog koda (modul se učitava `transpile-only`
 * i izvršava iz `src/`).
 *
 * Namjerno se ne dodaje parametar u `decideProposal`: proizvod ne treba da ima
 * prekidač za podešavanje praga, a mjerenje ga treba.
 */
const PARAM_ARG = process.argv.find((a) => a.startsWith('--params='));

function effectiveParams() {
  return {
    STEP_UP: controllerModule.STEP_UP_K,
    STEP_DOWN: controllerModule.STEP_DOWN_K,
    DWELL: controllerModule.DWELL_DAYS,
  };
}

function paramOverrides() {
  if (!PARAM_ARG) return null;
  const out = {};
  for (const pair of PARAM_ARG.slice('--params='.length).split(',')) {
    const [key, raw] = pair.split('=');
    if (!['STEP_UP', 'STEP_DOWN', 'DWELL'].includes(key)) {
      throw new Error(`Nepoznat parametar: ${key} (dozvoljeno: STEP_UP, STEP_DOWN, DWELL)`);
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Vrijednost za ${key} mora biti broj > 0, dobijeno: ${raw}`);
    }
    out[key] = value;
  }
  return Object.keys(out).length ? out : null;
}

/** Postavi privremene vrijednosti; vraća funkciju za vraćanje. */
function withParams(controller, overrides) {
  if (!overrides) return () => {};
  const map = {
    STEP_UP: 'STEP_UP_K',
    STEP_DOWN: 'STEP_DOWN_K',
    DWELL: 'DWELL_DAYS',
  };
  const saved = {};
  for (const [key, value] of Object.entries(overrides)) {
    const name = map[key];
    saved[name] = controller[name];
    controller[name] = value;
  }
  return () => {
    for (const [name, value] of Object.entries(saved)) controller[name] = value;
  };
}
const trace = process.argv.includes('--trace');
const daysArg = process.argv.find((a) => a.startsWith('--days='));
const days = daysArg ? Number(daysArg.split('=')[1]) : 60;

process.env.TZ = 'Europe/Sarajevo';
const root = path.resolve(__dirname, '../..');
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');

// Moduli koji se koriste su čisti (bez Prisma-e, baze i Nest-a), pa nema stubs.
require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));

const {
  computeDayOutcome,
} = require(path.join(root, 'backend/src/modules/DailyRecord/day-outcome.ts'));
const {
  nightFloorFrom,
} = require(path.join(root, 'backend/src/modules/DailyRecord/flow-bounds.ts'));
const controllerModule = require(path.join(
  root,
  'backend/src/modules/DailyRecord/proposal-controller.ts',
));
const { decideProposal, shortCycleFloorFrom } = controllerModule;
const {
  buildDayRow,
  fitDailyBalance,
} = require(path.join(root, 'backend/src/modules/HomeModel/daily-balance.ts'));

// --- fiksne postavke sistema (iz koda, ne pretpostavke) -------------------
const DEAD_ZONE = 1.0;
const SENSOR_STEP = 0.5;
const MIN_SWITCH_MIN = 2;
const TARGET_ROOM = 21.0;
const EPS_UNDERSHOOT = 1.0;
const FLOW_MIN = 30;
const FLOW_MAX = 55;
const SAMPLES_PER_DAY = 288;

// --- kuće (iste kao learning_sim.cjs) ------------------------------------
const HOUSES = {
  light: { C: 3e6, k1: 190, k2: 143.4 },
  medium: { C: 6e6, k1: 212, k2: 200 },
  heavy: { C: 12e6, k1: 240, k2: 240 },
};

const EPOCH = Date.UTC(2026, 10, 1); // 2026-11-01
const zone = 'UTC';
const localDateOf = (dayIndex) =>
  new Date(EPOCH + dayIndex * 1440 * 60000).toISOString().slice(0, 10);

let seed = 20261108;
const resetSeed = () => {
  seed = 20261108;
};
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const gauss = () => {
  const u = Math.max(rnd(), 1e-9);
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

function outdoorAt(dayIndex, minuteOfDay) {
  const phase = (2 * Math.PI * dayIndex) / 45;
  const dailyMean = 1.5 + 5.5 * Math.cos(phase);
  const amplitude = 2.0;
  const t = (minuteOfDay - 310) / 1440;
  return dailyMean + amplitude * Math.cos(2 * Math.PI * t) + 0.15 * gauss();
}

/**
 * Najhladniji sat **predstojeće** noći: 22:00 → 06:00 sljedećeg dana.
 *
 * Isti oblik prozora koji `computeDayOutcome` mjeri (samo pomjeren naprijed),
 * pa su prognoza i izmjereni dokaz poredljivi. `learning_sim.cjs` koristi
 * 06:00 → 06:00, što za ovu provjeru nije isto.
 */
const nightWindowMinFor = (dayIndex) => {
  let mn = Infinity;
  for (let m = 1320; m < 1440; m += 5) mn = Math.min(mn, outdoorAt(dayIndex, m));
  for (let m = 0; m <= 360; m += 5) mn = Math.min(mn, outdoorAt(dayIndex + 1, m));
  return mn;
};

// današnja formula (16 §3.3), bez naučenog offseta — početna vrijednost
function formulaFlow(min, max) {
  const ext = Math.max(-15, Math.min(10, 0.7 * min + 0.3 * max));
  if (ext >= 10) return 45;
  if (ext <= -15) return 56;
  return 51 - 0.3 * ext;
}

const round = (n, d = 2) =>
  typeof n === 'number' && Number.isFinite(n) ? Number(n.toFixed(d)) : n;

// --- dnevni redovi za fit (stvarni buildDayRow) ---------------------------
function aggregate(samples, localDate) {
  let heatingSamples = 0;
  let heatingPairs = 0;
  let flowMinusRoomSum = 0;
  let roomSum = 0;
  let roomCount = 0;
  let outdoorSum = 0;
  let outdoorSamples = 0;

  for (const s of samples) {
    if (s.at.toISOString().slice(0, 10) !== localDate) continue;
    if (s.isHeating) heatingSamples += 1;
    if (s.roomTempC != null) {
      roomSum += s.roomTempC;
      roomCount += 1;
    }
    if (s.outdoorTempC != null) {
      outdoorSum += s.outdoorTempC;
      outdoorSamples += 1;
    }
    if (s.isHeating && s.flowSetC != null && s.roomTempC != null) {
      heatingPairs += 1;
      flowMinusRoomSum += s.flowSetC - s.roomTempC;
    }
  }

  return {
    localDate,
    samples: samples.length,
    heatingSamples,
    heatingPairs,
    flowMinusRoomSum,
    roomSum,
    outdoorSum,
    outdoorSamples,
    targetRoomC: TARGET_ROOM,
  };
}

// --- simulacija -----------------------------------------------------------
function simulate(house) {
  resetSeed();
  const { C, k1, k2 } = house;
  const qInt = 200;

  let room = TARGET_ROOM - 0.5;
  let heating = false;
  let heatingPrev = false;
  let lastSwitchMin = -999;
  let prevHeatingForRecord = false;
  let flow = null;

  const samples = [];
  const aggregates = [];
  const outcomes = new Map();
  const dayLog = [];
  const decisions = [];

  let lastChangeDay = null;
  let learnedShortCycleFloor = null;
  let previousFlow = null;
  let lastOutcome = null;
  let lastOutcomeDay = null;

  for (let day = 0; day < days; day++) {
    const localDate = localDateOf(day);

    // 1. model: fit na svim završenim danima (stvarni moduli)
    const rows = [];
    for (const dayAggregate of aggregates) {
      const built = buildDayRow(dayAggregate);
      if (built.ok) rows.push(built.row);
    }
    const fit = fitDailyBalance(rows);
    const slope = fit.status === 'ok' ? fit.slope : null;
    // Baza se računa sa GORNJOM granicom intervala: potcijenjen `s` daje
    // prenisku ravnotežnu polaznu, a to je hladna kuća (24 §4).
    const slopeForBase =
      fit.status === 'ok' && Number.isFinite(fit.ciHigh) ? fit.ciHigh : null;

    // 2. noćni minimum iz izmjerenih noći (stvarni modul)
    const forecastNightMin = nightWindowMinFor(day);
    const evidence = [];
    for (let d = Math.max(0, day - 30); d < day; d++) {
      const outcome = outcomes.get(d);
      if (!outcome) continue;
      if (
        outcome.nightFlowC == null ||
        outcome.nightMinOutdoorC == null ||
        outcome.nightUndershootC == null
      ) {
        continue;
      }
      evidence.push({
        flowC: outcome.nightFlowC,
        nightMinOutdoorC: outcome.nightMinOutdoorC,
        nightUndershootC: outcome.nightUndershootC,
      });
    }
    const night = nightFloorFrom({ evidence, forecastNightMinC: forecastNightMin });

    // 3. odluka (stvarni modul)
    const modelFlowC =
      slopeForBase == null
        ? null
        : TARGET_ROOM + slopeForBase * (TARGET_ROOM - forecastNightMin);

    const decision = decideProposal({
      modelFlowC,
      previousFlowC: previousFlow,
      daysSinceChange: lastChangeDay == null ? null : day - lastChangeDay,
      outcome:
        lastOutcome == null || lastOutcomeDay !== day - 1
          ? null
          : {
              undershootC: lastOutcome.undershootC,
              overshootC: lastOutcome.overshootC,
              nightUndershootC: lastOutcome.nightUndershootC,
              medianCycleMin: lastOutcome.medianCycleMin,
            },
      night: { floorC: night.floorC, basis: night.basis },
      shortCycleFloorC: learnedShortCycleFloor,
      // Simulacija nema model bojlera; pretpostavlja se potvrđen model sa
      // odvojenim krugovima. Pravilo `MODEL_UNVERIFIED` pokriveno je testom.
      flowAdviceAllowed: true,
      modelState: slope == null ? 'COLD_START' : 'TRACKING',
    });

    // 4. bez odluke kontrolera ostaje današnja formula (kao u proizvodu)
    const { min, max } = (() => {
      let mn = Infinity;
      let mx = -Infinity;
      for (let m = 0; m < 1440; m += 5) {
        const t = outdoorAt(day, m);
        if (t < mn) mn = t;
        if (t > mx) mx = t;
      }
      return { min: mn, max: mx };
    })();

    const next = decision.flowC == null ? formulaFlow(min, max) : decision.flowC;
    if (previousFlow != null && Math.abs(next - previousFlow) > 1e-9) {
      lastChangeDay = day;
    }
    flow = Math.round(Math.max(FLOW_MIN, Math.min(FLOW_MAX, next)) * 10) / 10;
    previousFlow = flow;

    decisions.push({
      day,
      flow,
      action: decision.action,
      reasons: decision.reasons.join('+'),
      basis: night.basis,
      floorC: night.floorC,
      slope: round(slope, 4),
    });

    // 5. fizika dana, uzorak na 5 min
    const dayStartSample = samples.length;
    let dayMinRoom = room;
    let dayCycles = 0;
    let reachedAtMin = null;

    for (let m = 0; m < 1440; m++) {
      const tMin = day * 1440 + m;
      const tOut = outdoorAt(day, m);
      const sensor = Math.round(room / SENSOR_STEP) * SENSOR_STEP;

      if (heating) {
        if (sensor >= TARGET_ROOM) heating = false;
      } else if (sensor <= TARGET_ROOM - DEAD_ZONE) {
        heating = true;
      }
      if (heating !== heatingPrev) {
        if (tMin - lastSwitchMin >= MIN_SWITCH_MIN) {
          lastSwitchMin = tMin;
          if (heating) dayCycles += 1;
        } else {
          heating = heatingPrev;
        }
        heatingPrev = heating;
      }

      const q = heating ? Math.max(0, k1 * (flow - room)) : 0;
      room += ((q - k2 * (room - tOut) + qInt) / C) * 60;
      room = Math.max(-10, Math.min(40, room));

      const sensorNow = Math.round(room / SENSOR_STEP) * SENSOR_STEP;
      if (m >= 360 && reachedAtMin === null && sensorNow >= TARGET_ROOM - SENSOR_STEP) {
        reachedAtMin = m - 360;
      }
      dayMinRoom = Math.min(dayMinRoom, room);

      if (m % 5 === 0) {
        samples.push({
          at: new Date(EPOCH + tMin * 60000),
          roomTempC: Math.round(room / SENSOR_STEP) * SENSOR_STEP,
          targetTempC: TARGET_ROOM,
          // evidencija sa 60 s kašnjenja
          isHeating: prevHeatingForRecord,
          outdoorTempC: Math.round(tOut * 2) / 2,
          flowSetC: flow,
        });
      }
      prevHeatingForRecord = heating;
    }

    aggregates.push(aggregate(samples.slice(dayStartSample), localDate));

    // 6. ishod dana (stvarni modul), odmah nakon ponoći
    const result = computeDayOutcome(localDate, samples, zone);
    if (result.ok) {
      outcomes.set(day, result.outcome);
      lastOutcome = result.outcome;
      lastOutcomeDay = day;
    } else {
      lastOutcome = null;
      lastOutcomeDay = null;
    }

    if (result.ok) {
      const learned = shortCycleFloorFrom({
        flowC: flow,
        medianCycleMin: result.outcome.medianCycleMin,
      });
      if (learned != null) {
        learnedShortCycleFloor =
          learnedShortCycleFloor == null
            ? learned
            : Math.max(learnedShortCycleFloor, learned);
      }
    }

    dayLog.push({
      day,
      localDate,
      flow,
      minRoom: round(dayMinRoom, 2),
      undershoot: round(Math.max(0, TARGET_ROOM - dayMinRoom), 2),
      cycles: dayCycles,
      medianCycleMin: result.ok ? round(result.outcome.medianCycleMin, 1) : null,
      reachedMin: reachedAtMin,
      nightMin: round(forecastNightMin, 1),
      slope: round(slope, 4),
      basis: night.basis,
    });
  }

  return { samples, outcomes, dayLog, decisions };
}

// --- metrike i provjere ---------------------------------------------------
function summarise(houseName, run) {
  const flows = run.decisions.map((d) => d.flow);
  const after10 = run.dayLog.filter((d) => d.day >= 10);
  const first10 = run.dayLog.filter((d) => d.day < 10);

  const medianOf = (xs) => {
    const a = [...xs].filter((x) => typeof x === 'number').sort((x, y) => x - y);
    if (!a.length) return null;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  };

  const worstUndershootAfter10 = after10.reduce(
    (acc, d) => Math.max(acc, d.undershoot),
    0,
  );
  const slowestReach = after10.reduce(
    (acc, d) => (d.reachedMin == null ? acc : Math.max(acc, d.reachedMin)),
    0,
  );

  const dailyJumps = [];
  for (let i = 1; i < flows.length; i++) {
    dailyJumps.push(Math.abs(flows[i] - flows[i - 1]));
  }

  return {
    house: houseName,
    days: run.dayLog.length,
    flow: {
      start: flows[0],
      end: flows[flows.length - 1],
      min: Math.min(...flows),
      max: Math.max(...flows),
      meanLast10:
        flows.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, flows.length),
    },
    cycles: {
      first10: medianOf(first10.map((d) => d.cycles)),
      last10: medianOf(after10.slice(-10).map((d) => d.cycles)),
    },
    medianCycleMin: {
      first10: medianOf(first10.map((d) => d.medianCycleMin)),
      last10: medianOf(after10.slice(-10).map((d) => d.medianCycleMin)),
    },
    comfort: {
      worstUndershootAfter10: round(worstUndershootAfter10, 2),
      daysOverToleranceAfter10: after10.filter(
        (d) => d.undershoot > EPS_UNDERSHOOT,
      ).length,
      slowestReachMin: slowestReach,
    },
    bounds: {
      maxDailyJump: round(Math.max(0, ...dailyJumps), 2),
      jumpsOver2: dailyJumps.filter((j) => j > 2 + 1e-9).length,
      min: Math.min(...flows),
      max: Math.max(...flows),
    },
    holds: {
      total: run.decisions.filter((d) => d.action === 'HOLD').length,
      degraded: run.decisions.filter((d) => d.reasons.includes('DEGRADED')).length,
      noOutcome: run.decisions.filter((d) => d.reasons.includes('NO_OUTCOME'))
        .length,
      noNightEvidence: run.decisions.filter((d) =>
        d.reasons.includes('NO_NIGHT_EVIDENCE'),
      ).length,
      noModel: run.decisions.filter((d) => d.reasons.includes('NO_MODEL')).length,
    },
    nightFloors: {
      raised: run.decisions.filter((d) => d.basis === 'RAISED_FROM_FAILURE')
        .length,
      atLimit: run.decisions.filter((d) => d.basis === 'AT_LIMIT').length,
      noEvidence: run.decisions.filter((d) => d.basis === 'NO_EVIDENCE').length,
      noFailure: run.decisions.filter((d) => d.basis === 'NO_FAILURE').length,
    },
    lastSlope: run.dayLog[run.dayLog.length - 1].slope,
  };
}

function verify(results) {
  const violations = [];
  for (const r of results) {
    if (!(r.flow.min >= FLOW_MIN && r.flow.max <= FLOW_MAX)) {
      violations.push(`${r.house}: polazna izašla iz ${FLOW_MIN}–${FLOW_MAX}`);
    }
    if (r.comfort.daysOverToleranceAfter10 !== 0) {
      violations.push(
        `${r.house}: ${r.comfort.daysOverToleranceAfter10} dana sa podbačajem > 1 K poslije dana 10`,
      );
    }
    if (r.jumpsWithoutFloor !== 0) {
      violations.push(
        `${r.house}: ${r.jumpsWithoutFloor} skokova > 2 K bez noćnog minimuma`,
      );
    }
    if (!(r.flow.end < r.flow.start)) {
      violations.push(`${r.house}: kontroler nije spustio polaznu`);
    }
  }
  return violations;
}

// --- izlaz ---------------------------------------------------------------
const overrides = paramOverrides();
const restoreParams = withParams(controllerModule, overrides);
const results = [];
for (const [name, house] of Object.entries(HOUSES)) {
  const run = simulate(house);
  const summary = summarise(name, run);

  // skokovi > 2 K koji nijesu posljedica noćnog minimuma
  let jumpsWithoutFloor = 0;
  for (let i = 1; i < run.decisions.length; i++) {
    const jump = Math.abs(run.decisions[i].flow - run.decisions[i - 1].flow);
    const floorForced =
      run.decisions[i].basis === 'RAISED_FROM_FAILURE' ||
      run.decisions[i].basis === 'AT_LIMIT';
    if (jump > 2 + 1e-9 && !floorForced) jumpsWithoutFloor += 1;
  }
  summary.jumpsWithoutFloor = jumpsWithoutFloor;

  results.push(summary);
  results[results.length - 1].trace = trace
    ? run.dayLog.map((d) => ({
        day: d.day,
        flow: d.flow,
        minRoom: d.minRoom,
        cycles: d.cycles,
        medianCycleMin: d.medianCycleMin,
        slope: d.slope,
        basis: d.basis,
      }))
    : undefined;
}

restoreParams();
const violations = verify(results);

if (asJson) {
  console.log(
    JSON.stringify(
      {
        days,
        params: overrides
          ? { ...effectiveParams(), ...overrides }
          : effectiveParams(),
        results,
        violations,
      },
      null,
      2,
    ),
  );
} else {
  console.log(`Kontroler u zatvorenoj petlji — ${days} dana, stvarni moduli.\n`);
  for (const r of results) {
    console.log(`${r.house}:`);
    console.log(
      `  polazna:           ${r.flow.start} → ${r.flow.end} °C ` +
        `(min ${r.flow.min}, max ${r.flow.max}, zadnjih 10 dana ${round(r.flow.meanLast10, 1)})`,
    );
    console.log(
      `  ciklusa/dan:       ${r.cycles.first10} → ${r.cycles.last10}; ` +
        `medijana ciklusa ${r.medianCycleMin.first10} → ${r.medianCycleMin.last10} min`,
    );
    console.log(
      `  komfor:            podbačaj > 1 K poslije dana 10: ` +
        `${r.comfort.daysOverToleranceAfter10}/${r.days - 10}, ` +
        `najgori ${r.comfort.worstUndershootAfter10} K, najsporije do cilja ${r.comfort.slowestReachMin} min`,
    );
    console.log(
      `  granice:           najveći dnevni skok ${r.bounds.maxDailyJump} K ` +
        `(bez noćnog minimuma: ${r.jumpsWithoutFloor})`,
    );
    console.log(
      `  držanja:           ${r.holds.total} (degraded ${r.holds.degraded}, ` +
        `bez ishoda ${r.holds.noOutcome}, bez noći ${r.holds.noNightEvidence}, bez modela ${r.holds.noModel})`,
    );
    console.log(
      `  noćni minimum:     podignut ${r.nightFloors.raised}×, na granici ${r.nightFloors.atLimit}×, ` +
        `bez dokaza ${r.nightFloors.noEvidence}×, bez podbačaja ${r.nightFloors.noFailure}×`,
    );
    console.log(`  nagib na kraju:    ${r.lastSlope}`);
    if (trace) {
      console.log(
        '  tok po danu (dan: polazna / najniža soba / ciklusa / medijana / s / noć):',
      );
      for (const d of r.trace) {
        console.log(
          `    ${String(d.day).padStart(3)} ${String(d.flow).padStart(6)} ` +
            `${String(d.minRoom).padStart(7)} ${String(d.cycles).padStart(4)} ` +
            `${String(d.medianCycleMin ?? '—').padStart(7)} ` +
            `${String(d.slope ?? '—').padStart(7)}  ${d.basis}`,
        );
      }
    }
    console.log('');
  }

  if (violations.length === 0) {
    console.log('Tvrdnje prošle.');
  } else {
    console.log('Tvrdnje NIJESU prošle:');
    for (const violation of violations) console.log(`  - ${violation}`);
  }
  console.log(
    'Ograničenje: model nema minimalnu modulaciju kotla, sunce, DHW ni otvoren prozor.\n' +
      'Kratki ciklusi na preniskoj polazni (vlasnikov primjer) su zato jedinični test, ne simulacija.',
  );
}

if (violations.length > 0) process.exitCode = 1;
