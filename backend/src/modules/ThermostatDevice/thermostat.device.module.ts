import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ThermostatDeviceController } from './thermostat.device.controller';
import { ThermostatDeviceService } from './thermostat.device.service';

@Module({
  imports: [PrismaModule],
  controllers: [ThermostatDeviceController],
  providers: [ThermostatDeviceService],
})
export class ThermostatDeviceModule {}
