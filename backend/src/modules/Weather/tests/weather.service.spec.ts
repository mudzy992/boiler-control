jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));

import { Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as openMeteoTransport from '../openmeteo-flatbuffers';
import { WeatherService } from '../weather.service';

const repoRoot = path.resolve(__dirname, '../../../../..');
const fixtureBytes = readFileSync(
  path.join(
    repoRoot,
    'scripts/audit/fixtures/openmeteo-generated-dst-spring.flatbuffers',
  ),
);

function cachedWeather(ageMinutes: number) {
  return {
    id: 7,
    city: 'Visoko',
    fetchedAt: new Date(Date.now() - ageMinutes * 60_000),
    temperature: 4,
  };
}

function makeService(cached: ReturnType<typeof cachedWeather> | null) {
  const prisma = {
    weatherCache: {
      findFirst: jest.fn().mockResolvedValue(cached),
      delete: jest.fn().mockResolvedValue(cached),
      create: jest
        .fn()
        .mockImplementation(({ data }) => Promise.resolve({ id: 8, ...data })),
      update: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: cached?.id ?? 8, ...data }),
        ),
    },
  };
  const adapter = {
    executeWithCircuitBreaker: jest
      .fn()
      .mockImplementation((request: () => unknown) => request()),
  };
  const service = Reflect.construct(WeatherService, [
    prisma,
    adapter,
  ]) as WeatherService;
  return { service, prisma };
}

function mockGeocodeAndForecast(forecast: Response) {
  return jest
    .spyOn(global, 'fetch')
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [{ latitude: 43.99, longitude: 18.18 }],
        }),
        { status: 200 },
      ),
    )
    .mockResolvedValueOnce(forecast);
}

function validForecast() {
  return new Response(new Uint8Array(fixtureBytes), { status: 200 });
}

const frozenNow = Date.parse('2026-01-16T12:00:00.000Z');

function timelineResponse(
  sunrise = BigInt(Date.parse('2026-01-16T06:00:00.000Z') / 1000),
) {
  const start = BigInt(Date.parse('2026-01-15T23:00:00.000Z') / 1000);
  const sunset = BigInt(Date.parse('2026-01-16T15:00:00.000Z') / 1000);
  const values = (base: number) =>
    Float32Array.from({ length: 24 }, (_, index) => base + index);
  const series = [
    values(0),
    values(100),
    values(10),
    values(1000),
    values(40),
    values(200),
    values(300),
    values(20),
    values(1),
    values(0),
    values(0),
  ];
  const variable = (array: Float32Array) => ({ valuesArray: () => array });

  return {
    utcOffsetSeconds: () => 3600,
    current: () => ({
      time: () => BigInt(frozenNow / 1000),
      variables: (index: number) => ({
        value: () => [5, 60, 1, 1][index],
      }),
    }),
    hourly: () => ({
      time: () => start,
      timeEnd: () => start + 24n * 3600n,
      interval: () => 3600,
      variables: (index: number) => variable(series[index]),
    }),
    daily: () => ({
      variables: (index: number) => ({
        valuesArray: () => Float32Array.from([index === 0 ? 10 : -2]),
        valuesInt64: () => (index === 2 ? sunrise : sunset),
      }),
    }),
  };
}

function mockTimelineResponse(response: ReturnType<typeof timelineResponse>) {
  jest
    .spyOn(global, 'fetch')
    .mockResolvedValue(
      new Response(
        JSON.stringify({ results: [{ latitude: 43.99, longitude: 18.18 }] }),
        { status: 200 },
      ),
    );
  jest
    .spyOn(openMeteoTransport, 'fetchOpenMeteoFlatbuffers')
    .mockResolvedValue([response] as any);
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('WeatherService legacy Open-Meteo transport and cache', () => {
  it('keeps fresh cache without contacting the provider', async () => {
    const cached = cachedWeather(5);
    const { service, prisma } = makeService(cached);
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new Error('unexpected provider call'));

    await expect(service.getTodayWeather('Visoko')).resolves.toBe(cached);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.weatherCache.delete).not.toHaveBeenCalled();
  });

  it('decodes a valid generated FlatBuffers response through the real SDK reader', async () => {
    const { service, prisma } = makeService(null);
    const fetchMock = mockGeocodeAndForecast(validForecast());

    const result = await service.getTodayWeather('Visoko');

    expect(result).toMatchObject({
      city: 'Visoko',
      temp_min: 0,
      temp_max: 10,
    });
    expect(prisma.weatherCache.create).toHaveBeenCalledTimes(1);
    const requestUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(requestUrl.searchParams.get('format')).toBe('flatbuffers');
    expect(requestUrl.searchParams.get('timezone')).toBe('Europe/Sarajevo');
    expect(requestUrl.searchParams.get('forecast_days')).toBe('1');
  });

  it('updates a stale row only after a successful refresh', async () => {
    const { service, prisma } = makeService(cachedWeather(20));
    mockGeocodeAndForecast(validForecast());

    await expect(service.getTodayWeather('Visoko')).resolves.toMatchObject({
      id: 7,
      temp_min: 0,
      temp_max: 10,
    });
    expect(prisma.weatherCache.update).toHaveBeenCalledTimes(1);
    expect(prisma.weatherCache.delete).not.toHaveBeenCalled();
    expect(prisma.weatherCache.create).not.toHaveBeenCalled();
  });

  it('reports an upstream HTTP error instead of parsing JSON as missing blocks', async () => {
    const { service } = makeService(null);
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    mockGeocodeAndForecast(
      new Response(JSON.stringify({ reason: 'synthetic outage' }), {
        status: 503,
      }),
    );

    await expect(service.getTodayWeather('Visoko')).rejects.toThrow(
      'Failed to fetch Open-Meteo data for Visoko',
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Open-Meteo HTTP 503: synthetic outage'),
    );
    expect(errorSpy).not.toHaveBeenCalledWith(
      'Open-Meteo response missing required blocks',
    );
  });

  it('rejects a successful HTTP response with a non-FlatBuffers body', async () => {
    const { service } = makeService(null);
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    mockGeocodeAndForecast(
      new Response(JSON.stringify({ reason: 'not flatbuffers' }), {
        status: 200,
      }),
    );

    await expect(service.getTodayWeather('Visoko')).rejects.toThrow(
      'Failed to fetch Open-Meteo data for Visoko',
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('invalid FlatBuffers payload'),
    );
  });

  it.each([20, 60])(
    'uses retained cache for a transient failure at %i minutes old',
    async (ageMinutes) => {
      jest.useFakeTimers().setSystemTime(new Date('2026-11-02T12:00:00.000Z'));
      const cached = cachedWeather(ageMinutes);
      const { service, prisma } = makeService(cached);
      mockGeocodeAndForecast(
        new Response(JSON.stringify({ reason: 'synthetic outage' }), {
          status: 503,
        }),
      );

      await expect(service.getTodayWeather('Visoko')).resolves.toBe(cached);
      expect(prisma.weatherCache.delete).not.toHaveBeenCalled();
      expect(prisma.weatherCache.update).not.toHaveBeenCalled();
    },
  );

  it('does not use cache older than the stale fallback bound', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-02T12:00:00.000Z'));
    const { service, prisma } = makeService(cachedWeather(61));
    mockGeocodeAndForecast(
      new Response(JSON.stringify({ reason: 'synthetic outage' }), {
        status: 503,
      }),
    );

    await expect(service.getTodayWeather('Visoko')).rejects.toThrow(
      'Failed to fetch Open-Meteo data for Visoko',
    );
    expect(prisma.weatherCache.delete).not.toHaveBeenCalled();
  });
});

describe('WeatherService legacy timeline mapping', () => {
  it('maps current instants and the local 06-15 average', async () => {
    jest.useFakeTimers().setSystemTime(new Date(frozenNow));
    const { service } = makeService(null);
    mockTimelineResponse(timelineResponse());

    const result = await service.getTodayWeather('Visoko');

    expect(result).toMatchObject({
      feelslike: 113,
      temp_avg: 10.5,
      wind_kph: 213,
      gust_kph: 313,
      wind_dir: '33°',
      pressure_mb: 1013,
      cloud: 23,
      sunrise: '2026-01-16T06:00:00.000Z',
      sunset: '2026-01-16T15:00:00.000Z',
    });
  });

  it('uses the provider current instant instead of the server wall clock', async () => {
    jest.useFakeTimers().setSystemTime(new Date(frozenNow + 2 * 3600 * 1000));
    const { service } = makeService(null);
    mockTimelineResponse(timelineResponse());

    const result = await service.getTodayWeather('Visoko');

    expect(result).toMatchObject({
      feelslike: 113,
      wind_kph: 213,
      pressure_mb: 1013,
      cloud: 23,
    });
  });

  it('maps the missing sunrise sentinel to null without losing the rest of the forecast', async () => {
    jest.useFakeTimers().setSystemTime(new Date(frozenNow));
    const { service } = makeService(null);
    mockTimelineResponse(timelineResponse(9223372036854775807n));

    const result = await service.getTodayWeather('Visoko');

    expect(result).toMatchObject({
      feelslike: 113,
      sunrise: null,
      sunset: '2026-01-16T15:00:00.000Z',
    });
  });
});
