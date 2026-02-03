// src/modules/Weather/weather.module.ts
import { Module } from '@nestjs/common';
import { WeatherService } from './weather.service';
import { WeatherController } from './weather.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { WeatherHttpAdapter } from './weather-http.adapter';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [WeatherController],
  providers: [WeatherService, WeatherHttpAdapter],
  exports: [WeatherService, WeatherHttpAdapter],
})
export class WeatherModule {}
