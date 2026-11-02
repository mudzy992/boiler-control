import type { WeatherV2Response } from './weather-v2.types';

export interface DailyWeatherInput {
  tempMin: number;
  tempMax: number;
}

function localDateKey(now: Date, timeZone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    let year = '';
    let month = '';
    let day = '';
    for (const part of parts) {
      if (part.type === 'year') year = part.value;
      else if (part.type === 'month') month = part.value;
      else if (part.type === 'day') day = part.value;
    }
    return year && month && day ? `${year}-${month}-${day}` : null;
  } catch {
    return null;
  }
}

export function dailyWeatherInputFromV2(
  response: WeatherV2Response | null,
  now: Date,
): DailyWeatherInput | null {
  if (!response || response.status !== 'ok') return null;
  const date = localDateKey(now, response.location.timezone);
  const daily = response.daily.find((candidate) => candidate.date === date);
  if (
    !daily ||
    typeof daily.temperatureMinC !== 'number' ||
    !Number.isFinite(daily.temperatureMinC) ||
    typeof daily.temperatureMaxC !== 'number' ||
    !Number.isFinite(daily.temperatureMaxC)
  ) {
    return null;
  }
  return {
    tempMin: daily.temperatureMinC,
    tempMax: daily.temperatureMaxC,
  };
}
