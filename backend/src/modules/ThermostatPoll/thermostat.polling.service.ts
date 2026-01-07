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

  async pollDevice(device: ThermostatDevice) {
    try {
      const snapshot = await this.adapter.fetchSnapshot(device.deviceId);

      const currentTemp = snapshot.currentTemp / 2;
      const targetTemp = snapshot.targetTemp / 2;

      this.logger.debug(
        `Snapshot ${device.deviceId}: current=${currentTemp}, target=${targetTemp}`,
      );

      const lastEvent = await this.prisma.heatingEvent.findFirst({
        where: { deviceId: device.id },
        orderBy: { timestampStart: 'desc' },
      });

      const isHeating = !!lastEvent && lastEvent.timestampEnd === null;

      const heatingOn = resolveHeatingState({
        isHeating,
        currentTemp,
        targetTemp,
        deadZone: this.DEAD_ZONE,
      });

      this.logger.debug(
        `Decision ${device.deviceId}: was=${isHeating ? 'ON' : 'OFF'} → now=${heatingOn ? 'ON' : 'OFF'}`,
      );

      // ===== STATE TRANSITIONS =====

      // ON → OFF
      if (isHeating && !heatingOn) {
        await this.prisma.heatingEvent.update({
          where: { id: lastEvent.id },
          data: {
            timestampEnd: new Date(),
            hvacAction: 'HEATING_OFF',
          },
        });

        await this.prisma.boilerHistory.updateMany({
          where: {
            userId: device.userId,
            heatingEnd: null,
          },
          data: {
            heatingEnd: new Date(),
          },
        });

        this.logger.log(`Heating STOPPED for device ${device.deviceId}`);
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

function resolveHeatingState(params: {
  isHeating: boolean;
  currentTemp: number;
  targetTemp: number;
  deadZone: number;
}): boolean {
  const { isHeating, currentTemp, targetTemp, deadZone } = params;

  if (isHeating) {
    // grijanje je uključeno → gasi se tek kad PREĐE gornji prag
    return currentTemp <= targetTemp + deadZone;
  } else {
    // grijanje je isključeno → pali se tek kad PADNE ispod donjeg praga
    return currentTemp < targetTemp - deadZone;
  }
}
