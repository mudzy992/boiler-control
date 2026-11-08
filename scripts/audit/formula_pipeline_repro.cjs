#!/usr/bin/env node
/*
 * PIPELINE REPRO — the four findings that live outside the pure engine.
 *
 * Executes the REAL services with an in-memory fake Prisma/notification layer:
 *   - HeatingRecommendationService.processHeatingEvent   (learning persistence)
 *   - BoilerService.calculateFlowTemp                    (seasonality, missing weather)
 *   - DailyRecommendationService.generateDailyRecommendations (cron path, push text)
 *   - HeatingAnomalyCheckerService.confirmOrUpdateAnomaly (timestampEnd rewrite)
 *
 * This is the same technique the repository already uses in
 * scripts/audit/learning_end_repro.cjs and history_close_repro.cjs: real service
 * code, synthetic collaborators. No database, no network, no device.
 *
 * Usage: node scripts/audit/formula_pipeline_repro.cjs [--json] [--help]
 */
'use strict';

const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');

if (process.argv.includes('--help')) {
  console.log(`Upotreba: node scripts/audit/formula_pipeline_repro.cjs [--json]

Pokreće stvarne servise (preporuka, dnevni cron, anomaly checker) nad lažnom
Prisma/notification bazom u memoriji. Provjerava:
  1. da se novi HeatingIntervalLearning red NIKAD ne kreira (id: 0);
  2. da seasonMode=SUMMER isključuje grijanje i na -12 °C;
  3. da nedostatak prognoze daje 51 °C kao punopravnu preporuku;
  4. da dnevni cron hardkodira 'morning' i piše preporuku i kad je već poslana;
  5. da potvrda anomalije prepisuje stvarni timestampEnd prognoziranim.

Bez baze, mreže, tajni i uređaja. Rezultati nisu upute za upravljanje kotlom.`);
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

// ---- module stubs --------------------------------------------------------
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
  // Generated Prisma enums: the strategy imports the directory form with a
  // trailing slash; other modules import the barrel or the client path.
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
const { BoilerService } = require(
  path.join(root, 'backend/src/modules/Boiler/boiler.service.ts'),
);
const { DailyRecommendationService } = require(
  path.join(root, 'backend/src/modules/Schedule/daily.recommendation.service.ts'),
);
const { HeatingAnomalyCheckerService } = require(
  path.join(root, 'backend/src/modules/HeatingAnomalyCheckerService/heating.anomayl.checker.service.ts'),
);

const results = {};

// ===========================================================================
// 1. LEARNING PERSISTENCE — no row is ever created
// ===========================================================================
async function learningPersistence() {
  const calls = { updateMany: [], create: [], upsert: [] };
  const learningTable = {
    updateMany: async (args) => {
      calls.updateMany.push(args);
      // A real Postgres `WHERE id = 0` matches nothing.
      return { count: args.where && args.where.id === 0 ? 0 : 1 };
    },
    create: async (args) => {
      calls.create.push(args);
      return { id: 99 };
    },
    upsert: async (args) => {
      calls.upsert.push(args);
      return { id: 98 };
    },
  };

  const db = {
    thermostatDevice: {
      findUnique: async () => ({
        id: 10,
        userId: 1,
        homeProfile: {
          id: 5,
          location: 'Visoko',
          floorArea: 150,
          learningOffset: 0,
          learningConfidence: 0.5,
          // Brand-new profile: no learning rows at all.
          intervalLearnings: [],
        },
      }),
    },
    weatherCache: { findFirst: async () => ({ temp_min: 2, temp_max: 9 }) },
    heatingIntervalLearning: learningTable,
    recommendation: {
      findFirst: async () => null,
      create: async () => ({ id: 1 }),
      update: async () => ({ id: 1 }),
    },
  };

  const service = new HeatingRecommendationService(db, {
    getV2WeatherInput: async () => null,
  });
  // Remove wall-clock dependency for a reproducible interval key.
  service.getIntervalKey = () => 'weekday_afternoon';

  const now = new Date('2026-11-04T08:00:00+01:00');
  await service.processHeatingEvent({
    userId: 1,
    deviceId: 10,
    timestampStart: new Date(now.getTime() - 45 * 60000),
    timestampEnd: now,
    roomCurrentTemp: 20.5,
    roomTargetTemp: 22,
    boilerFlowTemp: 51,
  });

  const whereId = calls.updateMany[0]?.where?.id;
  return {
    updateManyCalls: calls.updateMany.length,
    updateManyWhereId: whereId,
    updateManyWhereKeys: Object.keys(calls.updateMany[0]?.where ?? {}),
    createCalls: calls.create.length,
    upsertCalls: calls.upsert.length,
    rowsActuallyWritten: calls.updateMany[0]?.where?.id === 0 ? 0 : 1,
    samplesSentToDb: calls.updateMany[0]?.data?.samples ?? null,
    confidenceSentToDb: calls.updateMany[0]?.data?.confidence ?? null,
    recommendationStillWritten: true,
  };
}

// ===========================================================================
// 2. SEASONALITY — SUMMER disables heating at any outdoor temperature
// ===========================================================================
async function seasonality() {
  const makeService = (seasonMode) => {
    const db = {
      homeProfile: {
        findFirst: async () => ({
          id: 5,
          userId: 1,
          seasonMode,
          floorArea: 150,
          learningOffset: 0,
          learningConfidence: 0.5,
          location: 'Visoko',
        }),
      },
      user: { findUnique: async () => ({ id: 1, homeLocation: 'Visoko' }) },
      weatherCache: { findFirst: async () => null },
      heatingIntervalLearning: { findUnique: async () => null },
      heatingEvent: { findMany: async () => [] },
    };
    const weather = {
      getTodayWeather: async () => ({ temp_min: -12, temp_max: -4 }),
    };
    return new BoilerService(db, weather, { incrementCounter() {} }, {
      getV2WeatherInput: async () => null,
    });
  };

  const summer = await makeService('SUMMER').calculateFlowTemp(1);
  const winter = await makeService('WINTER').calculateFlowTemp(1);

  return {
    outdoorMinC: -12,
    outdoorMaxC: -4,
    summerModeFlowTemp: summer.flowTemp,
    summerModeConfidence: summer.confidence,
    winterModeFlowTemp: winter.flowTemp,
    heatingDisabledBelowFreezing: summer.flowTemp === 0,
  };
}

// ===========================================================================
// 3. MISSING WEATHER — 51 C produced from an absent forecast
// ===========================================================================
async function missingWeather() {
  // (a) BoilerService: weather provider returns nulls.
  const db = {
    homeProfile: {
      findFirst: async () => ({
        id: 5,
        userId: 1,
        seasonMode: 'WINTER',
        floorArea: 150,
        learningOffset: 0,
        learningConfidence: 0.5,
        location: 'Visoko',
      }),
    },
    user: { findUnique: async () => ({ id: 1, homeLocation: 'Visoko' }) },
    weatherCache: { findFirst: async () => null },
    heatingIntervalLearning: { findUnique: async () => null },
    heatingEvent: { findMany: async () => [] },
  };
  const nullWeather = {
    getTodayWeather: async () => ({ temp_min: null, temp_max: null }),
  };
  const svc = new BoilerService(db, nullWeather, { incrementCounter() {} }, {
    getV2WeatherInput: async () => null,
  });
  const boilerResult = await svc.calculateFlowTemp(1);

  // (b) DailyRecommendationService: no v2 weather and no WeatherCache row.
  const created = [];
  let notificationsSent = 0;
  const dailyDb = {
    user: {
      findMany: async () => [
        {
          id: 1,
          homeLocation: 'Visoko',
          homeProfiles: [
            {
              id: 5,
              floorArea: 150,
              learningOffset: 0,
              learningConfidence: 0.5,
            },
          ],
          thermostatDevices: [{ id: 10 }],
        },
      ],
    },
    heatingIntervalLearning: { findUnique: async () => null },
    recommendation: {
      create: async ({ data }) => {
        created.push(data);
        return { id: created.length };
      },
    },
    weatherCache: { findFirst: async () => null },
    // Stateful: the first notification row appears after notifyUser runs.
    notification: { findFirst: async () => (notificationsSent > 0 ? { id: 1 } : null) },
  };
  const daily = new DailyRecommendationService(
    dailyDb,
    {
      notifyUser: async () => {
        notificationsSent += 1;
      },
    },
    { getV2WeatherInput: async () => null },
  );

  const RealDate = Date;
  const frozen = new RealDate('2026-11-04T14:30:00+01:00');
  global.Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [frozen.getTime()]));
    }
    static now() {
      return frozen.getTime();
    }
  };
  try {
    await daily.generateDailyRecommendations();
    await daily.generateDailyRecommendations(); // second run: "already sent"
  } finally {
    global.Date = RealDate;
  }

  return {
    boiler: {
      weatherMin: null,
      weatherMax: null,
      flowTemp: boilerResult.flowTemp,
      mode: boilerResult.mode,
    },
    daily: {
      clock: '2026-11-04T14:30 Europe/Sarajevo (Wednesday afternoon)',
      recommendationsCreated: created.length,
      notificationsSent,
      firstRecommendedFlowTemp: created[0]?.recommendedFlowTemp,
      firstExpectedHeatTimeMin: created[0]?.expectedHeatTimeMin,
      breakdownIntervalKey: created[0]?.breakdown?.intervalKey,
      breakdownMode: created[0]?.breakdown?.mode,
      breakdownWeightedExternalTemp:
        created[0]?.breakdown?.weightedExternalTemp,
      breakdownBaseCurveTemp: created[0]?.breakdown?.baseCurveTemp,
      expectedIntervalKeyFromClock: 'weekday_afternoon',
    },
  };
}

// ===========================================================================
// 4. ANOMALY CONFIRM — real timestampEnd overwritten by a forecast
// ===========================================================================
async function anomalyConfirm() {
  const realEnd = new Date('2026-11-04T12:00:00+01:00');
  const forecastEnd = new Date('2026-11-04T09:30:00+01:00');
  let updateData = null;
  let recommendationArgs = null;

  const db = {
    heatingEvent: {
      findFirst: async () => ({
        id: 7,
        timestampStart: new Date('2026-11-04T08:00:00+01:00'),
        timestampEnd: realEnd,
        isAnomaly: true,
        proposedEndTime: forecastEnd,
        roomCurrentTemp: 21.8,
        roomTargetTemp: 22,
        thermostat: { id: 10, userId: 1, homeProfileId: 5 },
      }),
      updateMany: async ({ data }) => {
        updateData = data;
        return { count: 1 };
      },
    },
    boilerHistory: { findFirst: async () => ({ actualFlowTemp: 50 }) },
  };

  const checker = new HeatingAnomalyCheckerService(
    db,
    { notifyUser: async () => {} },
    {
      processHeatingEvent: async (args) => {
        recommendationArgs = args;
      },
    },
    { detectAnomalies: () => ({ isAnomaly: false, types: [], confidence: 0 }), logAnomalyDetection() {} },
    {},
    { incrementCounter() {} },
    { recordAnomaly() {} },
    {},
  );

  const res = await checker.confirmOrUpdateAnomaly(7, { confirm: true }, 1);

  return {
    success: res.success,
    realEnd: realEnd.toISOString(),
    forecastEnd: forecastEnd.toISOString(),
    storedEndAfterConfirm: updateData?.timestampEnd?.toISOString() ?? null,
    movedBackwardsByMin: Math.round(
      (realEnd.getTime() - (updateData?.timestampEnd?.getTime() ?? realEnd.getTime())) /
        60000,
    ),
    learningReceivedEnd: recommendationArgs?.timestampEnd?.toISOString() ?? null,
    learningReceivedRoomTemp: recommendationArgs?.roomCurrentTemp ?? null,
  };
}

// ===========================================================================
async function main() {
  results.learning = await learningPersistence();
  results.seasonality = await seasonality();
  results.weather = await missingWeather();
  results.anomaly = await anomalyConfirm();

  if (process.env.DEBUG_REPRO) console.log(JSON.stringify(results, null, 2));

  // Assertions: these are the claims the audit document makes.
  assert.equal(results.learning.updateManyWhereId, 0, 'first sample must use id 0');
  assert.equal(results.learning.createCalls, 0, 'no create call expected');
  assert.equal(results.learning.upsertCalls, 0, 'no upsert call expected');
  assert.equal(results.learning.rowsActuallyWritten, 0, 'no row can match id 0');
  assert.equal(results.seasonality.heatingDisabledBelowFreezing, true);
  assert.equal(results.seasonality.summerModeFlowTemp, 0);
  assert.equal(results.weather.boiler.flowTemp, 51);
  assert.equal(results.weather.daily.firstRecommendedFlowTemp, 51);
  assert.equal(results.weather.daily.breakdownIntervalKey, 'weekday_morning');
  assert.equal(results.weather.daily.recommendationsCreated, 2);
  assert.equal(results.weather.daily.notificationsSent, 1);
  assert.equal(results.anomaly.storedEndAfterConfirm, results.anomaly.forecastEnd);
  assert.equal(results.anomaly.storedEndAfterConfirm, results.anomaly.learningReceivedEnd);

  if (asJson) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  const l = results.learning;
  console.log('\n=== 1. PERZISTENCIJA UČENJA (stvarni servis, lažna baza) ===');
  console.log(`  updateMany poziva: ${l.updateManyCalls}, where = ${JSON.stringify({ id: l.updateManyWhereId })}`);
  console.log(`  create poziva: ${l.createCalls}, upsert poziva: ${l.upsertCalls}`);
  console.log(`  redova stvarno upisano: ${l.rowsActuallyWritten} (samples=${l.samplesSentToDb}, confidence=${l.confidenceSentToDb})`);

  const s = results.seasonality;
  console.log('\n=== 2. SEZONALNOST (stvarni BoilerService) ===');
  console.log(`  vanjska ${s.outdoorMinC} … ${s.outdoorMaxC} °C:`);
  console.log(`    seasonMode=SUMMER → flowTemp=${s.summerModeFlowTemp}, confidence=${s.summerModeConfidence}`);
  console.log(`    seasonMode=WINTER → flowTemp=${s.winterModeFlowTemp}`);

  const w = results.weather;
  console.log('\n=== 3. NEDOSTATAK PROGNOZE (stvarni servisi) ===');
  console.log(`  BoilerService (weather=null): flowTemp=${w.boiler.flowTemp}, mode=${w.boiler.mode}`);
  console.log(`  Dnevni cron u ${w.daily.clock}:`);
  console.log(`    intervalKey u breakdown-u: ${w.daily.breakdownIntervalKey} (očekivano po satu: ${w.daily.expectedIntervalKeyFromClock})`);
  console.log(`    preporuka: ${w.daily.firstRecommendedFlowTemp} °C, base=${w.daily.breakdownBaseCurveTemp}, ponder=${w.daily.breakdownWeightedExternalTemp}`);
  console.log(`    expectedHeatTimeMin: ${w.daily.firstExpectedHeatTimeMin}`);
  console.log(`    Recommendation redova kreirano u dva pokretanja: ${w.daily.recommendationsCreated}, notifikacija poslano: ${w.daily.notificationsSent}`);

  const a = results.anomaly;
  console.log('\n=== 4. POTVRDA ANOMALIJE (stvarni checker, lažna baza) ===');
  console.log(`  stvarni kraj:     ${a.realEnd}`);
  console.log(`  prognozirani kraj: ${a.forecastEnd}`);
  console.log(`  upisano nakon potvrde: ${a.storedEndAfterConfirm} (pomak unazad ${a.movedBackwardsByMin} min)`);
  console.log(`  učenje je dobilo kraj: ${a.learningReceivedEnd}, sobu: ${a.learningReceivedRoomTemp} °C`);

  console.log('\nNapomena: stvarni kod servisa, sintetički saradnici. Nema baze, mreže ni uređaja; rezultati nisu upute za upravljanje kotlom.\n');
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exitCode = 1;
});
