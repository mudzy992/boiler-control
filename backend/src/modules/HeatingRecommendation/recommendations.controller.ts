import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HeatingRecommendationService } from './heating.recommendation.service';

/**
 * Recommendations Controller (P2a)
 * Provides endpoints for heating recommendations
 */
@ApiTags('Recommendations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/recommendations')
export class RecommendationsController {
  constructor(private recommendationService: HeatingRecommendationService) {}

  /**
   * Get all recommendations for the authenticated user
   */
  @Get()
  async getRecommendations(@Req() req) {
    return this.recommendationService.getRecommendations(req.user.userId);
  }

  /**
   * Get today's recommendations
   */
  @Get('today')
  getTodayRecommendations() {
    // Stub: return empty array
    // Full implementation: fetch today's recommendations from database
    return [];
  }
}
