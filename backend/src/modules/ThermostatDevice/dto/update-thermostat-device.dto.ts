import { IsEnum, IsOptional, IsString, IsNumber } from 'class-validator';
import { ThermostatMode } from '../../../generated/prisma/enums';

export class UpdateThermostatDeviceDto {
  @IsOptional()
  @IsString()
  alias?: string;

  @IsOptional()
  @IsEnum(ThermostatMode)
  mode?: ThermostatMode;

  @IsOptional()
  @IsString()
  vendor?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsNumber()
  homeProfileId?: number;
}
