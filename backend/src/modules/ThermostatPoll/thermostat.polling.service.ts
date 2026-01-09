import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ThermostatDevice } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import type { IThermostatAdapter } from '../Boiler/adapter/thermostat-adapter.interface';

@Injectable()
export class ThermostatPollingService {
  private readonly logger = new Logger(ThermostatPollingService.name);
  private readonly DEAD_ZONE = 1.0;
  private readonly MIN_SWITCH_INTERVAL_MIN = 2; // minimalno 2 minute izmedju OFF→ON

  constructor(
    private prisma: PrismaService,
    @Inject('IThermostatAdapter') private adapter: IThermostatAdapter,
  ) {}

  /** Polla jedan uređaj i odlučuje ON/OFF grijanje */
  async pollDevice(device: ThermostatDevice) {
    try {
      // --- Snapshot sa termostata ---
      const snapshot = await this.adapter.fetchSnapshot(device.deviceId);
      const currentTemp = normalizeTemp(snapshot.currentTemp);
      const targetTemp = snapshot.targetTemp;
      const powerOn = snapshot.powerOn;

      // --- Dohvati lastEvent ---
      const lastEvent = await this.prisma.heatingEvent.findFirst({
        where: { deviceId: device.id },
        orderBy: { timestampStart: 'desc' },
      });
      const isHeating = !!lastEvent && lastEvent.timestampEnd === null;

      // --- Dohvati homeProfile i intervalLearning ---
      const homeProfile = await this.prisma.homeProfile.findUnique({
        where: { id: device.homeProfileId },
        include: { intervalLearnings: true },
      });

      const intervalKey = getIntervalKey(new Date());
      let intervalLearning = homeProfile?.intervalLearnings.find(
        (i) => i.intervalKey === intervalKey,
      );

      if (!intervalLearning && homeProfile) {
        intervalLearning = await this.prisma.heatingIntervalLearning.create({
          data: {
            homeProfileId: homeProfile.id,
            intervalKey,
            avgReachTimeMin: 0,
            avgOvershoot: 0,
          },
        });
        this.logger.debug(
          `Created new intervalLearning: ${intervalKey} for homeProfile ${homeProfile.id}`,
        );
      }

      // --- Resolve heating state ---
      const now = new Date();
      let heatingOn = false;
      if (powerOn) {
        heatingOn = resolveHeatingState({
          isHeating,
          currentTemp,
          targetTemp: targetTemp,
          deadZone: this.DEAD_ZONE,
        });

        // Provjeri minimalni interval između switch-a
        if (lastEvent && lastEvent.timestampStart) {
          const minutesSinceLastSwitch =
            (now.getTime() - lastEvent.timestampStart.getTime()) / 60000;
          if (minutesSinceLastSwitch < this.MIN_SWITCH_INTERVAL_MIN) {
            heatingOn = isHeating; // ignoriraj prebrze promjene
          }
        }
      }

      this.logger.debug(
        `Decision ${device.deviceId}: was=${isHeating ? 'ON' : 'OFF'} → now=${heatingOn ? 'ON' : 'OFF'}. ` +
          `Target: ${targetTemp} Current: ${currentTemp} Day: ${snapshot.dayType} ` +
          `Active Interval: ${formatInterval(snapshot.activeInterval!)}`,
      );


      // ===== STATE TRANSITIONS =====
      if (isHeating && !heatingOn && lastEvent) {
        // ON → OFF
        await this.prisma.heatingEvent.update({
          where: { id: lastEvent.id },
          data: { timestampEnd: now, hvacAction: 'HEATING_OFF' },
        });

        await this.prisma.boilerHistory.updateMany({
          where: { userId: device.userId, heatingEnd: null },
          data: { heatingEnd: now },
        });

        this.logger.log(`Heating STOPPED for device ${device.deviceId}`);

        // Update intervalLearning
        if (intervalLearning) {
          const reachTimeMin =
            (now.getTime() - lastEvent.timestampStart.getTime()) / 60000;
          const overshoot = lastEvent.targetTemp - lastEvent.currentTemp;

          intervalLearning.samples += 1;
          intervalLearning.avgReachTimeMin =
            (intervalLearning.avgReachTimeMin * (intervalLearning.samples - 1) +
              reachTimeMin) /
            intervalLearning.samples;
          intervalLearning.avgOvershoot =
            (intervalLearning.avgOvershoot * (intervalLearning.samples - 1) +
              overshoot) /
            intervalLearning.samples;
          intervalLearning.offset =
            lastEvent.targetTemp - lastEvent.currentTemp;
          intervalLearning.confidence = Math.min(
            1,
            intervalLearning.samples / 10,
          );
          intervalLearning.lastUpdated = now;

          await this.prisma.heatingIntervalLearning.update({
            where: { id: intervalLearning.id },
            data: intervalLearning,
          });
        }
      }

      if (!isHeating && heatingOn) {
        // OFF → ON
        const newEvent = await this.prisma.heatingEvent.create({
          data: {
            deviceId: device.id,
            timestampStart: now,
            currentTemp,
            targetTemp: targetTemp,
            hvacAction: 'HEATING_ON',
            source: 'THERMOSTAT',
          },
        });

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

        await this.prisma.boilerHistory.create({
          data: {
            userId: device.userId,
            externalTemp: lastBoilerHistory.externalTemp,
            suggestedTemp: lastBoilerHistory.suggestedTemp,
            actualTemp: lastBoilerHistory.actualTemp,
            heatingStart: newEvent.timestampStart,
            heatingEnd: null,
          },
        });

        this.logger.log(`Heating STARTED for device ${device.deviceId}`);
      }
    } catch (error) {
      this.logger.error(
        `Polling failed for device ${device.deviceId}: ${error.message}`,
        error.stack,
      );
    }
  }

  async pollAll() {
    const devices = await this.prisma.thermostatDevice.findMany();
    for (const d of devices) {
      await this.pollDevice(d);
    }
  }

  @Cron('*/1 * * * *', {
    name: 'polling',
    disabled: process.env.NODE_ENV === 'development',
  })
  handleCron() {
    this.logger.debug('Thermostat polling cron triggered');
    this.pollAll();
  }
}

function resolveHeatingState(params: {
  isHeating: boolean;
  currentTemp: number;
  targetTemp: number;
  deadZone: number;
}): boolean {
  const { isHeating, currentTemp, targetTemp, deadZone } = params;
  if (isHeating) {
    return currentTemp < targetTemp; // OFF kada pređe target
  } else {
    return currentTemp <= targetTemp - deadZone; // ON kada padne ispod target-deadZone
  }
}

function normalizeTemp(raw: number): number {
  return raw / 2;
}

function getIntervalKey(now: Date): string {
  const hour = now.getHours();
  const day = now.getDay();
  let partOfDay = 'night';
  if (hour >= 6 && hour < 12) partOfDay = 'morning';
  else if (hour >= 12 && hour < 18) partOfDay = 'afternoon';
  else if (hour >= 18 && hour < 23) partOfDay = 'evening';
  return `weekday_${day}_${partOfDay}`;
}

function formatInterval(
  interval: {
    startMinute: number;
    targetTemp: number;
    orderIndex: number;
  } | null,
) {
  if (!interval) return 'N/A';

  const hours = Math.floor(interval.startMinute / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (interval.startMinute % 60).toString().padStart(2, '0');

  // Pretpostavljamo da traje do kraja dana ako nemamo endMinute
  return `${hours}:${minutes} → ${interval.targetTemp}°C (idx=${interval.orderIndex})`;
}
