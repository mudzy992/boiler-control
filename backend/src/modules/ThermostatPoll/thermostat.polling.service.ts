import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import type { IThermostatAdapter } from '../Boiler/adapter/thermostat-adapter.interface';
import { addMinutes } from 'date-fns';

@Injectable()
export class ThermostatPollingService {
  private readonly logger = new Logger(ThermostatPollingService.name);
  private readonly DEAD_ZONE = 1.0;
  private readonly MIN_SWITCH_INTERVAL_MIN = 2;

  constructor(
    private prisma: PrismaService,
    @Inject('IThermostatAdapter') private adapter: IThermostatAdapter,
  ) {}

  /** Polling svih termostata */
  @Cron('*/1 * * * *', {
    name: 'boiler_polling',
    disabled: process.env.NODE_ENV === 'development',
  })
  async pollAll() {
    const devices = await this.prisma.thermostatDevice.findMany({
      include: { homeProfile: { include: { intervalLearnings: true } } },
    });

    for (const device of devices) {
      await this.pollDevice(device);
    }
  }

  /** Poll jednog uređaja i odluči grijanje */
  private async pollDevice(device: any) {
    try {
      const snapshot = await this.adapter.fetchSnapshot(device.deviceId);
      const currentTemp = snapshot.currentTemp / 2;
      const targetTemp = snapshot.targetTemp;
      const powerOn = snapshot.powerOn;

      const lastEvent = await this.prisma.heatingEvent.findFirst({
        where: { deviceId: device.id },
        orderBy: { timestampStart: 'desc' },
      });
      const isHeating = !!lastEvent && lastEvent.timestampEnd === null;

      const intervalKey = this.getIntervalKey();
      let intervalLearning = device.homeProfile.intervalLearnings.find(
        (i: any) => i.intervalKey === intervalKey,
      );
      if (!intervalLearning) {
        intervalLearning = await this.prisma.heatingIntervalLearning.create({
          data: {
            homeProfileId: device.homeProfile.id,
            intervalKey,
            avgReachTimeMin: 0,
            avgOvershoot: 0,
            offset: 0,
            confidence: 0.1,
            samples: 0,
          },
        });
        this.logger.debug(
          `Created intervalLearning ${intervalKey} for homeProfile ${device.homeProfile.id}`,
        );
      }

      let heatingOn = false;
      if (powerOn) {
        heatingOn = this.resolveHeatingState(
          isHeating,
          currentTemp,
          targetTemp,
        );

        if (lastEvent?.timestampStart) {
          const minutesSinceLast =
            (new Date().getTime() - lastEvent.timestampStart.getTime()) / 60000;
          if (minutesSinceLast < this.MIN_SWITCH_INTERVAL_MIN) {
            heatingOn = isHeating;
          }
        }
      }

      this.logger.debug(
        `Device ${device.deviceId}: was=${isHeating ? 'ON' : 'OFF'} → now=${
          heatingOn ? 'ON' : 'OFF'
        }, Target=${targetTemp} Current=${currentTemp}`,
      );

      // STATE TRANSITIONS
      if (isHeating && !heatingOn && lastEvent) {
        await this.turnOffHeating(device, lastEvent, intervalLearning);
      }

      if (!isHeating && heatingOn) {
        await this.turnOnHeating(
          device,
          intervalLearning,
          currentTemp,
          targetTemp,
        );
      }
    } catch (error) {
      this.logger.error(
        `Polling failed for device ${device.deviceId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /** Uključi grijanje */
  private async turnOnHeating(
    device: any,
    intervalLearning: any,
    currentTemp: number,
    targetTemp: number,
  ) {
    const now = new Date();

    const lastBoilerHistory = await this.prisma.boilerHistory.findFirst({
      where: { userId: device.userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastBoilerHistory) {
      this.logger.warn(
        `No BoilerHistory found, skipping BoilerHistory create for device ${device.deviceId}`,
      );
      return;
    }

    const newEvent = await this.prisma.heatingEvent.create({
      data: {
        deviceId: device.id,
        timestampStart: now,
        currentTemp, // sada je valid
        targetTemp, // sada je valid
        hvacAction: 'HEATING_ON',
        source: 'THERMOSTAT',
      },
    });

    const suggestedTemp = await this.getStartTemp(
      device.userId,
      intervalLearning,
    );

    await this.prisma.boilerHistory.create({
      data: {
        userId: device.userId,
        externalTemp: lastBoilerHistory.externalTemp,
        suggestedTemp,
        actualTemp: lastBoilerHistory.actualTemp,
        heatingStart: newEvent.timestampStart,
        heatingEnd: null,
      },
    });

    await this.createRecommendation(
      device.userId,
      suggestedTemp,
      intervalLearning,
    );

    this.logger.log(`Heating STARTED for device ${device.deviceId}`);
  }

  /** Isključi grijanje i update interval learning */
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

    // Update interval learning
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

    this.logger.log(`Heating STOPPED for device ${device.deviceId}`);
  }

  /** Start temp kalkulacija v1.1 */
  private async getStartTemp(
    userId: number,
    intervalLearning: any,
  ): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { homeProfiles: true },
    });
    if (!user) throw new Error('User not found');

    const home = user.homeProfiles[0];
    if (!home) throw new Error('HomeProfile not found');

    const weather = await this.prisma.weatherCache.findFirst({
      where: { city: user.homeLocation! },
      orderBy: { fetchedAt: 'desc' },
    });
    const tempMin = weather?.temp_min ?? 0;
    const tempMax = weather?.temp_max ?? 0;
    let weightedTemp = 0.7 * tempMin + 0.3 * tempMax;
    weightedTemp = Math.max(-15, Math.min(10, weightedTemp));

    const intervalKey = this.getIntervalKey();
    const isMorning = intervalKey.includes('morning');
    const intervalWeight = isMorning ? 0.4 : 1.0;

    let startTemp = this.calculateCurveTemp(weightedTemp);
    startTemp += home.learningOffset + intervalLearning.offset * intervalWeight;

    // Event-based adjustment
    const lastWeekEvents = await this.prisma.heatingEvent.findMany({
      where: {
        thermostat: { userId },
        timestampStart: { gte: addMinutes(new Date(), -7 * 24 * 60 * 60) },
      },
    });
    const eventOffset = lastWeekEvents.reduce((acc, e) => {
      const delta = e.targetTemp - e.currentTemp;
      const weight = e.timestampEnd ? 0.05 : 0.1;
      return acc + delta * weight;
    }, 0);
    startTemp += isMorning ? eventOffset * 0.5 : eventOffset;

    startTemp = Math.max(35, Math.min(56, startTemp));

    this.logger.debug(
      `[v1.1] User ${userId} | Interval: ${intervalKey} | StartTemp: ${startTemp.toFixed(
        2,
      )}`,
    );

    return Number(startTemp.toFixed(2));
  }

  /** Recommendation kreacija */
  private async createRecommendation(
    userId: number,
    recommendedFlowTemp: number,
    intervalLearning: any,
  ) {
    await this.prisma.recommendation.create({
      data: {
        userId,
        date: new Date(),
        recommendedFlowTemp: Number(recommendedFlowTemp.toFixed(2)),
        expectedHeatTimeMin: Math.round(intervalLearning.avgReachTimeMin),
        confidenceScore: Number(intervalLearning.confidence.toFixed(2)),
      },
    });
  }

  /** Resolve heating ON/OFF */
  private resolveHeatingState(
    isHeating: boolean,
    currentTemp: number,
    targetTemp: number,
  ): boolean {
    if (isHeating) return currentTemp < targetTemp;
    return currentTemp <= targetTemp - this.DEAD_ZONE;
  }

  /** Krivulja grijanja */
  private calculateCurveTemp(ext: number): number {
    if (ext >= 10) return 45;
    if (ext <= -15) return 56;
    return 51 - ext * 0.3;
  }

  /** Interval key */
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
