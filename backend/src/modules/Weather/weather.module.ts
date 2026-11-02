// src/modules/Weather/weather.module.ts
import { Module } from '@nestjs/common';
import { WeatherService } from './weather.service';
import { WeatherController } from './weather.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { WeatherHttpAdapter } from './weather-http.adapter';
import { WeatherV2Service } from './weather-v2.service';
import { OpenMeteoV2Provider } from './openmeteo-v2.provider';
import { CommonModule } from '../../common/common.module';
import { RecommendationWeatherService } from './recommendation-weather.service';
import { BoilerWeatherService } from './boiler-weather.service';
import { PollingWeatherService } from './polling-weather.service';
import { DashboardWeatherService } from './dashboard-weather.service';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [WeatherController],
  providers: [
    WeatherService,
    WeatherV2Service,
    OpenMeteoV2Provider,
    WeatherHttpAdapter,
    RecommendationWeatherService,
    BoilerWeatherService,
    PollingWeatherService,
    DashboardWeatherService,
  ],
  exports: [
    WeatherService,
    WeatherHttpAdapter,
    RecommendationWeatherService,
    BoilerWeatherService,
    PollingWeatherService,
    DashboardWeatherService,
  ],
})
export class WeatherModule {}
