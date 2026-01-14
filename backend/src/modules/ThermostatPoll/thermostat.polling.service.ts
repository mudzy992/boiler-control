// heating/thermostat.polling.service.ts

import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import type { IThermostatAdapter } from '../Boiler/adapter/thermostat-adapter.interface';
import { FlowTemperatureEngine } from '../Heating/engine/flow-temperature.engine';
import type { FlowTempInput } from '../Heating/engine/types';

@Injectable()
export class ThermostatPollingService {
  private readonly logger = new Logger(ThermostatPollingService.name);
  private readonly DEAD_ZONE = 1.0;
  private readonly MIN_SWITCH_INTERVAL_MIN = 2;

  constructor(
    private prisma: PrismaService,
    @Inject('IThermostatAdapter') private adapter: IThermostatAdapter,
  ) {}

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

  private async pollDevice(device: any) {
    try {
      const snapshot = await this.adapter.fetchSnapshot(device.deviceId);
      const currentTemp =
        snapshot?.currentTemp !== undefined ? snapshot.currentTemp / 2 : null;
      const targetTemp = snapshot?.targetTemp ?? null;
      const powerOn = snapshot?.powerOn ?? false;

      const lastEvent = await this.prisma.heatingEvent.findFirst({
        where: { deviceId: device.id },
        orderBy: { timestampStart: 'desc' },
      });
      const isHeating = !!lastEvent && lastEvent.timestampEnd === null;

      const intervalKey = this.getIntervalKey();
      const intervalLearning = device.homeProfile?.intervalLearnings?.find(
        (i: any) => i.intervalKey === intervalKey,
      );

      let mode: FlowTempInput['mode'] = 'PROFILE_ONLY';
      if (intervalLearning && snapshot) mode = 'FULL';
      else if (!snapshot) mode = 'PROFILE_ONLY';
      else if (!device.homeProfile) mode = 'ANONYMOUS';

      const recentEvents = await this.prisma.heatingEvent.findMany({
        where: {
          thermostat: { userId: device.userId },
          timestampStart: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      });

      // Weather fallback
      let tempMin = snapshot?.externalTempMin ?? 0;
      let tempMax = snapshot?.externalTempMax ?? 0;

      if (!tempMin || !tempMax) {
        const weather = await this.prisma.weatherCache.findFirst({
          where: { city: device.user.homeProfile?.user.homeLocation ?? '' },
          orderBy: { fetchedAt: 'desc' },
        });
        tempMin = weather?.temp_min ?? 0;
        tempMax = weather?.temp_max ?? 0;
      }

      const profileConfidence =
        (device.homeProfile?.learningConfidence ?? 0.1) *
        (mode === 'PROFILE_ONLY' ? 0.8 : 1);

      // --- FLOW TEMPERATURE INPUT ---
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
            }
          : undefined,
        recentEvents: recentEvents.map((e) => ({
          delta: e.targetTemp - e.currentTemp,
          active: !e.timestampEnd,
        })),
        weather: { tempMin, tempMax },
      };

      // --- CALCULATE FLOW TEMPERATURE ---
      const flowResult = FlowTemperatureEngine.calculate(input);

      let heatingOn = false;
      if (powerOn) {
        heatingOn = this.resolveHeatingState(
          isHeating,
          currentTemp!,
          targetTemp!,
        );
        const minutesSinceLast = lastEvent
          ? (Date.now() - lastEvent.timestampStart.getTime()) / 60000
          : Infinity;
        if (minutesSinceLast < this.MIN_SWITCH_INTERVAL_MIN)
          heatingOn = isHeating;
      }

      if (isHeating && !heatingOn && lastEvent)
        await this.turnOffHeating(device, lastEvent, intervalLearning);
      if (!isHeating && heatingOn)
        await this.turnOnHeating(
          device,
          intervalLearning,
          currentTemp!,
          flowResult.finalTemp, // koristimo finalnu temperaturu
        );

      this.logger.debug(
        `Device ${device.deviceId} | Mode=${mode} | Current=${currentTemp} | FlowTemp=${flowResult.finalTemp} | Heating=${heatingOn}`,
      );
    } catch (error) {
      this.logger.error(
        `Polling failed for device ${device.deviceId}: ${error.message}`,
        error.stack,
      );
    }
  }

  private async turnOnHeating(
    device: any,
    intervalLearning: any,
    currentTemp: number,
    startTemp: number,
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
        targetTemp: startTemp,
        hvacAction: 'HEATING_ON',
        source: 'THERMOSTAT',
      },
    });

    await this.prisma.boilerHistory.create({
      data: {
        userId: device.userId,
        externalTemp: lastBoilerHistory.externalTemp,
        suggestedTemp: startTemp,
        actualTemp: lastBoilerHistory.actualTemp,
        heatingStart: newEvent.timestampStart,
        heatingEnd: null,
      },
    });
  }

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
    const overshoot = lastEvent.targetTemp - lastEvent.currentTemp;
    const newSamples = intervalLearning.samples + 1;

    const newAvgReach =
      (intervalLearning.avgReachTimeMin * intervalLearning.samples +
        reachTimeMin) /
      newSamples;
    const newAvgOvershoot =
      (intervalLearning.avgOvershoot * intervalLearning.samples + overshoot) /
      newSamples;
    const newOffset =
      (intervalLearning.offset * intervalLearning.samples +
        (lastEvent.targetTemp - lastEvent.currentTemp)) /
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
  }

  private resolveHeatingState(
    isHeating: boolean,
    currentTemp: number,
    targetTemp: number,
  ): boolean {
    if (isHeating) return currentTemp < targetTemp;
    return currentTemp <= targetTemp - this.DEAD_ZONE;
  }

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
