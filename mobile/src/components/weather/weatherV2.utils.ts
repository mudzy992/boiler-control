export type WeatherIconName =
  | 'sunny'
  | 'partly-sunny'
  | 'cloud'
  | 'rainy'
  | 'snow'
  | 'thunderstorm';

const CONDITION_ICONS: Record<string, WeatherIconName> = {
  clear: 'sunny',
  mainly_clear: 'partly-sunny',
  partly_cloudy: 'partly-sunny',
  overcast: 'cloud',
  fog: 'cloud',
  depositing_rime_fog: 'cloud',
  light_drizzle: 'rainy',
  moderate_drizzle: 'rainy',
  dense_drizzle: 'rainy',
  light_freezing_drizzle: 'rainy',
  dense_freezing_drizzle: 'rainy',
  slight_rain: 'rainy',
  moderate_rain: 'rainy',
  heavy_rain: 'rainy',
  light_freezing_rain: 'rainy',
  heavy_freezing_rain: 'rainy',
  slight_snow: 'snow',
  moderate_snow: 'snow',
  heavy_snow: 'snow',
  snow_grains: 'snow',
  slight_rain_showers: 'rainy',
  moderate_rain_showers: 'rainy',
  violent_rain_showers: 'rainy',
  slight_snow_showers: 'snow',
  heavy_snow_showers: 'snow',
  thunderstorm: 'thunderstorm',
  thunderstorm_slight_hail: 'thunderstorm',
  thunderstorm_heavy_hail: 'thunderstorm',
  unknown: 'cloud',
};

export function weatherConditionIcon(conditionKey: string): WeatherIconName {
  return CONDITION_ICONS[conditionKey] ?? CONDITION_ICONS.unknown;
}

export function formatNullableNumber(value: number | null | undefined, fractionDigits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toFixed(fractionDigits);
}

function validDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatWeatherDateTime(value: string, locale: string, timeZone: string): string {
  const date = validDate(value);
  if (!date) return value;
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
      timeZoneName: 'short',
    }).format(date);
  } catch {
    return date.toLocaleString(locale);
  }
}

export function formatWeatherHour(value: string, locale: string, timeZone: string): string {
  const date = validDate(value);
  if (!date) return value;
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    }).format(date);
  } catch {
    return date.toLocaleString(locale);
  }
}

export function formatWeatherDay(value: string | null, locale: string): string {
  if (!value) return '—';
  const date = validDate(`${value}T12:00:00.000Z`);
  if (!date) return value;
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}
