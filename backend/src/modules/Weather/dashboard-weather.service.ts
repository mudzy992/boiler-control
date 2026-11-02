import { Injectable } from '@nestjs/common';
import { weatherDayFromV2 } from './daily-weather-input';
import { getWeatherV2Config } from './weather-v2.config';
import { WeatherV2Service } from './weather-v2.service';
import type { WeatherV2Response } from './weather-v2.types';

export interface DashboardWeatherData {
  temp: number | null;
  feelsLike: number | null;
  condition: string | null;
  humidity: number | null;
  windSpeed: number | null;
  pressure: number | null;
  uvIndex: number | null;
  sunrise: string | null;
  sunset: string | null;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function conditionOrNull(value: unknown): string | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? `WMO_${value}`
    : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function dashboardWeatherFromV2(
  response: WeatherV2Response | null,
  now: Date,
): DashboardWeatherData | null {
  if (!response || response.status !== 'ok' || response.currentHidden) {
    return null;
  }
  const current = response.current;
  const daily = weatherDayFromV2(response, now);
  const temperature = finiteOrNull(current?.temperatureC);
  if (!current || !daily || temperature === null) return null;

  return {
    temp: temperature,
    feelsLike: finiteOrNull(current.apparentTemperatureC),
    condition: conditionOrNull(current.conditionCode),
    humidity: finiteOrNull(current.humidityPercent),
    windSpeed: finiteOrNull(current.windKph),
    pressure: finiteOrNull(current.pressureHpa),
    uvIndex: finiteOrNull(daily.uvIndex),
    sunrise: stringOrNull(daily.sunrise),
    sunset: stringOrNull(daily.sunset),
  };
}

@Injectable()
export class DashboardWeatherService {
  constructor(private readonly weatherV2: WeatherV2Service) {}

  /** Read-only v2 view; null preserves the existing Dashboard fallback. */
  async getV2DashboardWeather(
    userId: number,
    homeProfileId: number,
  ): Promise<DashboardWeatherData | null> {
    const config = getWeatherV2Config();
    if (!config.dashboardEnabled || !config.locationEnabled) return null;

    const response = await this.weatherV2.getCachedWeather(
      userId,
      homeProfileId,
    );
    return dashboardWeatherFromV2(response, new Date());
  }
}
