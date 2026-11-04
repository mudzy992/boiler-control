import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { IsString } from 'class-validator';

// Globalni enableImplicitConversion ne smije pretvoriti ne-string u string prije
// @IsString. Servis i dalje radi trim i 2-100 provjeru nakon owner lookupa.
const preserveRawInput = ({ obj, key }: TransformFnParams) =>
  obj[key] as unknown;

/** Runtime query za GET /api/weather/v2/locations/:homeProfileId. */
export class WeatherLocationQueryDto {
  @ApiProperty()
  @Transform(preserveRawInput)
  @IsString()
  query!: string;
}
