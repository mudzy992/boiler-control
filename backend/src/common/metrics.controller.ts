import { Controller, Get } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { Public } from '../modules/Auth/public.decorator';

/**
 * Metrics endpoint for Prometheus scraping.
 * Lightweight and read-only, no external API calls.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private metricsService: MetricsService) {}

  /**
   * GET /api/metrics
   * Returns metrics in Prometheus text format (application/plain-text)
   */
  @Public()
  @Get()
  getMetrics() {
    return this.metricsService.exportPrometheus();
  }

  /**
   * GET /api/metrics/json
   * Returns metrics as JSON
   */
  @Public()
  @Get('json')
  getMetricsJson() {
    return this.metricsService.getMetrics();
  }
}
