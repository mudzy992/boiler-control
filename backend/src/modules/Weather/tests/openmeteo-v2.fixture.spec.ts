import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { OpenMeteoV2Provider } from '../openmeteo-v2.provider';
import type {
  ConfirmedWeatherLocation,
  WeatherForecastPayloadV2,
} from '../weather-v2.types';

const scenarioNames = ['spring', 'fall'] as const;
type ScenarioName = (typeof scenarioNames)[number];

interface FixtureScenario {
  timezone: string;
  currentTime: string;
  firstSunrise: string;
  firstSunset: string;
}

interface FixtureModule {
  buildFixture: (name: ScenarioName) => Buffer;
  fixturePath: (name: ScenarioName) => string;
  SCENARIOS: Record<ScenarioName, FixtureScenario>;
}

const repoRoot = path.resolve(__dirname, '../../../../..');
const loadFixture = createRequire(__filename);
const { buildFixture, fixturePath, SCENARIOS } = loadFixture(
  path.join(repoRoot, 'scripts/audit/openmeteo_combined_fixture.cjs'),
) as FixtureModule;

const expectedSha256: Record<ScenarioName, string> = {
  spring: '5ebc1684964dd1a7819ba1e82c45bc74314eeffcdc45dc56a0738e28846aba7f',
  fall: '3aac17fdf4d78bb372c196be7e83d9ff3544239e637bd08e608015fe6445ada2',
};

function makeProvider() {
  const adapter = {
    executeWithCircuitBreaker: jest
      .fn()
      .mockImplementation((request: () => unknown) => request()),
  };
  return Reflect.construct(OpenMeteoV2Provider, [
    adapter,
  ]) as OpenMeteoV2Provider;
}

function locationFor(name: ScenarioName): ConfirmedWeatherLocation {
  const scenario = SCENARIOS[name];
  return {
    provider: 'open-meteo',
    providerId: 'synthetic-fixture',
    label: 'Synthetic DST fixture',
    name: 'Synthetic DST fixture',
    admin1: null,
    country: null,
    countryCode: null,
    latitude: 40.7128,
    longitude: -74.006,
    timezone: scenario.timezone,
    confirmedAt: '2026-01-01T00:00:00.000Z',
  };
}

function localHourAndZone(iso: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  }).formatToParts(new Date(iso));
  return {
    hour: parts.find((part) => part.type === 'hour')?.value,
    zone: parts.find((part) => part.type === 'timeZoneName')?.value,
  };
}

async function replay(name: ScenarioName) {
  const bytes = readFileSync(fixturePath(name));
  const fetchMock = jest
    .spyOn(global, 'fetch')
    .mockImplementation(() =>
      Promise.resolve(new Response(new Uint8Array(bytes), { status: 200 })),
    );
  const provider = makeProvider();
  const result = await provider.fetchForecast(locationFor(name));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  return result;
}

function expectCombinedMapping(
  result: WeatherForecastPayloadV2,
  name: ScenarioName,
) {
  const scenario = SCENARIOS[name];
  expect(result.observedAt).toBe(scenario.currentTime);
  expect(result.current).toEqual({
    temperatureC: 0,
    apparentTemperatureC: -1,
    humidityPercent: 50,
    windKph: 0,
    gustKph: null,
    windDirectionDegrees: 180,
    pressureHpa: 1013,
    cloudPercent: 0,
    conditionCode: 0,
    conditionKey: 'clear',
    conditionI18nKey: 'weather.condition.clear',
    isDay: false,
  });
  expect(result.hourly).toHaveLength(72);
  expect(result.daily).toHaveLength(7);
  expect(result.hourly[0]).toMatchObject({
    temperatureC: 0,
    apparentTemperatureC: -2,
    humidityPercent: 50,
    precipitationProbabilityPercent: 0,
    precipitationMm: 0,
    windKph: 0,
    gustKph: null,
    windDirectionDegrees: 180,
    conditionCode: 2,
    conditionKey: 'partly_cloudy',
    isDay: false,
  });
  expect(result.daily[0]).toEqual({
    date: scenario.currentTime.slice(0, 10),
    temperatureMaxC: 10,
    temperatureMinC: 0,
    precipitationMm: 0,
    precipitationProbabilityPercent: 20,
    sunrise: scenario.firstSunrise,
    sunset: scenario.firstSunset,
    uvIndex: 0,
    conditionCode: 999,
    conditionKey: 'unknown',
    conditionI18nKey: 'weather.condition.unknown',
  });
  // INT64_MAX is the schema's missing-event sentinel, not a valid epoch.
  expect(result.daily[1].sunrise).toBeNull();
  expect(result.daily[1].sunset).toBe(
    new Date(Date.parse(scenario.firstSunset) + 86400_000).toISOString(),
  );
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('OpenMeteoV2Provider generated FlatBuffers fixtures', () => {
  it.each(scenarioNames)(
    '%s fixture is deterministic and byte-identical',
    (name) => {
      const bytes = readFileSync(fixturePath(name));
      expect(bytes.equals(buildFixture(name))).toBe(true);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(
        expectedSha256[name],
      );
    },
  );

  it('rejects an upstream HTTP error instead of reporting missing forecast blocks', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ reason: 'synthetic v2 outage' }), {
        status: 503,
      }),
    );
    const provider = makeProvider();

    await expect(provider.fetchForecast(locationFor('spring'))).rejects.toThrow(
      'Open-Meteo HTTP 503: synthetic v2 outage',
    );
  });

  it('decodes current+hourly+daily through the real SDK and skips the spring DST hour', async () => {
    const result = await replay('spring');
    expectCombinedMapping(result, 'spring');
    expect(result.hourly.slice(0, 3).map((hour) => hour.at)).toEqual([
      '2026-03-08T06:00:00.000Z',
      '2026-03-08T07:00:00.000Z',
      '2026-03-08T08:00:00.000Z',
    ]);
    expect(localHourAndZone(result.hourly[0].at)).toEqual({
      hour: '01',
      zone: 'EST',
    });
    expect(localHourAndZone(result.hourly[1].at)).toEqual({
      hour: '03',
      zone: 'EDT',
    });
    expect(localHourAndZone(result.hourly[2].at)).toEqual({
      hour: '04',
      zone: 'EDT',
    });
  });

  it('decodes current+hourly+daily through the real SDK and preserves both fall DST 01:00 hours', async () => {
    const result = await replay('fall');
    expectCombinedMapping(result, 'fall');
    expect(result.hourly.slice(0, 3).map((hour) => hour.at)).toEqual([
      '2026-11-01T05:00:00.000Z',
      '2026-11-01T06:00:00.000Z',
      '2026-11-01T07:00:00.000Z',
    ]);
    expect(localHourAndZone(result.hourly[0].at)).toEqual({
      hour: '01',
      zone: 'EDT',
    });
    expect(localHourAndZone(result.hourly[1].at)).toEqual({
      hour: '01',
      zone: 'EST',
    });
    expect(localHourAndZone(result.hourly[2].at)).toEqual({
      hour: '02',
      zone: 'EST',
    });
  });
});
