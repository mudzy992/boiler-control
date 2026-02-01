import { IsEnum, IsOptional, IsString, IsNumber } from 'class-validator';
import { ThermostatMode } from '../../../generated/prisma/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateThermostatDeviceDto {
  @ApiProperty()
  @IsString()
  vendor: string;

  @ApiProperty()
  @IsString()
  deviceId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  alias?: string;

  @ApiProperty({ enum: ThermostatMode })
  @IsEnum(ThermostatMode)
  mode: ThermostatMode;

  @ApiProperty()
  @IsNumber()
  homeProfileId: number;
}
