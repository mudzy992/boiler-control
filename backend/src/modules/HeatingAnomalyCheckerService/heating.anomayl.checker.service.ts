// src/modules/HeatingAnomalyChecker/heating.anomaly.checker.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../Notification/notifications.service';
import { subDays } from 'date-fns';
import { HeatingRecommendationService } from '../HeatingRecommendation/heating.recommendation.service';
import { StructuredLogger } from '../../common/structured-logger';
import { AnomalyDetectionService } from '../../common/anomaly-detection.service';
import { FallbackStrategyService } from '../../common/fallback-strategy.service';
import { MetricsService } from '../../common/metrics.service';
import { ReportingService } from '../../common/reporting.service';
import { CorrelationIdService } from '../../common/correlation-id.service';
import { NotificationType } from '../../generated/prisma';

type HeatingEventWithThermostat = {
  id: number;
  timestampStart: Date;
  timestampEnd: Date | null;
  isAnomaly: boolean;
  proposedEndTime?: Date;
  thermostat: {
    id: number;
    userId: number;
    homeProfileId: number;
  };
};

@Injectable()
export class HeatingAnomalyCheckerService {
  private readonly logger = new Logger(HeatingAnomalyCheckerService.name);
  private readonly structuredLogger = new StructuredLogger(
    HeatingAnomalyCheckerService.name,
  );

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private heatingRecommendation: HeatingRecommendationService,
    private anomalyDetection: AnomalyDetectionService,
    private fallbackStrategy: FallbackStrategyService,
    private metrics: MetricsService,
    private reporting: ReportingService,
    private correlationId: CorrelationIdService,
  ) {}

  /** Cron koji prolazi kroz otvorene intervale svakih 5 minuta */
  // Disabled during tests to avoid background DB activity
  @Cron('*/5 * * * *', {
    disabled:
      process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development',
  })
  async checkOpenIntervals() {
    try {
      const openEvents = await this.prisma.heatingEvent.findMany({
        where: { timestampEnd: null, isAnomaly: false },
        include: { thermostat: true },
      });

      for (const event of openEvents as HeatingEventWithThermostat[]) {
        await this.checkEvent(event, 'OPEN');
      }
    } catch (error) {
      this.logger.error('Error in checkOpenIntervals', error);
      this.metrics.incrementCounter('db_errors_total');
    }
  }

  @Cron('*/5 * * * *', {
    name: 'check-recently-closed',
    disabled:
      process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development',
  })
  async checkRecentlyClosedIntervals() {
    try {
      const recentEvents = await this.prisma.heatingEvent.findMany({
        where: {
          isAnomaly: false,
          timestampEnd: {
            not: null,
            gte: subDays(new Date(), 1), // Check last 24h, can be tuned
          },
          anomalyCheckedAt: null,
        },
        include: { thermostat: true },
      });

      for (const event of recentEvents as HeatingEventWithThermostat[]) {
        await this.checkEvent(event, 'CLOSED');
        // Mark as checked
        await this.prisma.heatingEvent.updateMany({
          where: { id: event.id, anomalyCheckedAt: null },
          data: { anomalyCheckedAt: new Date() },
        });
      }
    } catch (error) {
      this.logger.error('Error in checkRecentlyClosedIntervals', error);
      this.metrics.incrementCounter('db_errors_total');
    }
  }

  /** Provjera pojedinačnog eventa */
  private async checkEvent(
    event: HeatingEventWithThermostat,
    phase: 'OPEN' | 'CLOSED',
  ) {
    try {
      const intervalKey = this.getIntervalKey(event.timestampStart);

      const historyAll = await this.prisma.heatingEvent.findMany({
        where: {
          thermostat: {
            homeProfileId: event.thermostat.homeProfileId,
          },
          timestampEnd: { not: null },
          timestampStart: { gte: subDays(new Date(), 14) },
        },
      });

      // filtriraj po intervalKey u kodu
      const history = historyAll.filter(
        (h) => this.getIntervalKey(h.timestampStart) === intervalKey,
      );

      if (!history.length) return;

      const durations = history.map(
        (h) => (h.timestampEnd!.getTime() - h.timestampStart.getTime()) / 60000,
      );
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const stdDev = Math.sqrt(
        durations.map((d) => Math.pow(d - avg, 2)).reduce((a, b) => a + b, 0) /
          durations.length,
      );

      if (!stdDev && durations.length < 3) return;

      const currentDuration =
        phase === 'CLOSED' && event.timestampEnd
          ? (event.timestampEnd.getTime() - event.timestampStart.getTime()) /
            60000
          : (Date.now() - event.timestampStart.getTime()) / 60000;

      // Use enhanced anomaly detection with multi-factor analysis
      const anomalyResult = this.anomalyDetection.detectAnomalies(
        {
          currentDuration,
          averageDuration: avg,
          standardDeviation: stdDev,
          historicalCount: history.length,
          threshold: 2,
        },
        event.timestampStart,
        phase,
      );

      // If anomaly detected, update and notify
      if (anomalyResult.isAnomaly) {
        const proposedEndTime =
          phase === 'OPEN'
            ? anomalyResult.proposedEndTime ||
              new Date(event.timestampStart.getTime() + avg * 60000)
            : null;

        // Use tolerant update (updateMany instead of update) to handle concurrent updates
        await this.prisma.heatingEvent.updateMany({
          where: { id: event.id },
          data: {
            isAnomaly: true,
            proposedEndTime,
            anomalyCheckedAt: phase === 'CLOSED' ? new Date() : null,
          },
        });

        // Record anomaly in reporting service (positional args expected)
        this.reporting.recordAnomaly(
          event.thermostat.id,
          event.thermostat.userId,
          event.thermostat.homeProfileId,
          anomalyResult.types[0] ?? 'unknown',
          anomalyResult.confidence ?? 0,
        );

        // Log anomaly detection with structured telemetry
        this.anomalyDetection.logAnomalyDetection(
          event.id,
          event.thermostat.id,
          event.thermostat.userId,
          anomalyResult,
          {
            currentDuration,
            averageDuration: avg,
            standardDeviation: stdDev,
            historicalCount: history.length,
            threshold: 2,
          },
        );

        // Notifikacija korisniku
        const anomalyTypesStr = anomalyResult.types.join(', ');
        await this.notifications.notifyUser({
          userId: event.thermostat.userId,
          type: NotificationType.SYSTEM_ALERT,
          title: 'Detektovana anomalija grijanja',
          message: `Interval ${intervalKey} - anomalija: ${anomalyTypesStr}. Trajanje: ${currentDuration.toFixed(
            0,
          )}min, prosjek: ${avg.toFixed(
            0,
          )}min. Molimo provjerite stanje grijanja.`,
          data: {
            type: 'SYSTEM_ALERT',
            intervalKey,
            proposedEndTime,
            anomalyTypes: anomalyResult.types,
            confidence: anomalyResult.confidence,
          },
        });

        this.structuredLogger.log('Anomaly notification sent', {
          deviceId: event.thermostat.id,
          userId: event.thermostat.userId,
          eventId: event.id,
          module: 'anomaly-checker',
          action: 'anomaly_notification_sent',
          anomalyTypes: anomalyResult.types,
        });
      }
    } catch (error) {
      this.logger.error(`Error checking event ${event.id}`, error);
      this.metrics.incrementCounter('db_errors_total');
    }
  }

  /** Vrati sve otvorene anomalije za kontroler */
  async getOpenAnomalies(userId?: number) {
    try {
      return await this.prisma.heatingEvent.findMany({
        where: {
          isAnomaly: true,
          timestampEnd: null,
          ...(userId ? { thermostat: { userId } } : {}),
        },
        include: { thermostat: true },
      });
    } catch (error) {
      this.logger.error('Error fetching open anomalies', error);
      this.metrics.incrementCounter('db_errors_total');
      return [];
    }
  }

  /** Potvrda ili izmjena anomalije */
  async confirmOrUpdateAnomaly(
    eventId: number,
    dto: { proposedEndTime?: Date; confirm?: boolean },
  ) {
    try {
      const event = await this.prisma.heatingEvent.findUnique({
        where: { id: eventId },
        include: { thermostat: true },
      });

      if (!event) {
        return { success: false, error: 'Event not found' };
      }

      const boiler = await this.prisma.boilerHistory.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      let endTime = event.proposedEndTime ?? new Date();
      if (dto.proposedEndTime) endTime = dto.proposedEndTime;
      if (dto.confirm && !dto.proposedEndTime)
        endTime = event.proposedEndTime ?? new Date();

      // Use tolerant update with updateMany
      const result = await this.prisma.heatingEvent.updateMany({
        where: { id: eventId, isAnomaly: true },
        data: {
          timestampEnd: endTime,
          isAnomaly: false,
          proposedEndTime: null,
        },
      });

      if (result.count === 0) {
        return { success: false, error: 'Event not found or already updated' };
      }

      // Pozovi recommendation da izračuna na temelju stvarnog završetka
      if (event.roomCurrentTemp && event.roomTargetTemp) {
        await this.heatingRecommendation.processHeatingEvent({
          userId: event.thermostat.userId,
          deviceId: event.thermostat.id,
          timestampStart: event.timestampStart,
          timestampEnd: endTime,
          roomCurrentTemp: event.roomCurrentTemp,
          roomTargetTemp: event.roomTargetTemp,
          boilerFlowTemp: boiler?.suggestedFlowTemp || 0,
        });
      }

      this.structuredLogger.log('Anomaly confirmed', {
        deviceId: event.thermostat.id,
        userId: event.thermostat.userId,
        eventId,
        module: 'anomaly-checker',
        action: 'anomaly_confirmed',
        endTime,
      });

      return { success: true, eventId, timestampEnd: endTime };
    } catch (error) {
      this.logger.error(`Error confirming anomaly ${eventId}`, error);
      this.metrics.incrementCounter('db_errors_total');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /** Interval key helper */
  private getIntervalKey(timestamp: Date): string {
    const hour = timestamp.getHours();
    const weekday = timestamp.getDay();
    let part = 'night';
    if (hour >= 6 && hour < 9) part = 'morning';
    else if (hour >= 9 && hour < 12) part = 'late_morning';
    else if (hour >= 12 && hour < 17) part = 'afternoon';
    else if (hour >= 17 && hour < 22) part = 'evening';

    const dayType = weekday === 0 || weekday === 6 ? 'weekend' : 'weekday';
    return `${dayType}_${part}`;
  }
}
