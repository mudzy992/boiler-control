import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';

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

  @Get()
  async getDashboard(@Req() req: any) {
    const userId = req.user.id;
    return this.dashboardService.getUserDashboard(userId);
  }

  @Get('heating-events')
  getHeatingEvents(@Req() req: any, @Query() query: HeatingEventsQuery) {
    return this.dashboardService.getHeatingEvents(req.user.id, query);
  }

  @Get('heating-stats')
  getHeatingStats(@Req() req: any, @Query() query: HeatingStatsQuery) {
    return this.dashboardService.getHeatingStats(req.user.id, query);
  }

  @Get('learning-trends')
  getLearningTrends(@Req() req: any, @Query() query: LearningTrendsQuery) {
    return this.dashboardService.getLearningTrends(req.user.id, query);
  }
}
