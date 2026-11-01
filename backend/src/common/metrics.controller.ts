import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';
import { ReportingService } from './reporting.service';
import { MetricsAuthGuard } from './metrics-auth.guard';
import {
  ApiBearerAuth,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

/**
 * Metrics endpoint for Prometheus-compatible scraping.
 * Lightweight and read-only, no external API calls.
 *
 * SEC-6: protected by a dedicated scraper token, not a user JWT.
 */
@ApiTags('Metrics')
@ApiBearerAuth('metrics-token')
@ApiUnauthorizedResponse({ description: 'Missing or invalid metrics token' })
@ApiServiceUnavailableResponse({
  description: 'Metrics authentication is not configured',
})
@UseGuards(MetricsAuthGuard)
@Controller('metrics')
export class MetricsController {
  constructor(
    private metricsService: MetricsService,
    private reportingService: ReportingService,
  ) {}

  /**
   * GET /metrics
   * Returns metrics in Prometheus text format (application/plain-text)
   */
  @Get()
  getMetrics(@Res() res: Response) {
    const metrics = this.metricsService.exportPrometheus();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(metrics);
  }

  /**
   * GET /metrics/json
   * Returns metrics as JSON
   */
  @Get('json')
  getMetricsJson() {
    return this.metricsService.getMetrics();
  }

  /**
   * GET /metrics/reporting
   * Returns aggregate reporting metrics (health, anomaly/fallback rates, alerts)
   * Exported in Prometheus format for external monitoring. No ID labels.
   */
  @Get('reporting')
  getReportingMetrics(@Res() res: Response) {
    const metrics = this.reportingService.exportMetrics();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(metrics);
  }

  /**
   * GET /metrics/reporting/json
   * Returns aggregate reporting health summary as JSON
   */
  @Get('reporting/json')
  getReportingMetricsJson() {
    return this.reportingService.getHealthSummary();
  }
}
