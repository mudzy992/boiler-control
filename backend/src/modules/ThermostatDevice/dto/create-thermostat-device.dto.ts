import { IsEnum, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ThermostatMode } from 'src/generated/prisma';

// Globalni enableImplicitConversion ne smije promijeniti raw JSON tip prije validacije.
const preserveRawInput = ({ obj, key }: TransformFnParams) => obj[key];

export class CreateThermostatDeviceDto {
  @ApiProperty()
  @Transform(preserveRawInput)
  @IsString()
  vendor: string;

  @ApiProperty()
  @Transform(preserveRawInput)
  @IsString()
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
