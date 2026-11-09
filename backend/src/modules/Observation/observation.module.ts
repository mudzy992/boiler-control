import { Module } from '@nestjs/common';
import { ThermostatObservationService } from './thermostat-observation.service';

/**
 * Vremenska serija (`17` §13 korak 2). Izvozi samo pisca: seriju piše isključivo
 * on, iz već postojećeg minutnog pollinga.
 */
@Module({
  providers: [ThermostatObservationService],
  exports: [ThermostatObservationService],
})
export class ObservationModule {}
