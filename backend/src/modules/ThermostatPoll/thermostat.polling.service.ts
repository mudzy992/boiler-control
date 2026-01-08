import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ThermostatDevice } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import type { IThermostatAdapter } from '../Boiler/adapter/thermostat-adapter.interface';

@Injectable()
export class ThermostatPollingService {
  private readonly logger = new Logger(ThermostatPollingService.name);
  private readonly DEAD_ZONE = 1.0;

  constructor(
    private prisma: PrismaService,
    @Inject('IThermostatAdapter') private adapter: IThermostatAdapter,
  ) {}

  /** Polla jedan uređaj i odlučuje da li grijanje treba biti ON/OFF */
  async pollDevice(device: ThermostatDevice) {
    try {
      const snapshot = await this.adapter.fetchSnapshot(device.deviceId);
      const currentTemp = normalizeTemp(snapshot.currentTemp);
      const targetTemp = normalizeTemp(snapshot.targetTemp);
      const powerOn = snapshot.powerOn;

      this.logger.debug(
        `Snapshot ${device.deviceId}: current=${currentTemp}, target=${targetTemp}`,
      );

      const lastEvent = await this.prisma.heatingEvent.findFirst({
        where: { deviceId: device.id },
        orderBy: { timestampStart: 'desc' },
      });

      const isHeating = !!lastEvent && lastEvent.timestampEnd === null;

      // ====== INTERVAL LEARNING LOGIKA ======
      const homeProfile = await this.prisma.homeProfile.findUnique({
        where: { id: device.homeProfileId },
        include: { intervalLearnings: true },
      });

      const intervalKey = getIntervalKey(new Date());
      let intervalLearning = homeProfile?.intervalLearnings.find(
        (i) => i.intervalKey === intervalKey,
      );

      // Ako interval ne postoji, kreiraj ga
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

      // Target temp sa primijenjenim offsetom
      const adjustedTarget = targetTemp + (intervalLearning?.offset ?? 0);

      const heatingOn = powerOn
        ? resolveHeatingState({
            isHeating,
            currentTemp,
            targetTemp: adjustedTarget,
            deadZone: this.DEAD_ZONE,
          })
        : false;

      this.logger.debug(
        `Decision ${device.deviceId}: was=${isHeating ? 'ON' : 'OFF'} → now=${heatingOn ? 'ON' : 'OFF'}`,
      );

      // ===== STATE TRANSITIONS =====

      // ON → OFF
      if (isHeating && !heatingOn) {
        await this.prisma.heatingEvent.update({
          where: { id: lastEvent.id },
          data: { timestampEnd: new Date(), hvacAction: 'HEATING_OFF' },
        });

        await this.prisma.boilerHistory.updateMany({
          where: { userId: device.userId, heatingEnd: null },
          data: { heatingEnd: new Date() },
        });

        this.logger.log(`Heating STOPPED for device ${device.deviceId}`);

        // Update interval learning
        if (intervalLearning) {
          const reachTimeMin =
            (new Date().getTime() - lastEvent.timestampStart.getTime()) / 60000;
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
          intervalLearning.lastUpdated = new Date();

          await this.prisma.heatingIntervalLearning.update({
            where: { id: intervalLearning.id },
            data: intervalLearning,
          });
        }
      }

      // OFF → ON
      if (!isHeating && heatingOn) {
        const newEvent = await this.prisma.heatingEvent.create({
          data: {
            deviceId: device.id,
            timestampStart: new Date(),
            currentTemp,
            targetTemp,
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

  /** Polla sve uređaje */
  async pollAll() {
    const devices = await this.prisma.thermostatDevice.findMany();
    for (const d of devices) {
      await this.pollDevice(d);
    }
  }

  @Cron('*/1 * * * *')
  handleCron() {
    this.logger.debug('Thermostat polling cron triggered');
    this.pollAll();
  }
}

/** Rezolucija grijanja sa deadzone */
function resolveHeatingState(params: {
  isHeating: boolean;
  currentTemp: number;
  targetTemp: number;
  deadZone: number;
}): boolean {
  const { isHeating, currentTemp, targetTemp, deadZone } = params;
  if (isHeating) return currentTemp <= targetTemp + deadZone;
  else return currentTemp < targetTemp - deadZone;
}

/** Normalizacija temperature (Tuya / Polling) */
function normalizeTemp(raw: number): number {
  return raw / 2;
}

/** Generiše ključ intervala za homeProfile learning */
function getIntervalKey(now: Date): string {
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sunday
  let partOfDay = 'night';

  if (hour >= 6 && hour < 12) partOfDay = 'morning';
  else if (hour >= 12 && hour < 18) partOfDay = 'afternoon';
  else if (hour >= 18 && hour < 23) partOfDay = 'evening';

  return `weekday_${day}_${partOfDay}`;
}
