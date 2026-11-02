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
  baseCurveTemp: 50,
  weightedExternalTemp: -5,
  appliedOffsets: { home: 0, interval: 0, events: 0 },
  finalTemp: 45,
  confidence: 0.5,
};
const engineCalculate = Reflect.get(
  FlowTemperatureEngine,
  'calculate',
) as jest.Mock;

describe('HeatingRecommendationService recommendation weather routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-11-02T07:00:00.000Z'));
    engineCalculate.mockReturnValue(engineResult);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses the injected profile-aware weather input instead of legacy cache', async () => {
    const weatherInput = {
      getV2WeatherInput: jest
        .fn()
        .mockResolvedValue({ tempMin: -9, tempMax: -1 }),
    };
    const prisma = {
      thermostatDevice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 10,
          homeProfile: {
            id: 10,
            location: 'Visoko',
            floorArea: 150,
            learningOffset: 0,
            learningConfidence: 0.5,
            intervalLearnings: [],
          },
        }),
      },
      weatherCache: {
        findFirst: jest.fn().mockResolvedValue({ temp_min: 8, temp_max: 12 }),
      },
      heatingIntervalLearning: { updateMany: jest.fn() },
      recommendation: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 1 }),
        update: jest.fn(),
      },
    };
    const service = Reflect.construct(HeatingRecommendationService, [
      prisma,
      weatherInput,
    ]) as HeatingRecommendationService;

    await service.processHeatingEvent({
      userId: 1,
      deviceId: 10,
      timestampStart: new Date('2026-11-02T06:00:00.000Z'),
      roomCurrentTemp: 20,
      roomTargetTemp: 22,
      boilerFlowTemp: 50,
    });

    expect(weatherInput.getV2WeatherInput).toHaveBeenCalledWith(1, 10);
    expect(engineCalculate).toHaveBeenCalledWith(
      expect.objectContaining({ weather: { tempMin: -9, tempMax: -1 } }),
    );
    expect(prisma.weatherCache.findFirst).not.toHaveBeenCalled();
  });
});
