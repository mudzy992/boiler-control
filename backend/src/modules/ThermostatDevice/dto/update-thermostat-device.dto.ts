import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  Min,
  ValidateIf,
} from 'class-validator';
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
  @ValidateIf((_dto, value) => value !== undefined)
  @IsEnum(ThermostatMode)
  mode?: ThermostatMode;

  @ApiPropertyOptional({ minLength: 1 })
  @ValidateIf((_dto, value) => value !== undefined)
  @Transform(preserveRawInput)
  @IsString()
  @IsNotEmpty()
  vendor?: string;

  @ApiPropertyOptional({ minLength: 1 })
  @ValidateIf((_dto, value) => value !== undefined)
  @Transform(preserveRawInput)
  @IsString()
  @IsNotEmpty()
  deviceId?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @ValidateIf((_dto, value) => value !== undefined)
  @Transform(preserveRawInput)
  @IsInt()
  @Min(1)
  homeProfileId?: number;
}
