import { Module } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { HeatingRecommendationService } from './heating.recommendation.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { WeatherModule } from '../Weather/weather.module';

@Module({
  imports: [PrismaModule, WeatherModule],
  controllers: [RecommendationsController],
  providers: [HeatingRecommendationService],
})
export class HeatingRecommendationModule {}
