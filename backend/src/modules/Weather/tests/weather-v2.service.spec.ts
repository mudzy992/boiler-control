jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));

import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { WeatherV2Service } from '../weather-v2.service';
import type {
  ConfirmedWeatherLocation,
  WeatherForecastPayloadV2,
  WeatherLocationCandidate,
} from '../weather-v2.types';

const NOW = new Date('2026-11-02T12:00:00.000Z');
const ENV_KEYS = [
  'WEATHER_LOCATION_V2',
  'WEATHER_RECOMMENDATION_V2',
  'WEATHER_SWR_ENABLED',
  'WEATHER_STALE_AFTER_MINUTES',
  'WEATHER_CURRENT_HIDDEN_AFTER_MINUTES',
] as const;
const savedEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

const candidateA: WeatherLocationCandidate = {
  provider: 'open-meteo',
  providerId: 'a',
  label: 'Springfield, Illinois, United States',
  name: 'Springfield',
  admin1: 'Illinois',
  country: 'United States',
  countryCode: 'US',
  latitude: 39.78,
  longitude: -89.65,
  timezone: 'America/Chicago',
};
const candidateB: WeatherLocationCandidate = {
  ...candidateA,
  providerId: 'b',
  label: 'Springfield, Massachusetts, United States',
  admin1: 'Massachusetts',
  latitude: 42.1,
  longitude: -72.59,
  timezone: 'America/New_York',
};
const confirmed: ConfirmedWeatherLocation = {
  ...candidateA,
  confirmedAt: '2026-01-01T00:00:00.000Z',
};

function profile(confirmedLocation = true) {
  return {
    id: 10,
    weatherLatitude: confirmedLocation ? confirmed.latitude : null,
    weatherLongitude: confirmedLocation ? confirmed.longitude : null,
    weatherTimezone: confirmedLocation ? confirmed.timezone : null,
    weatherLocationProvider: confirmedLocation ? confirmed.provider : null,
    weatherLocationProviderId: confirmedLocation ? confirmed.providerId : null,
    weatherLocationLabel: confirmedLocation ? confirmed.label : null,
    weatherLocationName: confirmedLocation ? confirmed.name : null,
    weatherLocationAdmin1: confirmedLocation ? confirmed.admin1 : null,
    weatherLocationCountry: confirmedLocation ? confirmed.country : null,
    weatherLocationCountryCode: confirmedLocation
      ? confirmed.countryCode
      : null,
    weatherLocationConfirmedAt: confirmedLocation
      ? new Date(confirmed.confirmedAt)
      : null,
  };
}

function payload(temperatureC = 5): WeatherForecastPayloadV2 {
  return {
    observedAt: '2026-11-02T11:00:00.000Z',
    current: {
      temperatureC,
      apparentTemperatureC: 4,
      humidityPercent: 50,
      windKph: 0,
      gustKph: null,
      windDirectionDegrees: 180,
      pressureHpa: 1013,
      cloudPercent: 0,
      conditionCode: 0,
      conditionKey: 'clear',
      conditionI18nKey: 'weather.condition.clear',
      isDay: true,
    },
    hourly: [
      {
        at: '2026-11-02T12:00:00.000Z',
        temperatureC,
        apparentTemperatureC: 4,
        humidityPercent: 50,
        precipitationProbabilityPercent: 0,
        precipitationMm: 0,
        windKph: 0,
        gustKph: null,
        windDirectionDegrees: 180,
        conditionCode: 0,
        conditionKey: 'clear',
        conditionI18nKey: 'weather.condition.clear',
        isDay: true,
      },
    ],
    daily: [],
  };
}

function cached(minutesOld: number, value = payload()) {
  return {
    cacheKey: 'weather-key',
    provider: 'open-meteo',
    payload: value,
    fetchedAt: new Date(NOW.getTime() - minutesOld * 60 * 1000),
  };
}

function makeService(options: { cached?: unknown; confirmed?: boolean } = {}) {
  const prisma = {
    homeProfile: {
      findFirst: jest
        .fn()
        .mockResolvedValue(profile(options.confirmed !== false)),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    weatherV2Cache: {
      findUnique: jest.fn().mockResolvedValue(options.cached ?? null),
      upsert: jest.fn(),
    },
  };
  const provider = {
    geocode: jest.fn().mockResolvedValue([candidateA, candidateB]),
    fetchForecast: jest.fn(),
  };
  const service = Reflect.construct(WeatherV2Service, [
    prisma,
    provider,
  ]) as WeatherV2Service;
  return { service, prisma, provider };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  process.env.WEATHER_LOCATION_V2 = 'on';
  delete process.env.WEATHER_RECOMMENDATION_V2;
  delete process.env.WEATHER_SWR_ENABLED;
  delete process.env.WEATHER_STALE_AFTER_MINUTES;
  delete process.env.WEATHER_CURRENT_HIDDEN_AFTER_MINUTES;
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('WeatherV2Service location confirmation and ownership', () => {
  it('is unavailable while WEATHER_LOCATION_V2 is off', async () => {
    delete process.env.WEATHER_LOCATION_V2;
    const { service, prisma } = makeService();
    await expect(service.getWeather(1, 10)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.homeProfile.findFirst).not.toHaveBeenCalled();
  });

  it('never auto-confirms an existing text location', async () => {
    const { service, provider } = makeService({ confirmed: false });
    await expect(service.getWeather(1, 10)).resolves.toEqual({
      version: 2,
      status: 'location_confirmation_required',
    });
    expect(provider.geocode).not.toHaveBeenCalled();
    expect(provider.fetchForecast).not.toHaveBeenCalled();
  });

  it('persists only the explicitly selected fresh geocoder candidate', async () => {
    const { service, prisma, provider } = makeService();
    const result = await service.confirmLocation(1, 10, 'Springfield', 'b');

    expect(provider.geocode).toHaveBeenCalledWith('Springfield');
    expect(prisma.homeProfile.updateMany).toHaveBeenCalledWith({
      where: { id: 10, userId: 1 },
      data: expect.objectContaining({
        weatherLatitude: candidateB.latitude,
        weatherLongitude: candidateB.longitude,
        weatherTimezone: candidateB.timezone,
        weatherLocationProviderId: 'b',
        weatherLocationConfirmedAt: NOW,
      }),
    });
    expect(result.location).toMatchObject({
      providerId: 'b',
      timezone: 'America/New_York',
      confirmedAt: NOW.toISOString(),
    });
  });

  it('rejects a candidate outside the geocoder result and isolates other users', async () => {
    const { service, prisma, provider } = makeService();
    await expect(
      service.confirmLocation(1, 10, 'Springfield', 'not-listed'),
    ).rejects.toThrow('no longer available');
    expect(prisma.homeProfile.updateMany).not.toHaveBeenCalled();

    prisma.homeProfile.findFirst.mockResolvedValue(null);
    await expect(service.getWeather(2, 10)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(provider.fetchForecast).not.toHaveBeenCalled();
  });
});

describe('WeatherV2Service freshness and last-good behavior', () => {
  it('returns fresh cache without a provider request and always exposes fetchedAt', async () => {
    const lastGood = cached(5);
    const { service, provider } = makeService({ cached: lastGood });
    const result = await service.getWeather(1, 10);

    expect(provider.fetchForecast).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'ok',
      freshness: 'fresh',
      fetchedAt: lastGood.fetchedAt.toISOString(),
      ageSeconds: 300,
      currentHidden: false,
      current: { temperatureC: 5 },
    });
  });

  it('serves consumer cache reads without provider refresh or cache writes', async () => {
    process.env.WEATHER_SWR_ENABLED = 'on';
    const { service, prisma, provider } = makeService({ cached: cached(20) });

    const result = await service.getCachedWeather(1, 10);

    expect(result).toMatchObject({ status: 'ok', freshness: 'stale' });
    expect(provider.fetchForecast).not.toHaveBeenCalled();
    expect(prisma.weatherV2Cache.upsert).not.toHaveBeenCalled();
  });

  it('returns null on a cold consumer read without fetching provider data', async () => {
    const { service, prisma, provider } = makeService({ cached: null });

    await expect(service.getCachedWeather(1, 10)).resolves.toBeNull();
    expect(provider.fetchForecast).not.toHaveBeenCalled();
    expect(prisma.weatherV2Cache.upsert).not.toHaveBeenCalled();
  });

  it('separates caches for same-name locations with different coordinates', async () => {
    const { service, prisma } = makeService({ cached: cached(5) });
    await service.getWeather(1, 10);
    prisma.homeProfile.findFirst.mockResolvedValue({
      ...profile(),
      weatherLatitude: candidateB.latitude,
      weatherLongitude: candidateB.longitude,
      weatherTimezone: candidateB.timezone,
      weatherLocationProviderId: candidateB.providerId,
    });
    await service.getWeather(1, 11);

    const keys = prisma.weatherV2Cache.findUnique.mock.calls.map(
      ([argument]) => argument.where.cacheKey,
    );
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(keys[1]).toMatch(/^[a-f0-9]{64}$/);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('refreshes stale data synchronously when SWR is off', async () => {
    const refreshed = cached(0, payload(8));
    const { service, prisma, provider } = makeService({ cached: cached(20) });
    provider.fetchForecast.mockResolvedValue(payload(8));
    prisma.weatherV2Cache.upsert.mockResolvedValue(refreshed);

    const result = await service.getWeather(1, 10);

    expect(provider.fetchForecast).toHaveBeenCalledTimes(1);
    expect(prisma.weatherV2Cache.upsert).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      freshness: 'fresh',
      current: { temperatureC: 8 },
    });
  });

  it('keeps last-good data on provider failure and hides only current after 60 minutes', async () => {
    const lastGood = cached(61);
    const { service, provider } = makeService({ cached: lastGood });
    provider.fetchForecast.mockRejectedValue(new Error('offline'));

    const result = await service.getWeather(1, 10);

    expect(result).toMatchObject({
      status: 'ok',
      freshness: 'stale',
      current: null,
      currentHidden: true,
      fetchedAt: lastGood.fetchedAt.toISOString(),
      hourly: [{ temperatureC: 5 }],
    });
  });

  it('returns 503 on a cold provider failure instead of using another location cache', async () => {
    const { service, provider } = makeService({ cached: null });
    provider.fetchForecast.mockRejectedValue(new Error('offline'));
    await expect(service.getWeather(1, 10)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('returns stale immediately and shares one background refresh with SWR on', async () => {
    process.env.WEATHER_SWR_ENABLED = 'on';
    const lastGood = cached(20);
    const { service, prisma, provider } = makeService({ cached: lastGood });
    let resolveForecast!: (value: WeatherForecastPayloadV2) => void;
    provider.fetchForecast.mockReturnValue(
      new Promise<WeatherForecastPayloadV2>((resolve) => {
        resolveForecast = resolve;
      }),
    );
    prisma.weatherV2Cache.upsert.mockResolvedValue(cached(0, payload(9)));

    const [first, second] = await Promise.all([
      service.getWeather(1, 10),
      service.getWeather(1, 10),
    ]);

    expect(first).toMatchObject({
      freshness: 'stale',
      current: { temperatureC: 5 },
    });
    expect(second).toMatchObject({
      freshness: 'stale',
      current: { temperatureC: 5 },
    });
    expect(provider.fetchForecast).toHaveBeenCalledTimes(1);
    expect(prisma.weatherV2Cache.upsert).not.toHaveBeenCalled();

    resolveForecast(payload(9));
    for (let index = 0; index < 6; index++) await Promise.resolve();
    expect(prisma.weatherV2Cache.upsert).toHaveBeenCalledTimes(1);
  });
});
