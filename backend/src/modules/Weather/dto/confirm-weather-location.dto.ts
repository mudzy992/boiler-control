import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { IsString, Length } from 'class-validator';

// Globalni enableImplicitConversion ne smije pretvoriti ne-string u string prije
// @IsString; originalni tip polja mora ostati vidljiv validatoru.
const preserveRawInput = ({ obj, key }: TransformFnParams) =>
  obj[key] as unknown;

export class ConfirmWeatherLocationDto {
  @ApiProperty({ minLength: 2, maxLength: 100 })
  @Transform(preserveRawInput)
  @IsString()
  @Length(2, 100)
  query!: string;

  @ApiProperty({ minLength: 1, maxLength: 128 })
  @Transform(preserveRawInput)
  @IsString()
  @Length(1, 128)
  candidateId!: string;
}
