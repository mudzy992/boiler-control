// src/common/reporting.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { StructuredLogger } from './structured-logger';

/**
 * Reporting metrics for a home (thermostat)
 */
export interface HomeReportMetrics {
  deviceId: number;
  userId: number;
  homeProfileId: number;
  reportPeriod: {
    startTime: Date;
    endTime: Date;
  };
  anomalies: {
    total: number;
    overshoot: number;
    earlyStop: number;
    prolongedIdle: number;
    rapidCycling: number;
    rate: number; // anomalies per hour
  };
  fallbacks: {
    total: number;
    sensorFailure: number;
    adapterTimeout: number;
    cachedState: number;
    rate: number; // fallbacks per hour
  };
  adapterPerformance: {
    tuyaTimeouts: number;
    weatherTimeouts: number;
    circuitBreakerTrips: number;
  };
  healthScore: number; // 0-100: 100=no issues, <50=critical
}

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

/**
 * Alert for anomaly/fallback patterns
 */
export interface Alert {
  severity: AlertSeverity;
  deviceId: number;
  userId: number;
  title: string;
  message: string;
  timestamp: Date;
  metrics?: any;
  actionRequired?: boolean;
}

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);
  private readonly structuredLogger = new StructuredLogger(
    ReportingService.name,
  );

  // In-memory storage for aggregation (can be extended to database)
  private homeMetrics: Map<number, HomeReportMetrics> = new Map();
  private alerts: Alert[] = [];

  constructor(private metricsService: MetricsService) {}

  /**
   * Record an anomaly event for reporting
   */
  recordAnomaly(
    deviceId: number,
    userId: number,
    homeProfileId: number,
    anomalyType: string,
    confidence: number,
  ): void {
    this.structuredLogger.log('Anomaly recorded for reporting', {
      deviceId,
      userId,
      homeProfileId,
      module: 'reporting',
      action: 'anomaly_recorded',
      anomalyType,
      confidence,
    });
  }

  /**
   * Record a fallback event for reporting
   */
  recordFallback(
    deviceId: number,
    userId: number,
    homeProfileId: number,
    fallbackType: string,
    trigger: string,
  ): void {
    this.structuredLogger.log('Fallback recorded for reporting', {
      deviceId,
      userId,
      homeProfileId,
      module: 'reporting',
      action: 'fallback_recorded',
      fallbackType,
      trigger,
    });
  }

  /**
   * Check for alert conditions based on metrics
   * Returns true if alert was created
   */
  checkAlertConditions(
    deviceId: number,
    userId: number,
    homeProfileId: number,
    metrics: {
      anomaliesPerHour?: number;
      fallbacksPerHour?: number;
      recentTimeouts?: number;
      circuitBreakerTrips?: number;
    },
  ): boolean {
    const alerts: Alert[] = [];

    // Alert: High anomaly rate (>5 per hour)
    if (metrics.anomaliesPerHour && metrics.anomaliesPerHour > 5) {
      alerts.push({
        severity: AlertSeverity.CRITICAL,
        deviceId,
        userId,
        title: 'High Anomaly Rate Detected',
        message: `Device ${deviceId} has ${metrics.anomaliesPerHour.toFixed(1)} anomalies/hour. Possible thermostat malfunction.`,
        timestamp: new Date(),
        metrics: { anomaliesPerHour: metrics.anomaliesPerHour },
        actionRequired: true,
      });
    }

    // Alert: High fallback rate (>3 per hour)
    if (metrics.fallbacksPerHour && metrics.fallbacksPerHour > 3) {
      alerts.push({
        severity: AlertSeverity.WARNING,
        deviceId,
        userId,
        title: 'High Fallback Rate',
        message: `Device ${deviceId} is using fallbacks ${metrics.fallbacksPerHour.toFixed(1)} times/hour. Sensors may be unreliable.`,
        timestamp: new Date(),
        metrics: { fallbacksPerHour: metrics.fallbacksPerHour },
        actionRequired: true,
      });
    }

    // Alert: Repeated timeouts (>10 in last hour)
    if (metrics.recentTimeouts && metrics.recentTimeouts > 10) {
      alerts.push({
        severity: AlertSeverity.WARNING,
        deviceId,
        userId,
        title: 'Repeated Adapter Timeouts',
        message: `Device ${deviceId} experienced ${metrics.recentTimeouts} adapter timeouts. Network connectivity may be degraded.`,
        timestamp: new Date(),
        metrics: { recentTimeouts: metrics.recentTimeouts },
        actionRequired: false,
      });
    }

    // Alert: Circuit breaker trips (>5 in last hour)
    if (metrics.circuitBreakerTrips && metrics.circuitBreakerTrips > 5) {
      alerts.push({
        severity: AlertSeverity.CRITICAL,
        deviceId,
        userId,
        title: 'Circuit Breaker Activated Multiple Times',
        message: `Device ${deviceId} circuit breaker has been activated ${metrics.circuitBreakerTrips} times. Repeated failure pattern detected.`,
        timestamp: new Date(),
        metrics: { circuitBreakerTrips: metrics.circuitBreakerTrips },
        actionRequired: true,
      });
    }

    if (alerts.length > 0) {
      this.alerts.push(...alerts);
      this.structuredLogger.log('Alerts generated from metrics', {
        deviceId,
        userId,
        module: 'reporting',
        action: 'alerts_generated',
        alertCount: alerts.length,
        severities: alerts.map((a) => a.severity),
      });
      return true;
    }

    return false;
  }

  /**
   * Generate daily report metrics for a home
   */
  generateDailyReport(
    deviceId: number,
    userId: number,
    homeProfileId: number,
    periodStartTime: Date,
    periodEndTime: Date,
    metrics: {
      anomaliesTotal: number;
      anomaliesOvershoot: number;
      anomaliesEarlyStop: number;
      anomaliesProlongedIdle: number;
      anomaliesRapidCycling: number;
      fallbacksTotal: number;
      fallbacksSensorFailure: number;
      fallbacksAdapterTimeout: number;
      fallbacksCachedState: number;
      tuyaTimeouts: number;
      weatherTimeouts: number;
      circuitBreakerTrips: number;
    },
  ): HomeReportMetrics {
    const durationHours =
      (periodEndTime.getTime() - periodStartTime.getTime()) / (1000 * 60 * 60);
    const anomalyRate =
      durationHours > 0 ? metrics.anomaliesTotal / durationHours : 0;
    const fallbackRate =
      durationHours > 0 ? metrics.fallbacksTotal / durationHours : 0;

    // Calculate health score (100 = perfect, <50 = critical)
    let healthScore = 100;
    healthScore -= Math.min(30, anomalyRate * 5); // 1 anomaly/hour = -5 points
    healthScore -= Math.min(20, fallbackRate * 3); // 1 fallback/hour = -3 points
    healthScore -= Math.min(
      15,
      (metrics.tuyaTimeouts + metrics.weatherTimeouts) * 0.5,
    );
    healthScore -= Math.min(10, metrics.circuitBreakerTrips * 2);
    healthScore = Math.max(0, Math.min(100, healthScore));

    const report: HomeReportMetrics = {
      deviceId,
      userId,
      homeProfileId,
      reportPeriod: {
        startTime: periodStartTime,
        endTime: periodEndTime,
      },
      anomalies: {
        total: metrics.anomaliesTotal,
        overshoot: metrics.anomaliesOvershoot,
        earlyStop: metrics.anomaliesEarlyStop,
        prolongedIdle: metrics.anomaliesProlongedIdle,
        rapidCycling: metrics.anomaliesRapidCycling,
        rate: anomalyRate,
      },
      fallbacks: {
        total: metrics.fallbacksTotal,
        sensorFailure: metrics.fallbacksSensorFailure,
        adapterTimeout: metrics.fallbacksAdapterTimeout,
        cachedState: metrics.fallbacksCachedState,
        rate: fallbackRate,
      },
      adapterPerformance: {
        tuyaTimeouts: metrics.tuyaTimeouts,
        weatherTimeouts: metrics.weatherTimeouts,
        circuitBreakerTrips: metrics.circuitBreakerTrips,
      },
      healthScore,
    };

    this.homeMetrics.set(deviceId, report);

    this.structuredLogger.log('Daily report generated', {
      deviceId,
      userId,
      homeProfileId,
      module: 'reporting',
      action: 'daily_report_generated',
      anomalyRate: anomalyRate.toFixed(2),
      fallbackRate: fallbackRate.toFixed(2),
      healthScore,
    });

    return report;
  }

  /**
   * Generate weekly report by aggregating daily reports
   */
  generateWeeklyReport(
    homeProfileId: number,
    userId: number,
    periodStartTime: Date,
    periodEndTime: Date,
    dailyReports: HomeReportMetrics[],
  ): {
    homeProfileId: number;
    userId: number;
    reportPeriod: { startTime: Date; endTime: Date };
    deviceCount: number;
    aggregatedMetrics: any;
    overallHealthScore: number;
    criticalDevices: number[];
    recommendedActions: string[];
  } {
    if (!dailyReports || dailyReports.length === 0) {
      return {
        homeProfileId,
        userId,
        reportPeriod: { startTime: periodStartTime, endTime: periodEndTime },
        deviceCount: 0,
        aggregatedMetrics: {},
        overallHealthScore: 100,
        criticalDevices: [],
        recommendedActions: [],
      };
    }

    // Aggregate metrics
    const totalAnomalies = dailyReports.reduce(
      (sum, r) => sum + r.anomalies.total,
      0,
    );
    const totalFallbacks = dailyReports.reduce(
      (sum, r) => sum + r.fallbacks.total,
      0,
    );
    const avgHealthScore =
      dailyReports.reduce((sum, r) => sum + r.healthScore, 0) /
      dailyReports.length;

    // Identify critical devices
    const criticalDevices = dailyReports
      .filter((r) => r.healthScore < 50)
      .map((r) => r.deviceId);

    // Generate recommendations
    const recommendations: string[] = [];
    if (totalAnomalies > dailyReports.length * 5) {
      recommendations.push(
        'High anomaly rate detected. Check thermostat calibration.',
      );
    }
    if (totalFallbacks > dailyReports.length * 3) {
      recommendations.push(
        'Fallback usage high. Verify sensor connectivity and API availability.',
      );
    }
    if (criticalDevices.length > 0) {
      recommendations.push(
        `${criticalDevices.length} devices require attention. Review logs for detailed diagnostics.`,
      );
    }

    const weeklyReport = {
      homeProfileId,
      userId,
      reportPeriod: { startTime: periodStartTime, endTime: periodEndTime },
      deviceCount: dailyReports.length,
      aggregatedMetrics: {
        totalAnomalies,
        totalFallbacks,
        avgAnomalyRate: (totalAnomalies / (dailyReports.length * 24)).toFixed(
          2,
        ),
        avgFallbackRate: (totalFallbacks / (dailyReports.length * 24)).toFixed(
          2,
        ),
      },
      overallHealthScore: avgHealthScore,
      criticalDevices,
      recommendedActions: recommendations,
    };

    this.structuredLogger.log('Weekly report generated', {
      userId,
      homeProfileId,
      module: 'reporting',
      action: 'weekly_report_generated',
      deviceCount: dailyReports.length,
      criticalCount: criticalDevices.length,
      overallHealthScore: avgHealthScore.toFixed(1),
    });

    return weeklyReport;
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 10): Alert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Clear alerts (can be called after sending to external system)
   */
  clearAlerts(): void {
    const alertCount = this.alerts.length;
    this.alerts = [];
    this.logger.debug(`Cleared ${alertCount} alerts`);
  }

  /**
   * Get health score summary for dashboard
   */
  getHealthSummary(): {
    totalDevices: number;
    averageHealthScore: number;
    criticalDevices: number;
    warningDevices: number;
  } {
    const reports = Array.from(this.homeMetrics.values());

    if (reports.length === 0) {
      return {
        totalDevices: 0,
        averageHealthScore: 100,
        criticalDevices: 0,
        warningDevices: 0,
      };
    }

    const averageHealthScore =
      reports.reduce((sum, r) => sum + r.healthScore, 0) / reports.length;
    const criticalDevices = reports.filter((r) => r.healthScore < 50).length;
    const warningDevices = reports.filter(
      (r) => r.healthScore >= 50 && r.healthScore < 75,
    ).length;

    return {
      totalDevices: reports.length,
      averageHealthScore,
      criticalDevices,
      warningDevices,
    };
  }

  /**
   * Export metrics for Prometheus/dashboard
   */
  exportMetrics(): string {
    let output = '# Reporting Service Metrics\n';
    output +=
      '# HELP reporting_home_health_score Health score for each home (0-100)\n';
    output += '# TYPE reporting_home_health_score gauge\n';

    for (const [deviceId, report] of this.homeMetrics.entries()) {
      output += `reporting_home_health_score{deviceId="${deviceId}",userId="${report.userId}"} ${report.healthScore}\n`;
    }

    output +=
      '# HELP reporting_anomaly_rate_per_hour Anomalies detected per hour\n';
    output += '# TYPE reporting_anomaly_rate_per_hour gauge\n';

    for (const [deviceId, report] of this.homeMetrics.entries()) {
      output += `reporting_anomaly_rate_per_hour{deviceId="${deviceId}"} ${report.anomalies.rate.toFixed(2)}\n`;
    }

    output +=
      '# HELP reporting_fallback_rate_per_hour Fallbacks used per hour\n';
    output += '# TYPE reporting_fallback_rate_per_hour gauge\n';

    for (const [deviceId, report] of this.homeMetrics.entries()) {
      output += `reporting_fallback_rate_per_hour{deviceId="${deviceId}"} ${report.fallbacks.rate.toFixed(2)}\n`;
    }

    output += '# HELP reporting_active_alerts Current active alerts\n';
    output += '# TYPE reporting_active_alerts gauge\n';
    output += `reporting_active_alerts{severity="critical"} ${this.alerts.filter((a) => a.severity === AlertSeverity.CRITICAL).length}\n`;
    output += `reporting_active_alerts{severity="warning"} ${this.alerts.filter((a) => a.severity === AlertSeverity.WARNING).length}\n`;
    output += `reporting_active_alerts{severity="info"} ${this.alerts.filter((a) => a.severity === AlertSeverity.INFO).length}\n`;

    return output;
  }
}
