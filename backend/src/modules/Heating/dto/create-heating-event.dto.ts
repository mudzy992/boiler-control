import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { IsInt, IsNumber, Min } from 'class-validator';

// Globalni enableImplicitConversion ne smije null ili string pretvoriti u broj
// prije validacije. Ovaj JSON ugovor deklarira četiri stvarna brojčana polja.
const preserveRawInput = ({ obj, key }: TransformFnParams) =>
  obj[key] as unknown;

/** Runtime ulaz za POST /api/heating-events u oba stub režima. */
export class CreateHeatingEventDto {
  @ApiProperty({ example: 1, minimum: 1 })
  @Transform(preserveRawInput)
  @IsInt()
  @Min(1)
  deviceId: number;

  @ApiProperty({ example: 21 })
  @Transform(preserveRawInput)
  @IsNumber()
  roomCurrentTemp: number;

  @ApiProperty({ example: 22 })
  @Transform(preserveRawInput)
  @IsNumber()
  roomTargetTemp: number;

  @ApiProperty({ example: 45 })
  @Transform(preserveRawInput)
  @IsNumber()
  roomFlowTemp: number;
}
