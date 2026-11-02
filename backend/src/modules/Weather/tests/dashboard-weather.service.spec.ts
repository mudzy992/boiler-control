jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));

import { DashboardWeatherService } from '../dashboard-weather.service';

const NOW = new Date('2026-11-03T01:30:00.000Z');
const ENV_KEYS = [
  'WEATHER_LOCATION_V2',
  'WEATHER_RECOMMENDATION_V2',
  'WEATHER_BOILER_V2',
  'WEATHER_POLL_V2',
  'WEATHER_DASHBOARD_V2',
] as const;
const savedEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

function makeService(response: unknown) {
  const weatherV2 = {
    getCachedWeather: jest.fn().mockResolvedValue(response),
    getWeather: jest.fn(),
  };
  const service = Reflect.construct(DashboardWeatherService, [
    weatherV2,
  ]) as DashboardWeatherService;
  return { service, weatherV2 };
}

function enableDashboardV2() {
  process.env.WEATHER_LOCATION_V2 = 'on';
  process.env.WEATHER_DASHBOARD_V2 = 'on';
}

function makeResponse(overrides: Record<string, unknown> = {}) {
  return {
    version: 2,
    status: 'ok',
    currentHidden: false,
    location: { timezone: 'America/New_York' },
    current: {
      temperatureC: 0,
      apparentTemperatureC: -2,
      humidityPercent: 50,
      windKph: 0,
      pressureHpa: 1005,
      conditionCode: 0,
    },
    daily: [
      {
        date: '2026-11-03',
        uvIndex: 9,
        sunrise: '2026-11-03T11:00:00.000Z',
        sunset: '2026-11-03T21:00:00.000Z',
      },
      {
        date: '2026-11-02',
        uvIndex: 0,
        sunrise: '2026-11-02T11:00:00.000Z',
        sunset: '2026-11-02T21:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

describe('DashboardWeatherService', () => {
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
    ['only dashboard is on', { WEATHER_DASHBOARD_V2: 'on' }],
    ['only location is on', { WEATHER_LOCATION_V2: 'on' }],
    [
      'location and every other consumer flag are on without dashboard',
      {
        WEATHER_LOCATION_V2: 'on',
        WEATHER_RECOMMENDATION_V2: 'on',
        WEATHER_BOILER_V2: 'on',
        WEATHER_POLL_V2: 'on',
      },
    ],
  ])('returns null without a v2 read when %s', async (_label, flags) => {
    Object.assign(process.env, flags);
    const { service, weatherV2 } = makeService(null);

    await expect(service.getV2DashboardWeather(7, 10)).resolves.toBeNull();
    expect(weatherV2.getCachedWeather).not.toHaveBeenCalled();
  });

  it('reads only the cache, preserves zero and uses the profile-local day', async () => {
    enableDashboardV2();
    const { service, weatherV2 } = makeService(makeResponse());

    await expect(service.getV2DashboardWeather(7, 10)).resolves.toEqual({
      temp: 0,
      feelsLike: -2,
      condition: 'WMO_0',
      humidity: 50,
      windSpeed: 0,
      pressure: 1005,
      uvIndex: 0,
      sunrise: '2026-11-02T11:00:00.000Z',
      sunset: '2026-11-02T21:00:00.000Z',
    });
    expect(weatherV2.getCachedWeather).toHaveBeenCalledWith(7, 10);
    expect(weatherV2.getWeather).not.toHaveBeenCalled();
  });

  it('returns null for a cold cache instead of refreshing weather', async () => {
    enableDashboardV2();
    const { service, weatherV2 } = makeService(null);

    await expect(service.getV2DashboardWeather(7, 10)).resolves.toBeNull();
    expect(weatherV2.getWeather).not.toHaveBeenCalled();
  });

  it('returns null when location confirmation is still required', async () => {
    enableDashboardV2();
    const { service } = makeService({
      version: 2,
      status: 'location_confirmation_required',
    });

    await expect(service.getV2DashboardWeather(7, 10)).resolves.toBeNull();
  });

  it.each([
    ['current is hidden', { currentHidden: true }],
    ['current is missing', { current: null }],
    ['the profile-local day is missing', { daily: [] }],
  ])('returns null when %s', async (_label, overrides) => {
    enableDashboardV2();
    const { service } = makeService(makeResponse(overrides));

    await expect(service.getV2DashboardWeather(7, 10)).resolves.toBeNull();
  });

  it.each([null, undefined, Number.NaN, Infinity, -Infinity, '0'])(
    'returns null for invalid current temperature %s',
    async (temperatureC) => {
      enableDashboardV2();
      const { service } = makeService(
        makeResponse({ current: { temperatureC } }),
      );

      await expect(service.getV2DashboardWeather(7, 10)).resolves.toBeNull();
    },
  );
});
