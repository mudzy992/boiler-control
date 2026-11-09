import { Controller, Get, Query, Res, UseGuards, Req } from '@nestjs/common';
import type { Response } from 'express';
import { throwIfStubRejected } from '../../common/stub-endpoint';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { parsePage, setTotalCount, TOTAL_COUNT_HEADER } from '../../common/pagination';
import { RecommendationResponseDto } from './dto/recommendation-response.dto';
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
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiOkResponse({
    type: [RecommendationResponseDto],
    description: `Ukupan broj redova je u \`${TOTAL_COUNT_HEADER}\` zaglavlju.`,
  })
  async getRecommendations(
    @Req() req,
    @Query('limit') limit: string | undefined,
    @Query('offset') offset: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Prije: `take: 100` bez ikakvog znaka da još redova postoji — korisnik sa
    // 299 preporuka je vidio 100 i nije imao način da sazna da ima još.
    const page = parsePage({ limit, offset }, { defaultLimit: 50, maxLimit: 200 });
    const { rows, total } = await this.recommendationService.getRecommendations(
      req.user.userId,
      {
        ...page,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      },
    );
    setTotalCount(res, total);
    return rows;
  }

  /**
   * Get today's recommendations
   */
  @Get('today')
  getTodayRecommendations() {
    // API-1 / B-003: `[]` je bilo nerazlučivo od „nema preporuka za danas".
    // Potrošači su verificirani: frontend `ReportsPage` zove `getReports()`
    // → `GET /api/recommendations`, a ne `/today`.
    throwIfStubRejected('GET /api/recommendations/today', {
      alternative: 'GET /api/recommendations',
    });

    return [];
  }
}
