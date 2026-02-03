// src/common/anomaly-detection.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { StructuredLogger } from './structured-logger';

/**
 * Anomaly types for structured categorization
 */
export enum AnomalyType {
  OVERSHOOT = 'overshoot', // Duration > avg + 2σ
  EARLY_STOP = 'early_stop', // Duration < avg - 2σ
  PROLONGED_IDLE = 'prolonged_idle', // Duration > 120 minutes
  RAPID_CYCLING = 'rapid_cycling', // Duration < 5 minutes
}

/**
 * Anomaly detection context with statistical data
 */
export interface AnomalyContext {
  currentDuration: number; // minutes
  averageDuration: number; // minutes
  standardDeviation: number; // minutes
  historicalCount: number; // number of historical cycles
  threshold: number; // σ multiplier (default: 2)
}

/**
 * Anomaly detection result
 */
export interface AnomalyResult {
  isAnomaly: boolean;
  types: AnomalyType[];
  confidence: number; // 0.0 - 1.0
  reason?: string;
  proposedEndTime?: Date;
}

@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);
  private readonly structuredLogger = new StructuredLogger(
    AnomalyDetectionService.name,
  );

  constructor(private metricsService: MetricsService) {}

  /**
   * Detect anomalies in heating cycle
   * Uses multi-factor detection: overshoot, early stop, prolonged idle, rapid cycling
   */
  detectAnomalies(context: AnomalyContext, startTime: Date): AnomalyResult {
    const anomalies: AnomalyType[] = [];
    let confidence = 0;

    // Ensure minimum historical data for detection
    if (context.historicalCount < 3) {
      return {
        isAnomaly: false,
        types: [],
        confidence: 0,
        reason: 'Insufficient historical data for anomaly detection',
      };
    }

    // Check for overshoot: current duration > average + 2σ
    if (
      context.currentDuration >
      context.averageDuration + context.threshold * context.standardDeviation
    ) {
      anomalies.push(AnomalyType.OVERSHOOT);
      confidence = Math.min(
        1.0,
        0.8 + (context.standardDeviation > 0 ? 0.1 : 0),
      );
    }

    // Check for early stop: current duration < average - 2σ
    if (
      context.currentDuration <
        context.averageDuration -
          context.threshold * context.standardDeviation &&
      context.standardDeviation > 0
    ) {
      anomalies.push(AnomalyType.EARLY_STOP);
      confidence = Math.min(
        1.0,
        0.75 + (context.standardDeviation > 0 ? 0.15 : 0),
      );
    }

    // Check for prolonged idle: > 120 minutes
    if (context.currentDuration > 120) {
      anomalies.push(AnomalyType.PROLONGED_IDLE);
      confidence = Math.min(1.0, confidence + 0.2);
    }

    // Check for rapid cycling: < 5 minutes
    if (context.currentDuration < 5) {
      anomalies.push(AnomalyType.RAPID_CYCLING);
      confidence = Math.min(1.0, confidence + 0.25);
    }

    // Calculate proposed end time based on average
    let proposedEndTime: Date | undefined;
    if (anomalies.length > 0) {
      proposedEndTime = new Date(
        startTime.getTime() + context.averageDuration * 60000,
      );
    }

    const isAnomaly = anomalies.length > 0;

    if (isAnomaly) {
      // Record metrics for each anomaly type
      this.metricsService.incrementCounter('anomaly_detected_total');
      for (const type of anomalies) {
        switch (type) {
          case AnomalyType.OVERSHOOT:
            this.metricsService.incrementCounter('anomaly_overshoot_total');
            break;
          case AnomalyType.EARLY_STOP:
            this.metricsService.incrementCounter('anomaly_early_stop_total');
            break;
          case AnomalyType.PROLONGED_IDLE:
            this.metricsService.incrementCounter(
              'anomaly_prolonged_idle_total',
            );
            break;
          case AnomalyType.RAPID_CYCLING:
            this.metricsService.incrementCounter('anomaly_rapid_cycling_total');
            break;
        }
      }
    }

    return {
      isAnomaly,
      types: anomalies,
      confidence,
      reason: isAnomaly
        ? `Detected ${anomalies.join(', ')} (confidence: ${(confidence * 100).toFixed(0)}%)`
        : undefined,
      proposedEndTime,
    };
  }

  /**
   * Calculate anomaly confidence score (0.0 - 1.0)
   * Higher score = more likely to be an anomaly
   */
  calculateConfidence(types: AnomalyType[], historicalCount: number): number {
    let score = 0;
    const typeWeights: Record<AnomalyType, number> = {
      [AnomalyType.OVERSHOOT]: 0.8,
      [AnomalyType.EARLY_STOP]: 0.75,
      [AnomalyType.PROLONGED_IDLE]: 0.6,
      [AnomalyType.RAPID_CYCLING]: 0.85,
    };

    // Average weights of detected anomalies
    if (types.length > 0) {
      score =
        types.reduce((sum, type) => sum + typeWeights[type], 0) / types.length;
    }

    // Boost confidence if we have good historical data
    const dataQualityBoost = Math.min(0.1, historicalCount / 50);
    score = Math.min(1.0, score + dataQualityBoost);

    return score;
  }

  /**
   * Log anomaly detection event with structured telemetry
   */
  logAnomalyDetection(
    eventId: number,
    deviceId: number,
    userId: number,
    result: AnomalyResult,
    context: AnomalyContext,
  ): void {
    this.structuredLogger.log('Anomaly detected', {
      eventId,
      deviceId,
      userId,
      module: 'anomaly-detection',
      action: 'anomaly_detected',
      anomalyTypes: result.types.join(','),
      confidence: result.confidence,
      currentDuration: context.currentDuration,
      averageDuration: context.averageDuration,
      standardDeviation: context.standardDeviation,
      reason: result.reason,
    });

    this.logger.warn(
      `[Anomaly] Event ${eventId} | types=${result.types.join(
        ',',
      )} | duration=${context.currentDuration.toFixed(
        1,
      )}min | avg=${context.averageDuration.toFixed(1)}min | confidence=${(
        result.confidence * 100
      ).toFixed(0)}%`,
    );
  }
}
