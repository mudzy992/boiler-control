import { Injectable, Logger } from '@nestjs/common';
import { HttpAdapter } from '../../common/adapters/http-adapter';
import { MetricsService } from '../../common/metrics.service';
import { StructuredLogger } from '../../common/structured-logger';

/**
 * Tuya-specific HTTP adapter with 30s timeout and circuit breaker protection.
 * Wraps all Tuya API calls with timeout and failure resilience.
 */
@Injectable()
export class TuyaHttpAdapter extends HttpAdapter {
  protected readonly logger = new Logger(TuyaHttpAdapter.name);

  constructor(metricsService: MetricsService) {
    // Create a local StructuredLogger if one is not provided by DI. We avoid
    // requiring a StructuredLogger provider to keep DI simple for test setups.
    const structuredLogger = new StructuredLogger('TuyaHttpAdapter');

    super(
      {
        name: 'tuya-api',
        timeout: 30000, // 30 seconds for Tuya
        failureThreshold: 5,
        recoveryTimeout: 30000,
        retryAttempts: 1,
        retryDelay: 1000,
      },
      metricsService,
      structuredLogger,
    );
  }

  /**
   * Override to record Tuya-specific metrics
   */
  async get<T = any>(endpoint: string, config?: any): Promise<T> {
    if (this.metricsService) {
      this.metricsService.incrementCounter('tuya_requests_total');
    }

    try {
      const result = await super.get<T>(endpoint, config);
      if (this.metricsService) {
        this.metricsService.incrementCounter('tuya_requests_success');
      }
      return result;
    } catch (error: any) {
      if (this.metricsService) {
        this.metricsService.incrementCounter('tuya_requests_failed');

        // Track timeout errors separately
        if (error.message?.includes('timeout')) {
          this.metricsService.incrementCounter('tuya_timeout_errors');
        }

        // Track circuit breaker trips
        if (error.message?.includes('ServiceUnavailable')) {
          this.metricsService.incrementCounter('tuya_circuit_breaker_trips');
        }
      }

      throw error;
    }
  }

  /**
   * Override post for Tuya-specific metrics (when needed)
   */
  async post<T = any>(endpoint: string, data?: any, config?: any): Promise<T> {
    if (this.metricsService) {
      this.metricsService.incrementCounter('tuya_requests_total');
    }

    try {
      const result = await super.post<T>(endpoint, data, config);
      if (this.metricsService) {
        this.metricsService.incrementCounter('tuya_requests_success');
      }
      return result;
    } catch (error: any) {
      if (this.metricsService) {
        this.metricsService.incrementCounter('tuya_requests_failed');

        if (error.message?.includes('timeout')) {
          this.metricsService.incrementCounter('tuya_timeout_errors');
        }

        if (error.message?.includes('ServiceUnavailable')) {
          this.metricsService.incrementCounter('tuya_circuit_breaker_trips');
        }
      }

      throw error;
    }
  }
}
