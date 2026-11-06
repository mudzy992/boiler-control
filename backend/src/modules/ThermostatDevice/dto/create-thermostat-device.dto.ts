import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Matches,
} from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ThermostatMode } from 'src/generated/prisma';

// Globalni enableImplicitConversion ne smije promijeniti raw JSON tip prije validacije.
const preserveRawInput = ({ obj, key }: TransformFnParams) => obj[key];

export class CreateThermostatDeviceDto {
  @ApiProperty({ minLength: 1, pattern: '\\S' })
  @Transform(preserveRawInput)
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  vendor: string;

  @ApiProperty({ minLength: 1, pattern: '\\S' })
  @Transform(preserveRawInput)
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  deviceId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(preserveRawInput)
  @IsString()
  alias?: string;

  @ApiProperty({ enum: ThermostatMode })
  @IsEnum(ThermostatMode)
  mode: ThermostatMode;

  @ApiProperty({ minimum: 1 })
  @Transform(preserveRawInput)
  @IsInt()
  @Min(1)
  homeProfileId: number;
}
