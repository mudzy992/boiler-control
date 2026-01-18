// heating/thermostat.polling.service.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import type { IThermostatAdapter } from '../Boiler/adapter/thermostat-adapter.interface';
import type { FlowTempInput } from '../Heating/engine/types';
import { NotificationsService } from '../Notification/notifications.service';
import { NotificationType } from '../../generated/prisma/enums';
import { FlowTemperatureEngine } from '../Heating/engine/flow-temperature.engine';

@Injectable()
export class ThermostatPollingService {
  private readonly logger = new Logger(ThermostatPollingService.name);
  private readonly DEAD_ZONE = 1.0;
  private readonly MIN_SWITCH_INTERVAL_MIN = 2;

  constructor(
    private prisma: PrismaService,
    @Inject('IThermostatAdapter') private adapter: IThermostatAdapter,
    private notificationsService: NotificationsService,
  ) {}

  /** Cron task: poll every minute */
  @Cron('*/1 * * * *', {
    name: 'boiler_polling',
    disabled: process.env.NODE_ENV === 'development',
  })
  async pollAll() {
    const devices = await this.prisma.thermostatDevice.findMany({
      include: {
        homeProfile: { include: { intervalLearnings: true } },
        user: true,
      },
    });

    for (const device of devices) {
      await this.pollDevice(device);
    }
  }

  /** Get or create intervalLearning for a given intervalKey */
  private async getOrCreateIntervalLearning(
    homeProfile: any,
    intervalKey: string,
  ) {
    const existing = homeProfile.intervalLearnings?.find(
      (i) => i.intervalKey === intervalKey,
    );
    if (existing) return existing;

    this.logger.warn(
      `IntervalLearning missing for key=${intervalKey}, creating default`,
    );

    const created = await this.prisma.heatingIntervalLearning.create({
      data: {
        homeProfileId: homeProfile.id,
        intervalKey,
        offset: 0,
        avgReachTimeMin: 0,
        avgOvershoot: 0,
        samples: 0,
        confidence: 0.1,
        lastUpdated: new Date(),
      },
    });

    // add to local cache to prevent duplicate creation in the same poll cycle
    homeProfile.intervalLearnings.push(created);

    return created;
  }

  /** Poll a single device */
  private async pollDevice(device: any) {
    try {
      // 1️⃣ Fetch snapshot from adapter
      const snapshot = await this.adapter.fetchSnapshot(device.deviceId);
      const currentTemp =
        snapshot?.currentTemp !== undefined ? snapshot.currentTemp / 2 : null;
      const roomTargetTemp = snapshot?.targetTemp ?? null;
      const powerOn = snapshot?.powerOn ?? false;

      // 2️⃣ Last heating event
      const lastEvent = await this.prisma.heatingEvent.findFirst({
        where: { deviceId: device.id },
        orderBy: { timestampStart: 'desc' },
      });
      const isHeating = !!lastEvent && lastEvent.timestampEnd === null;

      // 3️⃣ Determine intervalKey & learning
      const intervalKey = this.getIntervalKey();
      let intervalLearning: any;
      if (device.homeProfile) {
        intervalLearning = await this.getOrCreateIntervalLearning(
          device.homeProfile,
          intervalKey,
        );
      }

      // 4️⃣ Determine engine mode
      let mode: FlowTempInput['mode'] = 'PROFILE_ONLY';
      if (intervalLearning && snapshot) mode = 'FULL';
      else if (!snapshot) mode = 'PROFILE_ONLY';
      else if (!device.homeProfile) mode = 'ANONYMOUS';

      // 5️⃣ Gather recent heating events (last 7 days)
      const recentEvents = await this.prisma.heatingEvent.findMany({
        where: {
          thermostat: { userId: device.userId },
          timestampStart: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      });

      // 6️⃣ Weather fallback
      let tempMin = snapshot?.externalTempMin ?? 0;
      let tempMax = snapshot?.externalTempMax ?? 0;
      if (!tempMin || !tempMax) {
        const weather = await this.prisma.weatherCache.findFirst({
          where: { city: device.user.homeLocation ?? '' },
          orderBy: { fetchedAt: 'desc' },
        });
        tempMin = weather?.temp_min ?? 0;
        tempMax = weather?.temp_max ?? 0;
      }

      const profileConfidence =
        (device.homeProfile?.learningConfidence ?? 0.1) *
        (mode === 'PROFILE_ONLY' ? 0.8 : 1);

      // 7️⃣ Prepare FlowTemperatureEngine input
      const input: FlowTempInput = {
        mode,
        homeProfile: {
          floorArea: device.homeProfile?.floorArea ?? 150,
          learningOffset: device.homeProfile?.learningOffset ?? 0,
          insulationFactor: 1,
          confidence: profileConfidence,
        },
        intervalKey,
        intervalLearning: intervalLearning
          ? {
              offset: intervalLearning.offset,
              confidence: intervalLearning.confidence,
              avgOvershoot: intervalLearning.avgOvershoot,
              avgReachTimeMin: intervalLearning.avgReachTimeMin,
            }
          : undefined,
        recentEvents: recentEvents.map((e) => ({
          delta: e.targetTemp - e.currentTemp,
          active: !e.timestampEnd,
        })),
        weather: { tempMin, tempMax },
      };

      // 8️⃣ Calculate flow temperature
      const { finalTemp: flowTemp } = FlowTemperatureEngine.calculate(input);

      // 9️⃣ Determine heating state
      let heatingOn = false;
      if (powerOn) {
        heatingOn = this.resolveHeatingState(
          isHeating,
          currentTemp!,
          roomTargetTemp!,
        );
        const minutesSinceLast = lastEvent
          ? (Date.now() - lastEvent.timestampStart.getTime()) / 60000
          : Infinity;
        if (minutesSinceLast < this.MIN_SWITCH_INTERVAL_MIN)
          heatingOn = isHeating;
      }

      // 10️⃣ Handle heating events
      await this.handleHeatingEvents(
        device,
        lastEvent,
        intervalLearning,
        heatingOn,
        currentTemp!,
        flowTemp,
        roomTargetTemp!,
      );

      this.logger.debug(
        `Device ${device.deviceId} | Mode=${mode} | Current=${currentTemp} | TargetTemp=${roomTargetTemp} | FlowTemp=${flowTemp} | Heating=${heatingOn}`,
      );
    } catch (error) {
      this.logger.error(
        `Polling failed for device ${device.deviceId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /** Unified heating events handler */
  private async handleHeatingEvents(
    device: any,
    lastEvent: any,
    intervalLearning: any,
    heatingOn: boolean,
    currentTemp: number,
    flowTemp: number,
    roomTargetTemp: number,
  ) {
    if (lastEvent && lastEvent.timestampEnd === null) {
      if (!heatingOn) {
        await this.turnOffHeating(device, lastEvent, intervalLearning);
      } else if (lastEvent.targetTemp !== roomTargetTemp) {
        await this.prisma.heatingEvent.update({
          where: { id: lastEvent.id },
          data: { targetTemp: roomTargetTemp },
        });
      }
    } else if (!lastEvent || (lastEvent.timestampEnd && heatingOn)) {
      await this.turnOnHeating(
        device,
        intervalLearning,
        currentTemp,
        flowTemp,
        roomTargetTemp,
      );
    }
  }

  /** Turn ON heating and log event */
  private async turnOnHeating(
    device: any,
    intervalLearning: any,
    currentTemp: number,
    flowTemp: number,
    roomTargetTemp: number,
  ) {
    const now = new Date();

    const lastBoilerHistory = await this.prisma.boilerHistory.findFirst({
      where: { userId: device.userId },
      orderBy: { createdAt: 'desc' },
    });
    if (!lastBoilerHistory) return;

    const newEvent = await this.prisma.heatingEvent.create({
      data: {
        deviceId: device.id,
        timestampStart: now,
        currentTemp,
        targetTemp: roomTargetTemp,
        hvacAction: 'HEATING_ON',
        source: 'THERMOSTAT',
      },
    });

    await this.prisma.boilerHistory.create({
      data: {
        userId: device.userId,
        externalTemp: lastBoilerHistory.externalTemp,
        suggestedTemp: flowTemp,
        actualTemp: lastBoilerHistory.suggestedTemp,
        heatingStart: newEvent.timestampStart,
        heatingEnd: null,
      },
    });

    await this.notificationsService.notifyUser({
      userId: device.userId,
      type: NotificationType.HEATING_STARTED,
      title: 'Grijanje uključeno',
      message: `Započeo je novi ciklus grijanja. Ciljna temperatura prostorije je ${roomTargetTemp}°C`,
      data: { type: 'HEATING_STARTED', flowTemp, roomTargetTemp },
    });
  }

  /** Turn OFF heating and update intervalLearning */
  private async turnOffHeating(
    device: any,
    lastEvent: any,
    intervalLearning: any,
  ) {
    const now = new Date();

    await this.prisma.heatingEvent.update({
      where: { id: lastEvent.id },
      data: { timestampEnd: now, hvacAction: 'HEATING_OFF' },
    });
    await this.prisma.boilerHistory.updateMany({
      where: { userId: device.userId, heatingEnd: null },
      data: { heatingEnd: now },
    });

    if (!intervalLearning) return;

    const reachTimeMin =
      (now.getTime() - lastEvent.timestampStart.getTime()) / 60000;
    const overshoot = lastEvent.currentTemp - lastEvent.targetTemp;

    const newSamples = intervalLearning.samples + 1;
    const newAvgReach =
      (intervalLearning.avgReachTimeMin * intervalLearning.samples +
        reachTimeMin) /
      newSamples;
    const newAvgOvershoot =
      (intervalLearning.avgOvershoot * intervalLearning.samples + overshoot) /
      newSamples;
    const newOffset =
      (intervalLearning.offset * intervalLearning.samples + overshoot) /
      newSamples;
    const newConfidence = Math.min(
      1,
      (intervalLearning.confidence * intervalLearning.samples + 0.1) /
        newSamples,
    );

    await this.prisma.heatingIntervalLearning.update({
      where: { id: intervalLearning.id },
      data: {
        avgReachTimeMin: newAvgReach,
        avgOvershoot: newAvgOvershoot,
        offset: newOffset,
        samples: newSamples,
        confidence: newConfidence,
        lastUpdated: now,
      },
    });

    await this.notificationsService.notifyUser({
      userId: device.userId,
      type: NotificationType.HEATING_ENDED,
      title: 'Grijanje završeno',
      message: `Ciklus grijanja je završen za ${reachTimeMin} min. Temperatura u prostoriji: ${lastEvent.currentTemp}°C`,
      data: { type: 'HEATING_ENDED', durationMin: reachTimeMin },
    });
  }

  /** Heating logic with dead zone */
  private resolveHeatingState(
    isHeating: boolean,
    currentTemp: number,
    targetTemp: number,
  ): boolean {
    if (isHeating) return currentTemp < targetTemp;
    return currentTemp <= targetTemp - this.DEAD_ZONE;
  }

  /** Return current interval key */
  private getIntervalKey(): string {
    const now = new Date();
    const hour = now.getHours();
    const weekday = now.getDay();
    let part = 'night';
    if (hour >= 6 && hour < 9) part = 'morning';
    else if (hour >= 9 && hour < 12) part = 'late_morning';
    else if (hour >= 12 && hour < 17) part = 'afternoon';
    else if (hour >= 17 && hour < 22) part = 'evening';
    const dayType = weekday === 0 || weekday === 6 ? 'weekend' : 'weekday';
    return `${dayType}_${part}`;
  }
}
