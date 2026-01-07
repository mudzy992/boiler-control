import { IsEnum, IsOptional, IsString, IsNumber } from 'class-validator';
import { ThermostatMode } from '../../../generated/prisma/enums';

export class CreateThermostatDeviceDto {
  @IsString()
  vendor: string;

  @IsString()
  deviceId: string;

  @IsOptional()
  @IsString()
  alias?: string;

  @IsEnum(ThermostatMode)
  mode: ThermostatMode;

  @IsNumber()
  homeProfileId: number;
}
