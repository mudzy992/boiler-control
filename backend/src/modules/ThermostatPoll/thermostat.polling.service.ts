import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import type { IThermostatAdapter } from '../Boiler/adapter/thermostat-adapter.interface';
import { NotificationsService } from '../Notification/notifications.service';
import { BoilerService } from '../Boiler/boiler.service';
import { HeatingRecommendationService } from '../HeatingRecommendation/heating.recommendation.service';
import { StructuredLogger, LogContext } from '../../common/structured-logger';
import { MetricsService } from '../../common/metrics.service';
import { NotificationType } from 'src/generated/prisma';

@Injectable()
export class ThermostatPollingService {
  private readonly logger = new Logger(ThermostatPollingService.name);
  private readonly structuredLogger = new StructuredLogger(
    ThermostatPollingService.name,
  );

  private readonly DEAD_ZONE = 1.0;
  private readonly MIN_SWITCH_INTERVAL_MIN = 2;

  constructor(
    private prisma: PrismaService,
    @Inject('IThermostatAdapter') private adapter: IThermostatAdapter,
    private boilerService: BoilerService,
    private notifications: NotificationsService,
    private recommendationService: HeatingRecommendationService,
    private metricsService: MetricsService,
  ) {}

  // ----------------------------------
  // CRON: Poll svih uređaja
  // Disabled during development and test runs to avoid exhausting DB pool
  // ----------------------------------
  @Cron('*/1 * * * *', {
    name: 'thermostat_polling',
    disabled:
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test',
  })
  async pollAll() {
    const runId = `poll_${Date.now()}`;
    this.metricsService.incrementCounter('poll_runs_total');

    try {
      const devices = await this.prisma.thermostatDevice.findMany({
        include: {
          user: true,
          homeProfile: { include: { intervalLearnings: true } },
        },
      });

      const ctx: LogContext = { runId, module: 'thermostat_polling' };
      this.structuredLogger.debug(
        `Starting poll cycle with ${devices.length} devices`,
        ctx,
      );

      for (const device of devices) {
        await this.pollDevice(device, runId);
      }

      this.metricsService.incrementCounter('poll_runs_success');
    } catch (err) {
      this.metricsService.incrementCounter('poll_runs_failed');
      const ctx: LogContext = { runId, module: 'thermostat_polling' };
      this.structuredLogger.error('Poll cycle failed', err, ctx);
    }
  }

  // ----------------------------------
  // POLL SINGLE DEVICE
  // ----------------------------------
  private async pollDevice(device: any, runId?: string) {
    const ctx: LogContext = {
      runId: runId || `poll_${Date.now()}`,
      deviceId: device.id,
      userId: device.userId,
    };

    try {
      // 1️⃣ Posljednji heating event
      const lastEvent = await this.prisma.heatingEvent.findFirst({
        where: { deviceId: device.id },
        orderBy: { timestampStart: 'desc' },
      });
      const isHeating = !!lastEvent && lastEvent.timestampEnd === null;

      this.structuredLogger.debug(
        `Device polling started | isHeating=${isHeating}`,
        ctx,
      );
      // 🧠 ADAPTIVNI CRON GUARD
      if (!this.shouldPollDevice(device, isHeating)) {
        return;
      }
      // 2️⃣ Snapshot (jedina istina iz stvarnog svijeta)
      const snapshot = await this.adapter.fetchSnapshot(device.deviceId, runId);
      if (!snapshot) return;
      // INFO: temperature su u adapteru već normalizovane i konvertovane u celzijuse
      const currentTemp =
        snapshot.currentTemp !== undefined ? snapshot.currentTemp : null;
      const targetTemp = snapshot.targetTemp ?? null;
      // INFO: ovo je podataka da li je termostat uključen ili ne, a ne da li je grijanje trenutno aktivno ili ne
      const powerOn = snapshot.powerOn ?? false;
      const hasChanged =
        device.roomTargetTemp !== targetTemp ||
        device.roomCurrentTemp !== currentTemp;
      if (hasChanged) {
        await this.prisma.thermostatDevice.updateMany({
          where: { id: device.id },
          data: {
            roomTargetTemp: targetTemp,
            roomCurrentTemp: currentTemp,
            lastSeen: new Date(),
            lastSnapshotAt: new Date(),
          },
        });
      } else {
        await this.prisma.thermostatDevice.updateMany({
          where: { id: device.id },
          data: {
            lastSnapshotAt: new Date(),
            lastSeen: new Date(),
          },
        });
      }

      if (currentTemp === null || targetTemp === null) return;

      // 3️⃣ Izračun preporučene polazne temperature (PURE)
      const flowResult = await this.boilerService.calculateFlowTemp(
        device.userId,
      );

      // 4️⃣ Odluči da li grijanje treba biti ON
      let heatingShouldBeOn = false;

      if (!powerOn) {
        heatingShouldBeOn = false;
      } else {
        heatingShouldBeOn = this.resolveHeatingState(
          isHeating,
          currentTemp,
          targetTemp,
        );

        if (lastEvent) {
          const minutesSinceLast =
            (Date.now() - lastEvent.timestampStart.getTime()) / 60000;
          if (minutesSinceLast < this.MIN_SWITCH_INTERVAL_MIN) {
            heatingShouldBeOn = isHeating;
          }
        }
      }

      // 5️⃣ State machine grijanja
      if (!isHeating && heatingShouldBeOn) {
        await this.handleHeatingStart(
          device,
          currentTemp,
          targetTemp,
          flowResult.flowTemp,
          ctx.runId,
        );
      }

      if (isHeating && !heatingShouldBeOn && lastEvent) {
        await this.handleHeatingEnd(device, lastEvent, ctx.runId);
      }

      if (isHeating && lastEvent && lastEvent.roomTargetTemp !== targetTemp) {
        await this.handleTargetTempChange(lastEvent, targetTemp, ctx.runId);
      }

      this.logger.debug(
        `Device=${device.deviceId} | Current=${currentTemp} | Target=${targetTemp} | Heating=${heatingShouldBeOn} | Flow=${flowResult.flowTemp}`,
      );
    } catch (err) {
      this.logger.error(
        `Polling failed for device ${device.deviceId}: ${err.message}`,
        err.stack,
      );
    }
  }

  // ----------------------------------
  // HEATING START
  // ----------------------------------
  private async handleHeatingStart(
    device: any,
    currentTemp: number,
    targetTemp: number,
    flowTemp: number,
    runId?: string,
  ) {
    const now = new Date();

    const ctx: LogContext = {
      runId,
      deviceId: device.id,
      userId: device.userId,
      action: 'heating_start',
    };

    // Idempotency: skip if an event was already created in the same minute
    const minuteSlotStart = new Date(Math.floor(now.getTime() / 60000) * 60000);
    const existing = await this.prisma.heatingEvent.findFirst({
      where: {
        deviceId: device.id,
        timestampStart: { gte: minuteSlotStart },
      },
    });

    if (existing) {
      this.structuredLogger.debug(
        'Duplicate heating start detected; skipping',
        ctx,
      );
      return;
    }

    this.structuredLogger.log('Starting heating start transaction', ctx);

    const [lastBoilerHistory, userState, lastWeatherTemp] = await Promise.all([
      this.prisma.boilerHistory.findFirst({
        where: { userId: device.userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.findUnique({
        where: { id: device.userId },
        select: { currentBoilerFlowTemp: true },
      }),
      this.prisma.weatherCache.findFirst({
        orderBy: { fetchedAt: 'desc' },
      }),
    ]);

    // Wrap multi-step DB operations in transaction for atomicity
    const [event] = await this.prisma.$transaction([
      this.prisma.heatingEvent.create({
        data: {
          deviceId: device.id,
          timestampStart: now,
          roomCurrentTemp: currentTemp,
          roomTargetTemp: targetTemp,
          hvacAction: 'HEATING_ON',
          source: 'THERMOSTAT',
        },
      }),
      this.prisma.boilerHistory.create({
        data: {
          userId: device.userId,
          externalTemp: lastWeatherTemp?.temperature || 0,
          suggestedFlowTemp: flowTemp,
          actualFlowTemp:
            userState?.currentBoilerFlowTemp ??
            lastBoilerHistory?.actualFlowTemp ??
            null,
          heatingStart: now,
          heatingEnd: null,
        },
      }),
    ]);

    this.metricsService.incrementCounter('heating_events_created');

    this.structuredLogger.log('Heating event created', {
      ...ctx,
      eventId: event.id,
    });

    await this.recommendationService.processHeatingEvent({
      userId: device.userId,
      deviceId: device.id,
      timestampStart: event.timestampStart,
      roomCurrentTemp: currentTemp,
      roomTargetTemp: targetTemp,
      boilerFlowTemp: flowTemp,
    });

    await this.notifications.notifyUser({
      userId: device.userId,
      type: NotificationType.HEATING_STARTED,
      title: 'Grijanje uključeno',
      message: `Započeto zagrijavanje na ${targetTemp}°C`,
      data: { flowTemp, targetTemp },
    });
  }

  // ----------------------------------
  // HEATING END
  // ----------------------------------
  private async handleHeatingEnd(device: any, lastEvent: any, runId?: string) {
    const now = new Date();

    const ctx: LogContext = {
      runId,
      deviceId: device.id,
      userId: device.userId,
      action: 'heating_end',
    };

    // Wrap heating end updates in transaction for consistency
    await this.prisma.$transaction([
      this.prisma.heatingEvent.updateMany({
        where: { id: lastEvent.id },
        data: { timestampEnd: now, hvacAction: 'HEATING_OFF' },
      }),
      this.prisma.boilerHistory.updateMany({
        where: { userId: device.userId, heatingEnd: null },
        data: { heatingEnd: now },
      }),
    ]);

    this.metricsService.incrementCounter('heating_events_ended');
    const durationMin =
      (now.getTime() - lastEvent.timestampStart.getTime()) / 60000;

    this.structuredLogger.log('Heating event ended', {
      ...ctx,
      eventId: lastEvent.id,
      durationMin,
    });

    await this.recommendationService.processHeatingEvent({
      userId: device.userId,
      deviceId: device.id,
      timestampStart: lastEvent.timestampStart,
      timestampEnd: now,
      roomCurrentTemp: lastEvent.roomCurrentTemp,
      roomTargetTemp: lastEvent.roomTargetTemp,
      boilerFlowTemp: 0, // Flow temp is not stored in event, using 0 or need to fetch from boilerHistory
    });

    await this.notifications.notifyUser({
      userId: device.userId,
      type: NotificationType.HEATING_ENDED,
      title: 'Grijanje završeno',
      message: `Grijanje trajalo ${durationMin.toFixed(0)} min`,
      data: { durationMin },
    });
  }

  // ----------------------------------
  // TARGET TEMP CHANGE (ISTINA!)
  // ----------------------------------
  private async handleTargetTempChange(
    lastEvent: any,
    newTargetTemp: number,
    runId?: string,
  ) {
    const ctx: LogContext = {
      runId,
      deviceId: lastEvent.deviceId,
      userId: lastEvent.userId,
      action: 'target_temp_change',
    };

    this.structuredLogger.log('Updating target temp for active heating event', {
      ...ctx,
      eventId: lastEvent.id,
    });

    await this.prisma.heatingEvent.updateMany({
      where: { id: lastEvent.id },
      data: { roomTargetTemp: newTargetTemp },
    });
  }

  // ----------------------------------
  // HEATING DECISION LOGIC
  // ----------------------------------
  private resolveHeatingState(
    isHeating: boolean,
    currentTemp: number,
    targetTemp: number,
  ): boolean {
    if (isHeating) return currentTemp < targetTemp;
    return currentTemp <= targetTemp - this.DEAD_ZONE;
  }

  private shouldPollDevice(device: any, isHeating: boolean): boolean {
    if (!device.lastSnapshotAt) return true;

    const now = Date.now();
    const last = device.lastSnapshotAt.getTime();

    const intervalMs = isHeating ? 60_000 : 120_000;

    return now - last >= intervalMs;
  }
}
