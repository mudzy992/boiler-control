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
  return Reflect.construct(HeatingRecommendationService, [prisma]);
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
      timestampStart: new Date('2026-11-01T06:00:00.000Z'),
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
      version: 1,
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
      timestampStart: new Date('2026-11-01T06:00:00.000Z'),
      roomCurrentTemp: 20,
      roomTargetTemp: 22,
      boilerFlowTemp: 50,
    });

    expect(prisma.recommendation.update).toHaveBeenCalledTimes(1);
    const data = prisma.recommendation.update.mock.calls[0][0].data;
    expect(data.recommendedFlowTemp).toBe(engineResult.finalTemp);
    expect(data.breakdown.finalTemp).toBe(engineResult.finalTemp);
    expect(data.breakdown.version).toBe(1);
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
      timestampStart: new Date('2026-11-01T06:00:00.000Z'),
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
