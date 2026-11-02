const TRUE_VALUES = new Set(['1', 'true', 'on']);

export interface WeatherV2Config {
  locationEnabled: boolean;
  swrEnabled: boolean;
  recommendationEnabled: boolean;
  boilerEnabled: boolean;
  pollEnabled: boolean;
  dashboardEnabled: boolean;
  staleAfterMs: number;
  hideCurrentAfterMs: number;
}

function enabled(value: string | undefined): boolean {
  return TRUE_VALUES.has(value?.trim().toLowerCase() ?? '');
}

function minutes(
  value: string | undefined,
  fallback: number,
  maximum = 24 * 60,
): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > maximum) {
    return fallback;
  }
  return parsed;
}

/** Values are read per call so tests and controlled rollouts do not need a reload. */
export function getWeatherV2Config(
  env: NodeJS.ProcessEnv = process.env,
): WeatherV2Config {
  const staleAfterMinutes = minutes(env.WEATHER_STALE_AFTER_MINUTES, 15);
  const hideCurrentAfterMinutes = minutes(
    env.WEATHER_CURRENT_HIDDEN_AFTER_MINUTES,
    60,
  );

  return {
    locationEnabled: enabled(env.WEATHER_LOCATION_V2),
    swrEnabled: enabled(env.WEATHER_SWR_ENABLED),
    recommendationEnabled: enabled(env.WEATHER_RECOMMENDATION_V2),
    boilerEnabled: enabled(env.WEATHER_BOILER_V2),
    pollEnabled: enabled(env.WEATHER_POLL_V2),
    dashboardEnabled: enabled(env.WEATHER_DASHBOARD_V2),
    staleAfterMs: staleAfterMinutes * 60 * 1000,
    hideCurrentAfterMs:
      Math.max(staleAfterMinutes, hideCurrentAfterMinutes) * 60 * 1000,
  };
}
