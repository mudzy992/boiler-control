import { Injectable } from '@nestjs/common';

/**
 * Simple in-memory metrics counter for observability.
 * Designed to be lightweight and exportable to Prometheus.
 */
export interface Metrics {
  poll_runs_total: number;
  poll_runs_success: number;
  poll_runs_failed: number;
  tuya_requests_total: number;
  tuya_requests_success: number;
  tuya_requests_failed: number;
  tuya_circuit_breaker_trips: number;
  db_errors_total: number;
  heating_events_created: number;
  heating_events_ended: number;
  anomalies_detected: number;
  timestamp: string;
}

@Injectable()
export class MetricsService {
  private metrics: Metrics = {
    poll_runs_total: 0,
    poll_runs_success: 0,
    poll_runs_failed: 0,
    tuya_requests_total: 0,
    tuya_requests_success: 0,
    tuya_requests_failed: 0,
    tuya_circuit_breaker_trips: 0,
    db_errors_total: 0,
    heating_events_created: 0,
    heating_events_ended: 0,
    anomalies_detected: 0,
    timestamp: new Date().toISOString(),
  };

  /**
   * Increment a counter metric
   */
  incrementCounter(key: keyof Metrics, value: number = 1): void {
    if (typeof this.metrics[key] === 'number') {
      (this.metrics[key] as number) += value;
      this.metrics.timestamp = new Date().toISOString();
    }
  }

  /**
   * Get all metrics as a plain object (Prometheus compatible)
   */
  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  /**
   * Export metrics in Prometheus text format
   */
  exportPrometheus(): string {
    const lines: string[] = [
      '# HELP poll_runs_total Total number of polling cycles',
      '# TYPE poll_runs_total counter',
      `poll_runs_total ${this.metrics.poll_runs_total}`,
      '',
      '# HELP poll_runs_success Total successful poll cycles',
      '# TYPE poll_runs_success counter',
      `poll_runs_success ${this.metrics.poll_runs_success}`,
      '',
      '# HELP poll_runs_failed Total failed poll cycles',
      '# TYPE poll_runs_failed counter',
      `poll_runs_failed ${this.metrics.poll_runs_failed}`,
      '',
      '# HELP tuya_requests_total Total Tuya API requests',
      '# TYPE tuya_requests_total counter',
      `tuya_requests_total ${this.metrics.tuya_requests_total}`,
      '',
      '# HELP tuya_requests_success Successful Tuya API requests',
      '# TYPE tuya_requests_success counter',
      `tuya_requests_success ${this.metrics.tuya_requests_success}`,
      '',
      '# HELP tuya_requests_failed Failed Tuya API requests',
      '# TYPE tuya_requests_failed counter',
      `tuya_requests_failed ${this.metrics.tuya_requests_failed}`,
      '',
      '# HELP tuya_circuit_breaker_trips Circuit breaker trips (rate-limit protection)',
      '# TYPE tuya_circuit_breaker_trips counter',
      `tuya_circuit_breaker_trips ${this.metrics.tuya_circuit_breaker_trips}`,
      '',
      '# HELP db_errors_total Total database errors',
      '# TYPE db_errors_total counter',
      `db_errors_total ${this.metrics.db_errors_total}`,
      '',
      '# HELP heating_events_created Total heating events created',
      '# TYPE heating_events_created counter',
      `heating_events_created ${this.metrics.heating_events_created}`,
      '',
      '# HELP heating_events_ended Total heating events ended',
      '# TYPE heating_events_ended counter',
      `heating_events_ended ${this.metrics.heating_events_ended}`,
      '',
      '# HELP anomalies_detected Total anomalies detected',
      '# TYPE anomalies_detected counter',
      `anomalies_detected ${this.metrics.anomalies_detected}`,
    ];

    return lines.join('\n');
  }

  /**
   * Reset all metrics (useful for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      poll_runs_total: 0,
      poll_runs_success: 0,
      poll_runs_failed: 0,
      tuya_requests_total: 0,
      tuya_requests_success: 0,
      tuya_requests_failed: 0,
      tuya_circuit_breaker_trips: 0,
      db_errors_total: 0,
      heating_events_created: 0,
      heating_events_ended: 0,
      anomalies_detected: 0,
      timestamp: new Date().toISOString(),
    };
  }
}
