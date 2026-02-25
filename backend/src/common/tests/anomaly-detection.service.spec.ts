import { Test, TestingModule } from '@nestjs/testing';
import {
  AnomalyDetectionService,
  AnomalyType,
} from '../anomaly-detection.service';
import { MetricsService } from '../metrics.service';

describe('AnomalyDetectionService', () => {
  let service: AnomalyDetectionService;
  let metricsService: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnomalyDetectionService,
        {
          provide: MetricsService,
          useValue: {
            incrementCounter: jest.fn(),
            exportPrometheus: jest.fn(() => ''),
          },
        },
      ],
    }).compile();

    service = module.get<AnomalyDetectionService>(AnomalyDetectionService);
    metricsService = module.get<MetricsService>(MetricsService);
  });

  describe('detectAnomalies', () => {
    it('should not detect anomaly with insufficient history (<3 cycles)', () => {
      const result = service.detectAnomalies(
        {
          currentDuration: 45,
          averageDuration: 40,
          standardDeviation: 5,
          historicalCount: 2,
          threshold: 2,
        },
        new Date(),
      );

      expect(result.isAnomaly).toBe(false);
      expect(result.types).toHaveLength(0);
    });

    it('should detect OVERSHOOT anomaly (duration > avg + 2σ)', () => {
      const result = service.detectAnomalies(
        {
          currentDuration: 100, // > 40 + 2*5 = 50
          averageDuration: 40,
          standardDeviation: 5,
          historicalCount: 10,
          threshold: 2,
        },
        new Date(),
      );

      expect(result.isAnomaly).toBe(true);
      expect(result.types).toContain(AnomalyType.OVERSHOOT);
      expect(metricsService.incrementCounter).toHaveBeenCalledWith(
        'anomaly_overshoot_total',
      );
    });

    it('should detect EARLY_STOP anomaly (duration < avg - 2σ)', () => {
      const result = service.detectAnomalies(
        {
          currentDuration: 20, // < 40 - 2*5 = 30
          averageDuration: 40,
          standardDeviation: 5,
          historicalCount: 10,
          threshold: 2,
        },
        new Date(),
        'CLOSED',
      );

      expect(result.isAnomaly).toBe(true);
      expect(result.types).toContain(AnomalyType.EARLY_STOP);
      expect(metricsService.incrementCounter).toHaveBeenCalledWith(
        'anomaly_early_stop_total',
      );
    });

    it('should detect PROLONGED_IDLE anomaly (duration > 120min)', () => {
      const result = service.detectAnomalies(
        {
          currentDuration: 150,
          averageDuration: 40,
          standardDeviation: 5,
          historicalCount: 10,
          threshold: 2,
        },
        new Date(),
      );

      expect(result.isAnomaly).toBe(true);
      expect(result.types).toContain(AnomalyType.PROLONGED_IDLE);
      expect(metricsService.incrementCounter).toHaveBeenCalledWith(
        'anomaly_prolonged_idle_total',
      );
    });

    it('should detect RAPID_CYCLING anomaly (duration < 5min)', () => {
      const result = service.detectAnomalies(
        {
          currentDuration: 3,
          averageDuration: 40,
          standardDeviation: 5,
          historicalCount: 10,
          threshold: 2,
        },
        new Date(),
        'CLOSED',
      );

      expect(result.isAnomaly).toBe(true);
      expect(result.types).toContain(AnomalyType.RAPID_CYCLING);
      expect(metricsService.incrementCounter).toHaveBeenCalledWith(
        'anomaly_rapid_cycling_total',
      );
    });

    it('should increment anomaly_detected_total counter when anomaly found', () => {
      service.detectAnomalies(
        {
          currentDuration: 100,
          averageDuration: 40,
          standardDeviation: 5,
          historicalCount: 10,
          threshold: 2,
        },
        new Date(),
      );

      expect(metricsService.incrementCounter).toHaveBeenCalledWith(
        'anomaly_detected_total',
      );
    });

    it('should return proposedEndTime based on averageDuration', () => {
      const startTime = new Date('2025-01-01T10:00:00Z');
      const result = service.detectAnomalies(
        {
          currentDuration: 100,
          averageDuration: 45,
          standardDeviation: 5,
          historicalCount: 10,
          threshold: 2,
        },
        startTime,
      );

      expect(result.proposedEndTime).toBeDefined();
      // Should be approximately startTime + 45 minutes
      const expectedTime = new Date(startTime.getTime() + 45 * 60000);
      expect(result.proposedEndTime!.getTime()).toBeCloseTo(
        expectedTime.getTime(),
        -3,
      );
    });
  });

  describe('calculateConfidence', () => {
    it('should return 0.0 for no anomalies', () => {
      const confidence = service.calculateConfidence([], 10);
      expect(confidence).toBe(0.0);
    });

    it('should weight rapid_cycling highest (0.85)', () => {
      const confidence = service.calculateConfidence(
        [AnomalyType.RAPID_CYCLING],
        10,
      );
      expect(confidence).toBeGreaterThan(0.8);
      expect(confidence).toBeLessThanOrEqual(0.85);
    });

    it('should weight overshoot high (0.8)', () => {
      const confidence = service.calculateConfidence([AnomalyType.OVERSHOOT], 10);
      expect(confidence).toBeGreaterThan(0.75);
      expect(confidence).toBeLessThanOrEqual(0.8);
    });

    it('should weight early_stop (0.75)', () => {
      const confidence = service.calculateConfidence(
        [AnomalyType.EARLY_STOP],
        10,
      );
      expect(confidence).toBeGreaterThan(0.7);
      expect(confidence).toBeLessThanOrEqual(0.75);
    });

    it('should weight prolonged_idle lowest (0.6)', () => {
      const confidence = service.calculateConfidence(
        [AnomalyType.PROLONGED_IDLE],
        10,
      );
      expect(confidence).toBeGreaterThan(0.55);
      expect(confidence).toBeLessThanOrEqual(0.6);
    });

    it('should boost confidence with more historical data', () => {
      const confidenceLow = service.calculateConfidence(
        [AnomalyType.OVERSHOOT],
        3,
      );
      const confidenceHigh = service.calculateConfidence(
        [AnomalyType.OVERSHOOT],
        100,
      );

      expect(confidenceHigh).toBeGreaterThan(confidenceLow);
    });

    it('should combine multiple anomaly types', () => {
      const confidence = service.calculateConfidence(
        [AnomalyType.OVERSHOOT, AnomalyType.RAPID_CYCLING],
        10,
      );

      // Should be higher than individual anomalies
      const singleConfidence = service.calculateConfidence(
        [AnomalyType.OVERSHOOT],
        10,
      );
      expect(confidence).toBeGreaterThan(singleConfidence);
    });
  });

  describe('logAnomalyDetection', () => {
    it('should call structuredLogger.log with correct parameters', () => {
      const loggerSpy = jest
        .spyOn((service as any).structuredLogger, 'log')
        .mockImplementation(() => undefined);

      const result = {
        isAnomaly: true,
        types: [AnomalyType.OVERSHOOT],
        confidence: 0.85,
        reason: 'Duration exceeds average by 2 standard deviations',
        proposedEndTime: new Date(),
      };

      const context = {
        currentDuration: 100,
        averageDuration: 40,
        standardDeviation: 5,
        historicalCount: 10,
        threshold: 2,
      };

      service.logAnomalyDetection(1, 2, 3, result, context);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Anomaly Detection',
        expect.objectContaining({
          eventId: 1,
          deviceId: 2,
          userId: 3,
          anomalyTypes: result.types,
          confidence: result.confidence,
        }),
      );
    });

    it('should include context details in log', () => {
      const loggerSpy = jest
        .spyOn((service as any).structuredLogger, 'log')
        .mockImplementation(() => undefined);

      const result = {
        isAnomaly: true,
        types: [AnomalyType.OVERSHOOT],
        confidence: 0.85,
        reason: 'Duration exceeds average by 2 standard deviations',
        proposedEndTime: new Date(),
      };

      const context = {
        currentDuration: 100,
        averageDuration: 40,
        standardDeviation: 5,
        historicalCount: 10,
        threshold: 2,
      };

      service.logAnomalyDetection(1, 2, 3, result, context);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          currentDuration: context.currentDuration,
          averageDuration: context.averageDuration,
          standardDeviation: context.standardDeviation,
        }),
      );
    });
  });
});
