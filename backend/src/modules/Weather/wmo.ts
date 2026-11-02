export interface WmoCondition {
  conditionCode: number | null;
  conditionKey: string;
  conditionI18nKey: string;
}

const CONDITIONS: Readonly<Record<number, string>> = {
  0: 'clear',
  1: 'mainly_clear',
  2: 'partly_cloudy',
  3: 'overcast',
  45: 'fog',
  48: 'depositing_rime_fog',
  51: 'light_drizzle',
  53: 'moderate_drizzle',
  55: 'dense_drizzle',
  56: 'light_freezing_drizzle',
  57: 'dense_freezing_drizzle',
  61: 'slight_rain',
  63: 'moderate_rain',
  65: 'heavy_rain',
  66: 'light_freezing_rain',
  67: 'heavy_freezing_rain',
  71: 'slight_snowfall',
  73: 'moderate_snowfall',
  75: 'heavy_snowfall',
  77: 'snow_grains',
  80: 'slight_rain_showers',
  81: 'moderate_rain_showers',
  82: 'violent_rain_showers',
  85: 'slight_snow_showers',
  86: 'heavy_snow_showers',
  95: 'thunderstorm',
  96: 'thunderstorm_with_slight_hail',
  99: 'thunderstorm_with_heavy_hail',
};

export const WMO_UNKNOWN = {
  conditionCode: null,
  conditionKey: 'unknown',
  conditionI18nKey: 'weather.condition.unknown',
} as const;

export function mapWmoWeatherCode(code: number | null): WmoCondition {
  if (code === null || !Number.isInteger(code)) return { ...WMO_UNKNOWN };
  const conditionKey = CONDITIONS[code];
  if (!conditionKey) return { ...WMO_UNKNOWN, conditionCode: code };
  return {
    conditionCode: code,
    conditionKey,
    conditionI18nKey: `weather.condition.${conditionKey}`,
  };
}
