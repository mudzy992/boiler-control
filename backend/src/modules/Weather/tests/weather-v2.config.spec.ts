import { getWeatherV2Config } from '../weather-v2.config';
import { mapWmoWeatherCode } from '../wmo';

describe('weather v2 configuration', () => {
  it('is off by default with 15/60 minute freshness limits', () => {
    expect(getWeatherV2Config({})).toEqual({
      locationEnabled: false,
      swrEnabled: false,
      staleAfterMs: 15 * 60 * 1000,
      hideCurrentAfterMs: 60 * 60 * 1000,
    });
  });

  it('accepts explicit on values and configurable limits', () => {
    expect(
      getWeatherV2Config({
        WEATHER_LOCATION_V2: 'on',
        WEATHER_SWR_ENABLED: 'true',
        WEATHER_STALE_AFTER_MINUTES: '5',
        WEATHER_CURRENT_HIDDEN_AFTER_MINUTES: '30',
      }),
    ).toMatchObject({
      locationEnabled: true,
      swrEnabled: true,
      staleAfterMs: 5 * 60 * 1000,
      hideCurrentAfterMs: 30 * 60 * 1000,
    });
  });

  it('uses safe defaults for invalid limits and never hides current while fresh', () => {
    const invalid = getWeatherV2Config({
      WEATHER_STALE_AFTER_MINUTES: 'nope',
      WEATHER_CURRENT_HIDDEN_AFTER_MINUTES: '-1',
    });
    expect(invalid.staleAfterMs).toBe(15 * 60 * 1000);
    expect(invalid.hideCurrentAfterMs).toBe(60 * 60 * 1000);

    const inverted = getWeatherV2Config({
      WEATHER_STALE_AFTER_MINUTES: '90',
      WEATHER_CURRENT_HIDDEN_AFTER_MINUTES: '10',
    });
    expect(inverted.hideCurrentAfterMs).toBe(inverted.staleAfterMs);
  });
});

describe('shared WMO mapping', () => {
  it('covers every documented Open-Meteo WMO code', () => {
    const documented = [
      0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75,
      77, 80, 81, 82, 85, 86, 95, 96, 99,
    ];
    expect(documented).toHaveLength(28);
    for (const code of documented) {
      const mapped = mapWmoWeatherCode(code);
      expect(mapped.conditionCode).toBe(code);
      expect(mapped.conditionKey).not.toBe('unknown');
      expect(mapped.conditionI18nKey).toBe(
        `weather.condition.${mapped.conditionKey}`,
      );
    }
    expect(mapWmoWeatherCode(0).conditionKey).toBe('clear');
  });

  it('keeps unknown and true zero values distinct', () => {
    expect(mapWmoWeatherCode(999)).toEqual({
      conditionCode: 999,
      conditionKey: 'unknown',
      conditionI18nKey: 'weather.condition.unknown',
    });
    expect(mapWmoWeatherCode(null).conditionCode).toBeNull();
    expect(mapWmoWeatherCode(1.5).conditionCode).toBeNull();
  });
});
