#!/usr/bin/env node
/*
 * MAX AUDIT HARNESS — flow temperature formula, learning principle,
 * anomaly tracking and user-instruction coverage.
 *
 * Runs the REAL backend code offline:
 *   - backend/src/modules/Heating/engine/flow-temperature.engine.ts
 *   - backend/src/common/anomaly-detection.service.ts
 *
 * No database, no network, no secrets, no writes to application code.
 * The learning-update arithmetic (heating.recommendation.service.ts:52-90) is
 * re-expressed line by line in JS because it is inseparable from Prisma; that
 * replica is marked REPLIKA in the output and is cross-checked against the
 * formulas in the source document.
 *
 * Usage:
 *   node scripts/audit/formula_max_audit.cjs [--json] [--only=curve|prod|learning|anomaly|sensitivity]
 *   node scripts/audit/formula_max_audit.cjs --help
 *
 * Result values are NOT operating instructions for a real boiler.
 */
'use strict';

const path = require('node:path');
const Module = require('node:module');

const root = path.resolve(__dirname, '../..');

if (process.argv.includes('--help')) {
  console.log(`Upotreba: node scripts/audit/formula_max_audit.cjs [--json] [--only=<sekcija>]
       node scripts/audit/formula_max_audit.cjs --write-golden
       node scripts/audit/formula_max_audit.cjs --check-golden

Sekcije: curve, prod, robust, learning, anomaly, sensitivity (default: sve)

--write-golden  upisuje scripts/audit/fixtures/formula_golden.json iz stvarnog motora
--check-golden  poredi trenutni izlaz sa snimkom; izlazni kod 1 pri razlici

Pokreće stvarni FlowTemperatureEngine i stvarni AnomalyDetectionService nad
sintetičkim ulazima. Učenje (HeatingIntervalLearning) je REPLIKA aritmetike iz
heating.recommendation.service.ts jer je ta logika vezana za Prisma.

Bez mreže, baze, tajni i bez izmjene aplikacijskog koda. Rezultati nisu upute
za upravljanje grijanjem i nisu izmjerene performanse sistema.`);
  process.exit(0);
}

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const writeGolden = args.includes('--write-golden');
const checkGolden = args.includes('--check-golden');
const onlyArg = args.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length) : null;
const allowed = ['curve', 'prod', 'robust', 'learning', 'anomaly', 'sensitivity'];
if (only && !allowed.includes(only)) {
  console.error(`Nepoznata sekcija "${only}". Dozvoljeno: ${allowed.join(', ')}`);
  process.exit(2);
}
const bad = args.filter(
  (a) =>
    a !== '--json' &&
    a !== '--write-golden' &&
    a !== '--check-golden' &&
    a !== onlyArg &&
    !a.startsWith('--only='),
);
if (bad.length) {
  console.error('Nepoznat argument; koristite --help');
  process.exit(2);
}

// ---- load real code -------------------------------------------------------
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  // `src/generated/prisma/` is gitignored (generated at build time). Supply the
  // same string enums the real generator emits, only for the strategy import.
  if (
    parent?.filename.endsWith(path.join('Heating', 'strategies', 'profile.strategy.ts')) &&
    request === 'src/generated/prisma/'
  ) {
    return {
      HomeProfile_windowType: {
        SINGLE_GLAZED: 'SINGLE_GLAZED',
        DOUBLE_GLAZED: 'DOUBLE_GLAZED',
        TRIPLE_GLAZED: 'TRIPLE_GLAZED',
      },
      HomeProfile_heatingType: {
        RADIATOR: 'RADIATOR',
        UNDERFLOOR: 'UNDERFLOOR',
        MIXED: 'MIXED',
      },
      HomeProfile_insulationType: {
        STANDARD: 'STANDARD',
        EPS: 'EPS',
        MINERAL_WOOL: 'MINERAL_WOOL',
        ADVANCED: 'ADVANCED',
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));

const { FlowTemperatureEngine } = require(
  path.join(root, 'backend/src/modules/Heating/engine/flow-temperature.engine.ts'),
);
const { AnomalyDetectionService } = require(
  path.join(root, 'backend/src/common/anomaly-detection.service.ts'),
);

// ---- helpers --------------------------------------------------------------
const r = (n, d = 2) => (typeof n === 'number' && Number.isFinite(n) ? Number(n.toFixed(d)) : n);
const base = { mode: 'ANONYMOUS', weather: { tempMin: 0, tempMax: 0 }, homeProfile: { floorArea: 150 } };
const calc = (overrides) => FlowTemperatureEngine.calculate({ ...base, ...overrides });
const round1 = (n) => Math.round(n * 10) / 10;
const nf = (n, d = 2) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : String(n));

const out = {};

// ===========================================================================
// GOLDEN SNAPSHOT — deterministic baseline of the REAL engine and detector.
//
// This is the regression net the audit says does not exist (see §6.0): a
// machine-readable record of current behaviour that fails loudly on drift.
// It needs no database, no Prisma client and no jest.
//
//   --write-golden   record the current behaviour (review the diff, then commit)
//   --check-golden   fail with exit 1 on any drift
// ===========================================================================
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'formula_golden.json');

const encode = (v) => {
  if (typeof v === 'number') {
    if (Number.isNaN(v)) return { $n: 'NaN' };
    if (!Number.isFinite(v)) return { $n: v > 0 ? 'Infinity' : '-Infinity' };
    return v;
  }
  if (Array.isArray(v)) return v.map(encode);
  if (v instanceof Date) return { $d: v.toISOString() };
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = encode(x);
    return o;
  }
  return v;
};

function buildGolden() {
  const cases = {};
  const record = (name, value) => {
    cases[name] = encode(value);
  };
  const snapshot = (res) => ({
    baseCurveTemp: res.baseCurveTemp,
    weightedExternalTemp: res.weightedExternalTemp,
    appliedOffsets: res.appliedOffsets,
    confidence: res.confidence,
    finalTemp: res.finalTemp,
  });

  for (let ext = -25; ext <= 20; ext += 1) {
    record(
      `anonymous/ext_${ext}`,
      snapshot(calc({ weather: { tempMin: ext, tempMax: ext } })),
    );
  }
  for (const [name, ext] of [
    ['cutoff10_minus_eps', 10 - 1e-6],
    ['cutoff10', 10],
    ['cutoff10_plus_eps', 10 + 1e-6],
    ['cutoffM15_minus_eps', -15 - 1e-6],
    ['cutoffM15', -15],
    ['cutoffM15_plus_eps', -15 + 1e-6],
  ]) {
    record(
      `boundary/${name}`,
      snapshot(calc({ weather: { tempMin: ext, tempMax: ext } })),
    );
  }
  record(
    'anonymous/mixed_min_max',
    snapshot(calc({ weather: { tempMin: -5, tempMax: 5 } })),
  );

  const profileBase = { floorArea: 150, confidence: 0.5, insulationFactor: 1 };
  for (const area of [10, 60, 100, 149, 150, 200, 400]) {
    record(
      `profile/area_${area}`,
      snapshot(
        calc({
          mode: 'PROFILE_ONLY',
          weather: { tempMin: 2, tempMax: 9 },
          homeProfile: { ...profileBase, floorArea: area },
        }),
      ),
    );
  }
  for (const [name, extra] of [
    ['window_single', { windowType: 'SINGLE_GLAZED' }],
    ['window_triple', { windowType: 'TRIPLE_GLAZED' }],
    ['heating_underfloor', { heatingType: 'UNDERFLOOR' }],
    ['insulation_advanced', { insulationType: 'ADVANCED' }],
    ['insulation_standard', { insulationType: 'STANDARD' }],
    ['ceiling_320cm', { ceilingHeight: 320 }],
    ['ceiling_3_2_latent_unit_bug', { ceilingHeight: 3.2 }],
    ['offset_3_confidence_0', { learningOffset: 3, confidence: 0 }],
    ['offset_2_confidence_1', { learningOffset: 2, confidence: 1 }],
  ]) {
    record(
      `profile/${name}`,
      snapshot(
        calc({
          mode: 'PROFILE_ONLY',
          weather: { tempMin: 2, tempMax: 9 },
          homeProfile: { ...profileBase, ...extra },
        }),
      ),
    );
  }

  for (const intervalKey of [
    'weekday_morning',
    'weekday_late_morning',
    'weekday_afternoon',
    'weekday_night',
    'weekend_morning',
  ]) {
    for (const offset of [-3, -1.7, 0, 2, 4]) {
      record(
        `full/${intervalKey}/offset_${offset}`,
        snapshot(
          calc({
            mode: 'FULL',
            weather: { tempMin: 2, tempMax: 9 },
            intervalKey,
            homeProfile: profileBase,
            intervalLearning: {
              offset,
              confidence: 0.5,
              avgOvershoot: 0,
              avgReachTimeMin: 30,
            },
          }),
        ),
      );
    }
  }
  for (const overshoot of [0, 2, -2]) {
    for (const reach of [10, 30, 60]) {
      record(
        `full/overshoot_${overshoot}_reach_${reach}`,
        snapshot(
          calc({
            mode: 'FULL',
            weather: { tempMin: 0, tempMax: 0 },
            intervalKey: 'weekday_afternoon',
            homeProfile: profileBase,
            intervalLearning: {
              offset: 0,
              confidence: 0.5,
              avgOvershoot: overshoot,
              avgReachTimeMin: reach,
            },
          }),
        ),
      );
    }
  }
  for (const n of [1, 5, 10]) {
    for (const delta of [2, 5]) {
      for (const active of [true, false]) {
        record(
          `full/events_n${n}_delta${delta}_${active ? 'active' : 'closed'}`,
          snapshot(
            calc({
              mode: 'FULL',
              weather: { tempMin: 0, tempMax: 0 },
              intervalKey: 'weekday_afternoon',
              homeProfile: profileBase,
              recentEvents: Array.from({ length: n }, () => ({ delta, active })),
            }),
          ),
        );
      }
    }
  }

  const robustCases = {
    'tempMin_NaN': { weather: { tempMin: NaN, tempMax: 0 } },
    'tempMax_NaN': { weather: { tempMin: 0, tempMax: NaN } },
    'temps_null': { weather: { tempMin: null, tempMax: null } },
    'temps_undefined': { weather: { tempMin: undefined, tempMax: undefined } },
    'temp_Infinity': { weather: { tempMin: Infinity, tempMax: Infinity } },
    'temp_neg_Infinity': { weather: { tempMin: -Infinity, tempMax: -Infinity } },
    'confidence_NaN': {
      mode: 'PROFILE_ONLY',
      homeProfile: { floorArea: 150, confidence: NaN },
    },
    'floorArea_NaN': { mode: 'PROFILE_ONLY', homeProfile: { floorArea: NaN } },
    'ceilingHeight_NaN': {
      mode: 'PROFILE_ONLY',
      homeProfile: { floorArea: 150, ceilingHeight: NaN },
    },
    'learningOffset_NaN': {
      mode: 'PROFILE_ONLY',
      homeProfile: { floorArea: 150, learningOffset: NaN, confidence: 0.5 },
    },
  };
  for (const [name, overrides] of Object.entries(robustCases)) {
    record(`robust/${name}`, snapshot(calc(overrides)));
  }

  const metrics = { incrementCounter() {}, setGauge() {}, observeHistogram() {} };
  const detector = new AnomalyDetectionService(metrics);
  const fixedStart = new Date('2026-11-04T06:00:00+01:00');
  const anomalyCases = [
    { name: 'n2_below_min', mu: 60, sd: 1.6, n: 2, cur: 400, phase: 'OPEN' },
    { name: 'sigma0_open_61', mu: 60, sd: 0, n: 3, cur: 61, phase: 'OPEN' },
    { name: 'sigma0_open_140', mu: 60, sd: 0, n: 3, cur: 140, phase: 'OPEN' },
    { name: 'sd1_6_closed_70', mu: 60, sd: 1.633, n: 3, cur: 70, phase: 'CLOSED' },
    { name: 'sd4_5_closed_70_selfincluded', mu: 62.5, sd: 4.555, n: 4, cur: 70, phase: 'CLOSED' },
    { name: 'sd60_closed_200_selfincluded', mu: 95, sd: 60.638, n: 4, cur: 200, phase: 'CLOSED' },
    { name: 'rapid_cycling_4', mu: 60, sd: 1.633, n: 3, cur: 4, phase: 'CLOSED' },
    { name: 'prolonged_200', mu: 60, sd: 1.633, n: 3, cur: 200, phase: 'CLOSED' },
  ];
  for (const c of anomalyCases) {
    const res = detector.detectAnomalies(
      {
        currentDuration: c.cur,
        averageDuration: c.mu,
        standardDeviation: c.sd,
        historicalCount: c.n,
        threshold: 2,
      },
      fixedStart,
      c.phase,
    );
    record(`anomaly/${c.name}`, {
      isAnomaly: res.isAnomaly,
      types: res.types,
      confidence: res.confidence,
      proposedEndTime: res.proposedEndTime ?? null,
    });
  }

  return {
    version: 1,
    generatedBy: 'scripts/audit/formula_max_audit.cjs --write-golden',
    engine: 'backend/src/modules/Heating/engine/flow-temperature.engine.ts',
    detector: 'backend/src/common/anomaly-detection.service.ts',
    note: 'Sintetički ulazi u stvarni kod. Snimak je ugovor o trenutnom ponašanju, ne tvrdnja da je ponašanje ispravno.',
    cases,
  };
}

function diffGolden(expected, actual) {
  const diffs = [];
  const walk = (e, a, path) => {
    if (typeof e === 'number' && typeof a === 'number') {
      if (Math.abs(e - a) > 1e-9) diffs.push({ path, expected: e, actual: a });
      return;
    }
    if (Array.isArray(e) || Array.isArray(a)) {
      const ea = Array.isArray(e) ? e : [];
      const aa = Array.isArray(a) ? a : [];
      if (ea.length !== aa.length) {
        diffs.push({ path, expected: `length ${ea.length}`, actual: `length ${aa.length}` });
        return;
      }
      for (let i = 0; i < ea.length; i += 1) walk(ea[i], aa[i], `${path}[${i}]`);
      return;
    }
    if (e && typeof e === 'object' && a && typeof a === 'object') {
      const keys = new Set([...Object.keys(e), ...Object.keys(a)]);
      for (const k of keys) walk(e[k], a[k], path ? `${path}.${k}` : k);
      return;
    }
    if (e !== a) diffs.push({ path, expected: e, actual: a });
  };
  walk(expected, actual, '');
  return diffs;
}

if (writeGolden || checkGolden) {
  const fs = require('node:fs');
  const current = buildGolden();
  if (writeGolden) {
    fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
    fs.writeFileSync(FIXTURE_PATH, `${JSON.stringify(current, null, 2)}\n`);
    console.log(
      `Golden snimak upisan: ${path.relative(root, FIXTURE_PATH)} (${Object.keys(current.cases).length} slučajeva).`,
    );
    process.exit(0);
  }
  if (!fs.existsSync(FIXTURE_PATH)) {
    console.error(`Nema snimka ${path.relative(root, FIXTURE_PATH)}; pokrenite --write-golden.`);
    process.exit(2);
  }
  const expected = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const diffs = diffGolden(expected.cases, current.cases);
  if (diffs.length === 0) {
    console.log(
      `Golden OK: ${Object.keys(current.cases).length} slučajeva, nema razlike prema snimku.`,
    );
    process.exit(0);
  }
  console.error(`Golden DRIFT: ${diffs.length} razlika prema snimku:`);
  for (const d of diffs.slice(0, 40)) {
    console.error(`  ${d.path || '(root)'}: snimak=${JSON.stringify(d.expected)} sada=${JSON.stringify(d.actual)}`);
  }
  if (diffs.length > 40) console.error(`  ... i još ${diffs.length - 40}.`);
  process.exit(1);
}


// ===========================================================================
// 1. CURVE — base curve, clamp, discontinuities, reachable output domain
// ===========================================================================
if (!only || only === 'curve') {
  const sweep = [];
  for (let ext = -25; ext <= 20; ext += 0.5) {
    const res = calc({ weather: { tempMin: ext, tempMax: ext } });
    sweep.push({
      ext,
      baseCurveTemp: res.baseCurveTemp,
      clampedInput: res.weightedExternalTemp,
      finalTemp: res.finalTemp,
      clampedAtOutput: res.finalTemp !== r(res.baseCurveTemp, 2),
    });
  }

  // Boundary jumps. The base curve is `51 - 0.3*ext` between the cut-offs, so
  // the jump has to be measured on the side that actually leaves the branch.
  // `side`: 'lower' compares ext-eps -> ext, 'upper' compares ext -> ext+eps.
  const jumpAt = (ext, side) => {
    const eps = 1e-6;
    const at = calc({ weather: { tempMin: ext, tempMax: ext } });
    const other = calc({
      weather: {
        tempMin: side === 'lower' ? ext - eps : ext + eps,
        tempMax: side === 'lower' ? ext - eps : ext + eps,
      },
    });
    const baseBefore = side === 'lower' ? other.baseCurveTemp : at.baseCurveTemp;
    const baseAfter = side === 'lower' ? at.baseCurveTemp : other.baseCurveTemp;
    const finalBefore = side === 'lower' ? other.finalTemp : at.finalTemp;
    const finalAfter = side === 'lower' ? at.finalTemp : other.finalTemp;
    return {
      ext,
      side,
      baseBefore: r(baseBefore, 6),
      baseAfter: r(baseAfter, 6),
      baseJump: r(baseAfter - baseBefore, 6),
      finalBefore,
      finalAfter,
      finalJump: r(finalAfter - finalBefore, 6),
    };
  };

  // Which outputs are reachable at all, and which of those the app can accept?
  const reachable = new Map();
  for (let ext = -25; ext <= 20; ext += 0.25) {
    const f = calc({ weather: { tempMin: ext, tempMax: ext } }).finalTemp;
    reachable.set(f, (reachable.get(f) || 0) + 1);
  }
  const finals = [...reachable.keys()].sort((a, b) => a - b);
  const belowInputMin = finals.filter((f) => f < 48);
  const aboveInputMax = finals.filter((f) => f > 55);

  // Is there a HOLE in the reachable output domain? Sweep the 9..12 °C band
  // finely, where the 10 °C cut-off lives.
  const band = [];
  for (let ext = 9; ext <= 12.0001; ext += 0.05) {
    band.push({ ext: r(ext, 3), finalTemp: calc({ weather: { tempMin: ext, tempMax: ext } }).finalTemp });
  }
  const bandFinals = [...new Set(band.map((b) => b.finalTemp))].sort((a, b) => a - b);
  const hole = bandFinals.every((f) => f === 46 || f >= 48);
  const gapInDomain = {
    lowestAbove46: bandFinals.find((f) => f > 46),
  };

  // Per-mode reachable domain: which modes can produce an output below the
  // 48 C entry floor, and do they have gaps?
  const domainByMode = {};
  const collect = (mode, values) => {
    const distinct = [...new Set(values)].sort((a, b) => a - b);
    const below = distinct.filter((f) => f < 48);
    const gap =
      distinct.some((f) => f > 46 && f < 48) ? null : { from: 46, to: distinct.find((f) => f > 46) };
    domainByMode[mode] = {
      distinct: distinct.length,
      min: distinct[0],
      max: distinct[distinct.length - 1],
      below48: below,
      gapBetween46AndFirstAbove: gap,
    };
  };

  const anonVals = [];
  for (let ext = -25; ext <= 20; ext += 0.05) {
    anonVals.push(calc({ weather: { tempMin: ext, tempMax: ext } }).finalTemp);
  }
  collect('ANONYMOUS', anonVals);

  const profileVals = [];
  for (let ext = 8; ext <= 14; ext += 0.25) {
    for (let area = 10; area <= 300; area += 5) {
      profileVals.push(
        calc({
          mode: 'PROFILE_ONLY',
          weather: { tempMin: ext, tempMax: ext },
          homeProfile: { floorArea: area, learningOffset: 0, confidence: 0.1, insulationFactor: 1 },
        }).finalTemp,
      );
    }
  }
  collect('PROFILE_ONLY', profileVals);

  const fullVals = [];
  for (let ext = 0; ext <= 10; ext += 0.25) {
    for (let offset = -4; offset <= 4; offset += 0.25) {
      fullVals.push(
        calc({
          mode: 'FULL',
          weather: { tempMin: ext, tempMax: ext },
          intervalKey: 'weekday_afternoon',
          homeProfile: { floorArea: 150, learningOffset: 0, confidence: 0.5, insulationFactor: 1 },
          intervalLearning: { offset, confidence: 0.5, avgOvershoot: 0, avgReachTimeMin: 30 },
        }).finalTemp,
      );
    }
  }
  collect('FULL', fullVals);

  // Negative learned offset pushes the output into the same un-enterable band.
  const learnedNegative = [];
  for (const ext of [0, 5, 8]) {
    for (const offset of [-1, -2, -3]) {
      const res = calc({
        mode: 'FULL',
        weather: { tempMin: ext, tempMax: ext },
        intervalKey: 'weekday_afternoon',
        homeProfile: { floorArea: 150, learningOffset: 0, confidence: 0.5, insulationFactor: 1 },
        intervalLearning: { offset, confidence: 0.5, avgOvershoot: 0, avgReachTimeMin: 30 },
      });
      learnedNegative.push({ ext, offset, finalTemp: res.finalTemp, enterable: res.finalTemp >= 48 });
    }
  }

  out.curve = {
    step: 0.5,
    sweep,
    discontinuities: [jumpAt(10, 'lower'), jumpAt(-15, 'upper')],
    outputDomain: {
      min: finals[0],
      max: finals[finals.length - 1],
      countDistinct: finals.length,
      belowInputFloor48: belowInputMin,
      aboveInputCeiling55: aboveInputMax,
    },
    bandAround10: band,
    anonymousOutputHoleBetween46And48: hole,
    gapInDomain,
    domainByMode,
    bandFinals,
    learnedNegativePushesBelowEntryFloor: learnedNegative,
  };
}

// ===========================================================================
// 2. PRODUCTION PATH — which profile fields actually reach the engine
// ===========================================================================
if (!only || only === 'prod') {
  // Verbatim shape of the object built at boiler.service.ts:104-109 and
  // heating.recommendation.service.ts:127-132.
  const productionShape = (profile) => ({
    mode: 'PROFILE_ONLY',
    intervalKey: 'weekday_morning',
    weather: { tempMin: 2, tempMax: 9 },
    homeProfile: {
      floorArea: profile.floorArea,
      learningOffset: profile.learningOffset,
      insulationFactor: 1,
      confidence: profile.learningConfidence,
    },
  });

  const rich = {
    floorArea: 120,
    ceilingHeight: 320,
    insulationType: 'SINGLE_GLAZED_LEGACY_IGNORED',
    windowType: 'SINGLE_GLAZED',
    heatingType: 'RADIATOR',
  };

  const viaProduction = calc(productionShape({ floorArea: 120, learningOffset: 0, learningConfidence: 0.5 }));
  const withFieldsDirect = calc({
    ...productionShape({ floorArea: 120, learningOffset: 0, learningConfidence: 0.5 }),
    homeProfile: {
      floorArea: 120,
      learningOffset: 0,
      confidence: 0.5,
      ceilingHeight: 320,
      windowType: 'SINGLE_GLAZED',
      heatingType: 'UNDERFLOOR',
      insulationType: 'ADVANCED',
    },
  });
  const bareArea = calc({
    mode: 'PROFILE_ONLY',
    weather: { tempMin: 2, tempMax: 9 },
    homeProfile: { floorArea: 120 },
  });

  // Effect the profile COULD have if the fields were passed (proof the omission
  // is in the call sites, not in the strategy).
  const fieldEffect = [];
  const variants = [
    ['windowType=SINGLE_GLAZED', { windowType: 'SINGLE_GLAZED' }],
    ['windowType=TRIPLE_GLAZED', { windowType: 'TRIPLE_GLAZED' }],
    ['heatingType=UNDERFLOOR', { heatingType: 'UNDERFLOOR' }],
    ['insulationType=ADVANCED', { insulationType: 'ADVANCED' }],
    ['insulationType=STANDARD', { insulationType: 'STANDARD' }],
    ['ceilingHeight=320 cm', { ceilingHeight: 320 }],
    ['ceilingHeight=3.2 (metri, DTO)', { ceilingHeight: 3.2 }],
  ];
  for (const [label, extra] of variants) {
    const res = calc({
      mode: 'PROFILE_ONLY',
      weather: { tempMin: 2, tempMax: 9 },
      homeProfile: { floorArea: 120, confidence: 0.5, ...extra },
    });
    fieldEffect.push({ label, finalTemp: res.finalTemp });
  }

  const dbDefaultConfidence = calc({
    mode: 'PROFILE_ONLY',
    weather: { tempMin: 2, tempMax: 9 },
    homeProfile: { floorArea: 120, learningOffset: 3, confidence: 0, insulationFactor: 1 },
  });

  out.prod = {
    dbDefaultLearningConfidenceZero: {
      note: 'HomeProfile.learningConfidence @default(0); `?? 0.1` does not rescue 0',
      confidence: dbDefaultConfidence.confidence,
      finalTempWithOffset3: dbDefaultConfidence.finalTemp,
    },
    equalViaProductionAndBareArea:
      viaProduction.finalTemp === bareArea.finalTemp &&
      viaProduction.baseCurveTemp === bareArea.baseCurveTemp,
    viaProduction: { finalTemp: viaProduction.finalTemp, confidence: viaProduction.confidence },
    bareArea: { finalTemp: bareArea.finalTemp, confidence: bareArea.confidence },
    withAllFieldsDirect: {
      finalTemp: withFieldsDirect.finalTemp,
      confidence: withFieldsDirect.confidence,
    },
    richProfileNeverPassed: rich,
    fieldEffectIfPassed: fieldEffect,
  };
}

// ===========================================================================
// 2b. ROBUSTNESS — non-finite / missing inputs against the real engine
// ===========================================================================
if (!only || only === 'robust') {
  const probe = (label, overrides) => {
    const res = calc(overrides);
    return {
      label,
      finalTemp: res.finalTemp,
      baseCurveTemp: res.baseCurveTemp,
      confidence: res.confidence,
      isNaN: typeof res.finalTemp === 'number' && Number.isNaN(res.finalTemp),
    };
  };
  out.robust = [
    probe('tempMin=NaN', { weather: { tempMin: NaN, tempMax: 0 } }),
    probe('tempMax=NaN', { weather: { tempMin: 0, tempMax: NaN } }),
    probe('tempMin=null,tempMax=null', { weather: { tempMin: null, tempMax: null } }),
    probe('tempMin=undefined,tempMax=undefined', { weather: { tempMin: undefined, tempMax: undefined } }),
    probe('tempMin=Infinity', { weather: { tempMin: Infinity, tempMax: Infinity } }),
    probe('tempMin=-Infinity', { weather: { tempMin: -Infinity, tempMax: -Infinity } }),
    probe('confidence=NaN', { mode: 'PROFILE_ONLY', homeProfile: { floorArea: 150, confidence: NaN } }),
    probe('floorArea=NaN', { mode: 'PROFILE_ONLY', homeProfile: { floorArea: NaN } }),
    probe('ceilingHeight=NaN', { mode: 'PROFILE_ONLY', homeProfile: { floorArea: 150, ceilingHeight: NaN } }),
    probe('learningOffset=NaN', {
      mode: 'PROFILE_ONLY',
      homeProfile: { floorArea: 150, learningOffset: NaN, confidence: 0.5 },
    }),
  ];
}

// ===========================================================================
// 3. LEARNING — REPLIKA of heating.recommendation.service.ts:52-90
// ===========================================================================
if (!only || only === 'learning') {
  /*
   * REPLIKA (ne izvršava Prisma):
   *   overshoot = roomCurrentTemp - roomTargetTemp
   *   reachTime = (timestampEnd - timestampStart) / 60000
   *   newAvg  = (avg_old * n + x) / (n + 1)
   *   newConf = min(1, (conf_old * n + 0.1) / (n + 1))
   */
  function simulate(events) {
    let avgReach = 0;
    let avgOvershoot = 0;
    let offset = 0;
    let confidence = 0.1;
    let samples = 0;
    const rows = [];
    for (const e of events) {
      const overshoot = e.roomCurrentTemp - e.roomTargetTemp;
      const reachTime = (e.timestampEndMs - e.timestampStartMs) / 60000;
      const n = samples + 1;
      avgReach = (avgReach * samples + reachTime) / n;
      avgOvershoot = (avgOvershoot * samples + overshoot) / n;
      offset = (offset * samples + overshoot) / n;
      confidence = Math.min(1, (confidence * samples + 0.1) / n);
      samples = n;
      rows.push({
        sample: samples,
        overshoot: r(overshoot, 3),
        reachTime: r(reachTime, 1),
        avgReachTimeMin: r(avgReach, 3),
        avgOvershoot: r(avgOvershoot, 3),
        learningOffset: r(offset, 3),
        confidence: r(confidence, 6),
      });
    }
    return rows;
  }

  const T0 = Date.UTC(2026, 10, 4, 6, 0, 0);
  const ev = (startMin, durMin, current, target) => ({
    timestampStartMs: T0 + startMin * 60000,
    timestampEndMs: T0 + (startMin + durMin) * 60000,
    roomCurrentTemp: current,
    roomTargetTemp: target,
  });

  // (a) Realistic cycles as the poller records them: handleHeatingEnd passes
  //     lastEvent.roomCurrentTemp, i.e. the START reading (polling:485), and the
  //     state machine only starts heating below target-1 (DEAD_ZONE, polling:57,534).
  const realistic = [
    ev(0, 42, 20.0, 22.0),
    ev(120, 38, 20.5, 22.0),
    ev(240, 47, 20.4, 22.0),
    ev(1440, 51, 20.2, 22.0),
    ev(2880, 40, 20.6, 22.0),
    ev(4320, 44, 20.1, 22.0),
  ];
  const realisticRows = simulate(realistic);

  // (b) What the engine does with that learned state (real engine call).
  const last = realisticRows[realisticRows.length - 1];
  const engineWithLearning = calc({
    mode: 'FULL',
    weather: { tempMin: 2, tempMax: 9 },
    intervalKey: 'weekday_morning',
    homeProfile: { floorArea: 120, learningOffset: 0, confidence: 0.5, insulationFactor: 1 },
    intervalLearning: {
      offset: last.learningOffset,
      confidence: last.confidence,
      avgOvershoot: last.avgOvershoot,
      avgReachTimeMin: last.avgReachTimeMin,
    },
    recentEvents: [],
  });
  const engineNoLearning = calc({
    mode: 'PROFILE_ONLY',
    weather: { tempMin: 2, tempMax: 9 },
    intervalKey: 'weekday_morning',
    homeProfile: { floorArea: 120, learningOffset: 0, confidence: 0.5, insulationFactor: 1 },
  });

  // (c) A genuine overshoot (+2 °C) — what the sign does.
  let s = { avgReach: 0, avgOvershoot: 0, offset: 0, confidence: 0.1, samples: 0 };
  const overshootRows = simulate([ev(0, 30, 24, 22), ev(600, 30, 24, 22), ev(1200, 30, 24, 22)]);
  const engineOvershoot = calc({
    mode: 'FULL',
    weather: { tempMin: 2, tempMax: 9 },
    intervalKey: 'weekday_afternoon',
    homeProfile: { floorArea: 150, confidence: 0.5 },
    intervalLearning: {
      offset: overshootRows[2].learningOffset,
      confidence: overshootRows[2].confidence,
      avgOvershoot: overshootRows[2].avgOvershoot,
      avgReachTimeMin: overshootRows[2].avgReachTimeMin,
    },
  });

  // (d) One single outlier event, as an unbounded mean would ingest it.
  const outlierRows = simulate([ev(0, 40, 21.5, 22), ev(600, 40, 21.5, 22), ev(1200, 40, 21.5, 22), ev(1800, 40, 21.5, 22), ev(2400, 40, 31.0, 22)]);
  const outlierLast = outlierRows[outlierRows.length - 1];
  const engineOutlier = calc({
    mode: 'FULL',
    weather: { tempMin: 2, tempMax: 9 },
    intervalKey: 'weekday_afternoon',
    homeProfile: { floorArea: 150, confidence: 0.5 },
    intervalLearning: {
      offset: outlierLast.learningOffset,
      confidence: outlierLast.confidence,
      avgOvershoot: outlierLast.avgOvershoot,
      avgReachTimeMin: outlierLast.avgReachTimeMin,
    },
  });

  // (d2) The same outlier repeated: unbounded mean saturates the output clamp.
  const outlierRepeatRows = simulate([
    ev(0, 40, 31.0, 22),
    ev(600, 40, 31.0, 22),
    ev(1200, 40, 31.0, 22),
  ]);
  const lastRepeat = outlierRepeatRows[outlierRepeatRows.length - 1];
  const engineOutlierRepeat = calc({
    mode: 'FULL',
    weather: { tempMin: 2, tempMax: 9 },
    intervalKey: 'weekday_afternoon',
    homeProfile: { floorArea: 150, confidence: 0.5 },
    intervalLearning: {
      offset: lastRepeat.learningOffset,
      confidence: lastRepeat.confidence,
      avgOvershoot: lastRepeat.avgOvershoot,
      avgReachTimeMin: lastRepeat.avgReachTimeMin,
    },
  });

  // (e) Confidence invariance: prove it is a constant for every N.
  const confidenceSeries = realisticRows.map((row) => row.confidence);

  // (f) Interval key / morning substring, verified on the real engine.
  const morningKeys = ['weekday_morning', 'weekday_late_morning', 'weekend_morning', 'weekday_afternoon', 'weekday_night'].map(
    (key) => {
      const res = calc({
        mode: 'FULL',
        weather: { tempMin: 0, tempMax: 0 },
        intervalKey: key,
        homeProfile: { floorArea: 150, confidence: 0.5 },
        intervalLearning: { offset: 2, confidence: 0.5, avgOvershoot: 0, avgReachTimeMin: 30 },
      });
      return { intervalKey: key, intervalOffset: r(res.appliedOffsets.interval, 4) };
    },
  );

  // (g) Time-based decay vs index-based decay: the engine never sees timestamps.
  const decayByIndex = [0, 1, 2, 3].map((i) => r(Math.exp(-0.25 * i), 4));

  out.learning = {
    algorithm: 'cumulative arithmetic mean, weight 1/N, no forgetting, no variance, no min-samples gate',
    realisticRows,
    engineEffect: {
      withoutLearning: engineNoLearning.finalTemp,
      withLearnedState: engineWithLearning.finalTemp,
      delta: r(engineWithLearning.finalTemp - engineNoLearning.finalTemp, 3),
    },
    genuineOvershoot: {
      rows: overshootRows,
      finalTemp: engineOvershoot.finalTemp,
      note: 'positive overshoot (room too hot) RAISES flow temperature',
    },
    singleOutlier: {
      rows: outlierRows,
      finalTemp: engineOutlier.finalTemp,
      note: 'one 9 C outlier in five samples moves the recommendation by '
        + nf(outlierLast.learningOffset, 2) + ' C-equivalent before clamp',
    },
    repeatedOutlier: {
      rows: outlierRepeatRows,
      finalTemp: engineOutlierRepeat.finalTemp,
      saturated: engineOutlierRepeat.finalTemp === 55,
    },
    confidenceSeries,
    confidenceIsConstant: confidenceSeries.every((c) => Math.abs(c - 0.1) < 1e-12),
    morningSubstringMatches: morningKeys,
    decayWeights: decayByIndex,
  };
}

// ===========================================================================
// 4. ANOMALY — real AnomalyDetectionService + baseline self-inclusion
// ===========================================================================
if (!only || only === 'anomaly') {
  const metrics = { incrementCounter() {}, setGauge() {}, observeHistogram() {} };
  const svc = new AnomalyDetectionService(metrics);
  const start = new Date('2026-11-04T06:00:00+01:00');

  // Baseline statistics exactly as heating.anomaly.checker.service.ts:127-134
  // computes them, with and without the event under test in the sample.
  const stats = (durations) => {
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance =
      durations.map((d) => Math.pow(d - avg, 2)).reduce((a, b) => a + b, 0) /
      durations.length;
    return { avg, stdDev: Math.sqrt(variance), n: durations.length };
  };

  const historyOnly = [60, 58, 62];
  const withSelfStat = [...historyOnly, 70];
  const withSelfIdle = [...historyOnly, 200];

  const sExcl = stats(historyOnly);
  const sInclStat = stats(withSelfStat);
  const sInclIdle = stats(withSelfIdle);

  const detect = (label, st, current, phase) => {
    const res = svc.detectAnomalies(
      {
        currentDuration: current,
        averageDuration: st.avg,
        standardDeviation: st.stdDev,
        historicalCount: st.n,
        threshold: 2,
      },
      start,
      phase,
    );
    return {
      label,
      n: st.n,
      avg: r(st.avg, 3),
      stdDev: r(st.stdDev, 3),
      currentDuration: current,
      isAnomaly: res.isAnomaly,
      types: res.types,
      confidence: r(res.confidence, 3),
      proposedEndTime: res.proposedEndTime ? res.proposedEndTime.toISOString() : null,
    };
  };

  const cases = [
    detect('CLOSED 70 min, baseline EXCLUDES self', sExcl, 70, 'CLOSED'),
    detect('CLOSED 70 min, baseline INCLUDES self (as coded)', sInclStat, 70, 'CLOSED'),
    detect('CLOSED 200 min, baseline EXCLUDES self', sExcl, 200, 'CLOSED'),
    detect('CLOSED 200 min, baseline INCLUDES self (as coded)', sInclIdle, 200, 'CLOSED'),
    detect('OPEN 61 min, history all exactly 60 (sigma=0)', stats([60, 60, 60]), 61, 'OPEN'),
    detect('OPEN 140 min, history all 60 (sigma=0)', stats([60, 60, 60]), 140, 'OPEN'),
    detect('OPEN 400 min, N=2 (below min samples)', stats([60, 62]), 400, 'OPEN'),
    detect('CLOSED 4 min rapid cycling', sExcl, 4, 'CLOSED'),
  ];

  // Two separate confidence implementations exist; the second is unused by the
  // checker (it passes `result.confidence` through, lines 180-182).
  const altConfidence = {
    OVERSHOOT: r(svc.calculateConfidence(['overshoot'], 3), 3),
    EARLY_STOP: r(svc.calculateConfidence(['early_stop'], 3), 3),
    withManyHistory: r(svc.calculateConfidence(['overshoot'], 220), 3),
  };

  out.anomaly = {
    baselineSelfInclusion: {
      withoutSelf: { n: sExcl.n, avg: r(sExcl.avg, 3), stdDev: r(sExcl.stdDev, 3) },
      withSelf70: { n: sInclStat.n, avg: r(sInclStat.avg, 3), stdDev: r(sInclStat.stdDev, 3) },
      withSelf200: { n: sInclIdle.n, avg: r(sInclIdle.avg, 3), stdDev: r(sInclIdle.stdDev, 3) },
      falseNegativeAt70min: {
        withoutSelf: cases[0].isAnomaly,
        withSelf: cases[1].isAnomaly,
      },
      maskedClassificationAt200min: {
        withoutSelfTypes: cases[2].types,
        withSelfTypes: cases[3].types,
      },
    },
    cases,
    altConfidence,
    coverage: {
      measured: ['cycle duration only'],
      notMeasured: [
        'flow temperature vs recommendation',
        'room temperature vs target at cycle end',
        'heating rate (C/min)',
        'sensor staleness / frozen readings',
        'gas consumption per degree-day',
        'outdoor sensor vs local forecast divergence',
      ],
    },
  };
}

// ===========================================================================
// 5. SENSITIVITY — numeric partial effects, straight from the real engine
// ===========================================================================
if (!only || only === 'sensitivity') {
  const at = (weather, homeProfile = { floorArea: 150 }, mode = 'PROFILE_ONLY', extra = {}) =>
    calc({ mode, weather, homeProfile, ...extra }).finalTemp;

  const extSensitivity = [];
  for (const t of [-10, -5, 0, 5, 9]) {
    const a = at({ tempMin: t, tempMax: t });
    const b = at({ tempMin: t + 1, tempMax: t + 1 });
    extSensitivity.push({ ext: t, finalTemp: a, finalTempPlus1C: b, deltaPerC: r(b - a, 4) });
  }

  const areaSensitivity = [];
  for (const area of [60, 100, 149, 150, 200, 400]) {
    areaSensitivity.push({
      floorArea: area,
      finalTemp: at({ tempMin: 0, tempMax: 0 }, { floorArea: area }),
    });
  }

  const offsetSensitivity = [];
  for (const conf of [0, 0.1, 0.5, 0.8, 1]) {
    offsetSensitivity.push({
      learningOffset: 2,
      confidence: conf,
      PROFILE_ONLY: at({ tempMin: 0, tempMax: 0 }, { floorArea: 150, learningOffset: 2, confidence: conf }),
      FULL: at(
        { tempMin: 0, tempMax: 0 },
        { floorArea: 150, learningOffset: 2, confidence: conf },
        'FULL',
        { intervalKey: 'weekday_afternoon', intervalLearning: { offset: 0, confidence: 0.5, avgOvershoot: 0, avgReachTimeMin: 30 } },
      ),
    });
  }

  // Event offset ceiling: 10 identical events, no cap in the code.
  const eventSweep = [];
  for (const n of [1, 3, 5, 10]) {
    const events = Array.from({ length: n }, () => ({ delta: 5, active: true }));
    const res = calc({
      mode: 'FULL',
      weather: { tempMin: 0, tempMax: 0 },
      intervalKey: 'weekday_afternoon',
      homeProfile: { floorArea: 150, confidence: 0.5 },
      recentEvents: events,
    });
    const resMorning = calc({
      mode: 'FULL',
      weather: { tempMin: 0, tempMax: 0 },
      intervalKey: 'weekday_morning',
      homeProfile: { floorArea: 150, confidence: 0.5 },
      recentEvents: events,
    });
    eventSweep.push({
      events: n,
      eventsOffset: r(res.appliedOffsets.events, 3),
      finalTemp: res.finalTemp,
      finalTempMorning: resMorning.finalTemp,
    });
  }

  out.sensitivity = { extSensitivity, areaSensitivity, offsetSensitivity, eventSweep };
}

// ===========================================================================
// OUTPUT
// ===========================================================================
if (asJson) {
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

if (out.curve) {
  console.log('\n=== 1. KRIVULJA I IZLAZNI DOMEN (stvarni engine) ===');
  console.log('ext °C | krivulja °C | final °C | clamp aktivan');
  for (const row of out.curve.sweep) {
    if (Math.abs(row.ext % 2.5) < 1e-9) {
      console.log(
        `${row.ext.toFixed(2).padStart(7)} | ${row.baseCurveTemp.toFixed(4).padStart(11)} | ${row.finalTemp
          .toFixed(2)
          .padStart(8)} | ${row.clampedAtOutput ? 'da' : '-'}`,
      );
    }
  }
  console.log('\nPrekidi:');
  for (const d of out.curve.discontinuities) {
    console.log(
      `  ext=${d.ext} (${d.side} side): krivulja ${d.baseBefore} -> ${d.baseAfter} (skok ${d.baseJump}); final ${d.finalBefore} -> ${d.finalAfter} (skok ${d.finalJump})`,
    );
  }
  const dom = out.curve.outputDomain;
  console.log(
    `\nDostizni final: ${dom.min} .. ${dom.max} °C, ${dom.countDistinct} različitih vrijednosti`,
  );
  console.log(`  ispod ulaznog minimuma 48 °C: ${JSON.stringify(dom.belowInputFloor48)}`);
  console.log(`  iznad ulaznog maksimuma 55 °C: ${JSON.stringify(dom.aboveInputCeiling55)}`);
  console.log(
    `  ANONYMOUS domen ima rupu između 46 i 48: ${out.curve.anonymousOutputHoleBetween46And48} (najniže iznad 46: ${out.curve.gapInDomain.lowestAbove46})`,
  );
  console.log('\n  Dostizni domen po načinu rada:');
  for (const [mode, d] of Object.entries(out.curve.domainByMode)) {
    console.log(
      `    ${mode.padEnd(13)} min=${d.min} max=${d.max} ispod 48: ${JSON.stringify(d.below48)} rupa=${JSON.stringify(d.gapBetween46AndFirstAbove)}`,
    );
  }
  console.log('\n  Negativan naučeni offset -> preporuka ispod ulaznog minimuma:');
  for (const a of out.curve.learnedNegativePushesBelowEntryFloor) {
    console.log(`    ext=${String(a.ext).padStart(2)} offset=${String(a.offset).padStart(2)}: ${a.finalTemp} °C, unos dozvoljen: ${a.enterable}`);
  }
}

if (out.prod) {
  console.log('\n=== 2. PROIZVODNA PUTANJA: koja profilna polja stižu do motora ===');
  console.log(
    `  objekt iz boiler.service.ts:104-109 daje isti final kao goli {floorArea}: ${out.prod.equalViaProductionAndBareArea}`,
  );
  console.log(`  profil sa learningConfidence=0 (DB default): ${JSON.stringify(out.prod.dbDefaultLearningConfidenceZero)}`);
  console.log(`  proizvodni oblik: ${out.prod.viaProduction.finalTemp} °C (confidence ${out.prod.viaProduction.confidence})`);
  console.log(`  goli floorArea:   ${out.prod.bareArea.finalTemp} °C (confidence ${out.prod.bareArea.confidence})`);
  console.log(
    `  svi profili polja direktno u engine: ${out.prod.withAllFieldsDirect.finalTemp} °C (confidence ${out.prod.withAllFieldsDirect.confidence})`,
  );
  console.log('\n  Efekat koji polja IMAJU kada se stvarno proslijede:');
  for (const f of out.prod.fieldEffectIfPassed) {
    console.log(`    ${f.label.padEnd(34)} ${f.finalTemp} °C`);
  }
}

if (out.robust) {
  console.log('\n=== 2b. ROBUSNOST ULAZA (stvarni engine) ===');
  for (const row of out.robust) {
    console.log(
      `  ${row.label.padEnd(36)} final=${String(row.finalTemp).padEnd(6)} base=${String(row.baseCurveTemp).padEnd(5)} conf=${row.confidence}${row.isNaN ? '  <-- NaN' : ''}`,
    );
  }
}

if (out.learning) {
  console.log('\n=== 3. UČENJE (REPLIKA aritmetike iz servisa) ===');
  console.log('  Realan slijed ciklusa (kraj uvijek nosi START temperaturu sobe):');
  console.log('  N | overshoot | reach min | avgReach | avgOvershoot | offset | confidence');
  for (const row of out.learning.realisticRows) {
    console.log(
      `  ${String(row.sample).padStart(2)} | ${String(row.overshoot).padStart(9)} | ${String(row.reachTime).padStart(9)} | ${String(
        row.avgReachTimeMin,
      ).padStart(8)} | ${String(row.avgOvershoot).padStart(12)} | ${String(row.learningOffset).padStart(6)} | ${row.confidence}`,
    );
  }
  console.log(
    `\n  Efekat na preporuku: bez učenja ${out.learning.engineEffect.withoutLearning} °C -> sa naučenim stanjem ${out.learning.engineEffect.withLearnedState} °C (delta ${out.learning.engineEffect.delta})`,
  );
  console.log(`  Confidence je konstanta kroz sve N: ${out.learning.confidenceIsConstant}`);
  console.log('\n  Stvarni overshoot +2 °C (soba prevruća) — smjer korekcije:');
  for (const row of out.learning.genuineOvershoot.rows) {
    console.log(`    N=${row.sample}: offset=${row.learningOffset}, avgOvershoot=${row.avgOvershoot} -> final ${out.learning.genuineOvershoot.finalTemp} °C`);
  }
  console.log(
    `\n  Jedan outlier (9 °C iznad cilja) u 5 uzoraka: offset=${out.learning.singleOutlier.rows[4].learningOffset} -> final ${out.learning.singleOutlier.finalTemp} °C`,
  );
  console.log(
    `  Isti outlier tri puta: offset=${out.learning.repeatedOutlier.rows[2].learningOffset} -> final ${out.learning.repeatedOutlier.finalTemp} °C (saturirano na clamp: ${out.learning.repeatedOutlier.saturated})`,
  );
  console.log('\n  "morning" substring u intervalKey (offset nosi 2 °C):');
  for (const k of out.learning.morningSubstringMatches) {
    console.log(`    ${k.intervalKey.padEnd(22)} interval offset = ${k.intervalOffset}`);
  }
  console.log(`  Decay po indeksu, ne po vremenu: ${out.learning.decayWeights.join(', ')}`);
}

if (out.anomaly) {
  console.log('\n=== 4. ANOMALIJE (stvarni AnomalyDetectionService) ===');
  const b = out.anomaly.baselineSelfInclusion;
  console.log(
    `  Baseline bez eventa:  N=${b.withoutSelf.n}, avg=${b.withoutSelf.avg}, sigma=${b.withoutSelf.stdDev}`,
  );
  console.log(
    `  Baseline sa 70-min eventom:  N=${b.withSelf70.n}, avg=${b.withSelf70.avg}, sigma=${b.withSelf70.stdDev}`,
  );
  console.log(
    `  Baseline sa 200-min eventom: N=${b.withSelf200.n}, avg=${b.withSelf200.avg}, sigma=${b.withSelf200.stdDev}`,
  );
  console.log(
    `  70-min event (6 sigma iznad historije) detektovan bez self-inclusion: ${b.falseNegativeAt70min.withoutSelf}, sa self-inclusion: ${b.falseNegativeAt70min.withSelf}`,
  );
  console.log(
    `  200-min event klasifikacija: bez self ${JSON.stringify(b.maskedClassificationAt200min.withoutSelfTypes)} vs sa self ${JSON.stringify(b.maskedClassificationAt200min.withSelfTypes)}`,
  );
  console.log('\n  Slučajevi:');
  for (const c of out.anomaly.cases) {
    console.log(
      `    ${c.label.padEnd(46)} anomaly=${String(c.isAnomaly).padStart(5)} types=${JSON.stringify(c.types)} conf=${c.confidence}`,
    );
  }
  console.log(`\n  Alternativna confidence funkcija (nije korištena): ${JSON.stringify(out.anomaly.altConfidence)}`);
  console.log(`  Mjeri se: ${out.anomaly.coverage.measured.join(', ')}`);
  console.log(`  Ne mjeri se: ${out.anomaly.coverage.notMeasured.join('; ')}`);
}

if (out.sensitivity) {
  console.log('\n=== 5. OSJETLJIVOST (stvarni engine) ===');
  console.log('  Vanjska temp -> final (po 1 °C):');
  for (const s of out.sensitivity.extSensitivity) {
    console.log(`    ${String(s.ext).padStart(4)} °C: ${s.finalTemp} -> ${s.finalTempPlus1C} (delta ${s.deltaPerC})`);
  }
  console.log('  Površina (150 m² je nula-točka):');
  for (const a of out.sensitivity.areaSensitivity) {
    console.log(`    ${String(a.floorArea).padStart(4)} m²: ${a.finalTemp} °C`);
  }
  console.log('  Naučeni offset 2 °C pri različitoj confidence:');
  for (const o of out.sensitivity.offsetSensitivity) {
    console.log(`    conf=${o.confidence}: PROFILE_ONLY ${o.PROFILE_ONLY} °C, FULL ${o.FULL} °C`);
  }
  console.log('  Događaji delta=5 °C (active=true), bez gornje granice:');
  for (const e of out.sensitivity.eventSweep) {
    console.log(
      `    N=${String(e.events).padStart(2)}: events offset ${e.eventsOffset} -> ${e.finalTemp} °C (morning ${e.finalTempMorning} °C)`,
    );
  }
}

console.log('\nNapomena: sve vrijednosti su iz sintetičkih ulaza u stvarni kod. To nisu mjerenja sistema, nisu dozvola za upravljanje kotlom i ne dokazuju fizički ishod.\n');
