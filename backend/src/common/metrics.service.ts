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
  tuya_timeout_errors: number;
  weather_requests_total: number;
  weather_requests_success: number;
  weather_requests_failed: number;
  weather_timeout_errors: number;
  adapter_circuit_breaker_trips: number;
  adapter_circuit_breaker_open: number;
  adapter_circuit_breaker_half_open: number;
  adapter_circuit_breaker_closed: number;
  adapter_timeout_errors_total: number;
  // P2c: Anomaly Detection Counters
  anomaly_detected_total: number;
  anomaly_overshoot_total: number;
  anomaly_early_stop_total: number;
  anomaly_prolonged_idle_total: number;
  anomaly_rapid_cycling_total: number;
  // P2c: Fallback Strategy Counters
  fallback_triggered_total: number;
  fallback_sensor_failure_total: number;
  fallback_adapter_timeout_total: number;
  fallback_cached_state_total: number;
  db_errors_total: number;
  heating_events_created: number;
  heating_events_ended: number;
  anomalies_detected: number;
  boiler_current_temp_updates_total: number;
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
    tuya_timeout_errors: 0,
    weather_requests_total: 0,
    weather_requests_success: 0,
    weather_requests_failed: 0,
    weather_timeout_errors: 0,
    adapter_circuit_breaker_trips: 0,
    adapter_circuit_breaker_open: 0,
    adapter_circuit_breaker_half_open: 0,
    adapter_circuit_breaker_closed: 0,
    adapter_timeout_errors_total: 0,
    // P2c: Anomaly Detection Counters
    anomaly_detected_total: 0,
    anomaly_overshoot_total: 0,
    anomaly_early_stop_total: 0,
    anomaly_prolonged_idle_total: 0,
    anomaly_rapid_cycling_total: 0,
    // P2c: Fallback Strategy Counters
    fallback_triggered_total: 0,
    fallback_sensor_failure_total: 0,
    fallback_adapter_timeout_total: 0,
    fallback_cached_state_total: 0,
    db_errors_total: 0,
    heating_events_created: 0,
    heating_events_ended: 0,
    anomalies_detected: 0,
    boiler_current_temp_updates_total: 0,
    timestamp: new Date().toISOString(),
  };

  /**
   * Increment a counter metric
   */
  incrementCounter(key: keyof Metrics, value: number = 1): void {
    if (typeof this.metrics[key] === 'number') {
      const counter = key as Exclude<keyof Metrics, 'timestamp'>;
      this.metrics[counter] += value;
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
      '# HELP tuya_timeout_errors Tuya API timeout errors',
      '# TYPE tuya_timeout_errors counter',
      `tuya_timeout_errors ${this.metrics.tuya_timeout_errors}`,
      '',
      '# HELP weather_requests_total Total Weather API requests',
      '# TYPE weather_requests_total counter',
      `weather_requests_total ${this.metrics.weather_requests_total}`,
      '',
      '# HELP weather_requests_success Successful Weather API requests',
      '# TYPE weather_requests_success counter',
      `weather_requests_success ${this.metrics.weather_requests_success}`,
      '',
      '# HELP weather_requests_failed Failed Weather API requests',
      '# TYPE weather_requests_failed counter',
      `weather_requests_failed ${this.metrics.weather_requests_failed}`,
      '',
      '# HELP weather_timeout_errors Weather API timeout errors',
      '# TYPE weather_timeout_errors counter',
      `weather_timeout_errors ${this.metrics.weather_timeout_errors}`,
      '',
      '# HELP adapter_circuit_breaker_trips Circuit breaker trips across all adapters',
      '# TYPE adapter_circuit_breaker_trips counter',
      `adapter_circuit_breaker_trips ${this.metrics.adapter_circuit_breaker_trips}`,
      '',
      '# HELP adapter_circuit_breaker_open Circuit breaker transitions to OPEN state',
      '# TYPE adapter_circuit_breaker_open counter',
      `adapter_circuit_breaker_open ${this.metrics.adapter_circuit_breaker_open}`,
      '',
      '# HELP adapter_circuit_breaker_half_open Circuit breaker transitions to HALF_OPEN state',
      '# TYPE adapter_circuit_breaker_half_open counter',
      `adapter_circuit_breaker_half_open ${this.metrics.adapter_circuit_breaker_half_open}`,
      '',
      '# HELP adapter_circuit_breaker_closed Circuit breaker transitions to CLOSED state',
      '# TYPE adapter_circuit_breaker_closed counter',
      `adapter_circuit_breaker_closed ${this.metrics.adapter_circuit_breaker_closed}`,
      '',
      '# HELP adapter_timeout_errors_total Total adapter timeout errors',
      '# TYPE adapter_timeout_errors_total counter',
      `adapter_timeout_errors_total ${this.metrics.adapter_timeout_errors_total}`,
      '',
      '# HELP anomaly_detected_total Total anomalies detected',
      '# TYPE anomaly_detected_total counter',
      `anomaly_detected_total ${this.metrics.anomaly_detected_total}`,
      '',
      '# HELP anomaly_overshoot_total Anomalies due to overshoot (duration > avg + 2σ)',
      '# TYPE anomaly_overshoot_total counter',
      `anomaly_overshoot_total ${this.metrics.anomaly_overshoot_total}`,
      '',
      '# HELP anomaly_early_stop_total Anomalies due to early termination (duration < avg - 2σ)',
      '# TYPE anomaly_early_stop_total counter',
      `anomaly_early_stop_total ${this.metrics.anomaly_early_stop_total}`,
      '',
      '# HELP anomaly_prolonged_idle_total Anomalies due to prolonged idle (> 120min)',
      '# TYPE anomaly_prolonged_idle_total counter',
      `anomaly_prolonged_idle_total ${this.metrics.anomaly_prolonged_idle_total}`,
      '',
      '# HELP anomaly_rapid_cycling_total Anomalies due to rapid cycling (< 5min)',
      '# TYPE anomaly_rapid_cycling_total counter',
      `anomaly_rapid_cycling_total ${this.metrics.anomaly_rapid_cycling_total}`,
      '',
      '# HELP fallback_triggered_total Total fallback strategies triggered',
      '# TYPE fallback_triggered_total counter',
      `fallback_triggered_total ${this.metrics.fallback_triggered_total}`,
      '',
      '# HELP fallback_sensor_failure_total Fallbacks due to sensor failure',
      '# TYPE fallback_sensor_failure_total counter',
      `fallback_sensor_failure_total ${this.metrics.fallback_sensor_failure_total}`,
      '',
      '# HELP fallback_adapter_timeout_total Fallbacks due to adapter timeout',
      '# TYPE fallback_adapter_timeout_total counter',
      `fallback_adapter_timeout_total ${this.metrics.fallback_adapter_timeout_total}`,
      '',
      '# HELP fallback_cached_state_total Fallbacks using cached state',
      '# TYPE fallback_cached_state_total counter',
      `fallback_cached_state_total ${this.metrics.fallback_cached_state_total}`,
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
      '',
      '# HELP boiler_current_temp_updates_total Total manual boiler current temperature updates',
      '# TYPE boiler_current_temp_updates_total counter',
      `boiler_current_temp_updates_total ${this.metrics.boiler_current_temp_updates_total}`,
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
      tuya_timeout_errors: 0,
      weather_requests_total: 0,
      weather_requests_success: 0,
      weather_requests_failed: 0,
      weather_timeout_errors: 0,
      adapter_circuit_breaker_trips: 0,
      adapter_circuit_breaker_open: 0,
      adapter_circuit_breaker_half_open: 0,
      adapter_circuit_breaker_closed: 0,
      adapter_timeout_errors_total: 0,
      // P2c: Anomaly Detection Counters
      anomaly_detected_total: 0,
      anomaly_overshoot_total: 0,
      anomaly_early_stop_total: 0,
      anomaly_prolonged_idle_total: 0,
      anomaly_rapid_cycling_total: 0,
      // P2c: Fallback Strategy Counters
      fallback_triggered_total: 0,
      fallback_sensor_failure_total: 0,
      fallback_adapter_timeout_total: 0,
      fallback_cached_state_total: 0,
      db_errors_total: 0,
      heating_events_created: 0,
      heating_events_ended: 0,
      anomalies_detected: 0,
      boiler_current_temp_updates_total: 0,
      timestamp: new Date().toISOString(),
    };
  }
}
