jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));
jest.mock('../../Heating/engine/flow-temperature.engine', () => ({
  FlowTemperatureEngine: { calculate: jest.fn() },
}));

import { FlowTemperatureEngine } from '../../Heating/engine/flow-temperature.engine';
import type { FlowTempResult } from '../../Heating/engine/types';
import { HeatingRecommendationService } from '../heating.recommendation.service';

const engineResult: FlowTempResult = {
  baseCurveTemp: 51.123456,
  weightedExternalTemp: -2.5,
  appliedOffsets: { home: 0.25, interval: -0.5, events: 0.125 },
  finalTemp: 50.998456,
  confidence: 0.72,
};
const engineCalculate = Reflect.get(
  FlowTemperatureEngine,
  'calculate',
) as jest.Mock;

function makeService(prisma: unknown): HeatingRecommendationService {
  const recommendationWeather = {
    getV2WeatherInput: jest.fn().mockResolvedValue(null),
  };
  return Reflect.construct(HeatingRecommendationService, [
    prisma,
    recommendationWeather,
  ]);
}

describe('FE2-10 HeatingRecommendationService write sites', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ponedjeljak ujutro -> getIntervalKey() = weekday_morning.
    jest.useFakeTimers().setSystemTime(new Date('2026-11-02T07:00:00.000Z'));
    (FlowTemperatureEngine.calculate as jest.Mock).mockReturnValue(
      engineResult,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('persists the engine snapshot on create without changing the recommendation', async () => {
    const intervalLearning = {
      id: 1,
      intervalKey: 'weekday_morning',
      offset: 0,
      avgOvershoot: 0,
      avgReachTimeMin: 27.5,
      samples: 8,
      confidence: 0.72,
    };
    const prisma = {
      thermostatDevice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 10,
          homeProfile: {
            location: 'Visoko',
            floorArea: 150,
            learningOffset: 0.25,
            learningConfidence: 0.72,
            // F5.2: `zoneForDevice` čita zonu kuće, pa korisnika, pa fallback.
            // Bez zone u mock-u ključ pada na `Europe/Sarajevo`; 01.11.2026 je
            // nedjelja, pa je ključ `weekend_morning` umjesto `weekday_morning`,
            // a učenje se ne nađe (`samples: 0`).
            weatherTimezone: null,
            user: { timezone: 'Europe/Sarajevo' },
            intervalLearnings: [intervalLearning],
          },
        }),
      },
      weatherCache: {
        findFirst: jest.fn().mockResolvedValue({ temp_min: -5, temp_max: 0 }),
      },
      heatingIntervalLearning: { updateMany: jest.fn() },
      recommendation: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 1 }),
        update: jest.fn(),
      },
    };

    await makeService(prisma).processHeatingEvent({
      userId: 1,
      deviceId: 10,
      /*
       * 02.11.2026 je **ponedjeljak** — namjerno. Do sada je ovdje bio
       * 01.11.2026, koji je nedjelja, pa je ključ ispravno bio
       * `weekend_morning`, a test je očekivao `weekday_morning`. Test je dakle
       * tvrdio nešto što kod nikad nije radio; pad je otkriven tek kad je F5.2
       * doveo zonu u jednačinu (prije toga je pitanje bilo „koji sat", a ne
       * „koji dan", pa se razlika nije vidjela).
       */
      timestampStart: new Date('2026-11-02T06:00:00.000Z'),
      roomCurrentTemp: 20,
      roomTargetTemp: 22,
      boilerFlowTemp: 50,
    });

    expect(engineCalculate).toHaveBeenCalledWith(
      expect.objectContaining({ weather: { tempMin: -5, tempMax: 0 } }),
    );
    expect(prisma.recommendation.create).toHaveBeenCalledTimes(1);
    const data = prisma.recommendation.create.mock.calls[0][0].data;
    expect(data.recommendedFlowTemp).toBe(engineResult.finalTemp);
    expect(data.confidenceScore).toBe(engineResult.confidence);
    expect(data.breakdown).toEqual({
      // F4.3: snapshot je verzija 2 i nosi `engine`/`model`. Ovdje `engine`
      // nije proslijeđen (`null`) jer `HeatingRecommendationService` još piše
      // iz krive — F4.6 ga gasi kao pisca.
      version: 2,
      engine: null,
      model: null,
      mode: 'FULL',
      intervalKey: 'weekday_morning',
      baseCurveTemp: engineResult.baseCurveTemp,
      weightedExternalTemp: engineResult.weightedExternalTemp,
      appliedOffsets: engineResult.appliedOffsets,
      finalTemp: engineResult.finalTemp,
      confidence: engineResult.confidence,
      samples: 8,
      expectedHeatTimeMin: 27.5,
    });
  });

  it('persists the engine snapshot on update without changing the recommendation', async () => {
    const prisma = {
      thermostatDevice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 10,
          homeProfile: {
            floorArea: 150,
            learningOffset: 0,
            learningConfidence: 0.5,
            intervalLearnings: [],
          },
        }),
      },
      weatherCache: { findFirst: jest.fn().mockResolvedValue(null) },
      heatingIntervalLearning: { updateMany: jest.fn() },
      recommendation: {
        findFirst: jest.fn().mockResolvedValue({ id: 99 }),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 99 }),
      },
    };

    await makeService(prisma).processHeatingEvent({
      userId: 1,
      deviceId: 10,
      /*
       * 02.11.2026 je **ponedjeljak** — namjerno. Do sada je ovdje bio
       * 01.11.2026, koji je nedjelja, pa je ključ ispravno bio
       * `weekend_morning`, a test je očekivao `weekday_morning`. Test je dakle
       * tvrdio nešto što kod nikad nije radio; pad je otkriven tek kad je F5.2
       * doveo zonu u jednačinu (prije toga je pitanje bilo „koji sat", a ne
       * „koji dan", pa se razlika nije vidjela).
       */
      timestampStart: new Date('2026-11-02T06:00:00.000Z'),
      roomCurrentTemp: 20,
      roomTargetTemp: 22,
      boilerFlowTemp: 50,
    });

    expect(prisma.recommendation.update).toHaveBeenCalledTimes(1);
    const data = prisma.recommendation.update.mock.calls[0][0].data;
    expect(data.recommendedFlowTemp).toBe(engineResult.finalTemp);
    expect(data.breakdown.finalTemp).toBe(engineResult.finalTemp);
    expect(data.breakdown.version).toBe(2);
    expect(data.breakdown.samples).toBe(0);
    expect(data.breakdown.expectedHeatTimeMin).toBe(0);
  });

  it('does not use another city weather cache for the device profile', async () => {
    const weatherCache = {
      findFirst: jest.fn((args: any) => {
        const city = args?.where?.city;
        return Promise.resolve(
          city ? null : { city: 'Mostar', temp_min: 8, temp_max: 12 },
        );
      }),
    };
    const prisma = {
      thermostatDevice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 10,
          homeProfile: {
            location: 'Visoko',
            floorArea: 150,
            learningOffset: 0,
            learningConfidence: 0.5,
            intervalLearnings: [],
          },
        }),
      },
      weatherCache,
      heatingIntervalLearning: { updateMany: jest.fn() },
      recommendation: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 1 }),
        update: jest.fn(),
      },
    };

    await makeService(prisma).processHeatingEvent({
      userId: 1,
      deviceId: 10,
      /*
       * 02.11.2026 je **ponedjeljak** — namjerno. Do sada je ovdje bio
       * 01.11.2026, koji je nedjelja, pa je ključ ispravno bio
       * `weekend_morning`, a test je očekivao `weekday_morning`. Test je dakle
       * tvrdio nešto što kod nikad nije radio; pad je otkriven tek kad je F5.2
       * doveo zonu u jednačinu (prije toga je pitanje bilo „koji sat", a ne
       * „koji dan", pa se razlika nije vidjela).
       */
      timestampStart: new Date('2026-11-02T06:00:00.000Z'),
      roomCurrentTemp: 20,
      roomTargetTemp: 22,
      boilerFlowTemp: 50,
    });

    expect(engineCalculate).toHaveBeenCalledWith(
      expect.objectContaining({ weather: { tempMin: 0, tempMax: 0 } }),
    );
    expect(weatherCache.findFirst).toHaveBeenCalledWith({
      where: { city: 'Visoko' },
      orderBy: { fetchedAt: 'desc' },
    });
  });
});
