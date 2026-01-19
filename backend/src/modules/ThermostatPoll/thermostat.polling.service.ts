import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import type { IThermostatAdapter } from '../Boiler/adapter/thermostat-adapter.interface';
import { NotificationsService } from '../Notification/notifications.service';
import { NotificationType } from '../../generated/prisma/enums';
import { BoilerService } from '../Boiler/boiler.service';
import { HeatingRecommendationService } from '../HeatingRecommendation/heating.recommendation.service';

@Injectable()
export class ThermostatPollingService {
  private readonly logger = new Logger(ThermostatPollingService.name);

  private readonly DEAD_ZONE = 1.0;
  private readonly MIN_SWITCH_INTERVAL_MIN = 2;

  constructor(
    private prisma: PrismaService,
    @Inject('IThermostatAdapter') private adapter: IThermostatAdapter,
    private boilerService: BoilerService,
    private notifications: NotificationsService,
    private recommendationService: HeatingRecommendationService,
  ) {}

  // ----------------------------------
  // CRON: Poll svih uređaja
  // ----------------------------------
  @Cron('*/1 * * * *', {
    name: 'thermostat_polling',
    disabled: process.env.NODE_ENV === 'development',
  })
  async pollAll() {
    const devices = await this.prisma.thermostatDevice.findMany({
      include: {
        user: true,
        homeProfile: { include: { intervalLearnings: true } },
      },
    });

    for (const device of devices) {
      await this.pollDevice(device);
    }
  }

  // ----------------------------------
  // POLL SINGLE DEVICE
  // ----------------------------------
  private async pollDevice(device: any) {
    try {
      // 1️⃣ Snapshot (jedina istina iz stvarnog svijeta)
      const snapshot = await this.adapter.fetchSnapshot(device.deviceId);
      if (!snapshot) return;

      const currentTemp =
        snapshot.currentTemp !== undefined ? snapshot.currentTemp / 2 : null;
      const targetTemp = snapshot.targetTemp ?? null;
      const powerOn = snapshot.powerOn ?? false;
      if (currentTemp === null || targetTemp === null) return;

      // 2️⃣ Posljednji heating event
      const lastEvent = await this.prisma.heatingEvent.findFirst({
        where: { deviceId: device.id },
        orderBy: { timestampStart: 'desc' },
      });
      const isHeating = !!lastEvent && lastEvent.timestampEnd === null;

      // 3️⃣ Izračun preporučene polazne temperature (PURE)
      const flowResult = await this.boilerService.calculateFlowTemp(
        device.userId,
      );

      // 4️⃣ Odluči da li grijanje treba biti ON
      let heatingShouldBeOn = false;
      if (powerOn) {
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
        );
      }

      if (isHeating && !heatingShouldBeOn && lastEvent) {
        await this.handleHeatingEnd(device, lastEvent);
      }

      if (isHeating && lastEvent && lastEvent.targetTemp !== targetTemp) {
        await this.handleTargetTempChange(lastEvent, targetTemp);
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
  ) {
    const now = new Date();
    const lastBoilerHistory = await this.prisma.boilerHistory.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const lastWeatherTemp = await this.prisma.weatherCache.findFirst({
      orderBy: { fetchedAt: 'desc' },
    });

    const event = await this.prisma.heatingEvent.create({
      data: {
        deviceId: device.id,
        timestampStart: now,
        currentTemp,
        targetTemp,
        hvacAction: 'HEATING_ON',
        source: 'THERMOSTAT',
      },
    });

    await this.prisma.boilerHistory.create({
      data: {
        userId: device.userId,
        externalTemp: lastWeatherTemp?.temperature || 0,
        suggestedTemp: flowTemp,
        actualTemp: lastBoilerHistory?.suggestedTemp,
        heatingStart: event.timestampStart,
        heatingEnd: null,
      },
    });

    await this.recommendationService.processHeatingEvent({
      userId: device.userId,
      deviceId: device.id,
      timestampStart: event.timestampStart,
      currentTemp,
      targetTemp,
      flowTemp,
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
  private async handleHeatingEnd(device: any, lastEvent: any) {
    const now = new Date();

    await this.prisma.heatingEvent.update({
      where: { id: lastEvent.id },
      data: { timestampEnd: now, hvacAction: 'HEATING_OFF' },
    });

    await this.prisma.boilerHistory.updateMany({
      where: { userId: device.userId, heatingEnd: null },
      data: { heatingEnd: now },
    });

    const durationMin =
      (now.getTime() - lastEvent.timestampStart.getTime()) / 60000;

    await this.recommendationService.processHeatingEvent({
      userId: device.userId,
      deviceId: device.id,
      timestampStart: lastEvent.timestampStart,
      timestampEnd: now,
      currentTemp: lastEvent.currentTemp,
      targetTemp: lastEvent.targetTemp,
      flowTemp: lastEvent.flowTemp,
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
  private async handleTargetTempChange(lastEvent: any, newTargetTemp: number) {
    await this.prisma.heatingEvent.update({
      where: { id: lastEvent.id },
      data: { targetTemp: newTargetTemp },
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
}
