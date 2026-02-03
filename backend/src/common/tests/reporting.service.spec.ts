import { Test, TestingModule } from '@nestjs/testing';
import {
  ReportingService,
  AlertSeverity,
  HomeReportMetrics,
} from '../reporting.service';
import { MetricsService } from '../metrics.service';
import { StructuredLogger } from '../structured-logger';

describe('ReportingService', () => {
  let service: ReportingService;
  let metricsService: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportingService,
        {
          provide: MetricsService,
          useValue: {
            incrementCounter: jest.fn(),
            exportPrometheus: jest.fn(() => ''),
          },
        },
        {
          provide: StructuredLogger,
          useValue: {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReportingService>(ReportingService);
    metricsService = module.get<MetricsService>(MetricsService);
  });

  describe('recordAnomaly', () => {
    it('should record anomaly for reporting', () => {
      service.recordAnomaly(1, 100, 200, 'OVERSHOOT', 0.85);

      // Should complete without error
      expect(service).toBeDefined();
    });
  });

  describe('recordFallback', () => {
    it('should record fallback for reporting', () => {
      service.recordFallback(1, 100, 200, 'CACHED_STATE', 'adapter_timeout');

      // Should complete without error
      expect(service).toBeDefined();
    });
  });

  describe('checkAlertConditions', () => {
    it('should create alert for high anomaly rate (>5/hour)', () => {
      const result = service.checkAlertConditions(1, 100, 200, {
        anomaliesPerHour: 6,
      });

      expect(result).toBe(true);
    });

    it('should create alert for high fallback rate (>3/hour)', () => {
      const result = service.checkAlertConditions(1, 100, 200, {
        fallbacksPerHour: 4,
      });

      expect(result).toBe(true);
    });

    it('should create alert for repeated timeouts (>10)', () => {
      const result = service.checkAlertConditions(1, 100, 200, {
        recentTimeouts: 11,
      });

      expect(result).toBe(true);
    });

    it('should create alert for circuit breaker trips (>5)', () => {
      const result = service.checkAlertConditions(1, 100, 200, {
        circuitBreakerTrips: 6,
      });

      expect(result).toBe(true);
    });

    it('should return false when no alert conditions met', () => {
      const result = service.checkAlertConditions(1, 100, 200, {
        anomaliesPerHour: 2,
        fallbacksPerHour: 1,
        recentTimeouts: 3,
        circuitBreakerTrips: 1,
      });

      expect(result).toBe(false);
    });
  });

  describe('generateDailyReport', () => {
    it('should generate daily report with correct metrics', () => {
      const startTime = new Date('2025-02-02T00:00:00Z');
      const endTime = new Date('2025-02-03T00:00:00Z'); // 24 hours

      const report = service.generateDailyReport(
        1,
        100,
        200,
        startTime,
        endTime,
        {
          anomaliesTotal: 10,
          anomaliesOvershoot: 5,
          anomaliesEarlyStop: 3,
          anomaliesProlongedIdle: 1,
          anomaliesRapidCycling: 1,
          fallbacksTotal: 5,
          fallbacksSensorFailure: 1,
          fallbacksAdapterTimeout: 2,
          fallbacksCachedState: 2,
          tuyaTimeouts: 3,
          weatherTimeouts: 1,
          circuitBreakerTrips: 0,
        },
      );

      expect(report.deviceId).toBe(1);
      expect(report.userId).toBe(100);
      expect(report.homeProfileId).toBe(200);
      expect(report.anomalies.total).toBe(10);
      expect(report.anomalies.rate).toBeCloseTo(10 / 24, 1); // 10 anomalies in 24 hours
      expect(report.fallbacks.total).toBe(5);
      expect(report.healthScore).toBeLessThan(100);
    });

    it('should calculate health score correctly', () => {
      const startTime = new Date('2025-02-02T00:00:00Z');
      const endTime = new Date('2025-02-03T00:00:00Z');

      // Perfect report (no issues)
      const perfectReport = service.generateDailyReport(
        1,
        100,
        200,
        startTime,
        endTime,
        {
          anomaliesTotal: 0,
          anomaliesOvershoot: 0,
          anomaliesEarlyStop: 0,
          anomaliesProlongedIdle: 0,
          anomaliesRapidCycling: 0,
          fallbacksTotal: 0,
          fallbacksSensorFailure: 0,
          fallbacksAdapterTimeout: 0,
          fallbacksCachedState: 0,
          tuyaTimeouts: 0,
          weatherTimeouts: 0,
          circuitBreakerTrips: 0,
        },
      );

      expect(perfectReport.healthScore).toBe(100);

      // Critical report (many issues)
      const criticalReport = service.generateDailyReport(
        1,
        100,
        200,
        startTime,
        endTime,
        {
          anomaliesTotal: 50,
          anomaliesOvershoot: 20,
          anomaliesEarlyStop: 15,
          anomaliesProlongedIdle: 10,
          anomaliesRapidCycling: 5,
          fallbacksTotal: 30,
          fallbacksSensorFailure: 10,
          fallbacksAdapterTimeout: 10,
          fallbacksCachedState: 10,
          tuyaTimeouts: 20,
          weatherTimeouts: 10,
          circuitBreakerTrips: 10,
        },
      );

      expect(criticalReport.healthScore).toBeLessThan(50);
    });
  });

  describe('generateWeeklyReport', () => {
    it('should generate weekly report from daily reports', () => {
      const startTime = new Date('2025-01-27T00:00:00Z');
      const endTime = new Date('2025-02-03T00:00:00Z');

      // Create 3 daily reports
      const dailyReports: HomeReportMetrics[] = [
        {
          deviceId: 1,
          userId: 100,
          homeProfileId: 200,
          reportPeriod: { startTime, endTime },
          anomalies: {
            total: 10,
            overshoot: 5,
            earlyStop: 3,
            prolongedIdle: 1,
            rapidCycling: 1,
            rate: 10 / 24,
          },
          fallbacks: {
            total: 5,
            sensorFailure: 1,
            adapterTimeout: 2,
            cachedState: 2,
            rate: 5 / 24,
          },
          adapterPerformance: {
            tuyaTimeouts: 3,
            weatherTimeouts: 1,
            circuitBreakerTrips: 0,
          },
          healthScore: 85,
        },
        {
          deviceId: 2,
          userId: 100,
          homeProfileId: 200,
          reportPeriod: { startTime, endTime },
          anomalies: {
            total: 5,
            overshoot: 2,
            earlyStop: 2,
            prolongedIdle: 1,
            rapidCycling: 0,
            rate: 5 / 24,
          },
          fallbacks: {
            total: 3,
            sensorFailure: 0,
            adapterTimeout: 2,
            cachedState: 1,
            rate: 3 / 24,
          },
          adapterPerformance: {
            tuyaTimeouts: 2,
            weatherTimeouts: 0,
            circuitBreakerTrips: 0,
          },
          healthScore: 90,
        },
        {
          deviceId: 3,
          userId: 100,
          homeProfileId: 200,
          reportPeriod: { startTime, endTime },
          anomalies: {
            total: 20,
            overshoot: 10,
            earlyStop: 8,
            prolongedIdle: 1,
            rapidCycling: 1,
            rate: 20 / 24,
          },
          fallbacks: {
            total: 15,
            sensorFailure: 5,
            adapterTimeout: 5,
            cachedState: 5,
            rate: 15 / 24,
          },
          adapterPerformance: {
            tuyaTimeouts: 10,
            weatherTimeouts: 5,
            circuitBreakerTrips: 2,
          },
          healthScore: 45,
        },
      ];

      const weeklyReport = service.generateWeeklyReport(
        200,
        100,
        startTime,
        endTime,
        dailyReports,
      );

      expect(weeklyReport.homeProfileId).toBe(200);
      expect(weeklyReport.userId).toBe(100);
      expect(weeklyReport.deviceCount).toBe(3);
      expect(weeklyReport.aggregatedMetrics.totalAnomalies).toBe(35); // 10+5+20
      expect(weeklyReport.aggregatedMetrics.totalFallbacks).toBe(23); // 5+3+15
      expect(weeklyReport.criticalDevices).toContain(3); // Health score 45 < 50
      expect(weeklyReport.recommendedActions.length).toBeGreaterThan(0);
    });

    it('should handle empty daily reports', () => {
      const startTime = new Date('2025-01-27T00:00:00Z');
      const endTime = new Date('2025-02-03T00:00:00Z');

      const weeklyReport = service.generateWeeklyReport(
        200,
        100,
        startTime,
        endTime,
        [],
      );

      expect(weeklyReport.deviceCount).toBe(0);
      expect(weeklyReport.overallHealthScore).toBe(100);
      expect(weeklyReport.criticalDevices).toHaveLength(0);
    });
  });

  describe('getRecentAlerts', () => {
    it('should return recent alerts in order', () => {
      service.checkAlertConditions(1, 100, 200, { anomaliesPerHour: 6 });
      service.checkAlertConditions(2, 100, 200, { fallbacksPerHour: 4 });

      const recentAlerts = service.getRecentAlerts(10);

      expect(recentAlerts.length).toBeGreaterThanOrEqual(2);
      expect(recentAlerts[0].severity).toBeDefined();
    });
  });

  describe('clearAlerts', () => {
    it('should clear all alerts', () => {
      service.checkAlertConditions(1, 100, 200, { anomaliesPerHour: 6 });
      service.checkAlertConditions(2, 100, 200, { fallbacksPerHour: 4 });

      let alerts = service.getRecentAlerts();
      expect(alerts.length).toBeGreaterThan(0);

      service.clearAlerts();

      alerts = service.getRecentAlerts();
      expect(alerts).toHaveLength(0);
    });
  });

  describe('getHealthSummary', () => {
    it('should return health summary', () => {
      service.generateDailyReport(
        1,
        100,
        200,
        new Date(),
        new Date(Date.now() + 86400000),
        {
          anomaliesTotal: 10,
          anomaliesOvershoot: 5,
          anomaliesEarlyStop: 3,
          anomaliesProlongedIdle: 1,
          anomaliesRapidCycling: 1,
          fallbacksTotal: 5,
          fallbacksSensorFailure: 1,
          fallbacksAdapterTimeout: 2,
          fallbacksCachedState: 2,
          tuyaTimeouts: 3,
          weatherTimeouts: 1,
          circuitBreakerTrips: 0,
        },
      );

      const summary = service.getHealthSummary();

      expect(summary.totalDevices).toBe(1);
      expect(summary.averageHealthScore).toBeLessThan(100);
      expect(summary.criticalDevices).toBeGreaterThanOrEqual(0);
    });

    it('should return default summary when no reports', () => {
      const summary = service.getHealthSummary();

      expect(summary.totalDevices).toBe(0);
      expect(summary.averageHealthScore).toBe(100);
      expect(summary.criticalDevices).toBe(0);
    });
  });

  describe('exportMetrics', () => {
    it('should export Prometheus format metrics', () => {
      service.generateDailyReport(
        1,
        100,
        200,
        new Date(),
        new Date(Date.now() + 86400000),
        {
          anomaliesTotal: 10,
          anomaliesOvershoot: 5,
          anomaliesEarlyStop: 3,
          anomaliesProlongedIdle: 1,
          anomaliesRapidCycling: 1,
          fallbacksTotal: 5,
          fallbacksSensorFailure: 1,
          fallbacksAdapterTimeout: 2,
          fallbacksCachedState: 2,
          tuyaTimeouts: 3,
          weatherTimeouts: 1,
          circuitBreakerTrips: 0,
        },
      );

      const metrics = service.exportMetrics();

      expect(metrics).toContain('reporting_home_health_score');
      expect(metrics).toContain('reporting_anomaly_rate_per_hour');
      expect(metrics).toContain('reporting_fallback_rate_per_hour');
      expect(metrics).toContain('reporting_active_alerts');
    });
  });
});
