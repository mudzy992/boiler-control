import { Injectable } from '@nestjs/common';
import { getWeatherV2Config } from './weather-v2.config';
import { WeatherV2Service } from './weather-v2.service';
import type { WeatherV2Response } from './weather-v2.types';

export function currentTemperatureFromV2(
  response: WeatherV2Response | null,
): number | null {
  if (!response || response.status !== 'ok' || response.currentHidden) {
    return null;
  }
  const temperature = response.current?.temperatureC;
  return typeof temperature === 'number' && Number.isFinite(temperature)
    ? temperature
    : null;
}

@Injectable()
export class PollingWeatherService {
  constructor(private readonly weatherV2: WeatherV2Service) {}

  /** Read-only current temperature; null preserves the Poll legacy fallback. */
  async getV2CurrentTemperature(
    userId: number,
    homeProfileId: number,
  ): Promise<number | null> {
    const config = getWeatherV2Config();
    if (!config.pollEnabled || !config.locationEnabled) return null;

    const response = await this.weatherV2.getCachedWeather(
      userId,
      homeProfileId,
    );
    return currentTemperatureFromV2(response);
  }
}
