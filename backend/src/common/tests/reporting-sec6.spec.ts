import { Logger } from '@nestjs/common';
import { MetricsService } from '../metrics.service';
import { ReportingService } from '../reporting.service';

/**
 * SEC-6 — aggregate Prometheus export and minimized reporting logs.
 * Internal report/alert objects may still carry IDs; the external text export
 * and log messages must not.
 */
describe('SEC-6: reporting privacy and worst-case aggregates', () => {
  let service: ReportingService;
  let logs: string[];
  let logSpy: jest.SpyInstance;

  const start = new Date('2026-01-01T00:00:00Z');
  const end = new Date('2026-01-02T00:00:00Z');
  const base = {
    anomaliesTotal: 120,
    anomaliesOvershoot: 120,
    anomaliesEarlyStop: 0,
    anomaliesProlongedIdle: 0,
    anomaliesRapidCycling: 0,
    fallbacksTotal: 72,
    fallbacksSensorFailure: 72,
    fallbacksAdapterTimeout: 0,
    fallbacksCachedState: 0,
    tuyaTimeouts: 20,
    weatherTimeouts: 0,
    circuitBreakerTrips: 6,
  };

  beforeEach(() => {
    service = new ReportingService(new MetricsService());
    logs = [];
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation((message: unknown) => {
        logs.push(String(message));
      });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  function seedTwoHomes(): void {
    service.generateDailyReport(731001, 931002, 831003, start, end, base);
    service.generateDailyReport(731004, 931005, 831006, start, end, {
      ...base,
      anomaliesTotal: 0,
      fallbacksTotal: 0,
      tuyaTimeouts: 0,
      circuitBreakerTrips: 0,
    });
  }

  it('exports worst-case aggregates without ID labels', () => {
    seedTwoHomes();
    const text = service.exportMetrics();

    expect(text).toContain('reporting_home_health_score 46');
    expect(text).toContain('reporting_anomaly_rate_per_hour 5.00');
    expect(text).toContain('reporting_fallback_rate_per_hour 3.00');
    expect(text).not.toMatch(/deviceId=|userId=|homeProfileId=/);
    expect(text).not.toContain('731001');
    expect(text).not.toContain('931002');
    expect(text).not.toContain('831003');
  });

  it('keeps active alert counts by severity and omits home gauges when empty', () => {
    service.checkAlertConditions(731001, 931002, 831003, {
      anomaliesPerHour: 6,
      fallbacksPerHour: 4,
    });
    const text = service.exportMetrics();
    expect(text).toContain('reporting_active_alerts{severity="critical"} 1');
    expect(text).toContain('reporting_active_alerts{severity="warning"} 1');
    expect(text).not.toContain('reporting_home_health_score');
    expect(text).not.toMatch(/deviceId=|userId=/);
  });

  it('does not write raw IDs to reporting logs or alert text', () => {
    seedTwoHomes();
    service.recordAnomaly(731001, 931002, 831003, 'OVERSHOOT', 0.8);
    service.recordFallback(731001, 931002, 831003, 'CACHED_STATE', 'timeout');
    service.checkAlertConditions(731001, 931002, 831003, {
      anomaliesPerHour: 6,
      fallbacksPerHour: 4,
      recentTimeouts: 11,
      circuitBreakerTrips: 6,
    });
    service.generateWeeklyReport(831003, 931002, start, end, [
      service.generateDailyReport(731001, 931002, 831003, start, end, base),
    ]);

    const joined = logs.join('\n');
    expect(joined).not.toContain('731001');
    expect(joined).not.toContain('931002');
    expect(joined).not.toContain('831003');
    expect(joined).not.toMatch(/\[deviceId=|\[userId=/);

    const alerts = service.getRecentAlerts();
    expect(alerts.length).toBeGreaterThan(0);
    // Internal objects still carry IDs for existing callers.
    expect(alerts[0].deviceId).toBe(731001);
    expect(alerts[0].userId).toBe(931002);
    for (const alert of alerts) {
      expect(alert.message).not.toContain('731001');
      expect(alert.title).not.toContain('731001');
    }
  });
});
