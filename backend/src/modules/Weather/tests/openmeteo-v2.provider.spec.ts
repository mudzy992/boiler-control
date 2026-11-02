jest.mock('openmeteo', () => ({ fetchWeatherApi: jest.fn() }));

import { fetchWeatherApi } from 'openmeteo';
import { OpenMeteoV2Provider } from '../openmeteo-v2.provider';
import type { ConfirmedWeatherLocation } from '../weather-v2.types';

const location: ConfirmedWeatherLocation = {
  provider: 'open-meteo',
  providerId: '42',
  label: 'Testville, Test Region, Testland',
  name: 'Testville',
  admin1: 'Test Region',
  country: 'Testland',
  countryCode: 'TT',
  latitude: 40.7128,
  longitude: -74.006,
  timezone: 'America/New_York',
  confirmedAt: '2026-01-01T00:00:00.000Z',
};

function makeProvider(execute?: jest.Mock) {
  const adapter = {
    executeWithCircuitBreaker:
      execute ??
      jest.fn().mockImplementation((request: () => unknown) => request()),
  };
  return {
    provider: Reflect.construct(OpenMeteoV2Provider, [
      adapter,
    ]) as OpenMeteoV2Provider,
    adapter,
  };
}

function block(
  start: number,
  interval: number,
  count: number,
  currentValues: number[],
  arrays: number[][],
  int64: bigint[][] = [],
) {
  return {
    time: () => BigInt(start),
    timeEnd: () => BigInt(start + count * interval),
    interval: () => interval,
    variables: (index: number) => ({
      value: () => currentValues[index],
      valuesArray: () => arrays[index],
      valuesInt64: (position: number) => int64[index]?.[position] ?? null,
    }),
  };
}

function forecastResponse() {
  const currentTime = Date.parse('2026-03-08T07:30:00.000Z') / 1000;
  const hourlyStart = Date.parse('2026-03-08T05:00:00.000Z') / 1000;
  const dailyStart = Date.parse('2026-03-08T05:00:00.000Z') / 1000;
  const hourlyCount = 200;
  const dailyCount = 10;
  const hourlyArrays = Array.from({ length: 10 }, (_, index) =>
    Array.from({ length: hourlyCount }, () => {
      if (index === 0) return 0;
      if (index === 1) return -2;
      if (index === 2) return 50;
      if (index === 3 || index === 4) return 0;
      if (index === 5) return 2;
      if (index === 6) return 0;
      if (index === 7) return Number.NaN;
      if (index === 8) return 180;
      return 1;
    }),
  );
  const dailyArrays = Array.from({ length: 8 }, (_, index) =>
    Array.from({ length: dailyCount }, () => {
      if (index === 0) return 10;
      if (index === 1) return 0;
      if (index === 2) return 0;
      if (index === 3) return 20;
      if (index === 4) return 999;
      return 0;
    }),
  );
  const sunrise = BigInt(Date.parse('2026-03-08T10:00:00.000Z') / 1000);
  const sunset = BigInt(Date.parse('2026-03-08T22:00:00.000Z') / 1000);
  const int64 = Array.from({ length: 8 }, (_, index) =>
    index === 5
      ? Array.from({ length: dailyCount }, () => sunrise)
      : index === 6
        ? Array.from({ length: dailyCount }, () => sunset)
        : [],
  );

  return {
    utcOffsetSeconds: () => -4 * 3600,
    current: () =>
      block(
        currentTime,
        900,
        1,
        [0, 50, -1, 0, 1, 0, Number.NaN, 180, 1013, 0],
        [],
      ),
    hourly: () => block(hourlyStart, 3600, hourlyCount, [], hourlyArrays),
    daily: () => block(dailyStart, 86400, dailyCount, [], dailyArrays, int64),
  };
}

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('OpenMeteoV2Provider forecast mapping', () => {
  it('maps UTC instants, true zeroes and exactly 72 hours/7 days', async () => {
    jest.mocked(fetchWeatherApi).mockResolvedValue([forecastResponse()] as any);
    const { provider, adapter } = makeProvider();

    const result = await provider.fetchForecast(location);

    expect(result.observedAt).toBe('2026-03-08T07:30:00.000Z');
    expect(result.current).toMatchObject({
      temperatureC: 0,
      apparentTemperatureC: -1,
      windKph: 0,
      gustKph: null,
      cloudPercent: 0,
      conditionKey: 'clear',
      isDay: true,
    });
    expect(result.hourly).toHaveLength(72);
    expect(result.hourly[0]).toMatchObject({
      at: '2026-03-08T08:00:00.000Z',
      temperatureC: 0,
      precipitationProbabilityPercent: 0,
      gustKph: null,
      conditionKey: 'partly_cloudy',
    });
    expect(result.daily).toHaveLength(7);
    expect(result.daily[0]).toMatchObject({
      date: '2026-03-08',
      temperatureMinC: 0,
      precipitationMm: 0,
      uvIndex: 0,
      sunrise: '2026-03-08T10:00:00.000Z',
      sunset: '2026-03-08T22:00:00.000Z',
      conditionCode: 999,
      conditionKey: 'unknown',
    });

    const [url, params, retries, , , options] =
      jest.mocked(fetchWeatherApi).mock.calls[0];
    expect(url).toContain('open-meteo.com');
    expect(params).toMatchObject({
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: 'America/New_York',
      forecast_days: 7,
    });
    expect(retries).toBe(0);
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(adapter.executeWithCircuitBreaker).toHaveBeenCalledTimes(1);
  });

  it('does not wrap to the first hour when current time is beyond the forecast', async () => {
    const response = forecastResponse();
    response.current = () =>
      block(
        Date.parse('2027-01-01T00:00:00.000Z') / 1000,
        900,
        1,
        [0, 50, -1, 0, 1, 0, 0, 180, 1013, 0],
        [],
      );
    jest.mocked(fetchWeatherApi).mockResolvedValue([response] as any);
    const { provider } = makeProvider();

    const result = await provider.fetchForecast(location);

    expect(result.hourly).toEqual([]);
    expect(result.daily).toHaveLength(7);
  });
});

describe('OpenMeteoV2Provider geocoding and timeout', () => {
  it('returns candidates without auto-selecting and skips invalid coordinates/timezones', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              id: 101,
              name: 'Springfield',
              admin1: 'Illinois',
              country: 'United States',
              country_code: 'US',
              latitude: 39.78,
              longitude: -89.65,
              timezone: 'America/Chicago',
            },
            {
              id: 102,
              name: 'Springfield',
              latitude: 39.78,
              longitude: -89.65,
              timezone: 'Not/AZone',
            },
            {
              id: 103,
              name: 'Springfield',
              admin1: 'Massachusetts',
              country: 'United States',
              latitude: 42.1,
              longitude: -72.59,
              timezone: 'America/New_York',
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const { provider } = makeProvider();

    const result = await provider.geocode('  Springfield  ');

    expect(result.map((candidate) => candidate.providerId)).toEqual([
      '101',
      '103',
    ]);
    expect(result[0].label).toBe('Springfield, Illinois, United States');
    expect(fetchMock.mock.calls[0][0]).toContain('name=Springfield');
    expect(fetchMock.mock.calls[0][0]).toContain('count=5');
  });

  it('bounds candidates even if the upstream returns more than requested', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          results: Array.from({ length: 7 }, (_, index) => ({
            id: index + 1,
            name: `Place ${index + 1}`,
            latitude: 40 + index,
            longitude: -70,
            timezone: 'America/New_York',
          })),
        }),
        { status: 200 },
      ),
    );
    const { provider } = makeProvider();

    const result = await provider.geocode('Place');

    expect(result).toHaveLength(5);
    expect(result.map((candidate) => candidate.providerId)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
    ]);
  });

  it('aborts the underlying request at the provider timeout', async () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          );
        }),
    );
    const { provider } = makeProvider();

    const pending = provider.geocode('Springfield');
    const rejection = expect(pending).rejects.toThrow(
      'weather provider timeout',
    );
    await jest.advanceTimersByTimeAsync(9000);
    await rejection;
  });
});
