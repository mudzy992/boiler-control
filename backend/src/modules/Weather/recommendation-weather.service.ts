import { Injectable } from '@nestjs/common';
import {
  dailyWeatherInputFromV2,
  type DailyWeatherInput,
} from './daily-weather-input';
import { getWeatherV2Config } from './weather-v2.config';
import { WeatherV2Service } from './weather-v2.service';

export type RecommendationWeatherInput = DailyWeatherInput;
export { dailyWeatherInputFromV2 as recommendationWeatherFromV2 };

@Injectable()
export class RecommendationWeatherService {
  constructor(private readonly weatherV2: WeatherV2Service) {}

  /** Returns null so each consumer can retain its existing legacy fallback. */
  async getV2WeatherInput(
    userId: number,
    homeProfileId: number,
  ): Promise<RecommendationWeatherInput | null> {
    const config = getWeatherV2Config();
    if (!config.recommendationEnabled || !config.locationEnabled) return null;

    const response = await this.weatherV2.getCachedWeather(
      userId,
      homeProfileId,
    );
    return dailyWeatherInputFromV2(response, new Date());
  }
}
