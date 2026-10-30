import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import {
  GetHeatingEventsDto,
  GetHeatingSummaryDto,
  GetHeatingStatsDto,
  GetLearningTrendsDto,
  ExportAnalyticsDto,
} from './dto/dashboard.dto';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  DashboardHeatingEventsResponseDto,
  DashboardLiveRecommendationDto,
  DashboardStoredRecommendationDto,
  DashboardHeatingStatusDto,
  DashboardHeatingSummaryResponseDto,
  DashboardResponseDto,
} from './dto/dashboard-response.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
// `oneOf` u DashboardSystemDto.recommendation referencira ove dvije klase
// samo preko $ref stringova, pa ih schema explorer sam ne registruje.
// Bez ovog dekoratora ugovor bi imao viseće reference.
@ApiExtraModels(
  DashboardLiveRecommendationDto,
  DashboardStoredRecommendationDto,
)
@Controller('api/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // =====================================
  // ANONYMOUS + AUTHENTICATED
  // =====================================

  @Get()
  @ApiOkResponse({ type: DashboardResponseDto })
  async getDashboard(@Req() req) {
    const userId = req.user?.userId;
    return this.dashboardService.getDashboard(userId ?? undefined);
  }

  // =====================================
  // FULL-ONLY
  // =====================================

  @Get('heating-events')
  @ApiOkResponse({ type: DashboardHeatingEventsResponseDto })
  getHeatingEvents(@Req() req: any, @Query() query: GetHeatingEventsDto) {
    return this.dashboardService.getHeatingEvents(req.user.userId, query);
  }

  @Get('heating-status')
  @ApiOkResponse({ type: [DashboardHeatingStatusDto] })
  getHeatingStatus(@Req() req: any) {
    return this.dashboardService.getHeatingStatus(req.user.userId);
  }

  @Get('heating-summary')
  @ApiOkResponse({ type: DashboardHeatingSummaryResponseDto })
  getHeatingSummary(@Req() req: any, @Query() query: GetHeatingSummaryDto) {
    return this.dashboardService.getHeatingSummary(req.user.userId, query);
  }

  @Get('heating-stats')
  getHeatingStats(@Req() req: any, @Query() query: GetHeatingStatsDto) {
    return this.dashboardService.getHeatingStats(req.user.userId, query);
  }

  @Get('learning-trends')
  getLearningTrends(@Req() req: any, @Query() query: GetLearningTrendsDto) {
    return this.dashboardService.getLearningTrends(req.user.userId, query);
  }

  @Get('export')
  exportAnalytics(@Req() req: any, @Query() query: ExportAnalyticsDto) {
    return this.dashboardService.exportAnalytics(req.user.userId, query);
  }
}
