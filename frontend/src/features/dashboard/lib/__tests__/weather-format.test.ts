import { describe, expect, it } from 'vitest';
import { buildWeatherDisplay } from '../schedule-helpers';
import {
  formatOneDecimal,
  resolveWeatherConditionKey,
  roundOneDecimal,
} from '../weather-format';

describe('weather-format', () => {
  it('rounds to one decimal', () => {
    expect(roundOneDecimal(5.991593837738037)).toBe(6);
    expect(formatOneDecimal(5.991593837738037)).toBe('6.0');
    expect(formatOneDecimal(1.9495668411254883)).toBe('1.9');
  });

  it('maps WMO codes to condition keys', () => {
    expect(resolveWeatherConditionKey('WMO_1')).toBe('mainly_clear');
    expect(resolveWeatherConditionKey('WMO_0')).toBe('clear');
    expect(resolveWeatherConditionKey('Partly Cloudy')).toBe('partly_cloudy');
  });

  it('buildWeatherDisplay rounds and resolves condition', () => {
    const actual = buildWeatherDisplay({
      temperature: 2.345,
      wind_kph: 5.991593837738037,
      temp_min: 1.9495668411254883,
      temp_max: 8.863622665405273,
      condition_text: 'WMO_1',
      humidity: 77,
    });
    expect(actual).toMatchObject({
      outsideTemp: 2.3,
      windSpeed: 6,
      tempMin: 1.9,
      tempMax: 8.9,
      condition: 'mainly_clear',
      humidity: 77,
    });
  });
});
