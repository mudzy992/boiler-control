import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ThermostatDevice } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import type { IThermostatAdapter } from '../Boiler/adapter/thermostat-adapter.interface';

@Injectable()
export class ThermostatPollingService {
  private readonly logger = new Logger(ThermostatPollingService.name);

  constructor(
    private prisma: PrismaService,
    @Inject('IThermostatAdapter') private adapter: IThermostatAdapter,
  ) {}

  async pollDevice(device: ThermostatDevice) {
    try {
      const snapshot = await this.adapter.fetchSnapshot(device.deviceId);
      this.logger.debug(
        `Snapshot for device ${device.deviceId}: currentTemp=${snapshot.currentTemp}, targetTemp=${snapshot.targetTemp}`,
      );

      const lastEvent = await this.prisma.heatingEvent.findFirst({
        where: { deviceId: device.id },
        orderBy: { timestampStart: 'desc' },
      });

      const heatingOn = snapshot.currentTemp + 1 < snapshot.targetTemp; // deadzone
      this.logger.debug(
        `Heating status for device ${device.deviceId}: ${heatingOn ? 'ON' : 'OFF'}`,
      );

      if (lastEvent && lastEvent.timestampEnd == null) {
        // postojeći event je otvoren
        if (!heatingOn) {
          // grijanje je prestalo → zatvori event
          await this.prisma.heatingEvent.update({
            where: { id: lastEvent.id },
            data: { timestampEnd: new Date() },
          });
          this.logger.log(
            `Closed heating event ${lastEvent.id} for device ${device.deviceId}`,
          );
        }
      } else {
        // nema otvorenog eventa
        if (heatingOn) {
          // grijanje starta → kreiraj novi
          const newEvent = await this.prisma.heatingEvent.create({
            data: {
              deviceId: device.id,
              timestampStart: new Date(),
              currentTemp: snapshot.currentTemp,
              targetTemp: snapshot.targetTemp,
              hvacAction: heatingOn ? 'HEATING_ON' : 'IDLE',
              source: 'THERMOSTAT',
            },
          });
          // Kreiraj BoilerHistory za taj event
          const morningBh = await this.prisma.boilerHistory.findFirst({
            where: {
              userId: device.userId,
              createdAt: { gte: new Date(new Date().setHours(6, 0, 0, 0)) },
            },
            orderBy: { createdAt: 'asc' },
          });

          if (morningBh) {
            await this.prisma.boilerHistory.create({
              data: {
                userId: device.userId,
                externalTemp: morningBh.externalTemp,
                suggestedTemp: morningBh.suggestedTemp,
                actualTemp: morningBh.actualTemp,
                heatingStart: newEvent.timestampStart,
                heatingEnd: newEvent.timestampEnd,
              },
            });
          }
          this.logger.log(
            `Created new heating event ${newEvent.id} for device ${device.deviceId}`,
          );
        } else {
          this.logger.debug(
            `No event created for device ${device.deviceId} (heating OFF)`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to poll device ${device.deviceId}: ${error.message}`,
        error.stack,
      );
    }
  }

  async pollAll() {
    const devices = await this.prisma.thermostatDevice.findMany();
    this.logger.debug(`Polling ${devices.length} thermostat devices...`);
    for (const d of devices) {
      await this.pollDevice(d);
    }
  }

  @Cron('*/1 * * * *')
  handleCron() {
    this.logger.debug('Running thermostat polling cron...');
    this.pollAll();
  }
}
