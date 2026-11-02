import {
  formatNullableNumber,
  formatWeatherDateTime,
  formatWeatherDay,
  formatWeatherHour,
  weatherConditionIcon,
} from '../weather/weatherV2.utils';

describe('weather v2 formatting', () => {
  it('preserves numeric zero and uses an em dash for missing values', () => {
    expect(formatNullableNumber(0)).toBe('0');
    expect(formatNullableNumber(0, 1)).toBe('0.0');
    expect(formatNullableNumber(-2.4, 1)).toBe('-2.4');
    expect(formatNullableNumber(null)).toBe('—');
    expect(formatNullableNumber(undefined)).toBe('—');
    expect(formatNullableNumber(Number.NaN)).toBe('—');
  });

  it('maps stable condition keys and falls back safely', () => {
    expect(weatherConditionIcon('clear')).toBe('sunny');
    expect(weatherConditionIcon('heavy_snow')).toBe('snow');
    expect(weatherConditionIcon('thunderstorm_heavy_hail')).toBe('thunderstorm');
    expect(weatherConditionIcon('unknown')).toBe('cloud');
    expect(weatherConditionIcon('new-provider-value')).toBe('cloud');
  });

  it('formats UTC hours in the confirmed IANA zone across a DST jump', () => {
    expect(formatWeatherHour('2026-03-08T06:30:00.000Z', 'en-US', 'America/New_York')).toMatch(
      /1:30\sAM/,
    );
    expect(formatWeatherHour('2026-03-08T07:30:00.000Z', 'en-US', 'America/New_York')).toMatch(
      /3:30\sAM/,
    );
  });

  it('shows an absolute fetchedAt with timezone and a wall-date daily label', () => {
    const fetchedAt = formatWeatherDateTime(
      '2026-11-02T12:00:00.000Z',
      'en-US',
      'America/New_York',
    );
    expect(fetchedAt).toMatch(/7:00\sAM/);
    expect(fetchedAt).toContain('EST');

    const day = formatWeatherDay('2026-03-08', 'en-US');
    expect(day).toContain('Sun');
    expect(day).toContain('Mar');
    expect(day).toContain('8');
    expect(formatWeatherDay(null, 'en-US')).toBe('—');
  });
});
