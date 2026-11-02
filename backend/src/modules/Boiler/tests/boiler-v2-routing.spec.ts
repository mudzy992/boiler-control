jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));
jest.mock('../../Weather/weather.service', () => ({
  WeatherService: class {},
}));
jest.mock('../../Heating/engine/flow-temperature.engine', () => ({
  FlowTemperatureEngine: { calculate: jest.fn() },
}));

import { FlowTemperatureEngine } from '../../Heating/engine/flow-temperature.engine';
import type { FlowTempResult } from '../../Heating/engine/types';
import { BoilerService } from '../boiler.service';

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

function makeHarness(v2Weather: { tempMin: number; tempMax: number } | null) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ homeLocation: 'Visoko' }),
    },
    homeProfile: {
      findFirst: jest.fn().mockResolvedValue({
        id: 10,
        floorArea: 150,
        learningOffset: 0,
        learningConfidence: 0.5,
        seasonMode: 'WINTER',
      }),
    },
    heatingIntervalLearning: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    heatingEvent: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const legacyWeather = {
    getTodayWeather: jest.fn().mockResolvedValue({ temp_min: 8, temp_max: 12 }),
  };
  const boilerWeather = {
    getV2WeatherInput: jest.fn().mockResolvedValue(v2Weather),
  };
  const service = Reflect.construct(BoilerService, [
    prisma,
    legacyWeather,
    {},
    boilerWeather,
  ]) as BoilerService;
  return { service, prisma, legacyWeather, boilerWeather };
}

describe('BoilerService weather routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    engineCalculate.mockReturnValue(engineResult);
  });

  it('uses cached v2 weather from the same profile used for calculation', async () => {
    const { service, legacyWeather, boilerWeather } = makeHarness({
      tempMin: -9,
      tempMax: -1,
    });

    await service.calculateFlowTemp(1);

    expect(boilerWeather.getV2WeatherInput).toHaveBeenCalledWith(1, 10);
    expect(engineCalculate).toHaveBeenCalledWith(
      expect.objectContaining({ weather: { tempMin: -9, tempMax: -1 } }),
    );
    expect(legacyWeather.getTodayWeather).not.toHaveBeenCalled();
  });

  it('keeps the legacy profile-user city fallback when v2 returns null', async () => {
    const { service, legacyWeather } = makeHarness(null);

    await service.calculateFlowTemp(1);

    expect(legacyWeather.getTodayWeather).toHaveBeenCalledWith('Visoko');
    expect(engineCalculate).toHaveBeenCalledWith(
      expect.objectContaining({ weather: { tempMin: 8, tempMax: 12 } }),
    );
  });

  it('keeps legacy user weather when no profile exists', async () => {
    const { service, prisma, legacyWeather, boilerWeather } = makeHarness(null);
    prisma.homeProfile.findFirst.mockResolvedValue(null);

    await service.calculateFlowTemp(1);

    expect(boilerWeather.getV2WeatherInput).not.toHaveBeenCalled();
    expect(legacyWeather.getTodayWeather).toHaveBeenCalledWith('Visoko');
    expect(engineCalculate).toHaveBeenCalledWith(
      expect.objectContaining({ weather: { tempMin: 8, tempMax: 12 } }),
    );
  });

  it('keeps anonymous legacy weather without requesting a profile v2 read', async () => {
    const { service, prisma, legacyWeather, boilerWeather } = makeHarness(null);

    await service.calculateFlowTemp();

    expect(prisma.homeProfile.findFirst).not.toHaveBeenCalled();
    expect(boilerWeather.getV2WeatherInput).not.toHaveBeenCalled();
    expect(legacyWeather.getTodayWeather).toHaveBeenCalledWith('Visoko');
    expect(engineCalculate).toHaveBeenCalledWith(
      expect.objectContaining({ weather: { tempMin: 8, tempMax: 12 } }),
    );
  });
});
