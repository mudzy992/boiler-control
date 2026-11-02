import { Injectable, Logger } from '@nestjs/common';
import { HttpAdapter } from '../../common/adapters/http-adapter';
import { MetricsService } from '../../common/metrics.service';
import { StructuredLogger } from '../../common/structured-logger';

/**
 * Weather API-specific HTTP adapter with 10s timeout and circuit breaker protection.
 * Wraps all Weather/Open-Meteo API calls with timeout and failure resilience.
 */
@Injectable()
export class WeatherHttpAdapter extends HttpAdapter {
  protected readonly logger = new Logger(WeatherHttpAdapter.name);

  constructor(metricsService: MetricsService) {
    // Avoid requiring StructuredLogger in DI for test modules; create a
    // local instance for adapter-level structured logs.
    const structuredLogger = new StructuredLogger('WeatherHttpAdapter');

    super(
      {
        name: 'weather-api',
        timeout: 10000, // 10 seconds for Weather API (faster, more responsive)
        failureThreshold: 3, // Lower threshold for weather (non-critical)
        recoveryTimeout: 30000,
        retryAttempts: 1,
        retryDelay: 1000,
      },
      metricsService,
      structuredLogger,
    );
  }

  /** Count every logical geocoder/forecast call, including direct SDK calls. */
  async executeWithCircuitBreaker<T>(
    requestFn: () => Promise<T>,
    context?: { runId?: string; endpoint?: string },
  ): Promise<T> {
    this.metricsService?.incrementCounter('weather_requests_total');
    try {
      const result = await super.executeWithCircuitBreaker(requestFn, context);
      this.metricsService?.incrementCounter('weather_requests_success');
      return result;
    } catch (error) {
      this.metricsService?.incrementCounter('weather_requests_failed');
      if (error instanceof Error && error.message.includes('timeout')) {
        this.metricsService?.incrementCounter('weather_timeout_errors');
      }
      throw error;
    }
  }
}
