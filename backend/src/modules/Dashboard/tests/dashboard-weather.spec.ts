jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../Boiler/boiler.service', () => ({
  BoilerService: class BoilerService {},
}));
jest.mock('../../Weather/weather.service', () => ({
  WeatherService: class WeatherService {},
}));

import { DashboardService } from '../dashboard.service';

const otherCityWeather = {
  city: 'Mostar',
  temperature: 14,
  feelslike: 13,
  condition_text: 'WMO_1',
  humidity: 50,
  wind_kph: 8,
  pressure_mb: 1005,
  uv_index: 2,
  sunrise: '2026-11-02T06:00:00.000Z',
  sunset: '2026-11-02T16:00:00.000Z',
};

function makeService(rows: Array<typeof otherCityWeather>) {
  const weatherCache = {
    findFirst: jest.fn((args: any) => {
      const city = args?.where?.city;
      return Promise.resolve(
        city
          ? (rows.find((row) => row.city === city) ?? null)
          : (rows[0] ?? null),
      );
    }),
  };
  const weatherService = {
    getTodayWeather: jest.fn().mockRejectedValue(new Error('synthetic outage')),
  };
  const service = new DashboardService(
    { weatherCache } as any,
    {} as any,
    weatherService as any,
    {} as any,
  );
  return { service, weatherCache };
}

describe('DashboardService weather cache location', () => {
  it('does not fall back to a different city when Visoko refresh fails', async () => {
    const { service, weatherCache } = makeService([otherCityWeather]);

    await expect(service['getLatestWeather']()).resolves.toBeNull();
    expect(weatherCache.findFirst).toHaveBeenCalledWith({
      where: { city: 'Visoko' },
      orderBy: { fetchedAt: 'desc' },
    });
  });

  it('keeps the matching-city cache fallback', async () => {
    const visokoWeather = { ...otherCityWeather, city: 'Visoko' };
    const { service } = makeService([otherCityWeather, visokoWeather]);

    await expect(service['getLatestWeather']()).resolves.toMatchObject({
      temp: 14,
      condition: 'WMO_1',
    });
  });
});
