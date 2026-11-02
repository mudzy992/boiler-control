import { Injectable } from '@nestjs/common';
import {
  dailyWeatherInputFromV2,
  type DailyWeatherInput,
} from './daily-weather-input';
import { getWeatherV2Config } from './weather-v2.config';
import { WeatherV2Service } from './weather-v2.service';

@Injectable()
export class BoilerWeatherService {
  constructor(private readonly weatherV2: WeatherV2Service) {}

  /** Read-only v2 input; null preserves the existing Boiler legacy fallback. */
  async getV2WeatherInput(
    userId: number,
    homeProfileId: number,
  ): Promise<DailyWeatherInput | null> {
    const config = getWeatherV2Config();
    if (!config.boilerEnabled || !config.locationEnabled) return null;

    const response = await this.weatherV2.getCachedWeather(
      userId,
      homeProfileId,
    );
    return dailyWeatherInputFromV2(response, new Date());
  }
}
