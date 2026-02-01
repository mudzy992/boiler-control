// src/modules/HeatingAnomalyChecker/heating.anomaly.checker.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../Notification/notifications.service';
import { subDays } from 'date-fns';
import { NotificationType } from '../../generated/prisma/enums';
import { HeatingRecommendationService } from '../HeatingRecommendation/heating.recommendation.service';

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

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private heatingRecommendation: HeatingRecommendationService,
  ) {}

  /** Cron koji prolazi kroz otvorene intervale svakih 5 minuta */
  @Cron('*/5 * * * *')
  async checkOpenIntervals() {
    const openEvents = await this.prisma.heatingEvent.findMany({
      where: { timestampEnd: null, isAnomaly: false },
      include: { thermostat: true },
    });

    for (const event of openEvents as HeatingEventWithThermostat[]) {
      await this.checkEvent(event);
    }
  }

  /** Provjera pojedinačnog eventa */
  private async checkEvent(event: HeatingEventWithThermostat) {
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

    if (!stdDev) return;

    const currentDuration =
      (Date.now() - event.timestampStart.getTime()) / 60000;

    // Detekcija anomalije
    if (
      currentDuration > avg + 2 * stdDev ||
      currentDuration < avg - 2 * stdDev
    ) {
      const proposedEndTime = new Date(
        event.timestampStart.getTime() + avg * 60000,
      );

      await this.prisma.heatingEvent.updateMany({
        where: { id: event.id },
        data: {
          isAnomaly: true,
          proposedEndTime,
        },
      });

      // Notifikacija korisniku
      await this.notifications.notifyUser({
        userId: event.thermostat.userId,
        type: NotificationType.SYSTEM_ALERT,
        title: 'Detektovana anomalija grijanja',
        message: `Interval ${intervalKey} traje ${currentDuration.toFixed(
          0,
        )} min, prosjek je ${avg.toFixed(
          0,
        )} min. Molimo provjerite i potvrdite završetak.`,
        data: { type: 'SYSTEM_ALERT', intervalKey, proposedEndTime },
      });

      this.logger.warn(
        `[Anomaly] Event ${event.id} | duration=${currentDuration.toFixed(
          0,
        )}min | avg=${avg.toFixed(0)}min`,
      );
    }
  }

  /** Vrati sve otvorene anomalije za kontroler */
  async getOpenAnomalies() {
    return this.prisma.heatingEvent.findMany({
      where: { isAnomaly: true, timestampEnd: null },
      include: { thermostat: true },
    });
  }

  /** Potvrda ili izmjena anomalije */
  async confirmOrUpdateAnomaly(
    eventId: number,
    dto: { proposedEndTime?: Date; confirm?: boolean },
  ) {
    const event = await this.prisma.heatingEvent.findUnique({
      where: { id: eventId },
      include: { thermostat: true },
    });

    const boiler = await this.prisma.boilerHistory.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    if (!event) return { success: false };

    let endTime = event.proposedEndTime ?? new Date();
    if (dto.proposedEndTime) endTime = dto.proposedEndTime;
    if (dto.confirm && !dto.proposedEndTime)
      endTime = event.proposedEndTime ?? new Date();

    await this.prisma.heatingEvent.update({
      where: { id: eventId },
      data: {
        timestampEnd: endTime,
        isAnomaly: false,
        proposedEndTime: null,
      },
    });

    // Pozovi recommendation da izračuna na temelju stvarnog završetka
    await this.heatingRecommendation.processHeatingEvent({
      userId: event.thermostat.userId,
      deviceId: event.thermostat.id,
      timestampStart: event.timestampStart,
      timestampEnd: endTime,
      roomCurrentTemp: event.roomCurrentTemp,
      roomTargetTemp: event.roomTargetTemp,
      boilerFlowTemp: boiler?.suggestedFlowTemp || 0,
    });

    return { success: true, eventId, timestampEnd: endTime };
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
