import { IsEnum, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ThermostatMode } from 'src/generated/prisma';

// Globalni enableImplicitConversion ne smije promijeniti raw JSON tip prije validacije.
const preserveRawInput = ({ obj, key }: TransformFnParams) => obj[key];

export class UpdateThermostatDeviceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(preserveRawInput)
  @IsString()
  alias?: string;

  @ApiPropertyOptional({ enum: ThermostatMode })
  @IsOptional()
  @IsEnum(ThermostatMode)
  mode?: ThermostatMode;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(preserveRawInput)
  @IsString()
  vendor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(preserveRawInput)
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Transform(preserveRawInput)
  @IsInt()
  @Min(1)
  homeProfileId?: number;
}
