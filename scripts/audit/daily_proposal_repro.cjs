#!/usr/bin/env node
/*
 * DAILY PROPOSAL CONTRACT REPRO
 *
 * The product contract is: ONE flow-temperature proposal per day, the user sets
 * the boiler manually, and the app only records what is currently set.
 * Everything below tests the real code against that contract.
 *
 *   1. How many times per day is the proposal written/overwritten?
 *   2. Does the proposal drift inside the same day as cycles accumulate?
 *   3. Does the daily push use the same interval bucket as the live dashboard?
 *   4. Does the flow temperature the user actually recorded influence anything?
 *   5. Is the outdoor-temperature *shape* of the day visible to the formula?
 *   6. How long until a per-time-of-day bucket can be trusted at 1 decision/day?
 *
 * Real services and real engine, in-memory fake Prisma. No DB, no network.
 * Usage: node scripts/audit/daily_proposal_repro.cjs [--json] [--help]
 */
'use strict';

const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');

if (process.argv.includes('--help')) {
  console.log(`Upotreba: node scripts/audit/daily_proposal_repro.cjs [--json]

Pokreće stvarne servise i stvarni engine protiv ugovora "jedna dnevna
preporuka, korisnik podešava ručno". Mjeri broj upisa preporuke po danu,
unutar-dnevni drift, nesklad intervala (push vs dashboard), uticaj stvarno
unijete polazne temperature, vidljivost dnevnog oblika vanjske temperature i
vrijeme do upotrebljivog učenja pri jednoj odluci dnevno.

Bez baze, mreže i uređaja. Rezultati nisu upute za upravljanje kotlom.`);
  process.exit(0);
}
if (process.argv.slice(2).some((a) => a !== '--json')) {
  console.error('Nepoznat argument; koristite --help');
  process.exit(2);
}
const asJson = process.argv.includes('--json');

process.env.TZ = 'Europe/Sarajevo';
const root = path.resolve(__dirname, '../..');
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');

const stubs = {
  prisma: { PrismaService: class PrismaService {} },
  notifications: { NotificationsService: class NotificationsService {} },
  metrics: { MetricsService: class MetricsService {} },
  reporting: { ReportingService: class ReportingService {} },
  fallback: { FallbackStrategyService: class FallbackStrategyService {} },
  correlation: { CorrelationIdService: class CorrelationIdService {} },
  structured: { StructuredLogger: class StructuredLogger { log() {} debug() {} warn() {} } },
  weather: { WeatherService: class WeatherService {} },
  boilerWeather: { BoilerWeatherService: class BoilerWeatherService {} },
  recommendationWeather: { RecommendationWeatherService: class RecommendationWeatherService {} },
  anomalyDetection: { AnomalyDetectionService: class AnomalyDetectionService {} },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'src/generated/prisma/') {
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
  if (request.includes('generated/prisma')) {
    return {
      NotificationType: {
        DAILY_RECOMMENDATION: 'DAILY_RECOMMENDATION',
        FLOW_TEMP_CHANGED: 'FLOW_TEMP_CHANGED',
        HEATING_STARTED: 'HEATING_STARTED',
        HEATING_ENDED: 'HEATING_ENDED',
        SYSTEM_ALERT: 'SYSTEM_ALERT',
        GAS_READING_REMINDER: 'GAS_READING_REMINDER',
      },
      SeasonMode: { WINTER: 'WINTER', SUMMER: 'SUMMER', AUTO: 'AUTO' },
    };
  }
  if (request.includes('prisma/prisma.service')) return stubs.prisma;
  if (request.includes('Notification/notifications.service')) return stubs.notifications;
  if (request.includes('common/metrics.service')) return stubs.metrics;
  if (request.includes('common/reporting.service')) return stubs.reporting;
  if (request.includes('common/fallback-strategy.service')) return stubs.fallback;
  if (request.includes('common/correlation-id.service')) return stubs.correlation;
  if (request.includes('common/structured-logger')) return stubs.structured;
  if (request.includes('common/anomaly-detection.service')) return stubs.anomalyDetection;
  if (request.includes('Weather/boiler-weather.service')) return stubs.boilerWeather;
  if (request.includes('Weather/recommendation-weather.service')) return stubs.recommendationWeather;
  if (request.includes('Weather/weather.service')) return stubs.weather;
  return originalLoad.call(this, request, parent, isMain);
};

require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));
const { Logger } = require(path.join(root, 'backend/node_modules/@nestjs/common'));
Logger.overrideLogger(false);

const { HeatingRecommendationService } = require(
  path.join(root, 'backend/src/modules/HeatingRecommendation/heating.recommendation.service.ts'),
);
const { DailyRecommendationService } = require(
  path.join(root, 'backend/src/modules/Schedule/daily.recommendation.service.ts'),
);
const { BoilerService } = require(path.join(root, 'backend/src/modules/Boiler/boiler.service.ts'));
const { FlowTemperatureEngine } = require(
  path.join(root, 'backend/src/modules/Heating/engine/flow-temperature.engine.ts'),
);

const out = {};

// Freeze the clock for reproducible runs.
const RealDate = Date;
const FROZEN = new RealDate('2026-11-04T18:00:00+01:00'); // Wednesday evening
// Must await inside the override: an async service would otherwise see the
// real clock because the wrapper returns before its promise resolves.
async function withFrozenTime(fn) {
  global.Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [FROZEN.getTime()]));
    }
    static now() {
      return FROZEN.getTime();
    }
  };
  try {
    return await fn();
  } finally {
    global.Date = RealDate;
  }
}

const profile = {
  id: 5,
  userId: 1,
  seasonMode: 'WINTER',
  floorArea: 150,
  learningOffset: 0,
  learningConfidence: 0.5,
  location: 'Visoko',
};

// ===========================================================================
// 1 + 2. Writes per day and intra-day drift
// ===========================================================================
async function writesAndDrift(cycles) {
  const writes = [];
  let storedRow = null;
  const db = {
    thermostatDevice: {
      findUnique: async () => ({ id: 10, userId: 1, homeProfile: { ...profile, intervalLearnings: [] } }),
    },
    weatherCache: { findFirst: async () => ({ temp_min: 2, temp_max: 9 }) },
    heatingIntervalLearning: { updateMany: async () => ({ count: 0 }) },
    recommendation: {
      findFirst: async () => storedRow,
      create: async ({ data }) => {
        storedRow = { id: 1, ...data };
        writes.push({ op: 'create', value: data.recommendedFlowTemp, at: data.date.toISOString() });
        return storedRow;
      },
      update: async ({ data }) => {
        storedRow = { ...storedRow, ...data };
        writes.push({ op: 'update', value: data.recommendedFlowTemp, at: data.date.toISOString() });
        return storedRow;
      },
    },
  };

  const service = new HeatingRecommendationService(db, { getV2WeatherInput: async () => null });
  service.getIntervalKey = () => 'weekday_evening';

  const dayStart = FROZEN.getTime();
  for (let i = 0; i < cycles; i += 1) {
    // one heating cycle: start then end, 90 minutes apart
    const start = new Date(dayStart - 8 * 3600 * 1000 + i * 120 * 60 * 1000);
    const end = new Date(start.getTime() + 45 * 60 * 1000);
    await service.processHeatingEvent({
      userId: 1,
      deviceId: 10,
      timestampStart: start,
      roomCurrentTemp: 20.5,
      roomTargetTemp: 22,
      boilerFlowTemp: 51,
    });
    await service.processHeatingEvent({
      userId: 1,
      deviceId: 10,
      timestampStart: start,
      timestampEnd: end,
      roomCurrentTemp: 20.5,
      roomTargetTemp: 22,
      boilerFlowTemp: 51,
    });
  }

  const values = writes.map((w) => w.value);
  return {
    cycles,
    writesPerDay: writes.length,
    includesDailyCron: 1,
    totalWritesIncludingCron: writes.length + 1,
    distinctProposedValues: [...new Set(values)],
    writeSequence: writes.map((w) => `${w.op}:${w.value}`),
  };
}

function intradayDrift() {
  const base = {
    mode: 'FULL',
    weather: { tempMin: 2, tempMax: 9 },
    intervalKey: 'weekday_afternoon',
    homeProfile: { floorArea: 150, confidence: 0.5, insulationFactor: 1 },
  };
  const series = [];
  for (const n of [0, 1, 2, 4, 6, 10]) {
    const closed = Array.from({ length: n }, () => ({ delta: 2, active: false }));
    const active = Array.from({ length: n }, () => ({ delta: 2, active: true }));
    const rClosed = FlowTemperatureEngine.calculate({ ...base, recentEvents: closed });
    const rActive = FlowTemperatureEngine.calculate({ ...base, recentEvents: active });
    series.push({
      sameDayCycles: n,
      finalTempClosed: rClosed.finalTemp,
      finalTempActive: rActive.finalTemp,
      eventsOffsetClosed: rClosed.appliedOffsets.events,
      eventsOffsetActive: rActive.appliedOffsets.events,
    });
  }
  return series;
}

// ===========================================================================
// 3. Push bucket vs live dashboard bucket
// ===========================================================================
async function bucketMismatch() {
  const offsets = { 'weekday_morning': -2, 'weekday_evening': 1.5 };

  // (a) daily cron — always 'morning' by construction
  const created = [];
  const dailyDb = {
    user: {
      findMany: async () => [
        {
          id: 1,
          homeLocation: 'Visoko',
          homeProfiles: [{ id: 5, floorArea: 150, learningOffset: 0, learningConfidence: 0.5 }],
          thermostatDevices: [{ id: 10 }],
        },
      ],
    },
    // Only the bucket that the cycles actually produce exists (evening).
    heatingIntervalLearning: {
      findUnique: async ({ where }) => {
        const key = where.homeProfileId_intervalKey.intervalKey;
        if (key !== 'weekday_evening') return null;
        return { offset: offsets[key] ?? 0, confidence: 0.5, samples: 10, avgOvershoot: 0, avgReachTimeMin: 30 };
      },
    },
    recommendation: { create: async ({ data }) => { created.push(data); return { id: 1 }; } },
    weatherCache: { findFirst: async () => ({ temp_min: 2, temp_max: 9 }) },
    notification: { findFirst: async () => ({ id: 1 }) },
  };
  const daily = new DailyRecommendationService(
    dailyDb,
    { notifyUser: async () => {} },
    { getV2WeatherInput: async () => null },
  );
  await withFrozenTime(() => daily.generateDailyRecommendations());

  // (b) dashboard / boiler sync at the same instant — real bucket of "now"
  const boilerDb = {
    homeProfile: { findFirst: async () => profile },
    user: { findUnique: async () => ({ id: 1, homeLocation: 'Visoko' }) },
    weatherCache: { findFirst: async () => ({ temp_min: 2, temp_max: 9 }) },
    heatingIntervalLearning: {
      findUnique: async ({ where }) => {
        const key = where.homeProfileId_intervalKey.intervalKey;
        return { offset: offsets[key] ?? 0, confidence: 0.5, samples: 10, avgOvershoot: 0, avgReachTimeMin: 30 };
      },
    },
    heatingEvent: { findMany: async () => [] },
  };
  const boiler = new BoilerService(boilerDb, { getTodayWeather: async () => ({ temp_min: 2, temp_max: 9 }) }, { incrementCounter() {} }, {
    getV2WeatherInput: async () => null,
  });
  const live = await withFrozenTime(() => boiler.calculateFlowTemp(1));

  return {
    clock: FROZEN.toISOString(),
    learningOffsets: offsets,
    learningRowsThatExist: ['weekday_evening'],
    dailyPush: {
      intervalKey: created[0]?.breakdown?.intervalKey ?? null,
      mode: created[0]?.breakdown?.mode ?? null,
      flowTemp: created[0]?.recommendedFlowTemp ?? null,
    },
    liveDashboard: {
      intervalKey: live.intervalKey,
      flowTemp: live.flowTemp,
      mode: live.mode,
    },
    differ: (created[0]?.recommendedFlowTemp ?? null) !== live.flowTemp,
  };
}

// ===========================================================================
// 4. Does the recorded actual flow temp influence the proposal?
// ===========================================================================
async function recordedValueInfluence() {
  const run = async (recorded) => {
    const db = {
      homeProfile: { findFirst: async () => profile },
      user: {
        findUnique: async () => ({ id: 1, homeLocation: 'Visoko', currentBoilerFlowTemp: recorded }),
      },
      weatherCache: { findFirst: async () => ({ temp_min: 2, temp_max: 9 }) },
      heatingIntervalLearning: { findUnique: async () => null },
      heatingEvent: { findMany: async () => [] },
    };
    const svc = new BoilerService(
      db,
      { getTodayWeather: async () => ({ temp_min: 2, temp_max: 9 }) },
      { incrementCounter() {} },
      { getV2WeatherInput: async () => null },
    );
    return (await svc.calculateFlowTemp(1)).flowTemp;
  };
  const at48 = await run(48);
  const at55 = await run(55);
  return { recorded48Proposal: at48, recorded55Proposal: at55, proposalChanged: at48 !== at55 };
}

// ===========================================================================
// 5. Is the shape of the outdoor day visible to the formula?
// ===========================================================================
function outdoorShape() {
  // Two days with the SAME min (-6) and SAME max (+3) but opposite shape:
  // A is cold most of the day with a short mild afternoon; B is mild most of
  // the day with a short cold morning. Identical min/max, very different demand.
  const coldAllDay = [-6, -6, -6, -6, -6, -6, -6, -6, -6, -6, -6, 3]; // cold, one mild hour
  const mildAllDay = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, -6]; // mild, one cold hour
  const minMax = (series) => ({ tempMin: Math.min(...series), tempMax: Math.max(...series) });
  const ext = (series) => {
    const { tempMin, tempMax } = minMax(series);
    return Math.max(-15, Math.min(10, 0.7 * tempMin + 0.3 * tempMax));
  };
  // Degree-hours below 20 C: a crude but standard proxy for heating need.
  const degreeHours = (series) => series.reduce((a, t) => a + Math.max(0, 20 - t), 0);
  const finalFor = (series) => {
    const { tempMin, tempMax } = minMax(series);
    return FlowTemperatureEngine.calculate({
      mode: 'ANONYMOUS',
      weather: { tempMin, tempMax },
      homeProfile: { floorArea: 150 },
    }).finalTemp;
  };
  return {
    coldAllDay: {
      min: Math.min(...coldAllDay),
      max: Math.max(...coldAllDay),
      weightedExternalTemp: ext(coldAllDay),
      degreeHours: degreeHours(coldAllDay),
      proposal: finalFor(coldAllDay),
    },
    mildAllDay: {
      min: Math.min(...mildAllDay),
      max: Math.max(...mildAllDay),
      weightedExternalTemp: ext(mildAllDay),
      degreeHours: degreeHours(mildAllDay),
      proposal: finalFor(mildAllDay),
    },
    identicalProposalDespiteDifferentDemand:
      finalFor(coldAllDay) === finalFor(mildAllDay),
    heatDemandDifferencePct: Math.round(
      ((degreeHours(coldAllDay) - degreeHours(mildAllDay)) /
        degreeHours(mildAllDay)) *
        100,
    ),
  };
}

// ===========================================================================
// 6. Time to a usable bucket at one decision per day
// ===========================================================================
function learningBudget() {
  const N_MIN = 8;
  const buckets = [];
  for (const dayType of ['weekday', 'weekend']) {
    for (const part of ['morning', 'late_morning', 'afternoon', 'evening', 'night']) {
      buckets.push(`${dayType}_${part}`);
    }
  }
  const keyFor = (date) => {
    const hour = date.getHours();
    const weekday = date.getDay();
    const part =
      hour >= 6 && hour < 9
        ? 'morning'
        : hour >= 9 && hour < 12
          ? 'late_morning'
          : hour >= 12 && hour < 17
            ? 'afternoon'
            : hour >= 17 && hour < 22
              ? 'evening'
              : 'night';
    const dayType = weekday === 0 || weekday === 6 ? 'weekend' : 'weekday';
    return `${dayType}_${part}`;
  };

  // Scenario A: one heating cycle per day at 18:00 (typical evening heating).
  const a = new Map();
  const aDaysToAll = {};
  let aAllAt = null;
  const start = new RealDate('2026-11-04T18:00:00+01:00');
  for (let d = 0; d < 365; d += 1) {
    const day = new RealDate(start.getTime() + d * 24 * 3600 * 1000);
    const key = keyFor(day);
    a.set(key, (a.get(key) ?? 0) + 1);
    for (const b of buckets) if (!aDaysToAll[b] && (a.get(b) ?? 0) >= N_MIN) aDaysToAll[b] = d + 1;
    if (aAllAt === null && buckets.every((b) => (a.get(b) ?? 0) >= N_MIN)) aAllAt = d + 1;
  }

  // Scenario B: three cycles per day (morning, afternoon, evening).
  const threeMap = new Map();
  let bAllAt = null;
  for (let d = 0; d < 365; d += 1) {
    const day = new RealDate(start.getTime() + d * 24 * 3600 * 1000);
    for (const hour of [7, 14, 19]) {
      const at = new RealDate(day);
      at.setHours(hour);
      const key = keyFor(at);
      threeMap.set(key, (threeMap.get(key) ?? 0) + 1);
    }
    if (bAllAt === null && buckets.every((x) => (threeMap.get(x) ?? 0) >= N_MIN)) bAllAt = d + 1;
  }

  const perBucketOneCycle = Object.fromEntries(
    buckets.map((b) => [b, a.get(b) ?? 0]),
  );
  const perBucketThreeCycles = Object.fromEntries(
    buckets.map((key) => [key, threeMap.get(key) ?? 0]),
  );
  return {
    nMin: N_MIN,
    bucketCount: buckets.length,
    windowDays: 365,
    oneCyclePerDay: {
      daysUntilEveryBucketHas8: aAllAt, // null = never within the window
      daysUntilEveningWeekdayHas8: aDaysToAll['weekday_evening'] ?? null,
      samplesAfter365Days: perBucketOneCycle,
      bucketsThatNeverReachNMin: buckets.filter((b) => (a.get(b) ?? 0) < N_MIN),
    },
    threeCyclesPerDay: {
      daysUntilEveryBucketHas8: bAllAt,
      samplesAfter365Days: perBucketThreeCycles,
      bucketsThatNeverReachNMin: buckets.filter((key) => (threeMap.get(key) ?? 0) < N_MIN),
    },
  };
}

// ===========================================================================
async function main() {
  out.writes = {
    fiveCycles: await writesAndDrift(5),
    twoCycles: await writesAndDrift(2),
  };
  out.drift = intradayDrift();
  out.buckets = await bucketMismatch();
  out.recorded = await recordedValueInfluence();
  out.shape = outdoorShape();
  out.learning = learningBudget();

  // Contract claims.
  assert.equal(out.writes.fiveCycles.writesPerDay, 10, 'start+end per cycle writes');
  assert.equal(out.writes.fiveCycles.totalWritesIncludingCron, 11);
  assert.equal(out.recorded.proposalChanged, false, 'recorded value must not matter today');
  assert.equal(out.shape.identicalProposalDespiteDifferentDemand, true);
  assert.equal(out.buckets.dailyPush.intervalKey, 'weekday_morning');
  assert.equal(out.buckets.liveDashboard.intervalKey, 'weekday_evening');
  assert.equal(out.buckets.differ, true);

  if (asJson) {
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  const w = out.writes;
  console.log('\n=== 1. KOLIKO PUTA DNEVNO SE PREPORUKA NAPIŠE ===');
  for (const [label, s] of [['2 ciklusa', w.twoCycles], ['5 ciklusa', w.fiveCycles]]) {
    console.log(
      `  ${label}: ${s.writesPerDay} upisa iz ciklusa + 1 dnevni cron = ${s.totalWritesIncludingCron} (različite vrijednosti: ${JSON.stringify(s.distinctProposedValues)})`,
    );
    console.log(`    slijed: ${s.writeSequence.join(' → ')}`);
  }

  console.log('\n=== 2. DRIFT UNUTAR ISTOG DANA (isti dan, isti podaci, samo rastu ciklusi) ===');
  console.log('  ciklusa | delta=2 zatvoreni | delta=2 aktivni');
  for (const r of out.drift) {
    console.log(`  ${String(r.sameDayCycles).padStart(7)} | ${String(r.finalTempClosed).padStart(17)} | ${String(r.finalTempActive).padStart(14)}`);
  }

  const b = out.buckets;
  console.log('\n=== 3. PUSH I DASHBOARD U ISTOM TRENUTKU ===');
  console.log(`  vrijeme: ${b.clock}`);
  console.log(`  postojeći redovi učenja: ${JSON.stringify(b.learningRowsThatExist)}`);
  console.log(`  dnevni push:    ${b.dailyPush.intervalKey} / ${b.dailyPush.mode} → ${b.dailyPush.flowTemp} °C`);
  console.log(`  dashboard/sync: ${b.liveDashboard.intervalKey} / ${b.liveDashboard.mode} → ${b.liveDashboard.flowTemp} °C`);
  console.log(`  različite preporuke u istom danu: ${b.differ}`);

  const r = out.recorded;
  console.log('\n=== 4. UTICAJ STVARNO UNIJETE POLAZNE ===');
  console.log(`  korisnik unio 48 → predlog ${r.recorded48Proposal} °C`);
  console.log(`  korisnik unio 55 → predlog ${r.recorded55Proposal} °C`);
  console.log(`  predlog se mijenja: ${r.proposalChanged}`);

  const s = out.shape;
  console.log('\n=== 5. OBLIK DANA IZ VANJSKE TEMPERATURE ===');
  for (const [label, d] of [['hladno cijeli dan', s.coldAllDay], ['blago cijeli dan', s.mildAllDay]]) {
    console.log(
      `  ${label.padEnd(18)} min=${String(d.min).padStart(4)} max=${String(d.max).padStart(4)} ponder=${String(d.weightedExternalTemp).padStart(4)} stepen-sati=${String(d.degreeHours).padStart(5)} → predlog ${d.proposal} °C`,
    );
  }
  console.log(`  identičan predlog uz različitu potrebu za grijanjem: ${s.identicalProposalDespiteDifferentDemand} (razlika potrebe ${s.heatDemandDifferencePct} %)`);

  const l = out.learning;
  console.log('\n=== 6. VRIJEME DO UPOTREBLJIVOG UČENJA (N_min = 8) ===');
  console.log(`  buckets: ${l.bucketCount}`);
  const fmtDays = (v) => (v === null ? 'nikad (u 365 dana)' : `${v} dana`);
  console.log(`  jedan ciklus dnevno (18:00): svi bucketi puni nakon ${fmtDays(l.oneCyclePerDay.daysUntilEveryBucketHas8)}`);
  console.log(`    weekday_evening dostiže 8 uzoraka nakon ${fmtDays(l.oneCyclePerDay.daysUntilEveningWeekdayHas8)}`);
  console.log(`    bucketi koji NIKAD ne dostignu ${l.nMin}: ${l.oneCyclePerDay.bucketsThatNeverReachNMin.join(', ')}`);
  console.log(`  tri ciklusa dnevno (7/14/19h): svi bucketi puni nakon ${fmtDays(l.threeCyclesPerDay.daysUntilEveryBucketHas8)}`);
  console.log(`    bucketi koji NIKAD ne dostignu ${l.nMin}: ${l.threeCyclesPerDay.bucketsThatNeverReachNMin.join(', ')}`);

  console.log('\nNapomena: stvarni kod, sintetički podaci. Ovo nisu upute za podešavanje kotla.\n');
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exitCode = 1;
});
