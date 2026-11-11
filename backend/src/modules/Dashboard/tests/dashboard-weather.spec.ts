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

function makeService(
  rows: Array<typeof otherCityWeather>,
  v2Weather: object | null = null,
) {
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
  const boilerService = {
    calculateFlowTemp: jest.fn().mockResolvedValue({ flowTemp: 45 }),
  };
  const dashboardWeather = {
    getV2DashboardWeather: jest.fn().mockResolvedValue(v2Weather),
  };
  /*
   * `F14` (jedna polazna za cijeli dan) je uveo `homeDailyFlow`, a time i dva
   * nova čitanja: zonu korisnika i današnji `DailyRecord`. Stub je ostao samo
   * na `weatherCache`, pa je `getDashboard` padao na `this.prisma.user` —
   * klasa greške „servis čita više nego što stub daje" (isti uzrok kao
   * `DailyHistoryService`, run 42920655959). CI je to pokazao na run-u
   * 42981488213.
   */
  const prisma = {
    weatherCache,
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ timezone: 'Europe/Sarajevo' }),
    },
    dailyRecord: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const service = Reflect.construct(DashboardService, [
    prisma,
    boilerService,
    weatherService,
    {},
    dashboardWeather,
  ]) as DashboardService;
  return {
    service,
    prisma,
    weatherCache,
    weatherService,
    boilerService,
    dashboardWeather,
  };
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

  it('uses confirmed-profile v2 weather and skips both legacy reads', async () => {
    const v2Weather = { temp: 0, condition: 'WMO_0' };
    const { service, weatherCache, weatherService, dashboardWeather } =
      makeService([otherCityWeather], v2Weather);

    await expect((service as any).getLatestWeather(7, 10)).resolves.toEqual(
      v2Weather,
    );
    expect(dashboardWeather.getV2DashboardWeather).toHaveBeenCalledWith(7, 10);
    expect(weatherService.getTodayWeather).not.toHaveBeenCalled();
    expect(weatherCache.findFirst).not.toHaveBeenCalled();
  });

  it('keeps the legacy fallback when the v2 resolver returns null', async () => {
    const visokoWeather = { ...otherCityWeather, city: 'Visoko' };
    const { service, dashboardWeather } = makeService([visokoWeather]);

    await expect(
      (service as any).getLatestWeather(7, 10),
    ).resolves.toMatchObject({ temp: 14, condition: 'WMO_1' });
    expect(dashboardWeather.getV2DashboardWeather).toHaveBeenCalledWith(7, 10);
  });

  it('does not call the v2 resolver without a home profile', async () => {
    const visokoWeather = { ...otherCityWeather, city: 'Visoko' };
    const { service, dashboardWeather } = makeService([visokoWeather]);

    await expect(
      (service as any).getLatestWeather(7, undefined),
    ).resolves.toMatchObject({ temp: 14, condition: 'WMO_1' });
    expect(dashboardWeather.getV2DashboardWeather).not.toHaveBeenCalled();
  });

  it('uses the first already loaded profile for authenticated dashboard weather', async () => {
    const { service } = makeService([]);
    const getLatestWeather = jest
      .spyOn(service as any, 'getLatestWeather')
      .mockResolvedValue(null);
    jest.spyOn(service as any, 'getHomeProfiles').mockResolvedValue([
      {
        id: 10,
        thermostatDevices: [],
        intervalLearnings: [],
      },
    ]);
    jest
      .spyOn(service as any, 'getRecentRecommendations')
      .mockResolvedValue([]);

    await service.getDashboard(7);

    expect(getLatestWeather).toHaveBeenCalledTimes(1);
    expect(getLatestWeather).toHaveBeenCalledWith(7, 10);
  });

  it('keeps anonymous dashboard weather on the legacy path', async () => {
    const { service, dashboardWeather } = makeService([]);
    const getLatestWeather = jest
      .spyOn(service as any, 'getLatestWeather')
      .mockResolvedValue({ temp: 9 });

    const result = await service.getDashboard();

    expect(getLatestWeather).toHaveBeenCalledTimes(1);
    expect(getLatestWeather).toHaveBeenCalledWith();
    expect(result.system.weather).toEqual({ temp: 9 });
    expect(dashboardWeather.getV2DashboardWeather).not.toHaveBeenCalled();
  });
});
