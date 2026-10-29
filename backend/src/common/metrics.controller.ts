import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';
import { ReportingService } from './reporting.service';
import { Public } from '../modules/Auth/public.decorator';
import { ApiTags } from '@nestjs/swagger';

/**
 * Metrics endpoint for Prometheus scraping.
 * Lightweight and read-only, no external API calls.
 */
@ApiTags('Metrics')
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
  @Public()
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
  @Public()
  @Get('json')
  getMetricsJson() {
    return this.metricsService.getMetrics();
  }

  /**
   * GET /metrics/reporting
   * Returns reporting metrics (anomalies, fallbacks, health scores, alerts)
   * Exported in Prometheus format for external monitoring
   */
  @Public()
  @Get('reporting')
  getReportingMetrics(@Res() res: Response) {
    const metrics = this.reportingService.exportMetrics();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(metrics);
  }

  /**
   * GET /metrics/reporting/json
   * Returns reporting metrics as JSON
   */
  @Public()
  @Get('reporting/json')
  getReportingMetricsJson() {
    return this.reportingService.getHealthSummary();
  }
}
