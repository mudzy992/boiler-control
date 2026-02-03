/**
 * Base Adapter Pattern
 * Provides standardized interface for external API calls with circuit breaker resilience
 */

import { Logger } from '@nestjs/common';
import { CircuitBreaker, CircuitBreakerState } from './circuit-breaker';
import { MetricsService } from '../metrics.service';
import { StructuredLogger } from '../structured-logger';

export interface AdapterConfig {
  name: string;
  timeout: number; // Milliseconds before request times out
  failureThreshold?: number; // Defaults to 5
  recoveryTimeout?: number; // Defaults to 30000ms (30s)
  retryAttempts?: number; // Number of retries on failure
  retryDelay?: number; // Delay between retries in milliseconds
}

export class ServiceUnavailableError extends Error {
  constructor(
    message: string,
    public readonly circuitOpen: boolean = false,
  ) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export abstract class BaseAdapter {
  protected circuitBreaker: CircuitBreaker;
  protected logger = new Logger(this.constructor.name);
  protected readonly config: AdapterConfig;
  protected metricsService?: MetricsService;
  protected structuredLogger?: StructuredLogger;

  constructor(
    config: AdapterConfig,
    metricsService?: MetricsService,
    structuredLogger?: StructuredLogger,
  ) {
    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 30000,
      retryAttempts: 0,
      retryDelay: 1000,
      ...config,
    };

    this.metricsService = metricsService;
    this.structuredLogger = structuredLogger;

    this.circuitBreaker = new CircuitBreaker({
      name: config.name,
      failureThreshold: this.config.failureThreshold!,
      recoveryTimeout: this.config.recoveryTimeout!,
    });

    // Record circuit breaker trip in metrics when state changes to OPEN
    // NOTE: We wrap the circuit breaker's metrics getter to emit adapter-level
    // metrics when the state transitions to OPEN. This is non-invasive for
    // existing consumers but provides visibility for P2b.
    this.circuitBreaker.getMetrics = this.createMetricsGetter();
  }

  /**
   * Execute request with circuit breaker protection
   * @param requestFn Function that performs the actual request
   * @param context Additional context for logging (e.g., correlation ID)
   */
  async executeWithCircuitBreaker<T>(
    requestFn: () => Promise<T>,
    context?: { runId?: string; endpoint?: string },
  ): Promise<T> {
    // Check if circuit breaker allows the request
    if (!this.circuitBreaker.canAttempt()) {
      const metrics = this.circuitBreaker.getMetrics();
      if (metrics.state === CircuitBreakerState.OPEN) {
        this.logger.warn(
          `[${this.config.name}] Circuit breaker OPEN, rejecting request`,
          { runId: context?.runId },
        );

        // Record circuit breaker trip
        if (this.metricsService) {
          this.metricsService.incrementCounter('adapter_circuit_breaker_trips');
        }

        throw new ServiceUnavailableError(
          `${this.config.name} service temporarily unavailable (circuit breaker open)`,
          true,
        );
      }
    }

    // Implement retry-with-jitter around the requestFn. Retries are applied
    // before the circuit breaker records failures so that transient network
    // glitches are retried. The `retryAttempts` and `retryDelay` are
    // configurable in the adapter config.
    const attempts = Math.max(0, this.config.retryAttempts ?? 0) + 1;
    let lastError: any = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const result = await this.executeWithTimeout(requestFn);
        this.circuitBreaker.recordSuccess();
        return result;
      } catch (error) {
        lastError = error;

        // If timeout, record adapter-level metric
        if (error instanceof TimeoutError && this.metricsService) {
          this.metricsService.incrementCounter('adapter_timeout_errors_total');
        }

        // If this was the last attempt, record failure on circuit and rethrow
        if (attempt === attempts) {
          this.circuitBreaker.recordFailure();
          const metrics = this.circuitBreaker.getMetrics();

          // Log state transitions and record trip
          if (
            metrics.state === CircuitBreakerState.OPEN &&
            metrics.failureCount === 0
          ) {
            this.logger.error(
              `[${this.config.name}] Circuit breaker OPENED after ${this.config.failureThreshold} failures`,
              {
                runId: context?.runId,
                error: error instanceof Error ? error.message : String(error),
              },
            );

            if (this.metricsService) {
              this.metricsService.incrementCounter(
                'adapter_circuit_breaker_trips',
              );
            }
          }

          // Re-throw the last error
          throw error;
        }

        // Otherwise, wait with exponential backoff + jitter then retry
        const baseDelay = this.config.retryDelay ?? 1000;
        const backoff = baseDelay * Math.pow(2, attempt - 1);
        const jitter = Math.floor(Math.random() * 300) - 150; // +/-150ms
        const delay = Math.max(0, backoff + jitter);

        // Log retry attempt at debug level
        this.logger.debug(
          `[${this.config.name}] retry attempt ${attempt}/${attempts} after ${delay}ms (error: ${lastError?.message ?? String(lastError)})`,
          { runId: context?.runId },
        );

        this.logger.warn(
          `[${this.config.name}] request failed (attempt ${attempt}/${attempts}), retrying after ${delay}ms`,
          {
            runId: context?.runId,
            error: lastError?.message ?? String(lastError),
          },
        );

        await new Promise((res) => setTimeout(res, delay));
      }
    }

    // If we somehow exit loop without returning, throw last error.
    throw lastError;
  }

  /**
   * Execute request with timeout protection
   */
  protected async executeWithTimeout<T>(
    requestFn: () => Promise<T>,
  ): Promise<T> {
    return Promise.race([requestFn(), this.createTimeoutPromise<T>()]);
  }

  /**
   * Create a promise that rejects after configured timeout
   */
  private createTimeoutPromise<T>(): Promise<T> {
    return new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new TimeoutError(
              `${this.config.name} request timed out after ${this.config.timeout}ms`,
            ),
          ),
        this.config.timeout,
      ),
    );
  }

  /**
   * Get circuit breaker metrics
   */
  getMetrics() {
    return this.circuitBreaker.getMetrics();
  }

  /**
   * Create metrics getter wrapper to track state changes
   */
  private createMetricsGetter() {
    let lastState: CircuitBreakerState | null = null;
    return () => {
      const metrics = this.circuitBreaker.getMetrics();

      // Track state transitions
      if (lastState !== metrics.state && this.metricsService) {
        switch (metrics.state) {
          case CircuitBreakerState.OPEN:
            this.metricsService.incrementCounter(
              'adapter_circuit_breaker_open',
            );
            break;
          case CircuitBreakerState.HALF_OPEN:
            this.metricsService.incrementCounter(
              'adapter_circuit_breaker_half_open',
            );
            break;
          case CircuitBreakerState.CLOSED:
            this.metricsService.incrementCounter(
              'adapter_circuit_breaker_closed',
            );
            break;
        }
      }

      lastState = metrics.state;
      return metrics;
    };
  }

  /**
   * Reset circuit breaker (for testing or manual intervention)
   */
  reset(): void {
    this.circuitBreaker.reset();
  }

  /**
   * Abstract method to be implemented by subclasses
   */
  abstract executeRequest<T>(
    endpoint: string,
    options?: Record<string, any>,
  ): Promise<T>;
}
