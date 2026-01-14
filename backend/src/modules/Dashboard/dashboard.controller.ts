import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Public } from '../Auth/public.decorator';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import { User } from '../Auth/user.decorator';

export interface HeatingEventsQuery {
  homeProfileId?: number;
  deviceId?: number;
  hvacAction?: string;
  source?: string;
  from?: string; // ISO
  to?: string; // ISO
  page?: number; // default 1
  limit?: number; // default 20
}

export interface HeatingStatsQuery {
  homeProfileId: number;
  deviceId?: number;
  from: string; // ISO
  to: string; // ISO
  bucket: 'hour' | 'day';
}

export interface LearningTrendsQuery {
  homeProfileId: number;
  from: string;
  to: string;
}

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
  getHeatingEvents(@Req() req: any, @Query() query: any) {
    return this.dashboardService.getHeatingEvents(req.user.id, query);
  }

  @Get('heating-stats')
  getHeatingStats(@Req() req: any, @Query() query: any) {
    return this.dashboardService.getHeatingStats(req.user.id, query);
  }

  @Get('learning-trends')
  getLearningTrends(@Req() req: any, @Query() query: any) {
    return this.dashboardService.getLearningTrends(req.user.id, query);
  }
}
