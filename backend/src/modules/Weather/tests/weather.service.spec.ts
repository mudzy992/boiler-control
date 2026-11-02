jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));

import { Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import path from 'node:path';
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
