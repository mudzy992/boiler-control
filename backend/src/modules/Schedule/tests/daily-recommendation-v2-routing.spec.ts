jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));
jest.mock('../../Notification/notifications.service', () => ({
  NotificationsService: class {},
}));
jest.mock('../../Heating/engine/flow-temperature.engine', () => ({
  FlowTemperatureEngine: { calculate: jest.fn() },
}));

import { FlowTemperatureEngine } from '../../Heating/engine/flow-temperature.engine';
import type { FlowTempResult } from '../../Heating/engine/types';
import { DailyRecommendationService } from '../daily.recommendation.service';

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

function makeService(weatherInput: unknown) {
  const notificationService = { notifyUser: jest.fn().mockResolvedValue(null) };
  const prisma = {
    user: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 1,
          homeLocation: 'Visoko',
          homeProfiles: [
            {
              id: 10,
              location: 'Visoko',
              floorArea: 150,
              learningOffset: 0,
              learningConfidence: 0.5,
            },
          ],
          thermostatDevices: [],
        },
      ]),
    },
    heatingIntervalLearning: { findUnique: jest.fn().mockResolvedValue(null) },
    weatherCache: {
      findFirst: jest.fn().mockResolvedValue({ temp_min: 8, temp_max: 12 }),
    },
    recommendation: { create: jest.fn().mockResolvedValue({ id: 1 }) },
    notification: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const service = Reflect.construct(DailyRecommendationService, [
    prisma,
    notificationService,
    weatherInput,
  ]) as DailyRecommendationService;
  return { service, prisma };
}

describe('DailyRecommendationService recommendation weather routing', () => {
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
    const { service, prisma } = makeService(weatherInput);

    await service.generateDailyRecommendations();

    expect(weatherInput.getV2WeatherInput).toHaveBeenCalledWith(1, 10);
    expect(engineCalculate).toHaveBeenCalledWith(
      expect.objectContaining({ weather: { tempMin: -9, tempMax: -1 } }),
    );
    expect(prisma.weatherCache.findFirst).not.toHaveBeenCalled();
  });

  it('retains the existing city-scoped legacy input when v2 is unavailable', async () => {
    const weatherInput = {
      getV2WeatherInput: jest.fn().mockResolvedValue(null),
    };
    const { service, prisma } = makeService(weatherInput);

    await service.generateDailyRecommendations();

    expect(engineCalculate).toHaveBeenCalledWith(
      expect.objectContaining({ weather: { tempMin: 8, tempMax: 12 } }),
    );
    expect(prisma.weatherCache.findFirst).toHaveBeenCalledWith({
      where: { city: 'Visoko' },
      orderBy: { fetchedAt: 'desc' },
    });
  });
});
