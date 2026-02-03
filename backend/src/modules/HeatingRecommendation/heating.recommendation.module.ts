import { Module } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { HeatingRecommendationService } from './heating.recommendation.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RecommendationsController],
  providers: [HeatingRecommendationService],
})
export class HeatingRecommendationModule {}
