import { IsEnum, IsOptional, IsString, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ThermostatMode } from 'src/generated/prisma';

export class UpdateThermostatDeviceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  alias?: string;

  @ApiPropertyOptional({ enum: ThermostatMode })
  @IsOptional()
  @IsEnum(ThermostatMode)
  mode?: ThermostatMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vendor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  homeProfileId?: number;
}
