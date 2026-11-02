import { PollingWeatherService } from '../polling-weather.service';

const ENV_KEYS = [
  'WEATHER_LOCATION_V2',
  'WEATHER_RECOMMENDATION_V2',
  'WEATHER_BOILER_V2',
  'WEATHER_POLL_V2',
] as const;
const savedEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

function makeService(response: unknown) {
  const weatherV2 = {
    getCachedWeather: jest.fn().mockResolvedValue(response),
    getWeather: jest.fn(),
  };
  const service = Reflect.construct(PollingWeatherService, [
    weatherV2,
  ]) as PollingWeatherService;
  return { service, weatherV2 };
}

describe('PollingWeatherService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = savedEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it.each([
    ['both flags are off', {}],
    ['only poll is on', { WEATHER_POLL_V2: 'on' }],
    ['only location is on', { WEATHER_LOCATION_V2: 'on' }],
    [
      'location and recommendation are on without poll',
      { WEATHER_LOCATION_V2: 'on', WEATHER_RECOMMENDATION_V2: 'on' },
    ],
    [
      'location and boiler are on without poll',
      { WEATHER_LOCATION_V2: 'on', WEATHER_BOILER_V2: 'on' },
    ],
  ])('returns null without a v2 read when %s', async (_label, flags) => {
    Object.assign(process.env, flags);
    const { service, weatherV2 } = makeService(null);

    await expect(service.getV2CurrentTemperature(7, 10)).resolves.toBeNull();
    expect(weatherV2.getCachedWeather).not.toHaveBeenCalled();
  });

  it('reads only the cache and preserves real zero', async () => {
    process.env.WEATHER_LOCATION_V2 = 'on';
    process.env.WEATHER_POLL_V2 = 'on';
    const { service, weatherV2 } = makeService({
      version: 2,
      status: 'ok',
      currentHidden: false,
      current: { temperatureC: 0 },
    });

    await expect(service.getV2CurrentTemperature(7, 10)).resolves.toBe(0);
    expect(weatherV2.getCachedWeather).toHaveBeenCalledWith(7, 10);
    expect(weatherV2.getWeather).not.toHaveBeenCalled();
  });

  it('returns null for a cold cache instead of refreshing weather', async () => {
    process.env.WEATHER_LOCATION_V2 = 'on';
    process.env.WEATHER_POLL_V2 = 'on';
    const { service, weatherV2 } = makeService(null);

    await expect(service.getV2CurrentTemperature(7, 10)).resolves.toBeNull();
    expect(weatherV2.getWeather).not.toHaveBeenCalled();
  });

  it('returns null when location confirmation is still required', async () => {
    process.env.WEATHER_LOCATION_V2 = 'on';
    process.env.WEATHER_POLL_V2 = 'on';
    const { service } = makeService({
      version: 2,
      status: 'location_confirmation_required',
    });

    await expect(service.getV2CurrentTemperature(7, 10)).resolves.toBeNull();
  });

  it.each([
    [
      'current is hidden',
      { currentHidden: true, current: { temperatureC: 4 } },
    ],
    ['current is missing', { currentHidden: false, current: null }],
  ])('returns null when %s', async (_label, response) => {
    process.env.WEATHER_LOCATION_V2 = 'on';
    process.env.WEATHER_POLL_V2 = 'on';
    const { service } = makeService({
      version: 2,
      status: 'ok',
      ...response,
    });

    await expect(service.getV2CurrentTemperature(7, 10)).resolves.toBeNull();
  });

  it.each([null, undefined, Number.NaN, Infinity, -Infinity, '4'])(
    'returns null for non-finite current temperature %s',
    async (temperatureC) => {
      process.env.WEATHER_LOCATION_V2 = 'on';
      process.env.WEATHER_POLL_V2 = 'on';
      const { service } = makeService({
        version: 2,
        status: 'ok',
        currentHidden: false,
        current: { temperatureC },
      });

      await expect(service.getV2CurrentTemperature(7, 10)).resolves.toBeNull();
    },
  );
});
