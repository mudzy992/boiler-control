import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Public } from '../Auth/public.decorator';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import { User } from '../Auth/user.decorator';
import {
  GetHeatingEventsDto,
  GetHeatingStatsDto,
  GetLearningTrendsDto,
} from './dto/dashboard.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('api/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // =====================================
  // ANONYMOUS + AUTHENTICATED
  // =====================================

  @Get()
  @Public()
  async getDashboard(@User() userId: number | null) {
    return this.dashboardService.getDashboard(userId ?? undefined);
  }

  // =====================================
  // FULL-ONLY
  // =====================================

  @Get('heating-events')
  getHeatingEvents(
    @Req() req: any,
    @Query() query: GetHeatingEventsDto,
  ) {
    return this.dashboardService.getHeatingEvents(req.user.id, query);
  }

  @Get('heating-stats')
  getHeatingStats(
    @Req() req: any,
    @Query() query: GetHeatingStatsDto,
  ) {
    return this.dashboardService.getHeatingStats(req.user.id, query);
  }

  @Get('learning-trends')
  getLearningTrends(
    @Req() req: any,
    @Query() query: GetLearningTrendsDto,
  ) {
    return this.dashboardService.getLearningTrends(req.user.id, query);
  }
}
