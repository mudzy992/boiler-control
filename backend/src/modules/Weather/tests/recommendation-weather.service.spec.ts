jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));

import {
  RecommendationWeatherService,
  recommendationWeatherFromV2,
} from '../recommendation-weather.service';

const NOW = new Date('2026-11-03T01:30:00.000Z');
const ENV_KEYS = ['WEATHER_LOCATION_V2', 'WEATHER_RECOMMENDATION_V2'] as const;
const savedEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

function responseWithDaily(daily: unknown[]) {
  return {
    version: 2,
    status: 'ok',
    location: { timezone: 'America/New_York' },
    daily,
  } as any;
}

function makeService(response: unknown) {
  const weatherV2 = {
    getCachedWeather: jest.fn().mockResolvedValue(response),
  };
  const service = Reflect.construct(RecommendationWeatherService, [
    weatherV2,
  ]) as RecommendationWeatherService;
  return { service, weatherV2 };
}

describe('RecommendationWeatherService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(NOW);
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    jest.useRealTimers();
    for (const key of ENV_KEYS) {
      const value = savedEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it.each([
    ['both flags are off', {}],
    ['only recommendation is on', { WEATHER_RECOMMENDATION_V2: 'on' }],
    ['only location is on', { WEATHER_LOCATION_V2: 'on' }],
  ])('returns null without a v2 read when %s', async (_label, flags) => {
    Object.assign(process.env, flags);
    const { service, weatherV2 } = makeService(null);

    await expect(service.getV2WeatherInput(1, 10)).resolves.toBeNull();
    expect(weatherV2.getCachedWeather).not.toHaveBeenCalled();
  });

  it('selects the profile-local day and preserves a real zero', async () => {
    process.env.WEATHER_LOCATION_V2 = 'on';
    process.env.WEATHER_RECOMMENDATION_V2 = 'on';
    const response = responseWithDaily([
      { date: '2026-11-03', temperatureMinC: 8, temperatureMaxC: 12 },
      { date: '2026-11-02', temperatureMinC: -4, temperatureMaxC: 0 },
    ]);
    const { service, weatherV2 } = makeService(response);

    // F1: ugovor je proširen noćnim minimumom i izvorom. Bez satne prognoze
    // noć je dnevni minimum — i to piše u `nightMinSource`, da se gruba
    // procjena ne čita kao mjerenje iz sata.
    await expect(service.getV2WeatherInput(1, 10)).resolves.toEqual({
      tempMin: -4,
      tempMax: 0,
      nightMinC: -4,
      nightMinSource: 'DAILY_MIN',
      nightHoursUsed: 0,
      dayMeanC: null,
      dayMaxC: null,
      degreeHours: null,
    });
    expect(weatherV2.getCachedWeather).toHaveBeenCalledWith(1, 10);
  });

  it('returns null for a cold cache instead of manufacturing weather', async () => {
    process.env.WEATHER_LOCATION_V2 = 'on';
    process.env.WEATHER_RECOMMENDATION_V2 = 'on';
    const { service } = makeService(null);

    await expect(service.getV2WeatherInput(1, 10)).resolves.toBeNull();
  });

  it('returns null when location confirmation is still required', async () => {
    process.env.WEATHER_LOCATION_V2 = 'on';
    process.env.WEATHER_RECOMMENDATION_V2 = 'on';
    const { service } = makeService({
      version: 2,
      status: 'location_confirmation_required',
    });

    await expect(service.getV2WeatherInput(1, 10)).resolves.toBeNull();
  });

  it('returns null when the profile-local day is absent', () => {
    const response = responseWithDaily([
      { date: '2026-11-03', temperatureMinC: 8, temperatureMaxC: 12 },
    ]);

    expect(recommendationWeatherFromV2(response, NOW)).toBeNull();
  });

  it('does not convert missing daily temperatures to zero', () => {
    const response = responseWithDaily([
      { date: '2026-11-02', temperatureMinC: null, temperatureMaxC: 0 },
    ]);

    expect(recommendationWeatherFromV2(response, NOW)).toBeNull();
  });
});
